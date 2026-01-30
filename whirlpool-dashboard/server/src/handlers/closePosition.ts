import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    decreaseLiquidityQuoteByLiquidity,
    TokenExtensionUtil,
    IGNORE_CACHE,
    WhirlpoolIx
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";

export interface ClosePositionRequest {
    wallet: string;
    positionMint: string;
}

export interface ClosePositionResponse {
    success: boolean;
    serializedTransaction?: string;
    collectedFeeA?: string;
    collectedFeeB?: string;
    error?: string;
}

/**
 * Build transaction for closing an empty position.
 * This will collect any remaining fees and close the position.
 * Returns an unsigned transaction for client-side signing.
 */
export async function closePosition(request: ClosePositionRequest): Promise<ClosePositionResponse> {
    const connection = getConnection();
    const walletPubkey = new PublicKey(request.wallet);
    const positionMintPubkey = new PublicKey(request.positionMint);

    const dummyWallet = new Wallet({
        publicKey: walletPubkey,
        secretKey: new Uint8Array(64),
    } as any);

    const ctx = WhirlpoolContext.from(
        connection,
        dummyWallet
    );

    const client = buildWhirlpoolClient(ctx);

    try {
        // Fetch the position
        // Derive PDA from Position Mint
        const pda = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), positionMintPubkey.toBuffer()],
            ORCA_WHIRLPOOL_PROGRAM_ID
        )[0];

        // Fetch the position using PDA
        const position = await client.getPosition(pda);
        if (!position) {
            return {
                success: false,
                error: "Position does not exist",
            };
        }

        const positionData = position.getData();
        const whirlpool = await client.getPool(positionData.whirlpool);
        const whirlpoolData = whirlpool.getData();

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        // We chain instructions using the builders from SDK methods
        let txBuilder: any;

        // 1. Decrease Liquidity (if any)
        if (!positionData.liquidity.isZero()) {
            const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
                ctx.fetcher,
                whirlpoolData,
                IGNORE_CACHE
            );

            const quote = decreaseLiquidityQuoteByLiquidity(
                positionData.liquidity,
                Percentage.fromFraction(10, 1000), // 1% slippage
                position,
                whirlpool,
                tokenExtensionCtx
            );

            // Start with decrease liquidity builder
            txBuilder = await position.decreaseLiquidity(quote);

            // 2. Collect Fees
            // We need to merge collectFees instructions into this builder
            const collectTxBuilder = await position.collectFees();
            const collectBuild = await collectTxBuilder.build();

            // Add instructions and signers if any
            // Since txBuilder is from same SDK, adding instructions is safe
            if ('instructions' in collectBuild.transaction) {
                const instructions = collectBuild.transaction.instructions;
                instructions.forEach((ix: any) => txBuilder.addInstruction(ix));
            }
        } else {
            // Start with collect fees builder if no liquidity
            txBuilder = await position.collectFees();
        }

        // 3. Close Position
        // We append the close instruction manually
        const positionTokenAccount = getAssociatedTokenAddressSync(
            positionData.positionMint,
            walletPubkey
        );

        const closeIx = WhirlpoolIx.closePositionIx(
            ctx.program,
            {
                positionAuthority: walletPubkey,
                receiver: walletPubkey,
                position: position.getAddress(),
                positionMint: positionData.positionMint,
                positionTokenAccount: positionTokenAccount
            }
        );
        txBuilder.addInstruction(closeIx);

        // Build and Serialize
        const builtTx = await txBuilder.build();
        const { transaction, signers } = builtTx;

        if (transaction instanceof Transaction) {
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = walletPubkey;

            if (signers.length > 0) {
                transaction.partialSign(...signers);
            }
        } else {
            // VersionedTransaction
            if (signers.length > 0) {
                transaction.sign(signers);
            }
        }

        const serializedTx = transaction.serialize();

        return {
            success: true,
            serializedTransaction: Buffer.from(serializedTx).toString("base64"),
            collectedFeeA: positionData.feeOwedA.toString(),
            collectedFeeB: positionData.feeOwedB.toString(),
        };

    } catch (error: any) {
        console.error("Error in closePosition:", error);
        return {
            success: false,
            error: error.message || "Unknown error",
        };
    }
}

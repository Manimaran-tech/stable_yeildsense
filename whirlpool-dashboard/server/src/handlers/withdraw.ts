import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    decreaseLiquidityQuoteByLiquidity,
    TokenExtensionUtil,
    IGNORE_CACHE
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import BN from "bn.js";

export interface WithdrawRequest {
    wallet: string;
    positionMint: string;
    liquidity: string; // Amount of liquidity to withdraw
}

export interface WithdrawResponse {
    success: boolean;
    serializedTransaction?: string;
    estimatedTokenA?: string;
    estimatedTokenB?: string;
    error?: string;
}

/**
 * Build transaction for withdrawing liquidity from a position.
 * Returns an unsigned transaction for client-side signing.
 */
export async function withdraw(request: WithdrawRequest): Promise<WithdrawResponse> {
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
        // Derive PDA from Position Mint
        const pda = PublicKey.findProgramAddressSync(
            [Buffer.from("position"), positionMintPubkey.toBuffer()],
            ORCA_WHIRLPOOL_PROGRAM_ID
        )[0];

        console.log(`[withdraw] Use PDA: ${pda.toBase58()} for Mint: ${request.positionMint}`);

        // Fetch the position using PDA
        const position = await client.getPosition(pda);
        if (!position) {
            return {
                success: false,
                error: "Position does not exist",
            };
        }

        const positionData = position.getData();

        // Fetch the whirlpool
        const whirlpool = await client.getPool(positionData.whirlpool);
        const whirlpoolData = whirlpool.getData();

        // Parse liquidity amount to withdraw
        const liquidityToWithdraw = new BN(request.liquidity);

        // Build context for token extensions
        const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            whirlpoolData,
            IGNORE_CACHE
        );

        // Generate quote for decrease liquidity
        const quote = decreaseLiquidityQuoteByLiquidity(
            liquidityToWithdraw,
            Percentage.fromFraction(10, 1000), // 1% slippage
            position,
            whirlpool,
            tokenExtensionCtx
        );

        // Build decrease liquidity transaction
        const txBuilder = await position.decreaseLiquidity(quote);
        const builtTx = await txBuilder.build();

        const { transaction, signers } = builtTx;

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

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

        // Serialize transaction (unsigned by wallet)
        const serializedTx = transaction.serialize();

        return {
            success: true,
            serializedTransaction: Buffer.from(serializedTx).toString("base64"),
            estimatedTokenA: quote.tokenMinA.toString(),
            estimatedTokenB: quote.tokenMinB.toString(),
        };
    } catch (error: any) {
        console.error("Error in withdraw:", error);
        return {
            success: false,
            error: error.message || "Unknown error",
        };
    }
}

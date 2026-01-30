import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WhirlpoolIx,
    PDAUtil,
    TickUtil
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { TransactionBuilder } from "@orca-so/common-sdk";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export interface CollectFeesRequest {
    wallet: string;
    positionMint: string;
}

export interface CollectFeesResponse {
    success: boolean;
    serializedTransaction?: string;
    error?: string;
}

export async function collectFees(request: CollectFeesRequest): Promise<CollectFeesResponse> {
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

        const position = await client.getPosition(pda);
        const positionData = position.getData();
        const pool = await client.getPool(positionData.whirlpool);
        const poolData = pool.getData();

        // Get ATAs
        const positionTokenAccount = await getAssociatedTokenAddress(
            positionMintPubkey,
            walletPubkey
        );

        const tokenOwnerAccountA = await getAssociatedTokenAddress(
            poolData.tokenMintA,
            walletPubkey
        );

        const tokenOwnerAccountB = await getAssociatedTokenAddress(
            poolData.tokenMintB,
            walletPubkey
        );

        const txBuilder = new TransactionBuilder(ctx.connection, ctx.wallet);

        // Update fees and rewards
        const startTickLower = TickUtil.getStartTickIndex(positionData.tickLowerIndex, poolData.tickSpacing);
        const startTickUpper = TickUtil.getStartTickIndex(positionData.tickUpperIndex, poolData.tickSpacing);

        txBuilder.addInstruction(
            WhirlpoolIx.updateFeesAndRewardsIx(ctx.program, {
                whirlpool: positionData.whirlpool,
                position: position.getAddress(),
                tickArrayLower: PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, positionData.whirlpool, startTickLower).publicKey,
                tickArrayUpper: PDAUtil.getTickArray(ORCA_WHIRLPOOL_PROGRAM_ID, positionData.whirlpool, startTickUpper).publicKey,
            })
        );

        // Collect fees
        txBuilder.addInstruction(
            WhirlpoolIx.collectFeesIx(ctx.program, {
                whirlpool: positionData.whirlpool,
                positionAuthority: walletPubkey,
                position: position.getAddress(),
                positionTokenAccount,
                tokenOwnerAccountA,
                tokenOwnerAccountB,
                tokenVaultA: poolData.tokenVaultA,
                tokenVaultB: poolData.tokenVaultB,
            })
        );

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

        const serializedTx = transaction.serialize();

        return {
            success: true,
            serializedTransaction: Buffer.from(serializedTx).toString("base64"),
        };

    } catch (error: any) {
        console.error("Error in collectFees:", error);
        return {
            success: false,
            error: error.message || "Unknown error",
        };
    }
}

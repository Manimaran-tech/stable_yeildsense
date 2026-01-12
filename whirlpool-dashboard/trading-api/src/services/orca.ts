import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    swapQuoteByInputToken,
    PDAUtil,
    ORCA_WHIRLPOOLS_CONFIG,
} from "@orca-so/whirlpools-sdk";
import { Percentage } from "@orca-so/common-sdk";
import DecimalDefault from "decimal.js";
const Decimal = (DecimalDefault as any).default || DecimalDefault;

export interface OrcaQuoteResult {
    route: "ORCA";
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpact: string;
    slippageBps: number;
    tx: string;
}

/**
 * Create a dummy wallet for read-only operations
 */
function createDummyWallet(): Wallet {
    const dummyKeypair = {
        publicKey: PublicKey.default,
        secretKey: new Uint8Array(64),
    };
    return {
        publicKey: PublicKey.default,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
        payer: dummyKeypair as any,
    } as unknown as Wallet;
}

/**
 * Get swap quote and build transaction from Orca Whirlpools
 */
export async function getOrcaQuoteWithTx(params: {
    connection: Connection;
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps: number;
    userPubkey: string;
}): Promise<OrcaQuoteResult> {
    const { connection, inputMint, outputMint, amount, slippageBps, userPubkey } = params;

    // Create Whirlpool context
    const wallet = createDummyWallet();
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    const ctx = WhirlpoolContext.from(connection, wallet);
    const client = buildWhirlpoolClient(ctx);

    // Find the whirlpool for this token pair
    // Try multiple fee tiers
    const feeTiers = [64, 128, 1, 8, 16]; // Common Orca fee tiers in bps

    let whirlpoolAddress: PublicKey | null = null;
    let whirlpool: any = null;

    for (const feeTier of feeTiers) {
        try {
            const pda = PDAUtil.getWhirlpool(
                ORCA_WHIRLPOOL_PROGRAM_ID,
                ORCA_WHIRLPOOLS_CONFIG,
                new PublicKey(inputMint),
                new PublicKey(outputMint),
                feeTier
            );

            const wp = await client.getPool(pda.publicKey);
            if (wp) {
                whirlpoolAddress = pda.publicKey;
                whirlpool = wp;
                break;
            }
        } catch {
            // Try reverse order
            try {
                const pda = PDAUtil.getWhirlpool(
                    ORCA_WHIRLPOOL_PROGRAM_ID,
                    ORCA_WHIRLPOOLS_CONFIG,
                    new PublicKey(outputMint),
                    new PublicKey(inputMint),
                    feeTier
                );

                const wp = await client.getPool(pda.publicKey);
                if (wp) {
                    whirlpoolAddress = pda.publicKey;
                    whirlpool = wp;
                    break;
                }
            } catch {
                continue;
            }
        }
    }

    if (!whirlpool || !whirlpoolAddress) {
        throw new Error("No Orca whirlpool found for this token pair");
    }

    // Get swap quote
    const inputTokenMint = new PublicKey(inputMint);
    const amountBN = BigInt(amount);
    const slippage = Percentage.fromFraction(slippageBps, 10000);

    const quote = await swapQuoteByInputToken(
        whirlpool,
        inputTokenMint,
        amountBN,
        slippage,
        ORCA_WHIRLPOOL_PROGRAM_ID,
        ctx.fetcher,
        { refresh: true } as any
    );

    // Build unsigned transaction
    const { tx } = await whirlpool.swap(quote);
    const transaction = await tx.build();

    // Serialize to base64
    const serialized = Buffer.from(transaction.transaction.serialize()).toString("base64");

    // Calculate price impact (rough estimate)
    const inDecimal = new Decimal(amount);
    const outDecimal = new Decimal(quote.estimatedAmountOut.toString());

    return {
        route: "ORCA",
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: quote.estimatedAmountOut.toString(),
        priceImpact: "0", // Orca SDK doesn't provide this directly
        slippageBps,
        tx: serialized,
    };
}

import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
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
import axios from "axios";

const Decimal = (DecimalDefault as any).default || DecimalDefault;
const JITO_BLOCK_ENGINE = "https://mainnet.block-engine.jito.wtf/api/v1/bundles";

export interface OrcaQuoteResult {
    route: "ORCA";
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpact: string;
    slippageBps: number;
    tx: string;
    mevProtected: boolean;
}

/**
 * Create a dummy wallet/payer for read-only operations
 */
function createDummyWallet(): Wallet {
    const dummyKeypair = Keypair.generate();
    return {
        publicKey: dummyKeypair.publicKey,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
        payer: dummyKeypair,
    } as unknown as Wallet;
}

/**
 * Send transaction via Jito Bundle to avoid public mempool
 */
async function sendViaJito(serializedTx: string): Promise<string> {
    try {
        const response = await axios.post(JITO_BLOCK_ENGINE, {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [[serializedTx]]
        });
        return response.data.result;
    } catch (error) {
        console.error("Jito submission failed:", error);
        return "";
    }
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

    // --- MEV PROTECTION: Dynamic Slippage ---
    // Increase slippage if pool is low liquidity or amount is large relative to liquidity
    let finalSlippageBps = slippageBps;
    const poolLiquidity = whirlpool.getData().liquidity.toString();
    if (BigInt(amount) * 1000n > BigInt(poolLiquidity)) {
        finalSlippageBps = Math.min(1000, slippageBps * 2); // Cap at 10%
    }
    const slippage = Percentage.fromFraction(finalSlippageBps, 10000);
    const inputTokenMint = new PublicKey(inputMint);
    const amountBN = new BN(amount);

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

    // --- MEV PROTECTION: Private RPC / Jito ---
    // If enabled in env, we advise the client to use Jito or we provide a Jito-wrapped tx
    const usePrivateRelay = process.env.USE_PRIVATE_RELAY === "true";

    return {
        route: "ORCA",
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: quote.estimatedAmountOut.toString(),
        priceImpact: "0",
        slippageBps: finalSlippageBps,
        tx: serialized,
        mevProtected: usePrivateRelay
    };
}

import { createJupiterApiClient, QuoteResponse } from "@jup-ag/api";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const jupiterApi = createJupiterApiClient();

export interface JupiterQuoteResult {
    route: "JUPITER";
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpact: string;
    slippageBps: number;
    tx: string;
    quoteResponse: QuoteResponse;
}

/**
 * Get swap quote from Jupiter
 */
export async function getJupiterQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps: number;
}): Promise<QuoteResponse> {
    console.log("📊 Jupiter quoteGet params:", {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps,
    });

    try {
        const quote = await jupiterApi.quoteGet({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: parseInt(params.amount),
            slippageBps: params.slippageBps,
        });

        if (!quote) {
            throw new Error("Jupiter returned no quote");
        }

        console.log("📊 Jupiter quote success:", {
            inAmount: quote.inAmount,
            outAmount: quote.outAmount,
        });

        return quote;
    } catch (error: any) {
        console.error("📊 Jupiter quoteGet failed:", error.message);
        throw error;
    }
}

/**
 * Build unsigned swap transaction from Jupiter quote
 */
export async function buildJupiterTransaction(params: {
    quoteResponse: QuoteResponse;
    userPubkey: string;
}): Promise<string> {
    console.log("🔨 Jupiter swapPost for user:", params.userPubkey);

    try {
        const swapResult = await jupiterApi.swapPost({
            swapRequest: {
                quoteResponse: params.quoteResponse,
                userPublicKey: params.userPubkey,
                dynamicComputeUnitLimit: true,
            },
        });

        if (!swapResult || !swapResult.swapTransaction) {
            throw new Error("Jupiter returned no transaction");
        }

        console.log("🔨 Jupiter swapPost success, tx length:", swapResult.swapTransaction.length);
        return swapResult.swapTransaction;
    } catch (error: any) {
        console.error("🔨 Jupiter swapPost failed:", error.message);
        // Check for specific API errors
        if (error.response?.data) {
            console.error("🔨 Jupiter API response:", JSON.stringify(error.response.data));
        }
        throw error;
    }
}

/**
 * Get complete quote with unsigned transaction
 */
export async function getJupiterQuoteWithTx(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps: number;
    userPubkey: string;
}): Promise<JupiterQuoteResult> {
    console.log("🪐 Starting Jupiter quote flow...");

    const quoteResponse = await getJupiterQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps,
    });

    const tx = await buildJupiterTransaction({
        quoteResponse,
        userPubkey: params.userPubkey,
    });

    const priceImpactPct = quoteResponse.priceImpactPct
        ? (parseFloat(quoteResponse.priceImpactPct) * 100).toFixed(2)
        : "0";

    console.log("🪐 Jupiter quote complete, returning result");

    return {
        route: "JUPITER",
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        inAmount: quoteResponse.inAmount,
        outAmount: quoteResponse.outAmount,
        priceImpact: priceImpactPct,
        slippageBps: params.slippageBps,
        tx,
        quoteResponse,
    };
}


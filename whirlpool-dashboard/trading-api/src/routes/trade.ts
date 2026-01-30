import { Router, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { getJupiterQuoteWithTx } from "../services/jupiter.js";
import { getOrcaQuoteWithTx } from "../services/orca.js";
import { isValidMint, isValidAmount, clampSlippage } from "../utils/validation.js";

const router = Router();

// RPC connection (initialized on first request)
let connection: Connection | null = null;

function getConnection(): Connection {
    if (!connection) {
        const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
        connection = new Connection(rpcUrl, "confirmed");
    }
    return connection;
}

/**
 * GET /trade/quote
 * Get swap quote with price impact and unsigned transaction
 * 
 * Query params:
 * - inputMint: Input token mint address
 * - outputMint: Output token mint address
 * - amount: Amount in smallest units (lamports for SOL)
 * - slippageBps: (optional) Slippage tolerance in basis points
 * - userPubkey: User's wallet public key
 */
router.get("/quote", async (req: Request, res: Response) => {
    try {
        const { inputMint, outputMint, amount, slippageBps, userPubkey } = req.query;

        console.log("📥 Quote request:", {
            inputMint,
            outputMint,
            amount,
            slippageBps,
            userPubkey,
        });

        // Validate inputs
        if (!inputMint || !outputMint || !amount || !userPubkey) {
            console.log("❌ Missing required parameters");
            return res.status(400).json({
                error: "Missing required parameters: inputMint, outputMint, amount, userPubkey",
            });
        }

        if (!isValidMint(inputMint as string)) {
            console.log("❌ Invalid inputMint:", inputMint);
            return res.status(400).json({ error: "Invalid inputMint address" });
        }

        if (!isValidMint(outputMint as string)) {
            console.log("❌ Invalid outputMint:", outputMint);
            return res.status(400).json({ error: "Invalid outputMint address" });
        }

        if (!isValidAmount(amount as string)) {
            console.log("❌ Invalid amount:", amount);
            return res.status(400).json({ error: "Invalid amount" });
        }

        if (!isValidMint(userPubkey as string)) {
            console.log("❌ Invalid userPubkey:", userPubkey);
            return res.status(400).json({ error: "Invalid userPubkey address" });
        }

        console.log("✅ All inputs validated");

        // Clamp slippage
        const maxSlippage = parseInt(process.env.MAX_SLIPPAGE_BPS || "500");
        const finalSlippage = clampSlippage(
            parseInt(slippageBps as string) || 50,
            maxSlippage
        );

        // Try Jupiter first, fallback to Orca
        try {
            console.log("🪐 Trying Jupiter for swap quote...");
            const result = await getJupiterQuoteWithTx({
                inputMint: inputMint as string,
                outputMint: outputMint as string,
                amount: amount as string,
                slippageBps: finalSlippage,
                userPubkey: userPubkey as string,
            });
            console.log("✅ Jupiter quote successful");
            return res.json(result);
        } catch (jupiterError: any) {
            console.log(`⚠️ Jupiter failed: ${jupiterError.message}, trying Orca...`);

            try {
                const result = await getOrcaQuoteWithTx({
                    connection: getConnection(),
                    inputMint: inputMint as string,
                    outputMint: outputMint as string,
                    amount: amount as string,
                    slippageBps: finalSlippage,
                    userPubkey: userPubkey as string,
                });
                console.log("✅ Orca quote successful");
                return res.json(result);
            } catch (orcaError: any) {
                console.error("❌ Both Jupiter and Orca failed");
                return res.status(500).json({
                    error: "No route found",
                    details: {
                        jupiter: jupiterError.message,
                        orca: orcaError.message,
                    },
                });
            }
        }
    } catch (error: any) {
        console.error("❌ Unhandled quote error:", error.message);
        console.error("Stack:", error.stack);
        return res.status(500).json({
            error: error.message,
            type: "UNHANDLED_ERROR",
        });
    }
});

/**
 * POST /trade/build
 * Build (or rebuild) an unsigned swap transaction
 * 
 * Body:
 * - inputMint: Input token mint address
 * - outputMint: Output token mint address
 * - amount: Amount in smallest units
 * - slippageBps: Slippage tolerance in basis points
 * - userPubkey: User's wallet public key
 */
router.post("/build", async (req: Request, res: Response) => {
    try {
        const { inputMint, outputMint, amount, slippageBps, userPubkey } = req.body;

        // Validate inputs
        if (!inputMint || !outputMint || !amount || !userPubkey) {
            return res.status(400).json({
                error: "Missing required parameters: inputMint, outputMint, amount, userPubkey",
            });
        }

        // Clamp slippage
        const maxSlippage = parseInt(process.env.MAX_SLIPPAGE_BPS || "500");
        const finalSlippage = clampSlippage(slippageBps || 50, maxSlippage);

        // Try Jupiter first, fallback to Orca
        try {
            const result = await getJupiterQuoteWithTx({
                inputMint,
                outputMint,
                amount: amount.toString(),
                slippageBps: finalSlippage,
                userPubkey,
            });
            return res.json({ tx: result.tx, route: result.route });
        } catch {
            const result = await getOrcaQuoteWithTx({
                connection: getConnection(),
                inputMint,
                outputMint,
                amount: amount.toString(),
                slippageBps: finalSlippage,
                userPubkey,
            });
            return res.json({ tx: result.tx, route: result.route });
        }
    } catch (error: any) {
        console.error("Build error:", error);
        return res.status(500).json({ error: error.message });
    }
});

export default router;

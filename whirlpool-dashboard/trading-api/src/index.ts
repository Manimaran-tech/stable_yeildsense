import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tradeRouter from "./routes/trade.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// --- Routes ---

/**
 * Health check
 */
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "trading-api",
        timestamp: new Date().toISOString(),
    });
});

/**
 * Debug config (non-sensitive)
 */
app.get("/debug-config", (req, res) => {
    res.json({
        rpcUrl: process.env.RPC_URL ? "configured" : "default",
        maxSlippageBps: process.env.MAX_SLIPPAGE_BPS || "500",
        port,
    });
});

/**
 * Trade routes
 */
app.use("/trade", tradeRouter);

// --- Server Start ---

app.listen(port, () => {
    console.log(`🚀 Trading API listening at http://localhost:${port}`);
    console.log(`📡 RPC URL: ${process.env.RPC_URL || "default (mainnet)"}`);
    console.log(`⚙️  Max slippage: ${process.env.MAX_SLIPPAGE_BPS || "500"} bps`);
});

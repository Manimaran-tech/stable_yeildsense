import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// Singleton connection instance
let connection: Connection | null = null;

export function getConnection(): Connection {
    if (!connection) {
        connection = new Connection(RPC_URL, "confirmed");
        console.log(`📡 Connected to Solana RPC: ${RPC_URL}`);
    }
    return connection;
}

export function getWhirlpoolsProgramId(): string {
    return process.env.WHIRLPOOLS_PROGRAM_ID || "whirLbMiicVdio4qvUfM5KAg6Ct8WvpyZGfr3uctyc";
}

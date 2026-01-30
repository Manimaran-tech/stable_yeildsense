import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";

/**
 * Safely deserializes a transaction from a buffer or base64 string.
 * Attempts to deserialize as a VersionedTransaction first (V0), 
 * falling back to legacy Transaction if that fails.
 */
export const deserializeTransaction = (data: string | Buffer | Uint8Array): Transaction | VersionedTransaction => {
    const buffer = typeof data === 'string'
        ? Buffer.from(data, 'base64')
        : Buffer.from(data);

    try {
        // Attempt to deserialize as a Versioned Transaction (default for Orca SDK v0.17+)
        return VersionedTransaction.deserialize(buffer);
    } catch (error) {
        // Fallback to legacy Transaction
        try {
            return Transaction.from(buffer);
        } catch (legacyError) {
            console.error("Failed to deserialize transaction as Versioned or Legacy:", error, legacyError);
            throw new Error("Invalid transaction format");
        }
    }
};

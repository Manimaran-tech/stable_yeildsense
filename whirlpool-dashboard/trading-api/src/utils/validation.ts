import { PublicKey } from "@solana/web3.js";

/**
 * Validate a Solana public key (mint address)
 */
export function isValidMint(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Clamp slippage to a maximum value
 * @param slippageBps - User-requested slippage in basis points
 * @param maxBps - Maximum allowed slippage (default 500 = 5%)
 */
export function clampSlippage(slippageBps: number, maxBps: number = 500): number {
    if (!slippageBps || slippageBps < 0) return 50; // Default 0.5%
    return Math.min(slippageBps, maxBps);
}

/**
 * Common token mints for validation
 */
export const KNOWN_MINTS = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

/**
 * Check if an amount is valid (positive, finite)
 */
export function isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && isFinite(num) && num > 0;
}


export const TOKEN_MAP: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
    "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": "ORCA",
    "HzwqbKZw8JxJGd3sPMkmJC49Fp98W5J5XV7XE7t1W5k": "mSOL",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "Bonk",
    "JUPyiwrYJFskUPiHa7hkeR8VUtkqj20HMNwjP8D3bdC": "JUP",
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
    "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": "RNDR",
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "WIF",
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "mSOL",
};

/**
 * Resolve a token mint address to a symbol.
 * Returns the symbol if known, otherwise a shortened address.
 */
export function resolveTokenSymbol(mint: string): string {
    if (TOKEN_MAP[mint]) {
        return TOKEN_MAP[mint];
    }

    // Fallback: Shorten the address
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

/**
 * Get display info for a positioned based on its token mints
 */
export function getPoolPair(mintA: string, mintB: string): { poolPair: string, tokenA: string, tokenB: string } {
    const symbolA = resolveTokenSymbol(mintA);
    const symbolB = resolveTokenSymbol(mintB);

    return {
        tokenA: symbolA,
        tokenB: symbolB,
        poolPair: `${symbolA}/${symbolB}`
    };
}

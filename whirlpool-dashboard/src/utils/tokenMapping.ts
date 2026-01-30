/**
 * Token Mapping Utility
 * Maps pool token symbols to ML model supported tokens
 */

// ML model supported tokens
export const ML_SUPPORTED_TOKENS = ['sol', 'jup', 'jupsol', 'pengu', 'usdt', 'usdc'] as const;
export type MLToken = typeof ML_SUPPORTED_TOKENS[number];

// Map various token symbol variations to normalized ML token names
const TOKEN_MAP: Record<string, MLToken> = {
    // SOL variations
    'sol': 'sol',
    'solana': 'sol',
    'wsol': 'sol',
    'wrapped sol': 'sol',

    // JUP variations
    'jup': 'jup',
    'jupiter': 'jup',

    // JUPSOL variations
    'jupsol': 'jupsol',
    'jupiterstakedsol': 'jupsol',

    // PENGU variations
    'pengu': 'pengu',
    'pudgypenguins': 'pengu',

    // USDT variations
    'usdt': 'usdt',
    'tether': 'usdt',

    // USDC variations
    'usdc': 'usdc',
    'usdcoin': 'usdc',
};

/**
 * Convert a pool token symbol to the ML model token name
 * @param symbol - Token symbol from the pool (e.g., "SOL", "JupSOL")
 * @returns Normalized ML token name or null if not supported
 */
export function toMLToken(symbol: string): MLToken | null {
    const normalized = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    return TOKEN_MAP[normalized] || null;
}

/**
 * Check if a token is supported by the ML models
 * @param symbol - Token symbol to check
 * @returns True if supported by ML models
 */
export function isMLSupported(symbol: string): boolean {
    return toMLToken(symbol) !== null;
}

/**
 * Get both tokens mapped for a pool pair
 * @param tokenA - First token symbol
 * @param tokenB - Second token symbol
 * @returns Object with mapped tokens or null values for unsupported tokens
 */
export function mapPoolTokens(tokenA: string, tokenB: string): {
    mlTokenA: MLToken | null;
    mlTokenB: MLToken | null;
    bothSupported: boolean;
} {
    const mlTokenA = toMLToken(tokenA);
    const mlTokenB = toMLToken(tokenB);
    return {
        mlTokenA,
        mlTokenB,
        bothSupported: mlTokenA !== null && mlTokenB !== null
    };
}

/**
 * Get display name for recommendation
 */
export function getRecommendationDisplay(recommendation: string): {
    label: string;
    color: string;
    bgColor: string;
} {
    switch (recommendation) {
        case 'SAFE_TO_FARM':
            return { label: 'Safe to Farm', color: 'text-green-400', bgColor: 'bg-green-500/20' };
        case 'MODERATE_FARM':
            return { label: 'Moderate Risk', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
        case 'HIGH_RISK_FARM':
            return { label: 'High Risk', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
        case 'DO_NOT_FARM':
            return { label: 'Not Recommended', color: 'text-red-400', bgColor: 'bg-red-500/20' };
        default:
            return { label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted/20' };
    }
}

/**
 * Get signal display properties
 */
export function getSignalDisplay(signal: string): {
    label: string;
    color: string;
    icon: string;
} {
    switch (signal) {
        case 'BUY':
            return { label: 'BUY', color: 'text-green-400', icon: '↗' };
        case 'HOLD':
            return { label: 'HOLD', color: 'text-yellow-400', icon: '→' };
        case 'AVOID':
            return { label: 'AVOID', color: 'text-red-400', icon: '↘' };
        default:
            return { label: 'N/A', color: 'text-muted-foreground', icon: '?' };
    }
}

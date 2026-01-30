/**
 * Staking Service - Fetches real-time staking APY data
 * Provides staking yields for Solana LSTs (JupSOL, mSOL, jitoSOL, bSOL)
 */

export interface LSTAPYData {
    base_apy: number;
    mev_boost: number;
    protocol_fee: number;
    total_apy: number;
    name: string;
    mint: string;
    features: string[];
}

export interface StakingAPYResponse {
    success: boolean;
    lsts: {
        jupSOL?: LSTAPYData;
        mSOL?: LSTAPYData;
        jitoSOL?: LSTAPYData;
        bSOL?: LSTAPYData;
    };
    base_staking_apy: number;
    source: string;
    last_updated: string;
}

export interface CombinedYield {
    staking_yield: number;
    lp_yield: number;
    total_yield: number;
    yield_boost: number;
}

// Cache for staking data
let stakingCache: StakingAPYResponse | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const ML_API_URL = 'https://aguishly-ascertainable-londyn.ngrok-free.dev';

/**
 * Check if a token is a liquid staking token
 */
export function isLSTToken(token: string): boolean {
    const lstTokens = ['jupsol', 'msol', 'jitosol', 'bsol'];
    return lstTokens.includes(token.toLowerCase().replace('-', '').replace('_', ''));
}

/**
 * Get normalized LST key
 */
export function getLSTKey(token: string): string | null {
    const tokenLower = token.toLowerCase().replace('-', '').replace('_', '');
    const mapping: Record<string, string> = {
        'jupsol': 'jupSOL',
        'msol': 'mSOL',
        'jitosol': 'jitoSOL',
        'bsol': 'bSOL'
    };
    return mapping[tokenLower] || null;
}

/**
 * Fetch staking APY for all LSTs
 */
export async function getAllStakingAPY(): Promise<StakingAPYResponse | null> {
    const now = Date.now();

    // Return cached data if valid
    if (stakingCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return stakingCache;
    }

    try {
        console.log('Staking Service: Fetching APY data from ML API...');
        const response = await fetch(`${ML_API_URL}/api/staking/apy`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                stakingCache = data;
                cacheTimestamp = now;
                console.log('Staking Service: APY data fetched successfully');
                return data;
            }
        }
    } catch (error) {
        console.warn('Staking Service: Failed to fetch APY:', error);
    }

    // Return cached data even if stale
    if (stakingCache) {
        console.log('Staking Service: Using stale cache');
        return stakingCache;
    }

    // No fallback - return null if API is unavailable
    console.warn('Staking Service: No data available (API down and no cache)');
    return null;
}

/**
 * Get staking APY for a specific LST token
 */
export async function getTokenStakingAPY(token: string): Promise<LSTAPYData | null> {
    if (!isLSTToken(token)) {
        return null;
    }

    const lstKey = getLSTKey(token);
    if (!lstKey) {
        return null;
    }

    const allAPY = await getAllStakingAPY();
    if (!allAPY || !allAPY.lsts) {
        return null;
    }

    return allAPY.lsts[lstKey as keyof typeof allAPY.lsts] || null;
}

/**
 * Calculate combined yield from staking + LP
 */
export function calculateCombinedYield(stakingAPY: number, lpAPY: number): CombinedYield {
    const total = stakingAPY + lpAPY;
    const maxSingle = Math.max(stakingAPY, lpAPY);

    return {
        staking_yield: Math.round(stakingAPY * 100) / 100,
        lp_yield: Math.round(lpAPY * 100) / 100,
        total_yield: Math.round(total * 100) / 100,
        yield_boost: maxSingle > 0
            ? Math.round((total / maxSingle - 1) * 1000) / 10
            : 0
    };
}

/**
 * Format APY for display
 */
export function formatAPY(apy: number): string {
    return `${apy.toFixed(2)}%`;
}

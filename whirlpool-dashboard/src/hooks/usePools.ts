import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

// Import realtime context - will be available after App.tsx wraps with RealtimeProvider
let useRealtime: () => { lastPoolUpdate: number } | null = () => null;
try {
    const context = require('../context/RealtimeContext');
    useRealtime = context.useRealtime;
} catch {
    // Context not available yet
}

export interface PoolData {
    address: string;
    tokenA: string;
    tokenB: string;
    liquidity: string;
    price: string;
    feeTier: number;
    tickSpacing: number;
}

const POPULAR_POOLS = [
    {
        // SOL/USDC Whirlpool (64 tick spacing, 0.01% fee)
        address: "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
        tokenA: "SOL",
        tokenB: "USDC",
        feeTier: 0.01,
        decimalsA: 9,
        decimalsB: 6
    },
    {
        // SOL/USDC Whirlpool (128 tick spacing, 0.04% fee) - more popular
        address: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
        tokenA: "SOL",
        tokenB: "USDC",
        feeTier: 0.04,
        decimalsA: 9,
        decimalsB: 6
    },
    {
        // JupSOL/SOL Whirlpool
        address: "DtYKbQELgMZ3ihFUrCcCs9gy4djcUuhwgR7UpxVpP2Tg",
        tokenA: "JupSOL",
        tokenB: "SOL",
        feeTier: 0.01,
        decimalsA: 9,
        decimalsB: 9
    },
    {
        // PENGU/SOL Whirlpool (SOL is tokenA in this pool)
        address: "GF8T9bW7oJr5s4zL9Ai8yMwxx5MHm45G7BvArBkfjGJV",
        tokenA: "SOL",
        tokenB: "PENGU",
        feeTier: 0.30,
        decimalsA: 9,
        decimalsB: 6
    },
    {
        // JUP/SOL Whirlpool
        address: "C1MgLojNLWBKADvu9BHdtgzz1oZX4dZ5zGdGcgvvW8Wz",
        tokenA: "JUP",
        tokenB: "SOL",
        feeTier: 0.30,
        decimalsA: 6,
        decimalsB: 9
    }
];

export const usePools = () => {
    const [pools, setPools] = useState<PoolData[]>(POPULAR_POOLS.map(p => ({
        address: p.address,
        tokenA: p.tokenA,
        tokenB: p.tokenB,
        liquidity: "Loading...",
        price: "Loading...",
        feeTier: p.feeTier,
        tickSpacing: 64
    })));
    const [loading, setLoading] = useState(true);
    const lastFetchRef = useRef<number>(0);

    // Try to get realtime context
    let lastPoolUpdate = 0;
    try {
        const realtimeContext = useRealtime();
        if (realtimeContext) {
            lastPoolUpdate = realtimeContext.lastPoolUpdate;
        }
    } catch {
        // Context not available
    }

    const fetchPools = useCallback(async () => {
        // Debounce - don't fetch if we fetched less than 5 seconds ago
        const now = Date.now();
        if (now - lastFetchRef.current < 5000) {
            return;
        }
        lastFetchRef.current = now;

        setLoading(true);

        try {


            // Batch fetch all pools in one request
            try {
                const addresses = POPULAR_POOLS.map(p => p.address);
                const results = await api.getPools(addresses);

                const fetchedPools: PoolData[] = [];

                results.forEach((data, index) => {
                    if (!data) return;

                    const poolInfo = POPULAR_POOLS[index];
                    const price = parseFloat(data.price);

                    fetchedPools.push({
                        address: poolInfo.address,
                        tokenA: poolInfo.tokenA,
                        tokenB: poolInfo.tokenB,
                        liquidity: formatLiquidity(data.liquidity),
                        price: `$${price.toFixed(4)}`,
                        feeTier: poolInfo.feeTier,
                        tickSpacing: data.tickSpacing
                    });
                });

                if (fetchedPools.length > 0) {
                    setPools(fetchedPools);
                } else {
                    setPools(prev => prev.map(p => ({ ...p, price: "Unavailable" })));
                }
            } catch (error) {
                console.error("usePools: Error fetching pools batch:", error);
                setPools(prev => prev.map(p => ({ ...p, price: "Error" })));
            }

        } catch (error) {
            console.error("usePools: Error fetching pools:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchPools();
    }, [fetchPools]);

    // Refresh when WebSocket triggers an update
    useEffect(() => {
        if (lastPoolUpdate > 0) {
            console.log("usePools: WebSocket triggered refresh");
            lastFetchRef.current = 0; // Reset debounce for WS updates
            fetchPools();
        }
    }, [lastPoolUpdate, fetchPools]);

    return { pools, loading };
};

/**
 * Format large liquidity numbers for display
 */
function formatLiquidity(liquidity: string): string {
    try {
        const num = BigInt(liquidity);
        if (num > BigInt(1_000_000_000_000)) {
            return `${(Number(num / BigInt(1_000_000_000_000))).toFixed(2)}T`;
        }
        if (num > BigInt(1_000_000_000)) {
            return `${(Number(num / BigInt(1_000_000_000))).toFixed(2)}B`;
        }
        if (num > BigInt(1_000_000)) {
            return `${(Number(num / BigInt(1_000_000))).toFixed(2)}M`;
        }
        return liquidity;
    } catch {
        return liquidity;
    }
}

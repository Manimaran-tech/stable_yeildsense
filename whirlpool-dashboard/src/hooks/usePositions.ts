import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../api';

// Import realtime context - will be available after App.tsx wraps with RealtimeProvider
let useRealtime: () => { lastPositionUpdate: number } | null = () => null;
try {
    // Dynamic import to avoid circular dependency during initial load
    const context = require('../context/RealtimeContext');
    useRealtime = context.useRealtime;
} catch {
    // Context not available yet, will use fallback
}

export interface PositionData {
    address: string;
    positionMint: string;
    whirlpoolAddress: string;
    poolPair: string;
    tickLowerIndex: number;
    tickUpperIndex: number;
    minPrice: string;
    maxPrice: string;
    currentPrice: string;
    liquidity: string;
    tokenAAmount: string;
    tokenBAmount: string;
    inRange: boolean;
    unclaimedFeesA: string;
    unclaimedFeesB: string;
    tokenA: string;
    tokenB: string;
    yield24h?: string;
}

export const usePositions = () => {
    const { publicKey } = useWallet();
    const [positions, setPositions] = useState<PositionData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastFetchRef = useRef<number>(0);

    // Try to get realtime context (may not be available during initial render)
    let lastPositionUpdate = 0;
    try {
        const realtimeContext = useRealtime();
        if (realtimeContext) {
            lastPositionUpdate = realtimeContext.lastPositionUpdate;
        }
    } catch {
        // Context not available, ignore
    }

    const fetchPositions = useCallback(async () => {
        if (!publicKey) {
            setPositions([]);
            return;
        }

        // Debounce - don't fetch if we fetched less than 2 seconds ago
        const now = Date.now();
        if (now - lastFetchRef.current < 2000) {
            return;
        }
        lastFetchRef.current = now;

        setLoading(true);
        setError(null);

        try {
            console.log("usePositions: Fetching positions from backend for wallet:", publicKey.toString());
            const data = await api.getPositions(publicKey.toString());

            if (!Array.isArray(data)) {
                console.error("usePositions: API returned non-array data:", data);
                setError("Invalid data from server");
                setPositions([]);
                return;
            }

            const fetchedPositions: PositionData[] = data.map(pos => ({
                address: pos.positionAddress,
                positionMint: pos.positionMint,
                whirlpoolAddress: pos.whirlpoolAddress,
                poolPair: pos.poolPair || 'Unknown',
                tickLowerIndex: pos.tickLowerIndex,
                tickUpperIndex: pos.tickUpperIndex,
                minPrice: pos.minPrice,
                maxPrice: pos.maxPrice,
                currentPrice: pos.currentPrice,
                liquidity: formatLiquidity(pos.liquidity),
                tokenAAmount: pos.tokenAAmount,
                tokenBAmount: pos.tokenBAmount,
                inRange: pos.inRange,
                unclaimedFeesA: pos.feeOwedA,
                unclaimedFeesB: pos.feeOwedB,
                tokenA: pos.tokenA,
                tokenB: pos.tokenB,
                yield24h: calculateYield(pos) // Calculate yield here
            }));

            console.log(`usePositions: Found ${fetchedPositions.length} Whirlpool position(s)`);
            setPositions(fetchedPositions);
        } catch (err) {
            console.error("usePositions: Error fetching positions:", err);
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [publicKey]);

    // Initial fetch on mount
    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    // Refresh when WebSocket triggers an update
    useEffect(() => {
        if (lastPositionUpdate > 0) {
            console.log("usePositions: WebSocket triggered refresh");
            fetchPositions();
        }
    }, [lastPositionUpdate, fetchPositions]);

    const refresh = useCallback(() => {
        lastFetchRef.current = 0; // Reset debounce
        fetchPositions();
    }, [fetchPositions]);

    return { positions, loading, error, refresh };
};

// -------------------------------------------------------------------------
// YIELD CALCULATION ENGINE
// -------------------------------------------------------------------------
function calculateYield(pos: any): string {
    try {
        // 1. Calculate Position Value (Approximate in USDC)
        // Assume Token A is usually the higher value one or try to just sum them if we assume $1 parity for simplicity 
        // OR better: use currentPrice if available. 
        // pos.tokenAAmount (decimal) * price? 
        // Assume Token A is usually the higher value one or try to just sum them if we assume $1 parity for simplicity
        // OR better: use currentPrice if available.
        // pos.tokenAAmount (decimal) * price?
        // Since we don't have separate prices easily here, we'll use a heuristic or just sum raw amounts if they are USDC-like.
        // For a more robust solution, we'd need real-time prices of Token A and B.
        // Let's assume the API 'totalValue' if it existed, otherwise 0.
        // But we DO have 'currentPrice'. Let's assume it's Price of A in terms of B?
        // Let's keep it simple: If we can't get value, return "0.00%".


        // WARNING: Debugging 0% yield
        // console.log(`[YieldCalc] Input: AmountA=${pos.tokenAAmount}, Price=${pos.currentPrice}, AmountB=${pos.tokenBAmount}, Liquidity=${pos.liquidity}`);

        const amountA = parseFloat(pos.tokenAAmount || '0');
        const price = parseFloat(pos.currentPrice || '0');
        const amountB = parseFloat(pos.tokenBAmount || '0');

        const positionValue = (amountA * price) + amountB;
        // console.log(`[YieldCalc] Position Value: $${positionValue}`);

        if (!positionValue || positionValue === 0) return "0.00%";

        // 2. Constants & Factors (from User Formula)
        // estimated24hFees = volumeInRange * feeRate * liquidityShare * timeInRange * volatilityPenalty * liquidityMigrationFactor

        // We don't have volumeInRange, so we'll estimate it from Pool Volume (mocked or usually available in full data)
        // For now, let's assume a standard volume for the pool or random for demo if data missing.
        const poolVolume24h = 1_000_000; // $1M daily volume (Sample)
        const feeRate = 0.003; // 0.3%

        // Liquidity Share = User Liquidity / Total Liquidity (Mocked Total)
        // pos.liquidity is string, need to parse BigInt or float
        const userLiquidity = parseFloat(pos.liquidity || '0'); // Simplified
        const totalPoolLiquidity = Math.max(userLiquidity * 1000, 10_000_000); // Avoid div by zero. Assume pool is 1000x user or min base.
        const liquidityShare = userLiquidity / totalPoolLiquidity;

        // Factors
        const timeInRange = pos.inRange ? 0.95 : 0.0; // 95% if currently in range
        const volatilityPenalty = 0.85; // 15% penalty
        const liquidityMigrationFactor = 0.90; // 10% migration impact

        // 3. Execute Formula
        const estimated24hFees = poolVolume24h
            * feeRate
            * liquidityShare
            * timeInRange
            * volatilityPenalty
            * liquidityMigrationFactor;

        // console.log(`[YieldCalc] Est Fees: $${estimated24hFees}, Share: ${liquidityShare}`);

        const yieldPercent = (estimated24hFees / positionValue) * 100;
        // console.log(`[YieldCalc] Result: ${yieldPercent}%`);

        return yieldPercent.toFixed(2) + "%";
    } catch (e) {
        console.warn("Yield Calc Error:", e);
        return "0.00%";
    }
}

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
        if (num > BigInt(1_000)) {
            return `${(Number(num / BigInt(1_000))).toFixed(2)}K`;
        }
        return liquidity;
    } catch {
        return liquidity;
    }
}

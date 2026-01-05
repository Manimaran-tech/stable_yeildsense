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

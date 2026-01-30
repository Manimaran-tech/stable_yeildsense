import { Request, Response } from "express";

// Simple in-memory cache
const historyCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function getMarketHistory(req: Request, res: Response) {
    const { days = "1", coinId = "solana" } = req.query;
    const cacheKey = `${coinId}-${days}`;

    const now = Date.now();
    const cached = historyCache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
        return res.json(cached.data);
    }

    try {
        console.log(`[getMarketHistory] Fetching CoinGecko for ${coinId} (${days} days)...`);
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
            { signal: AbortSignal.timeout(10000) }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko error: ${response.status}`);
        }

        const data = await response.json();
        const prices = data.prices.map((item: [number, number]) => ({
            time: item[0],
            price: item[1]
        }));

        historyCache.set(cacheKey, { data: prices, timestamp: now });
        console.log(`[getMarketHistory] Cached ${prices.length} points for ${coinId}`);
        res.json(prices);
    } catch (error: any) {
        console.error(`[getMarketHistory] Error:`, error.message);

        // Return cached data if available (even if expired)
        if (cached) {
            console.log(`[getMarketHistory] Returning stale cache for ${coinId}`);
            return res.json(cached.data);
        }

        res.status(500).json({ error: `Failed to fetch history for ${coinId}` });
    }
}

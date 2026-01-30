/**
 * Price Service - Fetches real-time token prices
 * Uses CoinGecko API (more reliable CORS support) with Jupiter as fallback
 */

export interface TokenPrice {
    id: string;
    symbol: string;
    price: number;
}

// Simple in-memory cache
let priceCache: { solPrice: number; timestamp: number } = {
    solPrice: 0,
    timestamp: 0,
};
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetch SOL price from CoinGecko (primary) or Jupiter (fallback)
 */
export async function getSOLPrice(): Promise<number> {
    const now = Date.now();

    // Return cached data if valid
    if (priceCache.solPrice > 0 && now - priceCache.timestamp < CACHE_DURATION) {
        return priceCache.solPrice;
    }

    // Try CoinGecko first (simpler API, better CORS support)
    try {
        console.log('Price Service: Fetching from CoinGecko...');
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
            {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }
        );

        if (response.ok) {
            const data = await response.json();
            const price = data.solana?.usd || 0;
            if (price > 0) {
                console.log('Price Service: Got SOL price from CoinGecko:', price);
                priceCache = { solPrice: price, timestamp: now };
                return price;
            }
        }
    } catch (error) {
        console.warn('Price Service: CoinGecko failed:', error);
    }

    // Fallback to Jupiter
    try {
        console.log('Price Service: Trying Jupiter fallback...');
        const response = await fetch(
            'https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112'
        );

        if (response.ok) {
            const data = await response.json();
            const price = data.data?.['So11111111111111111111111111111111111111112']?.price || 0;
            if (price > 0) {
                console.log('Price Service: Got SOL price from Jupiter:', price);
                priceCache = { solPrice: price, timestamp: now };
                return price;
            }
        }
    } catch (error) {
        console.warn('Price Service: Jupiter failed:', error);
    }

    // 3. Fallback to DexScreener
    try {
        const response = await fetch(
            'https://api.dexscreener.com/latest/dex/pairs/solana/JUPyiwrYJFskUPiHa7hkeR8VUtkPHCLkdPwmRP89ps' // JUP/SOL pair
        );
        if (response.ok) {
            const data = await response.json();
            const pair = data.pair;
            if (pair) {
                // specific pair logic was incomplete/unused, skipping to search fallback
            }
        }

        // Simpler: Search for SOL
        const searchRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL%2FUSDC');
        if (searchRes.ok) {
            const data = await searchRes.json();
            const pair = data.pairs?.find((p: any) => p.baseToken.symbol === 'SOL' && p.quoteToken.symbol === 'USDC');
            if (pair) {
                const price = parseFloat(pair.priceUsd);
                if (price > 0) {
                    console.log('Price Service: Got SOL price from DexScreener:', price);
                    priceCache = { solPrice: price, timestamp: now };
                    return price;
                }
            }
        }

    } catch (error) {
        console.warn('Price Service: DexScreener SOL fallback failed:', error);
    }

    // Return cached value if available (even if stale), otherwise return 0
    console.log('Price Service: All APIs failed, returning cached/default value');
    return priceCache.solPrice || 0;
}

/**
 * Fetch price for a specific token symbol from Jupiter
 */
export async function getTokenPrice(symbol: string): Promise<number> {
    if (!symbol) return 0;

    // Use specialized SOL fetcher if applicable
    if (symbol === 'SOL' || symbol === 'So11111111111111111111111111111111111111112') {
        const solPrice = await getSOLPrice();
        if (solPrice > 0) return solPrice;
        // If that fails, fall through to generic logic (DexScreener etc)
    }

    // Normalize symbol for common tokens
    const querySymbol = symbol === 'JupSOL' ? 'JupSOL' : symbol.toUpperCase();

    // 1. Try Jupiter first
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Jupiter handles most Solana tokens by symbol or address
        const response = await fetch(
            `https://price.jup.ag/v6/price?ids=${querySymbol}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const price = data.data?.[querySymbol]?.price || 0;
            if (price > 0) {
                return price;
            }
        }
    } catch (error) {
        console.warn(`Price Service: Jupiter failed for ${symbol}:`, error);
    }

    // 2. Fallback to CoinGecko (using manual mapping if available)
    try {
        // Simple mapping for common missing tokens
        const geckoIds: Record<string, string> = {
            'PENGU': 'pudgy-penguins',
            'JUP': 'jupiter-exchange-solana',
            'JUPSOL': 'jupiter-staked-sol',
            'WIF': 'dogwifhat',
            'BONK': 'bonk'
        };

        const geckoId = geckoIds[symbol.toUpperCase()] || symbol.toLowerCase();

        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`
        );

        if (response.ok) {
            const data = await response.json();
            const price = data[geckoId]?.usd || 0;
            if (price > 0) return price;
        }
    } catch (e) {
        console.warn(`Price Service: CoinGecko fallback failed for ${symbol}`, e);
    }

    // 3. Fallback to DexScreener (Search by symbol)
    try {
        const response = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${symbol}`
        );

        if (response.ok) {
            const data = await response.json();
            // Find the most liquid pair for this token
            if (data.pairs && data.pairs.length > 0) {
                // Filter for pairs on Solana to be safe
                const solPairs = data.pairs.filter((p: any) => p.chainId === 'solana');
                const bestPair = solPairs.length > 0 ? solPairs[0] : data.pairs[0];

                const price = parseFloat(bestPair.priceUsd);
                if (price > 0) {
                    console.log(`Price Service: DexScreener found price for ${symbol}: ${price}`);
                    return price;
                }
            }
        }
    } catch (e) {
        console.warn(`Price Service: DexScreener fallback failed for ${symbol}`, e);
    }

    return 0;
}

/**
 * Get multiple token prices
 */
export async function getTokenPrices(): Promise<{ solPrice: number; usdcPrice: number }> {
    const solPrice = await getSOLPrice();
    return {
        solPrice,
        usdcPrice: 1, // USDC is always ~$1
    };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 2): string {
    if (price >= 1000000) {
        return `$${(price / 1000000).toFixed(decimals)}M`;
    }
    if (price >= 1000) {
        return `$${(price / 1000).toFixed(decimals)}K`;
    }
    return `$${price.toFixed(decimals)}`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
}

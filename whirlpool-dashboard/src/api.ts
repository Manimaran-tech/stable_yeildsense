const BACKEND_URL = 'https://yieldsense-backend-a8c2.onrender.com';

export interface PositionInfo {
    positionMint: string;
    positionAddress: string;
    whirlpoolAddress: string;
    tickLowerIndex: number;
    tickUpperIndex: number;
    liquidity: string;
    tokenAAmount: string;
    tokenBAmount: string;
    feeOwedA: string;
    feeOwedB: string;
    symbolA?: string;
    symbolB?: string;
    price?: string;
    minPrice: string;
    maxPrice: string;
    currentPrice: string;
    inRange: boolean;
    poolPair: string;
    tokenA: string;
    tokenB: string;
}

export interface TransactionResponse {
    success: boolean;
    serializedTransaction: string;
    error?: string;
    positionMint?: string;
}

export const api = {
    async getPositions(wallet: string): Promise<PositionInfo[]> {
        const response = await fetch(`${BACKEND_URL}/api/positions/${wallet}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch positions: ${response.statusText}`);
        }
        return response.json();
    },

    async createOrDeposit(params: {
        wallet: string,
        whirlpool: string,
        tickLower?: number,
        tickUpper?: number,
        priceLower?: string,
        priceUpper?: string,
        amountA: string,
        amountB?: string
    }): Promise<TransactionResponse> {
        const response = await fetch(`${BACKEND_URL}/api/position/create-or-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        return response.json();
    },

    async withdraw(params: {
        wallet: string,
        positionMint: string,
        liquidity: string
    }): Promise<TransactionResponse> {
        const response = await fetch(`${BACKEND_URL}/api/position/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        return response.json();
    },

    async closePosition(params: {
        wallet: string,
        positionMint: string
    }): Promise<TransactionResponse> {
        const response = await fetch(`${BACKEND_URL}/api/position/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        return response.json();
    },

    async collectFees(params: {
        wallet: string,
        positionMint: string
    }): Promise<TransactionResponse> {
        const response = await fetch(`${BACKEND_URL}/api/position/collect-fees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        return response.json();
    },

    async getPool(address: string): Promise<any> {
        const response = await fetch(`${BACKEND_URL}/api/pool/${address}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch pool: ${response.statusText}`);
        }
        return response.json();
    },

    async getPools(addresses: string[]): Promise<any[]> {
        const response = await fetch(`${BACKEND_URL}/api/pools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses })
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch pools: ${response.statusText}`);
        }
        return response.json();
    },

    async getMarketHistory(days: string = '1'): Promise<any> {
        const response = await fetch(`${BACKEND_URL}/api/market/history?days=${days}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch market history: ${response.statusText}`);
        }
        return response.json();
    },

    async getLiquidityDistribution(address: string): Promise<any> {
        const response = await fetch(`${BACKEND_URL}/api/pool/${address}/liquidity`);
        if (!response.ok) {
            throw new Error(`Failed to fetch liquidity distribution: ${response.statusText}`);
        }
        return response.json();
    },

    async getYieldHistory(address: string): Promise<any> {
        const response = await fetch(`${BACKEND_URL}/api/pool/${address}/yield`);
        if (!response.ok) {
            throw new Error(`Failed to fetch yield history: ${response.statusText}`);
        }
        return response.json();
    }
};

// --- Trading API (separate backend on port 3002) ---

const TRADING_API_URL = 'https://yieldsense-trading-api-a8c2.onrender.com';

export interface SwapQuote {
    route: 'JUPITER' | 'ORCA';
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpact: string;
    slippageBps: number;
    tx: string;
}

export const tradingApi = {
    async getQuote(params: {
        inputMint: string;
        outputMint: string;
        amount: string;
        slippageBps?: number;
        userPubkey: string;
    }): Promise<SwapQuote> {
        const queryParams = new URLSearchParams({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: params.amount,
            slippageBps: (params.slippageBps || 50).toString(),
            userPubkey: params.userPubkey,
        });

        const response = await fetch(`${TRADING_API_URL}/trade/quote?${queryParams}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || 'Failed to get quote');
        }
        return response.json();
    },

    async buildTx(params: {
        inputMint: string;
        outputMint: string;
        amount: string;
        slippageBps?: number;
        userPubkey: string;
    }): Promise<{ tx: string; route: string }> {
        const response = await fetch(`${TRADING_API_URL}/trade/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || 'Failed to build transaction');
        }
        return response.json();
    },
};

// ==========================
// ML API CLIENT
// ==========================
const ML_API_URL = 'http://127.0.0.1:8000';

export interface MLQuickAnalysis {
    success: boolean;
    token_a: {
        symbol: string;
        current_price: number;
        predicted_price: number;
        lower_bound: number;
        upper_bound: number;
        range_width_pct: number;
        safety_score: number;
    };
    token_b: {
        symbol: string;
        current_price: number;
        predicted_price: number;
        lower_bound: number;
        upper_bound: number;
        range_width_pct: number;
        safety_score: number;
    };
    overall: {
        safety_score: number;
        recommendation: string;
        signal: string;
        message: string;
    };
    error?: string;
}

export const mlApi = {
    /**
     * Check ML API health
     */
    async healthCheck(): Promise<{ status: string; models: { volatility: boolean; sentiment: boolean } }> {
        const response = await fetch(`${ML_API_URL}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('ML API is not available');
        return response.json();
    },

    /**
     * Get quick analysis for a token pair (optimized for UI)
     * Uses cache: 'no-store' to ensure fresh predictions on every request
     */
    async getQuickAnalysis(tokenA: string, tokenB: string, priceA?: number, priceB?: number): Promise<MLQuickAnalysis> {
        const response = await fetch(`${ML_API_URL}/api/farming/quick-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            cache: 'no-store',
            body: JSON.stringify({
                token_a: tokenA.toLowerCase(),
                token_b: tokenB.toLowerCase(),
                price_a: priceA,
                price_b: priceB
            })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Failed to get analysis');
        }
        return response.json();
    },

    /**
     * Get news and sentiment for a token
     */
    async getTokenNews(token: string): Promise<{
        success: boolean;
        token: string;
        news_available: boolean;
        sentiment: {
            net_sentiment: number;
            confidence: number;
            trend: 'bullish' | 'bearish' | 'neutral';
            headlines: Array<{
                headline: string;
                sentiment: 'positive' | 'negative' | 'neutral';
                score: number;
            }>;
        };
    }> {
        const response = await fetch(`${ML_API_URL}/api/news/${token.toLowerCase()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            return {
                success: false,
                token: token.toUpperCase(),
                news_available: false,
                sentiment: {
                    net_sentiment: 0,
                    confidence: 0.5,
                    trend: 'neutral',
                    headlines: []
                }
            };
        }
        return response.json();
    }
};

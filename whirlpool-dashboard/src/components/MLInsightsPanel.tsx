import { useState, useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import { Loader2, AlertCircle, Activity } from 'lucide-react';
import { mlApi, type MLQuickAnalysis } from '../api';
import { mapPoolTokens, getRecommendationDisplay, getSignalDisplay, toMLToken } from '../utils/tokenMapping';

interface MLInsightsPanelProps {
    tokenA: string;
    tokenB: string;
    isOpen: boolean;
    onPredictedRangeChange?: (lower: number, upper: number) => void;
    onApplyPrediction?: (lower: number, upper: number) => void;
    currentPriceA?: number;
    currentPriceB?: number;
}

/**
 * Fear & Greed style gauge component
 */
const SafetyGauge: FC<{ score: number }> = ({ score }) => {
    // Calculate the angle for the needle (0 = -90deg, 100 = 90deg)
    const angle = (score / 100) * 180 - 90;

    // Determine the color zone
    const getZoneColor = (s: number) => {
        if (s >= 75) return { label: 'Safe', color: '#22c55e', zone: 'green' };
        if (s >= 50) return { label: 'Moderate', color: '#eab308', zone: 'yellow' };
        if (s >= 25) return { label: 'Risky', color: '#f97316', zone: 'orange' };
        return { label: 'Avoid', color: '#ef4444', zone: 'red' };
    };

    const zone = getZoneColor(score);

    return (
        <div className="relative w-full max-w-[200px] mx-auto">
            {/* Gauge Background */}
            <svg viewBox="0 0 200 110" className="w-full">
                {/* Background arc segments */}
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="25%" stopColor="#f97316" />
                        <stop offset="50%" stopColor="#eab308" />
                        <stop offset="75%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                </defs>

                {/* Gauge arc */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />

                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const tickAngle = (tick / 100) * 180 - 90;
                    const rad = (tickAngle * Math.PI) / 180;
                    const x1 = 100 + 70 * Math.cos(rad);
                    const y1 = 100 + 70 * Math.sin(rad);
                    const x2 = 100 + 60 * Math.cos(rad);
                    const y2 = 100 + 60 * Math.sin(rad);
                    return (
                        <line
                            key={tick}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#64748b"
                            strokeWidth="2"
                        />
                    );
                })}

                {/* Needle */}
                <g transform={`rotate(${angle}, 100, 100)`}>
                    <line
                        x1="100"
                        y1="100"
                        x2="100"
                        y2="35"
                        stroke={zone.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx="100" cy="100" r="8" fill={zone.color} />
                    <circle cx="100" cy="100" r="4" fill="#1e293b" />
                </g>

                {/* Score text */}
                <text x="100" y="85" textAnchor="middle" fill="white" className="text-2xl font-bold">
                    {Math.round(score)}
                </text>
                <text x="100" y="100" textAnchor="middle" className="fill-muted-foreground text-xs">
                    /100
                </text>
            </svg>

            {/* Zone Label */}
            <div className="text-center mt-1">
                <span
                    className="text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${zone.color}20`, color: zone.color }}
                >
                    {zone.label}
                </span>
            </div>
        </div>
    );
};

/**
 * Signal badge component
 */
const SignalBadge: FC<{ signal: string }> = ({ signal }) => {
    const display = getSignalDisplay(signal);

    return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${signal === 'BUY' ? 'bg-green-500/20 border border-green-500/30' :
            signal === 'HOLD' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                'bg-red-500/20 border border-red-500/30'
            }`}>
            <span className={`text-2xl ${display.color}`}>{display.icon}</span>
            <span className={`text-lg font-bold ${display.color}`}>{display.label}</span>
        </div>
    );
};

/**
 * Price range display
 */
const PriceRangeCard: FC<{
    symbol: string;
    currentPrice: number;
    lowerBound: number;
    upperBound: number;
    safetyScore: number;
}> = ({ symbol, currentPrice, lowerBound, upperBound, safetyScore }) => {
    const rangeWidth = ((upperBound - lowerBound) / currentPrice * 100).toFixed(1);

    return (
        <div className="bg-[#1e293b] rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{symbol}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${safetyScore >= 75 ? 'bg-green-500/20 text-green-400' :
                    safetyScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                    {safetyScore.toFixed(0)} pts
                </span>
            </div>
            <div className="text-xs text-muted-foreground">
                Current: <span className="text-foreground font-mono">${currentPrice.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
                <span className="text-red-400 font-mono">${lowerBound.toFixed(4)}</span>
                <div className="flex-1 h-1.5 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
                    <div
                        className="absolute w-2 h-2 bg-white rounded-full -top-0.5 shadow"
                        style={{ left: `${Math.min(100, Math.max(0, ((currentPrice - lowerBound) / (upperBound - lowerBound)) * 100))}%` }}
                    />
                </div>
                <span className="text-green-400 font-mono">${upperBound.toFixed(4)}</span>
            </div>
            <div className="text-xs text-muted-foreground text-center">
                Range: ±{(parseFloat(rangeWidth) / 2).toFixed(1)}%
            </div>
        </div>
    );
};


/**
 * Main ML Insights Panel Component
 */
export const MLInsightsPanel: FC<MLInsightsPanelProps> = ({
    tokenA,
    tokenB,
    isOpen,
    onPredictedRangeChange,
    onApplyPrediction,
    currentPriceA,
    currentPriceB
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<MLQuickAnalysis | null>(null);

    // Track if we've already fetched for the current token pair
    // This prevents repeated fetches when prices change slightly
    const fetchedForRef = useRef<string>('');

    // Check token support and ensure alphabetical ordering for ML API
    const tokenMapping = useMemo(() => {
        const mapping = mapPoolTokens(tokenA, tokenB);

        // ML API expects tokens in alphabetical order
        // If they're not, swap them
        if (mapping.mlTokenA && mapping.mlTokenB && mapping.mlTokenA > mapping.mlTokenB) {
            return {
                mlTokenA: mapping.mlTokenB,
                mlTokenB: mapping.mlTokenA,
                bothSupported: mapping.bothSupported,
                swapped: true
            };
        }

        return { ...mapping, swapped: false };
    }, [tokenA, tokenB]);

    // Reset fetchedFor when panel closes or tokens change
    useEffect(() => {
        if (!isOpen) {
            fetchedForRef.current = '';
            setAnalysis(null);
            setError(null);
        }
    }, [isOpen, tokenA, tokenB]);

    useEffect(() => {
        if (!isOpen) return;

        // Create a key for this fetch session
        const fetchKey = `${tokenA}-${tokenB}`;

        // Skip if we've already fetched for this token pair
        if (fetchedForRef.current === fetchKey && analysis) {
            console.log('MLInsightsPanel: Using cached analysis for', fetchKey);
            return;
        }

        // Wait for at least one price to be available before fetching
        const hasPrices = currentPriceA !== undefined || currentPriceB !== undefined;
        if (!hasPrices) {
            setLoading(true);
            return;
        }

        const fetchAnalysis = async () => {
            setLoading(true);
            setError(null);

            // First check if tokens are supported
            if (!tokenMapping.bothSupported) {
                setError(`Tokens not fully supported. Available: SOL, JUP, JUPSOL, PENGU, USDT, USDC`);
                setLoading(false);
                return;
            }

            try {
                // Check ML API health first
                await mlApi.healthCheck();

                // Get quick analysis with real-time prices
                // Create a price map from ORIGINAL tokens to their prices
                const originalMLTokenA = toMLToken(tokenA);
                const originalMLTokenB = toMLToken(tokenB);

                if (!originalMLTokenA || !originalMLTokenB) {
                    throw new Error('Token mapping failed');
                }

                // Create price map for ML tokens based on ORIGINAL mapping
                const mlPriceMap: Record<string, number | undefined> = {
                    [originalMLTokenA]: currentPriceA,
                    [originalMLTokenB]: currentPriceB
                };

                // Now get prices for the alphabetically ordered ML tokens
                const priceForMLTokenA = mlPriceMap[tokenMapping.mlTokenA!];
                const priceForMLTokenB = mlPriceMap[tokenMapping.mlTokenB!];

                // Validation: ensure prices are valid numbers
                if (typeof priceForMLTokenA !== 'number' || typeof priceForMLTokenB !== 'number') {
                    throw new Error(`Price mapping error: ${tokenMapping.mlTokenA}=$${priceForMLTokenA}, ${tokenMapping.mlTokenB}=$${priceForMLTokenB}`);
                }

                console.log(`MLInsightsPanel: Original tokens - [${tokenA}, ${tokenB}] with prices [$${currentPriceA}, $${currentPriceB}]`);
                console.log(`MLInsightsPanel: Mapped to ML tokens - [${originalMLTokenA}, ${originalMLTokenB}]`);
                console.log(`MLInsightsPanel: Alphabetically ordered - [${tokenMapping.mlTokenA}, ${tokenMapping.mlTokenB}]`);
                console.log(`MLInsightsPanel: Final price map:`, mlPriceMap);
                console.log(`MLInsightsPanel: Sending to API - ${tokenMapping.mlTokenA}: $${priceForMLTokenA}, ${tokenMapping.mlTokenB}: $${priceForMLTokenB}`);

                const result = await mlApi.getQuickAnalysis(
                    tokenMapping.mlTokenA!,
                    tokenMapping.mlTokenB!,
                    priceForMLTokenA,
                    priceForMLTokenB
                );

                setAnalysis(result);

                // Mark that we've successfully fetched for this token pair
                fetchedForRef.current = `${tokenA}-${tokenB}`;

                // Debug: Log ML API response to trace safety score mismatch
                console.log('ML API Response:', {
                    token_a: { symbol: result.token_a.symbol, safety_score: result.token_a.safety_score, price: result.token_a.current_price, range: `${result.token_a.lower_bound} - ${result.token_a.upper_bound}` },
                    token_b: { symbol: result.token_b.symbol, safety_score: result.token_b.safety_score, price: result.token_b.current_price, range: `${result.token_b.lower_bound} - ${result.token_b.upper_bound}` },
                    overall_safety_score: result.overall.safety_score
                });

                // Determine which token's range to use for yield farming
                // Priority: Show the ALTCOIN (not SOL, not stablecoin)
                // - SOL/PENGU → show PENGU (altcoin to yield farm)
                // - JupSOL/SOL → show JupSOL (altcoin to yield farm)
                // - SOL/USDC → show SOL (no altcoin, so show SOL not stablecoin)
                const stablecoins = ['USDC', 'USDT'];
                const isTokenAStable = stablecoins.includes(tokenA);
                const isTokenBStable = stablecoins.includes(tokenB);
                const isTokenASOL = tokenA === 'SOL';
                const isTokenBSOL = tokenB === 'SOL';

                let useTokenA: boolean;

                if (isTokenAStable) {
                    // TokenA is stablecoin → use tokenB (SOL or altcoin)
                    useTokenA = false;
                } else if (isTokenBStable) {
                    // TokenB is stablecoin → use tokenA (SOL or altcoin)
                    useTokenA = true;
                } else if (isTokenASOL && !isTokenBSOL) {
                    // SOL/Altcoin → use Altcoin (tokenB)
                    useTokenA = false;
                } else if (isTokenBSOL && !isTokenASOL) {
                    // Altcoin/SOL → use Altcoin (tokenA)
                    useTokenA = true;
                } else {
                    // Both are altcoins or both are SOL → use tokenA
                    useTokenA = true;
                }

                // Correctly map API results (which might be swapped) back to Input Token A and Token B
                const resultForInputA = tokenMapping.swapped ? result.token_b : result.token_a;
                const resultForInputB = tokenMapping.swapped ? result.token_a : result.token_b;

                const displayResult = useTokenA ? resultForInputA : resultForInputB;

                if (onPredictedRangeChange && displayResult) {
                    onPredictedRangeChange(
                        displayResult.lower_bound,
                        displayResult.upper_bound
                    );
                }
            } catch (err) {
                console.error('ML Analysis error:', err);
                setError('ML API not available. Start the API server at port 8000.');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [isOpen, tokenMapping, onPredictedRangeChange, currentPriceA, currentPriceB, tokenA, tokenB]);

    if (!isOpen) return null;

    // Loading state
    if (loading) {
        return (
            <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-primary mr-2" size={24} />
                    <span className="text-muted-foreground">Analyzing with AI...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-xl p-4">
                <div className="flex items-start gap-3 text-yellow-400">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">ML Insights Unavailable</p>
                        <p className="text-xs text-muted-foreground">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // No data
    if (!analysis) {
        return (
            <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-xl p-4">
                <p className="text-sm text-muted-foreground text-center">No analysis available</p>
            </div>
        );
    }

    const { token_a, token_b, overall } = analysis;
    const recDisplay = getRecommendationDisplay(overall.recommendation);

    return (
        <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-xl p-4 space-y-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    AI Insights
                </h4>
                <span className="text-xs text-muted-foreground">7-day forecast</span>
            </div>

            {/* Safety Gauge */}
            <SafetyGauge score={overall.safety_score} />

            {/* Signal Badge */}
            <div className="flex justify-center">
                <SignalBadge signal={overall.signal} />
            </div>

            {/* Recommendation */}
            <div className={`text-center p-3 rounded-lg ${recDisplay.bgColor} border border-current/10`}>
                <p className={`text-sm font-medium ${recDisplay.color}`}>{recDisplay.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{overall.message}</p>
            </div>

            {/* Predicted Price Ranges */}
            <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Predicted Ranges
                </h5>
                <PriceRangeCard
                    symbol={token_a.symbol}
                    currentPrice={token_a.current_price}
                    lowerBound={token_a.lower_bound}
                    upperBound={token_a.upper_bound}
                    safetyScore={token_a.safety_score}
                />
                <PriceRangeCard
                    symbol={token_b.symbol}
                    currentPrice={token_b.current_price}
                    lowerBound={token_b.lower_bound}
                    upperBound={token_b.upper_bound}
                    safetyScore={token_b.safety_score}
                />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#1e293b] rounded-lg p-2 text-center">
                    <span className="text-muted-foreground">Token A Range</span>
                    <p className="font-mono font-medium">±{(token_a.range_width_pct / 2).toFixed(1) || '0'}%</p>
                </div>
                <div className="bg-[#1e293b] rounded-lg p-2 text-center">
                    <span className="text-muted-foreground">Token B Range</span>
                    <p className="font-mono font-medium">±{(token_b.range_width_pct / 2).toFixed(1) || '0'}%</p>
                </div>
            </div>

            {/* Use AI Prediction Button */}
            {onApplyPrediction && (
                <button
                    onClick={() => {
                        // Re-calculate which prediction to use (same logic as effect)
                        const stablecoins = ['USDC', 'USDT'];
                        const isTokenAStable = stablecoins.includes(tokenA);
                        const isTokenBStable = stablecoins.includes(tokenB);
                        const isTokenASOL = tokenA === 'SOL';
                        const isTokenBSOL = tokenB === 'SOL';

                        let useTokenA = true;
                        if (isTokenAStable) useTokenA = false;
                        else if (isTokenBStable) useTokenA = true;
                        else if (isTokenASOL && !isTokenBSOL) useTokenA = false;
                        else if (isTokenBSOL && !isTokenASOL) useTokenA = true;

                        const resultForInputA = tokenMapping.swapped ? analysis.token_b : analysis.token_a;
                        const resultForInputB = tokenMapping.swapped ? analysis.token_a : analysis.token_b;
                        const targetPrediction = useTokenA ? resultForInputA : resultForInputB;

                        if (targetPrediction) {
                            onApplyPrediction(targetPrediction.lower_bound, targetPrediction.upper_bound);
                        }
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Activity size={16} />
                    Use AI Prediction
                </button>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-[#1e293b]">
                Powered by LSTM + FinBERT Sentiment
            </div>
        </div>
    );
};

export default MLInsightsPanel;
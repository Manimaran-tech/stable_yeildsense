import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import { X, Loader2, Minus, Plus, ChevronLeft, Settings, Info, AlertTriangle } from 'lucide-react';
import { getTokenPrice } from '../services/priceService';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';
import { PriceChart } from './charts/PriceChart';
import { getCoinGeckoId } from '../utils/coinMapping';
import { MLInsightsPanel } from './MLInsightsPanel';
import { TokenNewsPanel } from './TokenNewsPanel';





interface CreatePositionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenA?: string;
    tokenB?: string;
}

type ViewMode = 'deposit' | 'range';
type RangePreset = '1%' | '5%' | '10%' | 'custom';

export const CreatePositionPanel: FC<CreatePositionPanelProps> = ({
    isOpen,
    onClose,
    poolAddress,
    tokenA = 'SOL',
    tokenB = 'USDC'
}) => {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('deposit');

    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [tokenAPriceUsd, setTokenAPriceUsd] = useState<number>(0);
    const [tokenBPriceUsd, setTokenBPriceUsd] = useState<number>(0);
    const [displayToken, setDisplayToken] = useState<string>(tokenA); // Which token to display in chart
    const [minPrice, setMinPrice] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');

    // Range preset state
    const [selectedPreset, setSelectedPreset] = useState<RangePreset>('5%');

    // Deposit state
    const [amountA, setAmountA] = useState<string>('');
    const [amountB, setAmountB] = useState<string>('');
    const slippage = 1; // 1% default slippage

    // Loading and transaction states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [priceLoading, setPriceLoading] = useState(true);
    const [liquidityLoading, setLiquidityLoading] = useState(true);
    const [liquidityData, setLiquidityData] = useState<{ tick: number, liquidity: string, price: number }[]>([]);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);


    // Fetch current price on mount
    useEffect(() => {
        if (!isOpen || !poolAddress) return;

        const fetchPrice = async (isBackground = false) => {
            if (!isBackground) setPriceLoading(true);

            // Initial Liquidity Fetch
            if (!isBackground) setLiquidityLoading(true);

            try {
                console.log("CreatePositionPanel: Fetching prices for", tokenA, tokenB);

                // 1. Fetch USD prices for both tokens (using reliable priceService)
                const priceA = await getTokenPrice(tokenA);
                const priceB = await getTokenPrice(tokenB);

                console.log("CreatePositionPanel: USD Prices:", { [tokenA]: priceA, [tokenB]: priceB });

                setTokenAPriceUsd(priceA);
                setTokenBPriceUsd(priceB);

                // 2. Determine which token to display for yield farming
                // Priority: Show the ALTCOIN (not SOL, not stablecoin)
                // - SOL/PENGU → show PENGU (altcoin to yield farm)
                // - JupSOL/SOL → show JupSOL (altcoin to yield farm)
                // - SOL/USDC → show SOL (no altcoin, so show SOL not stablecoin)
                const stablecoins = ['USDC', 'USDT'];
                const isTokenAStable = stablecoins.includes(tokenA);
                const isTokenBStable = stablecoins.includes(tokenB);
                const isTokenASOL = tokenA === 'SOL';
                const isTokenBSOL = tokenB === 'SOL';

                let displayTokenA: boolean;

                if (isTokenAStable) {
                    // TokenA is stablecoin → show tokenB (SOL or altcoin)
                    displayTokenA = false;
                } else if (isTokenBStable) {
                    // TokenB is stablecoin → show tokenA (SOL or altcoin)
                    displayTokenA = true;
                } else if (isTokenASOL && !isTokenBSOL) {
                    // SOL/Altcoin → show Altcoin (tokenB)
                    displayTokenA = false;
                } else if (isTokenBSOL && !isTokenASOL) {
                    // Altcoin/SOL → show Altcoin (tokenA)
                    displayTokenA = true;
                } else {
                    // Both are altcoins or both are SOL → show tokenA
                    displayTokenA = true;
                }

                const displayPrice = displayTokenA ? priceA : priceB;
                const displayToken = displayTokenA ? tokenA : tokenB;

                console.log('CreatePositionPanel: Display token:', displayToken, '=', displayPrice);

                setDisplayToken(displayToken);

                if (displayPrice > 0) {
                    setCurrentPrice(displayPrice);

                    // Apply default preset immediately based on this USD price (ONLY on first load)
                    if (!isBackground) {
                        const percentage = 0.05; // Default 5%
                        const min = displayPrice * (1 - percentage);
                        const max = displayPrice * (1 + percentage);
                        setMinPrice(min.toFixed(4));
                        setMaxPrice(max.toFixed(4));
                    }
                } else {
                    console.warn("CreatePositionPanel: Failed to fetch USD price for", displayToken);
                }

                // Fetch real liquidity distribution (background safe) with simple retry
                let attempts = 0;
                let success = false;
                while (attempts < 3 && !success) {
                    try {
                        const liqDist = await api.getLiquidityDistribution(poolAddress);
                        if (liqDist && liqDist.distribution && liqDist.distribution.length > 0) {
                            setLiquidityData(liqDist.distribution);
                            success = true;
                        } else {
                            // If empty, maybe wait and retry?
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    } catch (liqErr) {
                        console.error(`CreatePositionPanel: Liquidity fetch error (attempt ${attempts + 1}):`, liqErr);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    attempts++;
                }

                if (!success) {
                    console.warn("CreatePositionPanel: Failed to load liquidity data after 3 attempts.");
                    // Ensure we don't hold stale data if this was a re-fetch (though we only fetch once now)
                    // setLiquidityData([]); 
                }

            } catch (error) {
                console.error("CreatePositionPanel: Price fetch error:", error);
            } finally {
                setPriceLoading(false);
                setLiquidityLoading(false);
            }
        };

        // Only fetch once on mount/change. No polling to prevent reload flicker/reset.
        fetchPrice();
        // const interval = setInterval(() => fetchPrice(true), 30000); 
        // return () => clearInterval(interval);

    }, [isOpen, poolAddress, tokenA, tokenB]);

    // Reset states when opening
    useEffect(() => {
        if (isOpen) {
            setTxStatus('idle');
            setErrorMessage(null);
            setTxSignature(null);
        }
    }, [isOpen]);

    // Apply range preset
    const applyPreset = useCallback((preset: RangePreset, price: number) => {
        if (price <= 0) return;

        let percentage = 0;
        switch (preset) {
            case '1%': percentage = 0.01; break;
            case '5%': percentage = 0.05; break;
            case '10%': percentage = 0.10; break;
            default: return; // Custom - don't auto-set
        }

        const min = price * (1 - percentage);
        const max = price * (1 + percentage);

        setMinPrice(min.toFixed(4));
        setMaxPrice(max.toFixed(4));
        setSelectedPreset(preset);
    }, []);

    // Calculate deposit ratio based on current price and range
    const calculateDepositRatio = useCallback((): { ratioA: number; ratioB: number } => {
        if (!minPrice || !maxPrice || currentPrice <= 0) {
            return { ratioA: 50, ratioB: 50 };
        }

        const min = parseFloat(minPrice);
        const max = parseFloat(maxPrice);

        if (currentPrice <= min) {
            return { ratioA: 0, ratioB: 100 };
        } else if (currentPrice >= max) {
            return { ratioA: 100, ratioB: 0 };
        } else {
            const rangePosition = (currentPrice - min) / (max - min);
            const ratioB = Math.round(rangePosition * 100 * 10) / 10;
            return { ratioA: 100 - ratioB, ratioB };
        }
    }, [minPrice, maxPrice, currentPrice]);

    // Calculate exchange rate (Price of A in terms of B)
    const exchangeRate = tokenAPriceUsd && tokenBPriceUsd ? tokenAPriceUsd / tokenBPriceUsd : 0;

    const { ratioA, ratioB } = calculateDepositRatio();

    // Check if this is a pegged pair (like JupSOL/SOL) that needs static bars
    const isPeggedPair = useMemo(() => {
        const peggedTokens = ['JupSOL', 'mSOL', 'stSOL', 'bSOL', 'jitoSOL'];
        return (peggedTokens.includes(tokenA) && tokenB === 'SOL') ||
            (peggedTokens.includes(tokenB) && tokenA === 'SOL');
    }, [tokenA, tokenB]);

    // Process Liquidity Data for Chart
    const chartBars = useMemo(() => {
        if (!currentPrice) return null;

        // For pegged pairs (JupSOL/SOL etc.) or sparse liquidity data, use static Gaussian distribution
        // These pairs have very narrow tick ranges that don't map well to the 40% price range visualization
        if (isPeggedPair || liquidityData.length < 20) {
            const buckets = new Array(64).fill(0);
            let maxBucket = 0;

            // Generate a smooth Gaussian distribution centered around the middle
            for (let i = 0; i < 64; i++) {
                // Distance from center (32)
                const dist = (i - 32) / 10;
                // Gaussian curve with some variation
                const height = Math.exp(-(dist * dist)) * 100;
                // Add some natural-looking variation
                const variation = 0.7 + Math.random() * 0.6;
                buckets[i] = height * variation;
                if (buckets[i] > maxBucket) maxBucket = buckets[i];
            }

            return { buckets, maxBucket, isStatic: true };
        }

        if (liquidityData.length === 0) return null;

        const rangeWidth = currentPrice * 0.4; // +/- 20%
        const step = rangeWidth / 64;
        const startPrice = currentPrice - (rangeWidth / 2);

        const buckets = new Array(64).fill(0);
        let maxBucket = 0;

        const isDisplayTokenA = displayToken === tokenA;

        liquidityData.forEach(tick => {
            // Normalize tick price to USD based on which token we are displaying
            let tickPriceUsd = 0;

            if (isDisplayTokenA) {
                // Displaying Token A (e.g. SOL in SOL/USDC, or JupSOL in JupSOL/SOL)
                // Tick is B/A. Value(A) = Tick(B/A) * Value(B)
                tickPriceUsd = tick.price * (tokenBPriceUsd || 0);
            } else {
                // Displaying Token B (e.g. PENGU in SOL/PENGU)
                // Tick is B/A. Value(B) = Value(A) / Tick(B/A)
                if (tick.price > 0) {
                    tickPriceUsd = (tokenAPriceUsd || 0) / tick.price;
                }
            }

            // Safety check for invalid/zero prices
            if (tickPriceUsd <= 0) return;

            if (tickPriceUsd < startPrice || tickPriceUsd > startPrice + rangeWidth) return;
            const bucketIdx = Math.floor((tickPriceUsd - startPrice) / step);
            if (bucketIdx >= 0 && bucketIdx < 64) {
                const liq = Number(tick.liquidity);
                buckets[bucketIdx] += liq;
                if (buckets[bucketIdx] > maxBucket) maxBucket = buckets[bucketIdx];
            }
        });

        return { buckets, maxBucket, isStatic: false };
    }, [currentPrice, liquidityData, tokenAPriceUsd, tokenBPriceUsd, displayToken, tokenA, isPeggedPair]);

    // Auto-calculate the other token amount based on the deposit ratio
    const handleAmountAChange = useCallback((value: string) => {
        setAmountA(value);
        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            // Calculate equivalent amount of tokenB based on ratio
            // AmountB = AmountA * (PriceA/PriceB) * (ratioB/ratioA)
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const calculatedB = numValue * (ratioB / ratioA) * exchangeRate;
                setAmountB(calculatedB.toFixed(9));
            }
        } else if (!value) {
            setAmountB('');
        }
    }, [ratioA, ratioB, exchangeRate]);

    const handleAmountBChange = useCallback((value: string) => {
        setAmountB(value);
        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                // Reverse calculation
                const calculatedA = numValue * (ratioA / ratioB) / exchangeRate;
                setAmountA(calculatedA.toFixed(9));
            }
        } else if (!value) {
            setAmountA('');
        }
    }, [ratioA, ratioB, exchangeRate]);

    // Check if in range
    const isInRange = currentPrice >= parseFloat(minPrice || '0') && currentPrice <= parseFloat(maxPrice || '0');

    const handleCreatePosition = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Please connect your wallet first.");
            return;
        }

        if (!amountA || !minPrice || !maxPrice) {
            setErrorMessage("Please enter all required fields.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            console.log("Creating position:", {
                poolAddress,
                minPrice,
                maxPrice,
                amountA,
                slippage
            });

            // Convert prices from Display (USD) to Pool Units (TokenB / TokenA)
            // If Token B is NOT a stablecoin (e.g. PENGU), we must divide USD price by Token B USD price.
            // Example: Lower = $126 (USD/SOL) / $0.01 (USD/PENGU) = 12,600 PENGU/SOL
            let submissionLower = minPrice;
            let submissionUpper = maxPrice;

            if (tokenBPriceUsd > 0 && !['USDC', 'USDT'].includes(tokenB)) {
                submissionLower = (parseFloat(minPrice) / tokenBPriceUsd).toFixed(6);
                submissionUpper = (parseFloat(maxPrice) / tokenBPriceUsd).toFixed(6);
                console.log(`Converting USD bounds to Pool Units: ${minPrice} -> ${submissionLower}, ${maxPrice} -> ${submissionUpper}`);
            }

            const response = await api.createOrDeposit({
                wallet: publicKey.toString(),
                whirlpool: poolAddress,
                priceLower: submissionLower,
                priceUpper: submissionUpper,
                amountA: amountA
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            // Deserialize transaction
            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("Building openPosition transaction...");
            console.log("Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);

            setTxStatus('confirming');
            console.log("Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');

            // Success
            setTxStatus('success');

        } catch (error) {
            console.error("Position creation failed:", error);
            setTxStatus('error');
            setErrorMessage((error as Error).message || "Transaction failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusMessage = () => {
        switch (txStatus) {
            case 'building': return 'Building transaction...';
            case 'signing': return 'Please approve in your wallet...';
            case 'confirming': return 'Confirming on-chain...';
            case 'success': return 'Position created successfully!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-7xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                        {viewMode === 'range' && (
                            <button
                                onClick={() => setViewMode('deposit')}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-lg font-bold">Create Position</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {viewMode === 'deposit' ? (
                    /* Deposit View - 4 Column Layout: News | Chart | Inputs | AI */
                    <div className="flex flex-col lg:flex-row h-full">
                        {/* Column 1: News Panel */}
                        <div className="w-full lg:w-[15%] p-4 border-b lg:border-b-0 lg:border-r border-border bg-muted/10 overflow-hidden">
                            <TokenNewsPanel
                                tokenA={tokenA}
                                tokenB={tokenB}
                                isOpen={isOpen}
                            />
                        </div>

                        {/* Column 2: Chart (Wider) */}
                        <div className="w-full lg:w-[35%] p-4 border-b lg:border-b-0 lg:border-r border-border bg-muted/10 space-y-4 overflow-hidden flex flex-col">
                            <div className="flex-1 w-full min-h-[350px]">
                                <PriceChart
                                    coinId={getCoinGeckoId(displayToken)}
                                    title={`${displayToken} Price`}
                                />
                            </div>
                        </div>

                        {/* Column 3: Inputs */}
                        <div className="w-full lg:w-[25%] p-4 space-y-4 border-b lg:border-b-0 lg:border-r border-border">
                            {/* Info Banner */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                                <Info className="text-blue-400 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-blue-200">
                                    Fees are earned only while the price is within your selected range.
                                </p>
                            </div>

                            {/* Range Presets */}
                            <div className="flex items-center gap-2">
                                {(['1%', '5%', '10%', 'custom'] as RangePreset[]).map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => {
                                            if (preset === 'custom') {
                                                setSelectedPreset('custom');
                                                setViewMode('range');
                                            } else {
                                                applyPreset(preset, currentPrice);
                                            }
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedPreset === preset
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {preset === 'custom' ? 'Custom' : `±${preset}`}
                                    </button>
                                ))}
                            </div>

                            {/* Range Display */}
                            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Price Range</span>
                                    <span className="font-mono">
                                        ${minPrice || '—'} - ${maxPrice || '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Current Price</span>
                                    <span className="font-mono font-medium">
                                        {priceLoading ? 'Loading...' : `$${currentPrice.toFixed(4)}`}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Deposit Ratio</span>
                                    <span className="font-medium">
                                        {ratioA.toFixed(0)}% {tokenA} / {ratioB.toFixed(0)}% {tokenB}
                                    </span>
                                </div>

                                {/* Range Status */}
                                {!isInRange && minPrice && maxPrice && (
                                    <div className="flex items-center gap-2 text-yellow-400 text-xs pt-2 border-t border-border/50">
                                        <AlertTriangle size={14} />
                                        <span>Current price is outside your range</span>
                                    </div>
                                )}
                            </div>

                            {/* Deposit Amounts */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Deposit Amount</span>
                                </div>

                                {/* Token A Input */}
                                <div className="bg-background border border-border rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="number"
                                            value={amountA}
                                            onChange={(e) => handleAmountAChange(e.target.value)}
                                            placeholder="0"
                                            className="bg-transparent text-2xl font-medium focus:outline-none w-full"
                                        />
                                        <div className="flex items-center gap-2 ml-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                                            <span className="font-bold">{tokenA}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        ${amountA ? (parseFloat(amountA) * (tokenAPriceUsd || currentPrice)).toFixed(2) : '0.00'}
                                    </div>
                                </div>

                                {/* Token B Input (auto-calculated based on ratio) */}
                                <div className="bg-background border border-border rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="number"
                                            value={amountB}
                                            onChange={(e) => handleAmountBChange(e.target.value)}
                                            placeholder="0"
                                            className="bg-transparent text-2xl font-medium focus:outline-none w-full"
                                        />
                                        <div className="flex items-center gap-2 ml-2">
                                            <div className="w-6 h-6 rounded-full bg-green-500"></div>
                                            <span className="font-bold">{tokenB}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        ${amountB ? (parseFloat(amountB) * (tokenBPriceUsd || 1)).toFixed(2) : '0.00'}
                                    </div>
                                </div>
                            </div>

                            {/* Settings Row */}
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setViewMode('range')}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <Settings size={14} />
                                    Adjust Range
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Slippage:</span>
                                    <span className="text-xs font-medium bg-muted/50 px-2 py-1 rounded">
                                        {slippage}%
                                    </span>
                                </div>
                            </div>

                            {/* Transaction Status */}
                            {txStatus !== 'idle' && (
                                <div className={`p-4 rounded-lg border ${txStatus === 'success'
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : txStatus === 'error'
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : 'bg-blue-500/10 border-blue-500/30'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        {txStatus !== 'success' && txStatus !== 'error' && (
                                            <Loader2 className="animate-spin" size={16} />
                                        )}
                                        <span className={`text-sm ${txStatus === 'success' ? 'text-green-400' : txStatus === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                                            {getStatusMessage()}
                                        </span>
                                    </div>
                                    {txSignature && (
                                        <a
                                            href={`https://solscan.io/tx/${txSignature}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline mt-2 block"
                                        >
                                            View on Solscan →
                                        </a>
                                    )}
                                    {
                                        errorMessage && (
                                            <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
                                        )
                                    }
                                </div>
                            )}

                            {/* On-chain Transaction Notice */}
                            <div className="text-xs text-muted-foreground">
                                ⚡ This is an on-chain transaction requiring SOL for gas fees.
                            </div>

                            {/* Create Position Button */}
                            {
                                txStatus === 'success' ? (
                                    <button
                                        onClick={onClose}
                                        className="w-full py-4 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors"
                                    >
                                        Close
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreatePosition}
                                        disabled={isSubmitting || !connected}
                                        className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                                        {!connected ? 'Connect Wallet' : isSubmitting ? 'Creating...' : 'Create Position'}
                                    </button>
                                )
                            }
                        </div>

                        {/* Column 4: AI Insights */}
                        <div className="w-full lg:w-[25%] p-4">
                            <MLInsightsPanel
                                tokenA={tokenA}
                                tokenB={tokenB}
                                isOpen={isOpen}
                                currentPriceA={
                                    // If B is stable (e.g. USDC), then Pool Price (B per A) is the price of A in USD
                                    (['USDC', 'USDT'].includes(tokenB) && currentPrice > 0)
                                        ? currentPrice
                                        : (tokenAPriceUsd || undefined)
                                }
                                currentPriceB={
                                    // If A is stable (e.g. USDC), then Pool Price (B per A) is Price of A in B. 
                                    // Implies Price of B in A = 1/Pool Price.
                                    (['USDC', 'USDT'].includes(tokenA) && currentPrice > 0)
                                        ? (1 / currentPrice)
                                        : (tokenBPriceUsd || undefined)
                                }
                                onPredictedRangeChange={(lower, upper) => {
                                    // ML returns lower/upper in USD for Token A.
                                    // Since we are now in "USD Mode" for display, we just use them directly.
                                    if (selectedPreset !== 'custom') {
                                        setMinPrice(lower.toFixed(4));
                                        setMaxPrice(upper.toFixed(4));
                                    }
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    /* Range View */
                    <div className="p-4 space-y-4">
                        {/* Position Range Header */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Position Range</span>
                            <span className="text-xs text-muted-foreground">
                                USD per {tokenA}
                            </span>
                        </div>

                        {/* Full/Custom Toggle with Centered Current Price */}
                        <div className="flex items-center justify-between gap-4 bg-muted/10 p-2 border border-border">
                            <button
                                onClick={() => {
                                    setMinPrice('0');
                                    setMaxPrice('999999');
                                }}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-all border border-transparent ${minPrice === '0'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'hover:bg-muted/20 text-muted-foreground'
                                    }`}
                            >
                                Full Range
                            </button>

                            {/* Current Price Highlight */}
                            <div className="flex flex-col items-center px-4 py-1 bg-purple-500/10 border border-purple-500/30">
                                <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Current Price</span>
                                <span className="font-mono text-lg font-bold text-purple-400">
                                    ${currentPrice.toFixed(4)}
                                </span>
                            </div>

                            <button
                                onClick={() => applyPreset('5%', currentPrice)}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-all border border-transparent ${minPrice !== '0'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'hover:bg-muted/20 text-muted-foreground'
                                    }`}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Visual Range Selector (Purple & Interactive) */}
                        <div
                            className="bg-card border border-border p-4 h-64 relative overflow-hidden select-none cursor-crosshair group"
                            onMouseDown={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const pct = x / rect.width;
                                const rangeWidth = currentPrice * 0.4;
                                const startPrice = currentPrice - (rangeWidth / 2);
                                const clickedPrice = startPrice + pct * rangeWidth;

                                const min = parseFloat(minPrice) || 0;
                                const max = parseFloat(maxPrice) || Infinity;

                                // Reset to Custom if Full
                                if (minPrice === '0') setSelectedPreset('custom');

                                if (Math.abs(clickedPrice - min) < Math.abs(clickedPrice - max)) {
                                    setMinPrice(clickedPrice.toFixed(4));
                                } else {
                                    setMaxPrice(clickedPrice.toFixed(4));
                                }
                            }}
                        >
                            {priceLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="animate-spin text-muted-foreground" size={24} />
                                </div>
                            ) : (!chartBars || chartBars.buckets.every(b => b === 0)) ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                                    <AlertTriangle size={24} className="mb-2 opacity-50" />
                                    <span className="text-xs">No Liquidity Data</span>
                                </div>
                            ) : (
                                <div className="h-full flex items-end justify-between gap-[2px] px-8 relative pointer-events-none">
                                    {/* Central Pivot Line */}
                                    <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-purple-500/20 z-0 border-l border-dashed border-purple-500/30"></div>

                                    {/* Pegged Pair Indicator */}
                                    {chartBars?.isStatic && (
                                        <div className="absolute top-2 right-2 z-10">
                                            <span className="text-[9px] text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                Typical Distribution
                                            </span>
                                        </div>
                                    )}

                                    {Array.from({ length: 64 }).map((_, i) => {
                                        const rangeWidth = currentPrice * 0.4;
                                        const step = rangeWidth / 64;
                                        const startPrice = currentPrice - (rangeWidth / 2);
                                        const barStart = startPrice + i * step;
                                        const barPrice = barStart + step / 2;

                                        const min = parseFloat(minPrice) || 0;
                                        const max = parseFloat(maxPrice) || Infinity;

                                        let heightPct = 5; // Default low visibility (5%)

                                        if (chartBars && chartBars.maxBucket > 0) {
                                            const val = chartBars.buckets[i];
                                            if (val > 0) {
                                                if (chartBars.isStatic) {
                                                    // Linear scaling for static/simulated bars
                                                    heightPct = (val / chartBars.maxBucket) * 85 + 10;
                                                } else {
                                                    // Logarithmic Scaling for real liquidity: log(val) / log(max)
                                                    // This makes smaller liquidity amounts much more visible
                                                    const logVal = Math.log(val + 1);
                                                    const logMax = Math.log(chartBars.maxBucket + 1);
                                                    heightPct = (logVal / logMax) * 85 + 10; // Scale 10-95%
                                                }
                                            }
                                        } else if (liquidityLoading) {
                                            const dist = (barPrice - currentPrice) / (rangeWidth / 6);
                                            heightPct = Math.exp(-(dist * dist)) * 20 + 10;
                                        }

                                        const isInRange = barPrice >= min && barPrice <= max;

                                        return (
                                            <div
                                                key={i}
                                                className={`flex-1 rounded-t-[1px] transition-all duration-300 ${isInRange ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800/50'
                                                    }`}
                                                style={{ height: `${heightPct}%` }}
                                            />
                                        );
                                    })}

                                    {/* Min Price Handle (Neon Purple) */}
                                    {(parseFloat(minPrice) > currentPrice * 0.8 && parseFloat(minPrice) < currentPrice * 1.2) && (
                                        <div
                                            className="absolute top-8 bottom-0 w-[2px] bg-purple-400 z-10 shadow-[0_0_20px_#d8b4fe] transition-all duration-300"
                                            style={{ left: `${((parseFloat(minPrice) - (currentPrice * 0.8)) / (currentPrice * 0.4)) * 100}%` }}
                                        >
                                            <div className="absolute -top-10 -translate-x-1/2 bg-black/80 border border-purple-500/50 text-purple-300 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md flex flex-col items-center min-w-[60px]">
                                                <span className="text-[8px] text-muted-foreground uppercase">MIN</span>
                                                <span>{(parseFloat(minPrice)).toFixed(4)}</span>
                                            </div>
                                            <div className="absolute top-0 -translate-x-1/2 w-4 h-full group-hover:bg-purple-500/5 cursor-ew-resize pointer-events-auto flex justify-center">
                                                <div className="w-[2px] h-full bg-purple-400"></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Max Price Handle (Neon Purple) */}
                                    {(parseFloat(maxPrice) > currentPrice * 0.8 && parseFloat(maxPrice) < currentPrice * 1.2) && (
                                        <div
                                            className="absolute top-8 bottom-0 w-[2px] bg-purple-400 z-10 shadow-[0_0_20px_#d8b4fe] transition-all duration-300"
                                            style={{ left: `${((parseFloat(maxPrice) - (currentPrice * 0.8)) / (currentPrice * 0.4)) * 100}%` }}
                                        >
                                            <div className="absolute -top-10 -translate-x-1/2 bg-black/80 border border-purple-500/50 text-purple-300 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md flex flex-col items-center min-w-[60px]">
                                                <span className="text-[8px] text-muted-foreground uppercase">MAX</span>
                                                <span>{(parseFloat(maxPrice)).toFixed(4)}</span>
                                            </div>
                                            <div className="absolute top-0 -translate-x-1/2 w-4 h-full group-hover:bg-purple-500/5 cursor-ew-resize pointer-events-auto flex justify-center">
                                                <div className="w-[2px] h-full bg-purple-400"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Min/Max Price Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Min Price</label>
                                <div className="flex items-center bg-background border border-border rounded-lg">
                                    <button
                                        onClick={() => setMinPrice((parseFloat(minPrice) - 1).toFixed(4))}
                                        className="p-2 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-l-lg transition-colors"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        value={minPrice}
                                        onChange={(e) => {
                                            setMinPrice(e.target.value);
                                            setSelectedPreset('custom');
                                        }}
                                        className="flex-1 bg-transparent text-center font-mono text-sm focus:outline-none"
                                    />
                                    <button
                                        onClick={() => setMinPrice((parseFloat(minPrice) + 1).toFixed(4))}
                                        className="p-2 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-r-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Max Price</label>
                                <div className="flex items-center bg-background border border-border rounded-lg">
                                    <button
                                        onClick={() => setMaxPrice((parseFloat(maxPrice) - 1).toFixed(4))}
                                        className="p-2 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-l-lg transition-colors"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        value={maxPrice}
                                        onChange={(e) => {
                                            setMaxPrice(e.target.value);
                                            setSelectedPreset('custom');
                                        }}
                                        className="flex-1 bg-transparent text-center font-mono text-sm focus:outline-none"
                                    />
                                    <button
                                        onClick={() => setMaxPrice((parseFloat(maxPrice) + 1).toFixed(4))}
                                        className="p-2 text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-r-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Slippage */}
                        <div className="flex items-center justify-between pt-2">
                            <div className="w-8"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Slippage:</span>
                                <span className="text-xs font-medium bg-muted/50 px-2 py-1 rounded">
                                    {slippage}%
                                </span>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={() => setViewMode('deposit')}
                            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all"
                        >
                            Confirm Range
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

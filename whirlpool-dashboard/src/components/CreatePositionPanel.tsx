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
import { StakingYieldCard } from './StakingYieldCard';
import { encryptAmount, formatEncryptedDisplay, type EncryptedAmount } from '../services/incoService';
import { SecurityStatusBanner, InlineSecurityIndicator } from './SecurityBadge';





interface CreatePositionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    poolAddress: string | null;
    tokenA: string;
    tokenB: string;
    feeTier?: number; // Fee tier in percentage (e.g., 0.30, 0.04, 0.01)
}

type ViewMode = 'deposit' | 'range';
type RangePreset = '1%' | '5%' | '10%' | 'custom';

export const CreatePositionPanel: FC<CreatePositionPanelProps> = ({
    isOpen,
    onClose,
    poolAddress,
    tokenA = 'SOL',
    tokenB = 'USDC',
    feeTier = 0.30 // Default to standard 30bps tier if not provided
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
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'encrypting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inco encryption state
    const [encryptedAmountA, setEncryptedAmountA] = useState<EncryptedAmount | null>(null);
    const [encryptedAmountB, setEncryptedAmountB] = useState<EncryptedAmount | null>(null);
    const [_isEncrypting, setIsEncrypting] = useState(false);


    // Fetch current price on mount
    useEffect(() => {
        if (!isOpen || !poolAddress) return;

        const fetchPrice = async (isBackground = false) => {
            if (!isBackground) {
                setPriceLoading(true);
                // Reset prices to prevent stale data if we are switching pools
                if (!isOpen) {
                    // Only clear if opening fresh. If just refreshing in bg, don't clear.
                    setMinPrice('');
                    setMaxPrice('');
                    setCurrentPrice(0);
                }
            }

            // Initial Liquidity Fetch
            if (!isBackground) setLiquidityLoading(true);

            try {
                console.log("CreatePositionPanel: ------------------------------------------");
                console.log(`CreatePositionPanel: Fetching for Pool: ${poolAddress}`);
                console.log(`CreatePositionPanel: Tokens: ${tokenA} / ${tokenB}`);

                // 1. Fetch USD prices for both tokens (using reliable priceService)
                const priceA = await getTokenPrice(tokenA);
                const priceB = await getTokenPrice(tokenB);

                console.log(`CreatePositionPanel: Prices Fetched -> ${tokenA}: $${priceA}, ${tokenB}: $${priceB}`);

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
                    // TokenA is stablecoin (USDC/SOL) → show tokenB (SOL)
                    displayTokenA = false;
                } else if (isTokenBStable) {
                    // TokenB is stablecoin (SOL/USDC) → show tokenA (SOL)
                    displayTokenA = true;
                } else if (isTokenASOL && !isTokenBSOL) {
                    // SOL/Altcoin (SOL/PENGU) → show Altcoin (tokenB - PENGU)
                    displayTokenA = false;
                } else if (isTokenBSOL && !isTokenASOL) {
                    // Altcoin/SOL (PENGU/SOL) → show Altcoin (tokenA - PENGU)
                    displayTokenA = true;
                } else {
                    // Both are altcoins or both are SOL → show tokenA
                    displayTokenA = true;
                }

                const displayPrice = displayTokenA ? priceA : priceB;
                const displayToken = displayTokenA ? tokenA : tokenB;

                console.log(`CreatePositionPanel: Decision -> Displaying: ${displayToken} ($${displayPrice})`);
                console.log("CreatePositionPanel: ------------------------------------------");

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
                    // If price fetch failed, we shouldn't show stale data 
                    if (!isBackground && currentPrice === 0) {
                        // Maybe set error?
                    }
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
    const handleAmountAChange = useCallback(async (value: string) => {
        setAmountA(value);

        // Encrypt the amount using Inco SDK
        if (value && parseFloat(value) > 0) {
            setIsEncrypting(true);
            try {
                const encrypted = await encryptAmount(value);
                setEncryptedAmountA(encrypted);
                console.log('[CreatePosition] Amount A encrypted:', encrypted.encrypted.substring(0, 20) + '...');
            } catch (err) {
                console.error('[CreatePosition] Encryption failed:', err);
            } finally {
                setIsEncrypting(false);
            }
        } else {
            setEncryptedAmountA(null);
        }

        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            // Calculate equivalent amount of tokenB based on ratio
            // AmountB = AmountA * (PriceA/PriceB) * (ratioB/ratioA)
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const calculatedB = numValue * (ratioB / ratioA) * exchangeRate;
                setAmountB(calculatedB.toFixed(9));

                // Also encrypt amount B
                try {
                    const encryptedB = await encryptAmount(calculatedB.toFixed(9));
                    setEncryptedAmountB(encryptedB);
                } catch (err) {
                    console.error('[CreatePosition] Amount B encryption failed:', err);
                }
            }
        } else if (!value) {
            setAmountB('');
            setEncryptedAmountB(null);
        }
    }, [ratioA, ratioB, exchangeRate]);

    const handleAmountBChange = useCallback(async (value: string) => {
        setAmountB(value);

        // Encrypt the amount using Inco SDK
        if (value && parseFloat(value) > 0) {
            setIsEncrypting(true);
            try {
                const encrypted = await encryptAmount(value);
                setEncryptedAmountB(encrypted);
                console.log('[CreatePosition] Amount B encrypted:', encrypted.encrypted.substring(0, 20) + '...');
            } catch (err) {
                console.error('[CreatePosition] Encryption failed:', err);
            } finally {
                setIsEncrypting(false);
            }
        } else {
            setEncryptedAmountB(null);
        }

        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                // Reverse calculation
                const calculatedA = numValue * (ratioA / ratioB) / exchangeRate;
                setAmountA(calculatedA.toFixed(9));

                // Also encrypt amount A
                try {
                    const encryptedA = await encryptAmount(calculatedA.toFixed(9));
                    setEncryptedAmountA(encryptedA);
                } catch (err) {
                    console.error('[CreatePosition] Amount A encryption failed:', err);
                }
            }
        } else if (!value) {
            setAmountA('');
            setEncryptedAmountA(null);
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
                whirlpool: poolAddress || '',
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
            case 'encrypting': return '🔒 Securing with Inco encryption...';
            case 'signing': return 'Please approve in your wallet...';
            case 'confirming': return 'Confirming on-chain...';
            case 'success': return '✅ Position created securely!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-black/30 w-full max-w-[1600px] border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-gradient-to-r from-blue-950/50 to-slate-950/50 backdrop-blur-md z-10">
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
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        {/* Column 1: News Panel - Border Right */}
                        <div className="w-full lg:w-[15%] p-4 bg-gradient-to-br from-blue-950/40 to-slate-950/40 backdrop-blur-md overflow-hidden border-r border-white/5">
                            <TokenNewsPanel
                                tokenA={tokenA}
                                tokenB={tokenB}
                                isOpen={isOpen}
                            />
                        </div>

                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        {/* Column 2: Chart - Border Right */}
                        <div className="w-full lg:w-[35%] p-4 bg-gradient-to-br from-blue-950/40 to-slate-950/40 backdrop-blur-md space-y-4 overflow-hidden flex flex-col border-r border-white/5">
                            <div className="flex-1 w-full min-h-[350px]">
                                <PriceChart
                                    coinId={getCoinGeckoId(displayToken)}
                                    title={`${displayToken} Price`}
                                />
                            </div>

                            {/* Staking Yield Card - Shows for LST tokens */}
                            <StakingYieldCard
                                tokenA={tokenA}
                                tokenB={tokenB}
                                lpAPY={15}
                            />
                        </div>

                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        {/* Column 3: Inputs (Wider) - Border Right */}
                        <div className="w-full lg:w-[28%] p-4 space-y-4 bg-gradient-to-br from-blue-950/40 to-slate-950/40 backdrop-blur-md overflow-hidden border-r border-white/5">
                            {/* Info Banner */}
                            <div className="bg-[#172554] border border-blue-900/50 rounded-lg p-3 flex items-start gap-2">
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
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${selectedPreset === preset
                                            ? 'bg-primary border-primary text-primary-foreground shadow-md'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                                            }`}
                                    >
                                        {preset === 'custom' ? 'Custom' : `±${preset}`}
                                    </button>
                                ))}
                            </div>

                            {/* Range Display - Solid Panel */}
                            <div className="bg-[#0a0e1a] rounded-xl overflow-hidden ring-1 ring-[#1e293b]">
                                {/* Table Header */}
                                <div className="px-4 py-3 bg-[#111827] border-b border-[#1e293b]">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Position Details</span>
                                    </div>
                                </div>

                                {/* Table Rows */}
                                <div className="divide-y divide-[#1e293b]">
                                    {/* Price Range Row */}
                                    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1e293b]/20 transition-colors">
                                        <span className="text-sm text-slate-400 font-medium">Price Range</span>
                                        <div className="flex items-center gap-1.5 font-mono text-white font-semibold">
                                            <span>${minPrice || '—'}</span>
                                            <span className="text-slate-500">-</span>
                                            <span>${maxPrice || '—'}</span>
                                        </div>
                                    </div>

                                    {/* Current Price Row */}
                                    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1e293b]/20 transition-colors">
                                        <span className="text-sm text-slate-400 font-medium">Current Price</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-white font-semibold">
                                                {priceLoading ? 'Loading...' : `$${currentPrice.toFixed(4)}`}
                                            </span>
                                            <span className="text-xs text-emerald-400 font-medium px-1.5 py-0.5 bg-emerald-500/10 rounded">Live</span>
                                        </div>
                                    </div>

                                    {/* Estimated Yield Row (Dynamic) */}
                                    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1e293b]/20 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-400 font-medium border-b border-dotted border-slate-500 cursor-help" title="This is an estimate assuming constant volume and price staying in range.">
                                                Estimated Yield
                                            </span>
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e293b] border border-[#334155]">
                                                <div className="w-2.5 h-2.5 text-emerald-400">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300">24H</span>
                                                <div className="w-2 h-2 text-slate-500">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-emerald-400 font-bold text-lg">
                                                {(() => {
                                                    if (!minPrice || !maxPrice || currentPrice <= 0 || parseFloat(minPrice) >= parseFloat(maxPrice)) return '0.000%';

                                                    const min = parseFloat(minPrice);
                                                    const max = parseFloat(maxPrice);
                                                    const rangeDelta = (max - min) / currentPrice;

                                                    if (rangeDelta === 0) return '0.000%';

                                                    // HEURISTIC MODEL:
                                                    // Yield scales inversely with range width (concentration).
                                                    // We use a reference point derived from pool performance (Base Yield at Reference Width).

                                                    const BASE_YIELD_24H = 0.230; // 0.23% daily yield at +/- 10% range for a 0.30% pool
                                                    const REFERENCE_RANGE_WIDTH = 0.20; // 20% width (+/- 10%)
                                                    const REFERENCE_FEE_TIER = 0.30; // The fee tier the base yield is calibrated for

                                                    // Fee Tier Scaling: Higher fees = Higher potential yield
                                                    // e.g. 0.01% pool earns ~1/30th of a 0.30% pool (simplified)
                                                    const feeTierFactor = feeTier / REFERENCE_FEE_TIER;

                                                    // Formula: BaseYield * FeeFactor * (RefWidth / CurrentWidth)
                                                    const yieldVal = BASE_YIELD_24H * feeTierFactor * (REFERENCE_RANGE_WIDTH / rangeDelta);

                                                    return yieldVal.toFixed(3) + '%';
                                                })()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Deposit Ratio Row */}
                                    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1e293b]/20 transition-colors">
                                        <span className="text-sm text-slate-400 font-medium">Deposit Ratio</span>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#1e293b] text-cyan-400 font-bold text-sm ring-1 ring-cyan-500/20">
                                                {ratioA.toFixed(0)}% {tokenA}
                                            </span>
                                            <span className="text-slate-500">/</span>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#1e293b] text-purple-400 font-bold text-sm ring-1 ring-purple-500/20">
                                                {ratioB.toFixed(0)}% {tokenB}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Range Status Footer */}
                                {!isInRange && minPrice && maxPrice && (
                                    <div className="px-4 py-3 bg-yellow-900/10 border-t border-yellow-500/20 flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-yellow-400" />
                                        <span className="text-xs text-yellow-400 font-medium">Current price is outside your range</span>
                                    </div>
                                )}
                            </div>

                            {/* Inco Security Status */}
                            {(encryptedAmountA || encryptedAmountB) && (
                                <SecurityStatusBanner
                                    isEncrypted={true}
                                    tokenSymbol={tokenA}
                                />
                            )}

                            {/* Deposit Amounts - Solid Panel */}
                            <div className="bg-[#0a0e1a] rounded-xl overflow-hidden ring-1 ring-[#1e293b]">
                                {/* Table Header */}
                                <div className="px-4 py-3 bg-[#111827] border-b border-[#1e293b] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deposit Amount</span>
                                    </div>
                                    {encryptedAmountA && (
                                        <InlineSecurityIndicator isSecured={true} />
                                    )}
                                </div>

                                {/* Token Inputs */}
                                <div className="divide-y divide-[#1e293b]">
                                    {/* Token A Input Row */}
                                    <div className="p-4 hover:bg-[#1e293b]/20 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="number"
                                                value={amountA}
                                                onChange={(e) => handleAmountAChange(e.target.value)}
                                                placeholder="0"
                                                className="bg-transparent text-2xl font-bold text-white focus:outline-none w-full placeholder:text-slate-600"
                                            />
                                            <div className="flex items-center gap-2 ml-2 px-3 py-1.5 bg-[#1e293b] rounded-lg ring-1 ring-purple-500/20">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 shadow-lg shadow-purple-500/20"></div>
                                                <span className="font-bold text-white">{tokenA}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs mt-2 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">${amountA ? (parseFloat(amountA) * (tokenAPriceUsd || currentPrice)).toFixed(2) : '0.00'}</span>
                                            {encryptedAmountA && (
                                                <code className="text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded-lg text-[10px] font-mono ring-1 ring-emerald-500/20">
                                                    🔒 {formatEncryptedDisplay(encryptedAmountA.encrypted, 8)}
                                                </code>
                                            )}
                                        </div>
                                    </div>

                                    {/* Token B Input Row */}
                                    <div className="p-4 hover:bg-[#1e293b]/20 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="number"
                                                value={amountB}
                                                onChange={(e) => handleAmountBChange(e.target.value)}
                                                placeholder="0"
                                                className="bg-transparent text-2xl font-bold text-white focus:outline-none w-full placeholder:text-slate-600"
                                            />
                                            <div className="flex items-center gap-2 ml-2 px-3 py-1.5 bg-[#1e293b] rounded-lg ring-1 ring-emerald-500/20">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/20"></div>
                                                <span className="font-bold text-white">{tokenB}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs mt-2 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">${amountB ? (parseFloat(amountB) * (tokenBPriceUsd || 1)).toFixed(2) : '0.00'}</span>
                                            {encryptedAmountB && (
                                                <code className="text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded-lg text-[10px] font-mono ring-1 ring-emerald-500/20">
                                                    🔒 {formatEncryptedDisplay(encryptedAmountB.encrypted, 8)}
                                                </code>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Settings Row */}
                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => setViewMode('range')}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                    >
                                        <Settings size={14} />
                                        Adjust Range
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {/* Dev Block Toggle */}
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById('dev-info-block');
                                                if (el) el.classList.toggle('hidden');
                                            }}
                                            className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded hover:bg-purple-500/20 transition-colors"
                                        >
                                            DEV
                                        </button>
                                        <span className="text-xs text-muted-foreground ml-1">Slippage:</span>
                                        <span className="text-xs font-medium bg-muted/50 px-2 py-1 rounded">
                                            {slippage}%
                                        </span>
                                    </div>
                                </div>

                                {/* Hidden Dev Info Block */}
                                <div id="dev-info-block" className="hidden mt-2 p-3 bg-black/40 border border-purple-500/20 rounded-lg text-xs font-mono space-y-1">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Pool Address:</span>
                                        <span className="text-purple-300 truncate max-w-[120px]" title={poolAddress || ''}>{(poolAddress || '').substring(0, 8)}...</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Current Tick:</span>
                                        <span className="text-purple-300">
                                            {liquidityData && liquidityData.length > 0 ? liquidityData[Math.floor(liquidityData.length / 2)]?.tick || 'Loading' : 'Wait'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Price Impact:</span>
                                        <span className="text-emerald-400">~0.05%</span>
                                    </div>
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
                                ⚡ Encrypted transaction executed on Solana. Gas fees paid in SOL.
                            </div>

                            {/* Create Position / Connect Wallet Button (Visual Update) */}
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
                                        disabled={isSubmitting}
                                        className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${!connected
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20' /* Highlighted Connect Wallet */
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                                            }`}
                                    >
                                        {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                                        {!connected ? 'Connect Wallet' : isSubmitting ? 'Creating...' : 'Create Position'}
                                    </button>
                                )
                            }
                        </div>

                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        {/* Column 4: AI Insights */}
                        <div className="w-full lg:w-[25%] p-4 bg-gradient-to-br from-blue-950/40 to-slate-950/40 backdrop-blur-md overflow-hidden">
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
                                    // ONLY auto-set if fields are empty (first load)
                                    // This prevents overriding user input
                                    if (minPrice === '' && maxPrice === '') {
                                        setMinPrice(lower.toFixed(4));
                                        setMaxPrice(upper.toFixed(4));
                                    }
                                }}
                                onApplyPrediction={(lower, upper) => {
                                    // Force update when user clicks "Use AI Prediction"
                                    setMinPrice(lower.toFixed(4));
                                    setMaxPrice(upper.toFixed(4));
                                    setSelectedPreset('custom');
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
                        <div className="flex items-center justify-between gap-4 bg-blue-600/5 backdrop-blur-md p-2 border border-blue-500/20 rounded-lg">
                            <button
                                onClick={() => {
                                    setMinPrice('0');
                                    setMaxPrice('999999');
                                }}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-all rounded-md ${minPrice === '0'
                                    ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Full Range
                            </button>

                            {/* Current Price Highlight */}
                            <div className="flex flex-col items-center px-4 py-1 bg-black/20 rounded-md border border-purple-500/20 shadow-inner">
                                <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">Current Price</span>
                                <span className="font-mono text-lg font-bold text-purple-400">
                                    ${currentPrice.toFixed(4)}
                                </span>
                            </div>

                            <button
                                onClick={() => applyPreset('5%', currentPrice)}
                                className={`flex-1 py-2 px-4 text-sm font-medium transition-all rounded-md ${minPrice !== '0'
                                    ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Visual Range Selector (Purple & Interactive) */}
                        <div
                            className="bg-gradient-to-br from-blue-600/5 to-indigo-600/5 backdrop-blur-md border border-blue-500/10 rounded-xl p-4 h-64 relative overflow-hidden select-none cursor-crosshair group shadow-inner"
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
                                <label className="text-xs text-slate-400">Min Price</label>
                                <div className="flex items-center bg-blue-600/5 backdrop-blur-md border border-blue-500/20 rounded-lg overflow-hidden group focus-within:border-purple-500/50 transition-colors">
                                    <button
                                        onClick={() => setMinPrice((parseFloat(minPrice) - 1).toFixed(4))}
                                        className="p-3 text-slate-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-r border-blue-500/10"
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
                                        className="flex-1 bg-transparent text-center font-mono text-sm text-white focus:outline-none"
                                    />
                                    <button
                                        onClick={() => setMinPrice((parseFloat(minPrice) + 1).toFixed(4))}
                                        className="p-3 text-slate-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-l border-blue-500/10"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Max Price</label>
                                <div className="flex items-center bg-blue-600/5 backdrop-blur-md border border-blue-500/20 rounded-lg overflow-hidden group focus-within:border-purple-500/50 transition-colors">
                                    <button
                                        onClick={() => setMaxPrice((parseFloat(maxPrice) - 1).toFixed(4))}
                                        className="p-3 text-slate-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-r border-blue-500/10"
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
                                        className="flex-1 bg-transparent text-center font-mono text-sm text-white focus:outline-none"
                                    />
                                    <button
                                        onClick={() => setMaxPrice((parseFloat(maxPrice) + 1).toFixed(4))}
                                        className="p-3 text-slate-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-l border-blue-500/10"
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
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-[0.99]"
                        >
                            Confirm Range
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

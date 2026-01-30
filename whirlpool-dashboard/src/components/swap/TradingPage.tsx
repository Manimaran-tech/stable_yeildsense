import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle2, Wallet, Zap, TrendingUp, Shield } from 'lucide-react';
import { tradingApi } from '../../api';
import type { SwapQuote } from '../../api';

// Common tokens for swap
const TOKENS = [
    { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9, icon: '◎', color: 'from-purple-500 to-blue-500' },
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, icon: '💵', color: 'from-green-500 to-emerald-500' },
    { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, icon: '💲', color: 'from-green-400 to-teal-500' },
    { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, icon: '🐕', color: 'from-orange-500 to-yellow-500' },
    { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6, icon: '🪐', color: 'from-lime-500 to-green-500' },
    { symbol: 'PENGU', mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', decimals: 6, icon: '🐧', color: 'from-cyan-500 to-blue-500' },
    { symbol: 'JupSOL', mint: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v', decimals: 9, icon: '🌟', color: 'from-yellow-500 to-orange-500' },
];

interface SwapState {
    loading: boolean;
    quoteLoading: boolean;
    error: string | null;
    success: string | null;
    quote: SwapQuote | null;
}

export function TradingPage() {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();

    const [inputToken, setInputToken] = useState(TOKENS[0]); // SOL
    const [outputToken, setOutputToken] = useState(TOKENS[1]); // USDC
    const [inputAmount, setInputAmount] = useState('');
    const [slippageBps, setSlippageBps] = useState(50); // 0.5%

    const [state, setState] = useState<SwapState>({
        loading: false,
        quoteLoading: false,
        error: null,
        success: null,
        quote: null,
    });

    // Swap input/output tokens
    const handleSwapTokens = useCallback(() => {
        setInputToken(outputToken);
        setOutputToken(inputToken);
        setInputAmount('');
        setState(s => ({ ...s, quote: null, error: null }));
    }, [inputToken, outputToken]);

    // Get quote from trading API
    const handleGetQuote = useCallback(async () => {
        if (!publicKey || !inputAmount) return;

        setState(s => ({ ...s, quoteLoading: true, error: null, quote: null }));

        try {
            const amountInSmallest = Math.floor(
                parseFloat(inputAmount) * Math.pow(10, inputToken.decimals)
            ).toString();

            const quote = await tradingApi.getQuote({
                inputMint: inputToken.mint,
                outputMint: outputToken.mint,
                amount: amountInSmallest,
                slippageBps,
                userPubkey: publicKey.toBase58(),
            });

            setState(s => ({ ...s, quoteLoading: false, quote }));
        } catch (error: any) {
            setState(s => ({
                ...s,
                quoteLoading: false,
                error: error.message || 'Failed to get quote',
            }));
        }
    }, [publicKey, inputAmount, inputToken, outputToken, slippageBps]);

    // Execute swap
    const handleSwap = useCallback(async () => {
        if (!publicKey || !signTransaction || !state.quote) return;

        setState(s => ({ ...s, loading: true, error: null, success: null }));

        try {
            // Deserialize the unsigned transaction
            const txBuffer = Buffer.from(state.quote.tx, 'base64');
            const transaction = VersionedTransaction.deserialize(txBuffer);

            // Sign with wallet
            const signedTx = await signTransaction(transaction);

            // Send transaction
            const signature = await connection.sendTransaction(signedTx, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
            });

            // Wait for confirmation
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');

            if (confirmation.value.err) {
                throw new Error('Transaction failed on-chain');
            }

            setState(s => ({
                ...s,
                loading: false,
                success: `Swap successful! Signature: ${signature.slice(0, 20)}...`,
                quote: null,
            }));
            setInputAmount('');
        } catch (error: any) {
            setState(s => ({
                ...s,
                loading: false,
                error: error.message || 'Swap failed',
            }));
        }
    }, [publicKey, signTransaction, connection, state.quote]);

    // Format output amount for display
    const formatOutputAmount = (amount: string, decimals: number) => {
        const num = parseFloat(amount) / Math.pow(10, decimals);
        return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    return (
        <div className="max-w-xl mx-auto pt-0 pb-4">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-full mb-4">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium text-indigo-300">Instant Swaps</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent mb-2">
                    Swap Tokens
                </h1>
                <p className="text-slate-400 text-base">
                    Trade tokens with Jupiter + Orca routing for best rates
                </p>
            </div>

            {/* Main Swap Card */}
            <div className="relative">
                {/* Glow effect behind card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-50" />

                <div className="relative bg-[#0a0e1a]/90 backdrop-blur-xl border border-[#1e293b] rounded-3xl p-6 shadow-2xl">
                    {/* Input Token Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-400">You pay</label>
                            {connected && (
                                <span className="text-xs text-slate-500">Balance: --</span>
                            )}
                        </div>
                        <div className="flex gap-3 p-3 bg-[#111827] border border-[#1e293b] rounded-2xl hover:border-indigo-500/30 transition-colors">
                            <div className="relative">
                                <select
                                    value={inputToken.symbol}
                                    onChange={(e) => {
                                        const token = TOKENS.find(t => t.symbol === e.target.value);
                                        if (token && token.symbol !== outputToken.symbol) {
                                            setInputToken(token);
                                            setState(s => ({ ...s, quote: null }));
                                        }
                                    }}
                                    className="appearance-none bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 rounded-xl pl-4 pr-10 py-3 text-lg font-semibold text-white cursor-pointer hover:border-indigo-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    {TOKENS.map(t => (
                                        <option key={t.symbol} value={t.symbol} disabled={t.symbol === outputToken.symbol} className="bg-slate-800">
                                            {t.icon} {t.symbol}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={inputAmount}
                                onChange={(e) => {
                                    setInputAmount(e.target.value);
                                    setState(s => ({ ...s, quote: null }));
                                }}
                                className="flex-1 bg-transparent text-2xl text-right font-mono text-white placeholder-slate-600 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Swap Direction Button */}
                    <div className="w-full flex items-center justify-center my-3">
                        <button
                            onClick={handleSwapTokens}
                            className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all shadow-lg shadow-indigo-500/25 border border-indigo-400/20 hover:scale-105 active:scale-95"
                        >
                            <ArrowDownUp className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Output Token Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-400">You receive</label>
                        </div>
                        <div className="flex gap-3 p-3 bg-[#111827] border border-[#1e293b] rounded-2xl">
                            <div className="relative">
                                <select
                                    value={outputToken.symbol}
                                    onChange={(e) => {
                                        const token = TOKENS.find(t => t.symbol === e.target.value);
                                        if (token && token.symbol !== inputToken.symbol) {
                                            setOutputToken(token);
                                            setState(s => ({ ...s, quote: null }));
                                        }
                                    }}
                                    className="appearance-none bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 rounded-xl pl-4 pr-10 py-3 text-lg font-semibold text-white cursor-pointer hover:border-indigo-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    {TOKENS.map(t => (
                                        <option key={t.symbol} value={t.symbol} disabled={t.symbol === inputToken.symbol} className="bg-slate-800">
                                            {t.icon} {t.symbol}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1 text-2xl text-right font-mono text-slate-400">
                                {state.quote
                                    ? <span className="text-emerald-400">{formatOutputAmount(state.quote.outAmount, outputToken.decimals)}</span>
                                    : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Slippage Settings */}
                    <div className="mt-4 p-3 bg-[#111827]/50 border border-[#1e293b] rounded-xl">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Slippage tolerance
                            </span>
                            <div className="flex gap-2">
                                {[50, 100, 300].map(bps => (
                                    <button
                                        key={bps}
                                        onClick={() => setSlippageBps(bps)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${slippageBps === bps
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                    >
                                        {bps / 100}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quote Details */}
                    {state.quote && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Route
                                </span>
                                <span className="font-medium text-emerald-400">{state.quote.route}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Price Impact</span>
                                <span className={parseFloat(state.quote.priceImpact) > 1 ? 'text-yellow-400' : 'text-emerald-400'}>
                                    {state.quote.priceImpact}%
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Max Slippage</span>
                                <span className="text-white">{state.quote.slippageBps / 100}%</span>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {state.error && (
                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{state.error}</span>
                        </div>
                    )}

                    {/* Success Message */}
                    {state.success && (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{state.success}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4">
                        {!connected ? (
                            <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-xl text-center text-slate-400 flex items-center justify-center gap-3">
                                <Wallet className="w-5 h-5" />
                                <span>Connect wallet to start trading</span>
                            </div>
                        ) : !state.quote ? (
                            <button
                                onClick={handleGetQuote}
                                disabled={!inputAmount || state.quoteLoading}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {state.quoteLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Fetching best rate...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-5 h-5" />
                                        Get Quote
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleSwap}
                                disabled={state.loading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {state.loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Processing swap...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Confirm Swap
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>



            {/* Power by Info */}
            <p className="text-center text-xs text-slate-500 mt-4">
                Powered by <span className="text-indigo-400">Jupiter</span> and <span className="text-purple-400">Orca Whirlpools</span>
            </p>
        </div>
    );
}

export default TradingPage;


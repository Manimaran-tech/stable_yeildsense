import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { X, Info, Loader2, Plus, TrendingUp } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';
import { encryptAmount, formatEncryptedDisplay, type EncryptedAmount } from '../services/incoService';
import { SecurityStatusBanner } from './SecurityBadge';
import { getTokenPrice } from '../services/priceService';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    poolAddress: string;
    tokenA?: string;
    tokenB?: string;
    onSuccess?: () => void;
}

export const DepositModal: FC<DepositModalProps> = ({
    isOpen,
    onClose,
    poolAddress,
    tokenA = 'SOL',
    tokenB: _tokenB = 'USDC',
    onSuccess
}) => {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [amountA, setAmountA] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'encrypting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Current price state
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceLoading, setPriceLoading] = useState(true);

    const [encryptedAmount, setEncryptedAmount] = useState<EncryptedAmount | null>(null);

    // Fetch current price when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchPrice = async () => {
            setPriceLoading(true);
            try {
                // Get price for the primary token (SOL in SOL/USDC)
                const price = await getTokenPrice(tokenA);
                setCurrentPrice(price);

                // Auto-set a 5% range based on current price
                if (price > 0) {
                    const min = price * 0.95;
                    const max = price * 1.05;
                    setMinPrice(min.toFixed(4));
                    setMaxPrice(max.toFixed(4));
                }
            } catch (error) {
                console.error("Failed to fetch price:", error);
            } finally {
                setPriceLoading(false);
            }
        };

        fetchPrice();
    }, [isOpen, tokenA]);

    // Apply price range preset
    const applyPreset = (percentage: number) => {
        if (!currentPrice || currentPrice <= 0) return;
        const min = currentPrice * (1 - percentage);
        const max = currentPrice * (1 + percentage);
        setMinPrice(min.toFixed(4));
        setMaxPrice(max.toFixed(4));
    };

    if (!isOpen) return null;

    const handleDeposit = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Please connect your wallet.");
            return;
        }

        if (!amountA || !minPrice || !maxPrice) {
            setErrorMessage("Please fill in all fields.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            console.log("Deposit: Building transaction for pool:", poolAddress);

            setTxStatus('encrypting');
            const encrypted = await encryptAmount(amountA);
            setEncryptedAmount(encrypted);
            console.log("Deposit: Amount encrypted:", encrypted.encrypted.substring(0, 20) + '...');

            setTxStatus('building');

            const response = await api.createOrDeposit({
                wallet: publicKey.toString(),
                whirlpool: poolAddress,
                priceLower: minPrice,
                priceUpper: maxPrice,
                amountA: amountA
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("Deposit: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("Deposit: Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');
            setTxStatus('success');

            if (onSuccess) {
                onSuccess();
            }

        } catch (error) {
            console.error("Deposit failed:", error);
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
            case 'success': return '✅ Liquidity added securely!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pb-4 px-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-[#0a0e1a] w-full max-w-2xl max-h-[90vh] rounded-2xl border border-[#1e293b] shadow-2xl shadow-blue-500/10 animate-in fade-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
                {/* Premium Header */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10" />
                    <div className="relative flex items-center justify-between p-4 border-b border-[#1e293b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                                <Plus size={20} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Add Liquidity
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#2d3a4f] text-gray-400 hover:text-white transition-all duration-200"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    {/* Current Price Display */}
                    <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-400" />
                                <span className="text-sm text-gray-400">Current {tokenA} Price</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {priceLoading ? (
                                    <Loader2 size={16} className="animate-spin text-blue-400" />
                                ) : (
                                    <>
                                        <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                            ${currentPrice?.toFixed(4) || '—'}
                                        </span>
                                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Live</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <Info className="text-blue-400 shrink-0" size={16} />
                        <p className="text-xs text-gray-400">Fees earned only when price is within your range.</p>
                    </div>

                    {/* Quick Range Presets */}
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Quick Range</label>
                        <div className="flex gap-2">
                            {[
                                { label: '±1%', value: 0.01 },
                                { label: '±5%', value: 0.05 },
                                { label: '±10%', value: 0.10 },
                                { label: '±20%', value: 0.20 },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => applyPreset(preset.value)}
                                    disabled={priceLoading || !currentPrice}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                                        bg-[#1e293b] text-gray-400 hover:bg-[#2d3a4f] hover:text-white 
                                        border border-[#2d3a4f] disabled:opacity-50 disabled:cursor-not-allowed
                                        hover:border-blue-500/50"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Price Range</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 focus-within:border-blue-500/50 transition-colors">
                                <span className="text-[10px] text-gray-500 block mb-1">Min Price</span>
                                <input
                                    type="number"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-transparent focus:outline-none font-mono text-base text-white placeholder-gray-600"
                                />
                            </div>
                            <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 focus-within:border-blue-500/50 transition-colors">
                                <span className="text-[10px] text-gray-500 block mb-1">Max Price</span>
                                <input
                                    type="number"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-transparent focus:outline-none font-mono text-base text-white placeholder-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deposit Amount */}
                    <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Deposit Amount</label>
                        <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 flex items-center justify-between focus-within:border-blue-500/50 transition-colors">
                            <input
                                type="number"
                                value={amountA}
                                onChange={(e) => setAmountA(e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent text-xl font-semibold focus:outline-none w-full text-white placeholder-gray-600"
                            />
                            <span className="font-bold text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent ml-3">{tokenA}</span>
                        </div>
                    </div>

                    {/* Security Status */}
                    <div className="space-y-2">
                        <SecurityStatusBanner isEncrypted={true} tokenSymbol={tokenA} />
                        {encryptedAmount && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 p-2 bg-[#111827] rounded-lg">
                                <span>🔒 Encrypted:</span>
                                <code className="text-emerald-400 bg-emerald-900/50 px-2 py-1 rounded font-mono">
                                    {formatEncryptedDisplay(encryptedAmount.encrypted, 12)}
                                </code>
                            </div>
                        )}
                    </div>

                    {/* Transaction Status */}
                    {txStatus !== 'idle' && (
                        <div className={`p-4 rounded-xl border backdrop-blur-sm ${txStatus === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : txStatus === 'error'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-blue-500/10 border-blue-500/30'
                            }`}>
                            <div className="flex items-center gap-3">
                                {txStatus !== 'success' && txStatus !== 'error' && (
                                    <Loader2 className="animate-spin" size={18} />
                                )}
                                <span className={`text-sm font-medium ${txStatus === 'success' ? 'text-emerald-400' : txStatus === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                                    {getStatusMessage()}
                                </span>
                            </div>
                            {txSignature && (
                                <a
                                    href={`https://solscan.io/tx/${txSignature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 transition-colors"
                                >
                                    View on Solscan →
                                </a>
                            )}
                            {errorMessage && (
                                <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
                            )}
                        </div>
                    )}

                    {/* Info Footer */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 p-3 bg-[#111827] rounded-lg">
                        <span className="text-amber-400">⚡</span>
                        <span>Encrypted transaction executed on Solana. Gas fees paid in SOL.</span>
                    </div>
                </div>

                {/* Action Button */}
                <div className="p-4 border-t border-[#1e293b] bg-[#0d1220]">
                    {txStatus === 'success' ? (
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-[#1e293b] text-white font-bold rounded-xl hover:bg-[#2d3a4f] transition-all duration-200"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            onClick={handleDeposit}
                            disabled={isSubmitting || !amountA || !minPrice || !maxPrice}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 text-white font-bold rounded-xl 
                                hover:from-blue-500 hover:via-cyan-500 hover:to-emerald-500 
                                transition-all duration-300 
                                shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2
                                hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                            {isSubmitting ? "Processing..." : "Add Liquidity"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

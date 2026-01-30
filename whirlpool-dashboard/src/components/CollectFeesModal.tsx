import { useState } from 'react';
import type { FC } from 'react';
import { X, Loader2, Coins, AlertTriangle } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';

interface CollectFeesModalProps {
    isOpen: boolean;
    onClose: () => void;
    positionAddress: string;
    positionMint: string;
    poolPair: string;
    unclaimedFeesA: string;
    unclaimedFeesB: string;
    onSuccess?: () => void;
}

export const CollectFeesModal: FC<CollectFeesModalProps> = ({
    isOpen,
    onClose,
    positionAddress,
    positionMint,
    poolPair,
    unclaimedFeesA,
    unclaimedFeesB,
    onSuccess
}) => {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [collectedAmounts, setCollectedAmounts] = useState<{ tokenA: string; tokenB: string } | null>(null);

    if (!isOpen) return null;

    const hasUnclaimedFees = BigInt(unclaimedFeesA || '0') > 0 || BigInt(unclaimedFeesB || '0') > 0;

    const handleCollectFees = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Wallet not connected. Please connect your wallet.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            console.log("CollectFees: Building transaction for position mint:", positionMint);

            const response = await api.collectFees({
                wallet: publicKey.toString(),
                positionMint: positionMint
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("CollectFees: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("CollectFees: Transaction sent, awaiting confirmation:", signature);

            setTxStatus('success');
            setCollectedAmounts({
                tokenA: formatTokenAmount(unclaimedFeesA, 9),
                tokenB: formatTokenAmount(unclaimedFeesB, 6),
            });

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error("CollectFees failed:", error);
            setTxStatus('error');
            setErrorMessage((error as Error).message || "Transaction failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTokenAmount = (amount: string, decimals: number): string => {
        try {
            const num = BigInt(amount);
            const divisor = BigInt(10 ** decimals);
            const whole = num / divisor;
            const fraction = num % divisor;
            return `${whole}.${fraction.toString().padStart(decimals, '0').slice(0, 6)}`;
        } catch {
            return '0';
        }
    };

    const getStatusMessage = () => {
        switch (txStatus) {
            case 'building': return 'Building transaction...';
            case 'signing': return 'Please approve in your wallet...';
            case 'confirming': return 'Confirming on-chain...';
            case 'success': return '✅ Fees collected successfully!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-[#0a0e1a] w-full max-w-md rounded-2xl border border-[#1e293b] shadow-2xl shadow-emerald-500/10 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                {/* Premium Header */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10" />
                    <div className="relative flex items-center justify-between p-6 border-b border-[#1e293b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                                <Coins size={20} className="text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Collect Fees
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

                <div className="p-6 space-y-5">
                    {/* Pool Info Card */}
                    <div className="bg-[#111827] p-4 rounded-xl border border-[#1e293b] space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Pool</span>
                            <span className="font-semibold text-white">{poolPair}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Position</span>
                            <span className="font-mono text-xs bg-[#1e293b] px-3 py-1.5 rounded-lg text-gray-300">
                                {positionAddress.slice(0, 8)}...{positionAddress.slice(-6)}
                            </span>
                        </div>
                    </div>

                    {/* Unclaimed Fees */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-400">Unclaimed Fees</h4>
                        {hasUnclaimedFees ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#111827] border border-emerald-500/20 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                        {formatTokenAmount(unclaimedFeesA, 9)}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">SOL</div>
                                </div>
                                <div className="bg-[#111827] border border-emerald-500/20 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                        {formatTokenAmount(unclaimedFeesB, 6)}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">USDC</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <AlertTriangle className="text-amber-400" size={20} />
                                <span className="text-sm text-amber-300">No unclaimed fees available</span>
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
                                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-3 transition-colors"
                                >
                                    View on Solscan →
                                </a>
                            )}
                            {errorMessage && (
                                <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
                            )}
                        </div>
                    )}

                    {/* Success: Collected Amounts */}
                    {txStatus === 'success' && collectedAmounts && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-emerald-400 mb-3">Collected</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">SOL</span>
                                    <span className="font-mono font-semibold text-emerald-400">{collectedAmounts.tokenA}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">USDC</span>
                                    <span className="font-mono font-semibold text-emerald-400">{collectedAmounts.tokenB}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info Footer */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 p-3 bg-[#111827] rounded-lg">
                        <span className="text-amber-400">⚡</span>
                        <span>This is an on-chain transaction requiring SOL for gas fees.</span>
                    </div>
                </div>

                {/* Action Button */}
                <div className="p-6 border-t border-[#1e293b] bg-[#0d1220]">
                    {txStatus === 'success' ? (
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-[#1e293b] text-white font-bold rounded-xl hover:bg-[#2d3a4f] transition-all duration-200"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            onClick={handleCollectFees}
                            disabled={isSubmitting || !hasUnclaimedFees}
                            className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-bold rounded-xl 
                                hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 
                                transition-all duration-300 
                                shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2
                                hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                            {isSubmitting ? 'Processing...' : 'Collect Fees'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

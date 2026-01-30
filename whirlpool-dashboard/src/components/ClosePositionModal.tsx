import { useState } from 'react';
import type { FC } from 'react';
import { X, Loader2, Trash2, AlertTriangle, Flame } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';

interface ClosePositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    positionAddress: string;
    positionMint: string;
    poolPair: string;
    liquidity: string;
    onSuccess?: () => void;
}

export const ClosePositionModal: FC<ClosePositionModalProps> = ({
    isOpen,
    onClose,
    positionAddress,
    positionMint,
    poolPair,
    liquidity,
    onSuccess
}) => {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const hasLiquidity = liquidity !== '0' && liquidity !== '0.00' && liquidity !== '0K' && !liquidity.startsWith('0');

    const handleClosePosition = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Wallet not connected. Please connect your wallet.");
            return;
        }

        if (hasLiquidity) {
            setErrorMessage("Position still has liquidity. Please withdraw all liquidity first.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            console.log("ClosePosition: Building transaction for position mint:", positionMint);

            const response = await api.closePosition({
                wallet: publicKey.toString(),
                positionMint: positionMint
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("ClosePosition: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("ClosePosition: Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');
            setTxStatus('success');

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error("ClosePosition failed:", error);
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
            case 'success': return '✅ Position closed successfully!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-[#0a0e1a] w-full max-w-md rounded-2xl border border-[#1e293b] shadow-2xl shadow-red-500/10 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                {/* Premium Header with red accent */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10" />
                    <div className="relative flex items-center justify-between p-6 border-b border-[#1e293b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
                                <Trash2 size={20} className="text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Close Position
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
                    {/* Danger Warning */}
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <AlertTriangle className="text-red-400" size={18} />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-red-300 mb-1">This action is irreversible</p>
                            <p className="text-gray-400">Closing this position will burn your position NFT. Make sure you have withdrawn all liquidity first.</p>
                        </div>
                    </div>

                    {/* Position Info Card */}
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
                        <div className="flex justify-between items-center pt-2 border-t border-[#1e293b]">
                            <span className="text-sm text-gray-400">Remaining Liquidity</span>
                            <span className={`font-mono font-semibold ${hasLiquidity ? 'text-red-400' : 'text-emerald-400'}`}>
                                {liquidity || '0'}
                            </span>
                        </div>
                    </div>

                    {/* Liquidity Warning */}
                    {hasLiquidity && (
                        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                            <AlertTriangle className="text-amber-400" size={20} />
                            <span className="text-sm text-amber-300">Withdraw all liquidity before closing</span>
                        </div>
                    )}

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
                                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-3 transition-colors"
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
                    <div className="space-y-2 p-3 bg-[#111827] rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="text-amber-400">⚡</span>
                            <span>This is an on-chain transaction requiring SOL for gas fees.</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Flame size={12} className="text-orange-400" />
                            <span>Your position NFT will be burned permanently.</span>
                        </div>
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
                            onClick={handleClosePosition}
                            disabled={isSubmitting || hasLiquidity}
                            className="w-full py-4 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white font-bold rounded-xl 
                                hover:from-red-500 hover:via-orange-500 hover:to-amber-500 
                                transition-all duration-300 
                                shadow-lg shadow-red-500/25 hover:shadow-red-500/40
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2
                                hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                            <Flame size={18} />
                            {isSubmitting ? 'Processing...' : 'Close Position & Burn NFT'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

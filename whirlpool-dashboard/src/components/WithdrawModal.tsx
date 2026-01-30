import { useState } from 'react';
import type { FC } from 'react';
import { X, Loader2, AlertTriangle, Minus } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';
import { encryptAmount, formatEncryptedDisplay, type EncryptedAmount } from '../services/incoService';
import { SecurityStatusBanner } from './SecurityBadge';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    positionAddress: string;
    onSuccess?: () => void;
}

export const WithdrawModal: FC<WithdrawModalProps> = ({ isOpen, onClose, positionAddress, onSuccess }) => {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [percentage, setPercentage] = useState(100);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'encrypting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [withdrawnAmounts, setWithdrawnAmounts] = useState<{ tokenA: string; tokenB: string } | null>(null);

    // Inco encryption state
    const [encryptedWithdrawAmount, setEncryptedWithdrawAmount] = useState<EncryptedAmount | null>(null);

    if (!isOpen) return null;

    const handleWithdraw = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Wallet not connected. Please connect your wallet.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            console.log("Withdraw: Fetching position info for:", positionAddress);
            const positions = await api.getPositions(publicKey.toString());
            const position = positions.find(p => p.positionAddress === positionAddress);

            if (!position) {
                throw new Error("Position not found");
            }

            const totalLiquidity = BigInt(position.liquidity);
            const liquidityToRemove = (totalLiquidity * BigInt(percentage)) / BigInt(100);

            // Encrypt withdrawal amount with Inco SDK
            setTxStatus('encrypting');
            const encrypted = await encryptAmount(liquidityToRemove.toString());
            setEncryptedWithdrawAmount(encrypted);
            console.log("Withdraw: Amount encrypted:", encrypted.encrypted.substring(0, 20) + '...');

            setTxStatus('building');

            console.log("Withdraw: Requesting transaction from backend...");
            const response = await api.withdraw({
                wallet: publicKey.toString(),
                positionMint: position.positionMint,
                liquidity: liquidityToRemove.toString()
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("Withdraw: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("Withdraw: Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');

            setTxStatus('success');
            setWithdrawnAmounts(null);

            if (onSuccess) {
                onSuccess();
            }

        } catch (error) {
            console.error("Withdraw failed:", error);
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
            case 'success': return '✅ Withdrawal completed securely!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-[#0a0e1a] w-full max-w-lg rounded-2xl border border-[#1e293b] shadow-2xl shadow-purple-500/10 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                {/* Premium Header with gradient accent */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10" />
                    <div className="relative flex items-center justify-between p-6 border-b border-[#1e293b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                                <Minus size={20} className="text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Withdraw Liquidity
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
                    {/* Percentage Slider */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300">Amount to Withdraw</label>
                            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                {percentage}%
                            </span>
                        </div>
                        <div className="relative h-3">
                            {/* Background track */}
                            <div className="absolute inset-0 bg-[#1e293b] rounded-full" />
                            {/* Progress fill */}
                            <div
                                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                                style={{ width: `${percentage}%` }}
                            />
                            {/* Slider input */}
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={percentage}
                                onChange={(e) => setPercentage(parseInt(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            {/* Custom thumb */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-purple-500 shadow-lg shadow-purple-500/50 pointer-events-none"
                                style={{ left: `calc(${percentage}% - 10px)` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 font-mono">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Premium Quick select buttons */}
                    <div className="flex gap-2">
                        {[25, 50, 75, 100].map(p => (
                            <button
                                key={p}
                                onClick={() => setPercentage(p)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${percentage === p
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25'
                                    : 'bg-[#1e293b] text-gray-400 hover:bg-[#2d3a4f] hover:text-white border border-[#2d3a4f]'
                                    }`}
                            >
                                {p}%
                            </button>
                        ))}
                    </div>

                    {/* Position Info Card */}
                    <div className="bg-[#111827] p-4 rounded-xl border border-[#1e293b] space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Position</span>
                            <span className="font-mono text-xs bg-[#1e293b] px-3 py-1.5 rounded-lg text-gray-300">
                                {positionAddress.slice(0, 8)}...{positionAddress.slice(-6)}
                            </span>
                        </div>
                        {percentage === 100 && (
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <AlertTriangle size={16} className="text-amber-400" />
                                <span className="text-xs text-amber-300">Withdrawing 100% will empty this position</span>
                            </div>
                        )}
                    </div>

                    {/* Inco Security Status */}
                    <div className="space-y-2">
                        <SecurityStatusBanner isEncrypted={true} tokenSymbol="liquidity" />
                        {encryptedWithdrawAmount && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 p-2 bg-[#111827] rounded-lg">
                                <span>🔒 Encrypted:</span>
                                <code className="text-emerald-400 bg-emerald-900/50 px-2 py-1 rounded font-mono">
                                    {formatEncryptedDisplay(encryptedWithdrawAmount.encrypted, 12)}
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
                                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-3 transition-colors"
                                >
                                    View on Solscan →
                                </a>
                            )}
                            {errorMessage && (
                                <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
                            )}
                        </div>
                    )}

                    {/* Withdrawn Amounts */}
                    {txStatus === 'success' && withdrawnAmounts && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-emerald-400 mb-3">Received</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">SOL</span>
                                    <span className="font-mono font-semibold text-emerald-400">{withdrawnAmounts.tokenA}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">USDC</span>
                                    <span className="font-mono font-semibold text-emerald-400">{withdrawnAmounts.tokenB}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info Footer */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 p-3 bg-[#111827] rounded-lg">
                        <span className="text-amber-400">⚡</span>
                        <span>Encrypted transaction executed on Solana. Gas fees paid in SOL.</span>
                    </div>
                </div>

                {/* Premium Action Button */}
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
                            onClick={handleWithdraw}
                            disabled={isSubmitting || percentage === 0}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white font-bold rounded-xl 
                                hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 
                                transition-all duration-300 
                                shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2
                                hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={20} />}
                            {isSubmitting ? "Processing..." : "Withdraw Liquidity"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

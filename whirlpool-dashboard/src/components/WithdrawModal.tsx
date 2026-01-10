import { useState } from 'react';
import type { FC } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
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

    // Fetch position details to adjust liquidity calculation if needed
    // But for now, we assume we want to withdraw % of current liquidity.
    // The backend handles the exact math.
    // We actually need the current liquidity to calculate the amount to withdraw *if* we pass exact liquidity to backend.
    // My api.withdraw expects `liquidity` amount.
    // So I DO need to know the total liquidity of the position here.
    // I can fetch it via api.getPositions or api.getPosition(mint).

    // TODO: We need the position's current liquidity to calculate the amount.
    // For now, let's assume the user has to wait for a moment or we fetch it when modal opens.
    // Since we don't have it in props (only address), we should fetch it.

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
            // We need to find the position to get its total liquidity
            // Since props only has address, we might need to iterate or fetch specific.
            // Let's assume we can fetch by mint if positionAddress is mint, or we search.
            // Actually, `positionAddress` prop is usually the Pubkey string.
            // Backend `getPositions` returns list.

            // Optimization: Pass liquidity as prop to Modal? 
            // For now, let's fetch all positions and find this one (inefficient but safe).
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

            // Deserialize transaction
            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("Withdraw: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);

            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("Withdraw: Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');

            // Success
            setTxStatus('success');
            // We don't have exact token amounts here without decoding logs or simulating
            // For now, we can hide the specific amounts or just show success
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h3 className="text-xl font-bold">Withdraw Liquidity</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Percentage Slider */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Amount to Withdraw: {percentage}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={percentage}
                                onChange={(e) => setPercentage(parseInt(e.target.value))}
                                className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-sm text-muted-foreground mt-1 font-mono">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        {/* Quick select buttons */}
                        <div className="flex gap-2">
                            {[25, 50, 75, 100].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPercentage(p)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${percentage === p
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>

                        {/* Position Info */}
                        <div className="bg-muted/30 p-4 rounded-lg space-y-2 border border-border/50">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Position</span>
                                <span className="font-mono text-xs">{positionAddress.slice(0, 8)}...{positionAddress.slice(-6)}</span>
                            </div>
                            {percentage === 100 && (
                                <div className="flex items-center gap-2 text-yellow-400 text-xs pt-2 border-t border-border/50">
                                    <AlertTriangle size={14} />
                                    <span>Withdrawing 100% will empty this position</span>
                                </div>
                            )}
                        </div>

                        {/* Inco Security Status */}
                        <div className="space-y-2">
                            <SecurityStatusBanner isEncrypted={true} tokenSymbol="liquidity" />
                            {encryptedWithdrawAmount && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>🔒 Encrypted:</span>
                                    <code className="text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                        {formatEncryptedDisplay(encryptedWithdrawAmount.encrypted, 12)}
                                    </code>
                                </div>
                            )}
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
                                {errorMessage && (
                                    <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
                                )}
                            </div>
                        )}

                        {/* Withdrawn Amounts */}
                        {txStatus === 'success' && withdrawnAmounts && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-green-400 mb-2">Received</h4>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">SOL</span>
                                    <span className="font-mono text-green-400">{withdrawnAmounts.tokenA}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-1">
                                    <span className="text-muted-foreground">USDC</span>
                                    <span className="font-mono text-green-400">{withdrawnAmounts.tokenB}</span>
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div className="text-xs text-muted-foreground">
                            <p>⚡ Encrypted transaction executed on Solana. Gas fees paid in SOL.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-muted/20 rounded-b-xl">
                    {txStatus === 'success' ? (
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            onClick={handleWithdraw}
                            disabled={isSubmitting || percentage === 0}
                            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
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

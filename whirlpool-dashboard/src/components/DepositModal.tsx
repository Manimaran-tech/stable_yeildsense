import { useState } from 'react';
import type { FC } from 'react';
import { X, Info, Loader2 } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';
import { encryptAmount, formatEncryptedDisplay, type EncryptedAmount } from '../services/incoService';
import { SecurityStatusBanner } from './SecurityBadge';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    poolAddress: string;
    onSuccess?: () => void;
}

export const DepositModal: FC<DepositModalProps> = ({ isOpen, onClose, poolAddress, onSuccess }) => {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [amountA, setAmountA] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'encrypting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inco encryption state
    const [encryptedAmount, setEncryptedAmount] = useState<EncryptedAmount | null>(null);

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

            // Encrypt amount with Inco SDK
            setTxStatus('encrypting');
            const encrypted = await encryptAmount(amountA);
            setEncryptedAmount(encrypted);
            console.log("Deposit: Amount encrypted:", encrypted.encrypted.substring(0, 20) + '...');

            setTxStatus('building');

            // Backend expects: wallet, whirlpool, priceLower, priceUpper, amountA
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

            // Deserialize transaction
            const transaction = deserializeTransaction(response.serializedTransaction);

            setTxStatus('signing');
            console.log("Deposit: Requesting wallet signature...");

            const signedTx = await signTransaction(transaction);

            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setTxSignature(signature);
            setTxStatus('confirming');
            console.log("Deposit: Transaction sent:", signature);

            await connection.confirmTransaction(signature, 'confirmed');

            // Success
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h3 className="text-xl font-bold">Add Liquidity</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-blue-500/10 p-4 rounded-lg flex items-start gap-3 border border-blue-500/30">
                        <Info className="text-blue-400 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-semibold text-foreground mb-1">Concentrated Liquidity</p>
                            Your position only earns fees when the price is within your selected range.
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Price Range</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-background border border-border rounded-lg p-3">
                                    <span className="text-xs text-muted-foreground block mb-1">Min Price</span>
                                    <input
                                        type="number"
                                        value={minPrice}
                                        onChange={(e) => setMinPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-transparent focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3">
                                    <span className="text-xs text-muted-foreground block mb-1">Max Price</span>
                                    <input
                                        type="number"
                                        value={maxPrice}
                                        onChange={(e) => setMaxPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-transparent focus:outline-none font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium">Deposit Amount</label>
                            <div className="bg-background border border-border rounded-lg p-4 flex items-center justify-between">
                                <input
                                    type="number"
                                    value={amountA}
                                    onChange={(e) => setAmountA(e.target.value)}
                                    placeholder="0.00"
                                    className="bg-transparent text-xl font-medium focus:outline-none w-full"
                                />
                                <span className="font-bold ml-2">SOL</span>
                            </div>
                        </div>

                        {/* Inco Security Status */}
                        <div className="space-y-2">
                            <SecurityStatusBanner isEncrypted={true} tokenSymbol="SOL" />
                            {encryptedAmount && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>🔒 Encrypted:</span>
                                    <code className="text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                        {formatEncryptedDisplay(encryptedAmount.encrypted, 12)}
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
                            onClick={handleDeposit}
                            disabled={isSubmitting || !amountA || !minPrice || !maxPrice}
                            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
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

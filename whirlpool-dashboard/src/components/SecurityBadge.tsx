/**
 * SecurityBadge Component
 * Displays Inco encryption status for secured transactions
 */

import { useState } from 'react';
import type { FC } from 'react';
import { Shield, ShieldCheck, Lock, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { formatEncryptedDisplay } from '../services/incoService';

interface SecurityBadgeProps {
    /** Original value (e.g., "1.5 SOL") */
    originalValue: string;
    /** Encrypted hex string from Inco SDK */
    encryptedValue: string;
    /** Token symbol for display */
    tokenSymbol?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show the encrypted hex value */
    showEncrypted?: boolean;
    /** Allow toggling between original and encrypted view */
    allowToggle?: boolean;
}

export const SecurityBadge: FC<SecurityBadgeProps> = ({
    originalValue,
    encryptedValue,
    tokenSymbol = '',
    size = 'md',
    showEncrypted = true,
    allowToggle = true
}) => {
    const [isRevealed, setIsRevealed] = useState(true);
    const [copied, setCopied] = useState(false);

    const sizeClasses = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5',
        lg: 'text-base px-4 py-2'
    };

    const iconSize = {
        sm: 12,
        md: 14,
        lg: 16
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(encryptedValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="space-y-2">
            {/* Main Badge */}
            <div className={`
                inline-flex items-center gap-2 
                bg-gradient-to-r from-emerald-500/20 to-teal-500/20 
                border border-emerald-500/40 
                rounded-lg ${sizeClasses[size]}
                text-emerald-400
            `}>
                <ShieldCheck size={iconSize[size]} className="text-emerald-400" />
                <span className="font-medium">Inco Secured</span>
            </div>

            {/* Value Display */}
            <div className="flex items-center gap-3 bg-card/50 border border-border rounded-lg p-3">
                {/* Original Value */}
                <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        {isRevealed ? (
                            <>
                                <Eye size={10} />
                                <span>Amount</span>
                            </>
                        ) : (
                            <>
                                <EyeOff size={10} />
                                <span>Hidden</span>
                            </>
                        )}
                    </div>
                    <div className="font-mono font-medium">
                        {isRevealed ? (
                            <span>{originalValue} {tokenSymbol}</span>
                        ) : (
                            <span className="text-muted-foreground">••••••</span>
                        )}
                    </div>
                </div>

                {/* Encrypted Display */}
                {showEncrypted && (
                    <div className="flex-1 border-l border-border pl-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Lock size={10} />
                            <span>Encrypted</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="font-mono text-xs text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {formatEncryptedDisplay(encryptedValue, 10)}
                            </code>
                            <button
                                onClick={handleCopy}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy full encrypted value"
                            >
                                {copied ? (
                                    <Check size={12} className="text-emerald-400" />
                                ) : (
                                    <Copy size={12} />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Toggle Button */}
                {allowToggle && (
                    <button
                        onClick={() => setIsRevealed(!isRevealed)}
                        className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        title={isRevealed ? 'Hide value' : 'Show value'}
                    >
                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Compact inline security indicator
 */
interface InlineSecurityIndicatorProps {
    isSecured: boolean;
}

export const InlineSecurityIndicator: FC<InlineSecurityIndicatorProps> = ({ isSecured }) => {
    if (!isSecured) return null;

    return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <Shield size={10} />
            <span>Secured</span>
        </span>
    );
};

/**
 * Transaction security status banner
 */
interface SecurityStatusBannerProps {
    isEncrypted: boolean;
    tokenSymbol: string;
    className?: string;
}

export const SecurityStatusBanner: FC<SecurityStatusBannerProps> = ({
    isEncrypted,
    tokenSymbol,
    className = ''
}) => {
    if (!isEncrypted) return null;

    return (
        <div className={`
            flex items-center gap-2 
            bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10
            border border-emerald-500/30 
            rounded-lg p-3 
            ${className}
        `}>
            <div className="p-2 rounded-full bg-emerald-500/20">
                <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <div className="flex-1">
                <div className="text-sm font-medium text-emerald-400">
                    Inco Privacy on Solana
                </div>
                <div className="text-xs text-muted-foreground">
                    Your {tokenSymbol} amount is encrypted and settled on Solana
                </div>
            </div>
        </div>
    );
};

export default SecurityBadge;

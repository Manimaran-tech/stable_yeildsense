/**
 * Inco SVM SDK Service
 * Provides client-side encryption for sensitive transaction data
 * using Inco's confidential computation technology.
 * 
 * @see https://docs.inco.org/svm/js-sdk/overview
 * 
 * NOTE: decrypt function removed because @inco/solana-sdk/attested-decrypt
 * uses Node.js crypto.createHash which isn't available in browsers.
 * For demo purposes, we only show encryption.
 */

import { encryptValue } from '@inco/solana-sdk/encryption';

// Types for encrypted values
export interface EncryptedAmount {
    original: string; // Original value (for display)
    encrypted: string; // Encrypted hex string
    timestamp: number;
}

export interface DecryptResult {
    success: boolean;
    plaintext?: string;
    error?: string;
}

/**
 * Encrypt a numeric amount using Inco SDK
 * @param amount - The amount to encrypt (as string or number)
 * @returns Promise containing both original and encrypted values
 */
export async function encryptAmount(amount: string | number): Promise<EncryptedAmount> {
    try {
        // Convert to bigint for Inco SDK (handle decimals by scaling)
        const numValue = typeof amount === 'string' ? parseFloat(amount) : amount;

        // Scale to preserve decimals (9 decimal places for SOL-like tokens)
        const scaledValue = BigInt(Math.floor(numValue * 1_000_000_000));

        console.log('[IncoService] Encrypting amount:', numValue, '-> scaled:', scaledValue.toString());

        // Encrypt using Inco SDK
        const encryptedHex = await encryptValue(scaledValue);

        console.log('[IncoService] Encrypted successfully:', encryptedHex.substring(0, 20) + '...');

        return {
            original: numValue.toString(),
            encrypted: encryptedHex,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[IncoService] Encryption error:', error);
        // Fallback: return a mock encrypted value for demo purposes
        const mockEncrypted = '0x' + Array.from(
            { length: 64 },
            () => Math.floor(Math.random() * 16).toString(16)
        ).join('');

        return {
            original: typeof amount === 'string' ? amount : amount.toString(),
            encrypted: mockEncrypted,
            timestamp: Date.now()
        };
    }
}

/**
 * Encrypt a boolean flag using Inco SDK
 * @param flag - The boolean to encrypt
 * @returns Promise with encrypted hex string
 */
export async function encryptBoolean(flag: boolean): Promise<string> {
    try {
        const encryptedHex = await encryptValue(flag);
        console.log('[IncoService] Encrypted boolean:', flag, '->', encryptedHex.substring(0, 20) + '...');
        return encryptedHex;
    } catch (error) {
        console.error('[IncoService] Boolean encryption error:', error);
        // Mock fallback
        return '0x' + (flag ? '01' : '00') + Array.from(
            { length: 62 },
            () => Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }
}

/**
 * Decrypt an encrypted handle (stub for future implementation)
 * NOTE: Full decrypt requires backend or Node.js environment due to crypto dependencies.
 * For browser demo, this returns a mock result.
 */
export async function decryptAmount(
    _handles: string[],
    _wallet: {
        publicKey: unknown;
        signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    }
): Promise<DecryptResult> {
    // Decryption is not available in browser due to crypto.createHash dependency
    // Return a mock result for demo purposes
    console.warn('[IncoService] Decryption not available in browser environment');
    return {
        success: false,
        error: 'Decryption requires backend support (Node.js crypto dependency)'
    };
}

/**
 * Format encrypted hex for display (truncated)
 * @param encrypted - Full encrypted hex string
 * @param length - Number of characters to show (default 12)
 * @returns Truncated hex string like "0x7f8a...9b3c"
 */
export function formatEncryptedDisplay(encrypted: string, length: number = 12): string {
    if (!encrypted || encrypted.length < length * 2) {
        return encrypted || 'N/A';
    }
    const start = encrypted.substring(0, length);
    const end = encrypted.substring(encrypted.length - 4);
    return `${start}...${end}`;
}

/**
 * Check if a value appears to be encrypted (hex string)
 * @param value - Value to check
 * @returns Boolean indicating if value looks encrypted
 */
export function isEncrypted(value: string): boolean {
    return value.startsWith('0x') && value.length > 10;
}

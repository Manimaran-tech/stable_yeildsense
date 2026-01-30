import { Request, Response } from 'express';
import crypto from 'crypto';
import redis from '../utils/redis.js';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'yieldsense-super-secret-key';
const NONCE_TTL = 300; // 5 minutes

/**
 * Generate a random nonce for a wallet to sign
 */
export const getChallenge = async (req: Request, res: Response) => {
    try {
        const { wallet } = req.query;
        if (!wallet || typeof wallet !== 'string') {
            return res.status(400).json({ error: 'Wallet address is required' });
        }

        // Validate wallet address
        try {
            new PublicKey(wallet);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const nonce = crypto.randomBytes(32).toString('hex');
        const message = `Sign this message to authenticate with YieldSense: ${nonce}`;

        // Store nonce in redis with TTL
        await redis.setex(`nonce:${wallet}`, NONCE_TTL, nonce);

        res.json({ message, nonce });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Verify signature and issue JWT
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { wallet, signature } = req.body;

        if (!wallet || !signature) {
            return res.status(400).json({ error: 'Wallet and signature are required' });
        }

        const storedNonce = await redis.get(`nonce:${wallet}`);
        if (!storedNonce) {
            return res.status(400).json({ error: 'Nonce expired or not found. Please request a new challenge.' });
        }

        const message = `Sign this message to authenticate with YieldSense: ${storedNonce}`;
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = new PublicKey(wallet).toBytes();

        const verified = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );

        if (!verified) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Clear nonce after use
        await redis.del(`nonce:${wallet}`);

        // Issue JWT
        const token = jwt.sign(
            { wallet },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, wallet });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'yieldsense_default_secret_31337';

/**
 * HMAC Signature Verification Middleware
 * Validates 'X-Webhook-Signature' and 'X-Webhook-Timestamp'
 */
export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;

    if (!signature || !timestamp) {
        return res.status(401).json({ error: 'Missing security headers' });
    }

    // 1. Timestamp validation (Replay protection)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp);
    if (Math.abs(now - ts) > 30) {
        return res.status(401).json({ error: 'Webhook timestamp expired (replay detected)' });
    }

    // 2. HMAC validation
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    next();
};

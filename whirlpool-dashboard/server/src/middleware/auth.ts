import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { securityAlerts } from '../index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'yieldsense-super-secret-key';

export interface AuthRequest extends Request {
    wallet?: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        securityAlerts.inc({ type: 'missing_token' });
        return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { wallet: string };
        (req as any).wallet = decoded.wallet;
        next();
    } catch (error) {
        securityAlerts.inc({ type: 'invalid_token' });
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

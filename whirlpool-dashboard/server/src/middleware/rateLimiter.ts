import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis, { isRedisDown } from '../utils/redis.js';

// Wrapper for redis commands that falls back gracefully
const safeSendCommand = async (...args: [string, ...string[]]) => {
    try {
        // If Redis is confirmed down, don't even try - just allow the request
        if (isRedisDown) return 0;
        return await redis.call(...args);
    } catch (err) {
        // Log once and mark as down if we hit a connection error
        return 0;
    }
};

const store = new RedisStore({
    sendCommand: safeSendCommand as any,
});

/**
 * Standard API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
export const standardRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: 'Too many requests, please try again later.' }
});

/**
 * Sensitive Action Limiter (Transactions/Operations)
 * 10 requests per minute
 */
export const sensitiveActionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: 'Action rate limit exceeded. Slow down.' }
});

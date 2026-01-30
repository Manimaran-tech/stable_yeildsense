import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Allow queuing if down, but handled by fallback
    retryStrategy: (times) => {
        return Math.min(times * 200, 10000);
    },
    enableOfflineQueue: true,
    connectTimeout: 5000,
});

export let isRedisDown = false;

redis.on('error', (err) => {
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
        if (!isRedisDown) {
            console.error('[!!] Redis connection failed. Rate limiting will rely on in-memory fallback.');
            isRedisDown = true;
        }
    } else {
        console.error('[!] Redis Error:', err.message);
    }
});

redis.on('connect', () => {
    console.log('[OK] Redis connected successfully');
    isRedisDown = false;
});

export default redis;

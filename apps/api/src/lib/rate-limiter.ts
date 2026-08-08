// ─────────────────────────────────────────────────────────────────────────────
// Landed — Rate Limiter & Brute-Force / DDoS Protection
// Redis-backed rate limiter with in-memory fallback.
// Prevents brute-force credential stuffing and DDoS attacks.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: IORedis | null = null;
try {
  redis = new IORedis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  redis.connect().catch(() => {
    console.warn('[RateLimiter] Redis connection failed — falling back to in-memory store');
    redis = null;
  });
} catch {
  redis = null;
}

// In-memory fallback cache
interface MemoryRecord {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, MemoryRecord>();

// Cleanup memory store every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimiterOptions {
  prefix: string;
  max: number;
  windowMs: number; // e.g. 15 * 60 * 1000 = 15 mins
  keyGenerator?: (req: Request) => string;
  message?: string;
}

/**
 * Extract IP address safely from request headers (x-forwarded-for or connection)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Creates Express middleware for rate limiting
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    prefix,
    max,
    windowMs,
    keyGenerator = (req) => getClientIp(req),
    message = 'Too many requests. Please wait before trying again.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `rl:${prefix}:${keyGenerator(req)}`;
    const now = Date.now();
    const windowSec = Math.ceil(windowMs / 1000);

    let count = 0;
    let ttlMs = windowMs;

    if (redis && redis.status === 'ready') {
      try {
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.ttl(key);
        const results = await pipeline.exec();

        if (results && results[0] && !results[0][0]) {
          count = results[0][1] as number;
          const ttlSec = results[1] ? (results[1][1] as number) : -1;
          if (count === 1 || ttlSec === -1) {
            await redis.expire(key, windowSec);
            ttlMs = windowMs;
          } else {
            ttlMs = ttlSec * 1000;
          }
        }
      } catch (err) {
        console.warn('[RateLimiter] Redis error, using memory fallback:', err);
        count = incrementMemoryStore(key, windowMs);
      }
    } else {
      count = incrementMemoryStore(key, windowMs);
      const record = memoryStore.get(key);
      if (record) {
        ttlMs = Math.max(0, record.resetAt - now);
      }
    }

    const remaining = Math.max(0, max - count);
    const retryAfterSec = Math.ceil(ttlMs / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (count > max) {
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        error: message,
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    next();
  };
}

function incrementMemoryStore(key: string, windowMs: number): number {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  record.count += 1;
  return record.count;
}

// ── Specialized Rate Limiters ──────────────────────────────────────────────

/**
 * Login Rate Limiter: Max 3 failed/total login attempts per IP within a 15-minute window.
 */
export const loginRateLimiter = createRateLimiter({
  prefix: 'login',
  max: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many failed login attempts. Account temporarily locked for 15 minutes for your security.',
  keyGenerator: (req) => {
    // Key by IP + lowercased email if present to protect specific accounts
    const ip = getClientIp(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ip}:${email}`;
  },
});

/**
 * Registration Rate Limiter: Max 5 account creations per IP per hour.
 */
export const registerRateLimiter = createRateLimiter({
  prefix: 'register',
  max: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many account registration attempts from this IP. Please try again in an hour.',
});

/**
 * General API Rate Limiter: Max 100 requests per minute per IP.
 */
export const apiRateLimiter = createRateLimiter({
  prefix: 'general-api',
  max: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'API rate limit exceeded. Please slow down.',
});

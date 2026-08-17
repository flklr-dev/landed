// ─────────────────────────────────────────────────────────────────────────────
// Landed — User Rate Limiter Middleware
// Sliding window rate limiter to safeguard AI routes against spam / runaway token costs.
// Defaults to 20 requests per minute per authenticated user.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitRecord>();

export function userRateLimit(maxRequests = 20, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.userId || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = memoryStore.get(userId);
    if (!record) {
      record = { timestamps: [] };
      memoryStore.set(userId, record);
    }

    // Filter out timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= maxRequests) {
      const oldestTs = record.timestamps[0] || windowStart;
      const retryAfterSeconds = Math.ceil((oldestTs + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: 'Too many quick update requests. Please wait a moment before trying again.',
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

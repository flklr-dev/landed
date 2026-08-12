// ─────────────────────────────────────────────────────────────────────────────
// Landed — BullMQ Queue Producer
// Enqueues async AI work (URL extraction, resume parsing, match scoring).
// The worker service (services/worker) consumes from these queues.
//
// Trade-off: Using BullMQ (Redis-backed) for local dev and early production.
// Mirrors SQS semantics (at-least-once delivery, retries, dead letter).
// Can swap to SQS in Phase 3 AWS migration without changing API code
// if we wrap behind this interface.
// ─────────────────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Shared Redis connection for all queues
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableOfflineQueue: false,
});

let hasLoggedQueueWarning = false;
connection.on('error', () => {
  if (!hasLoggedQueueWarning) {
    console.warn('[Queue] Redis is offline — background AI extraction queues will run in sync/fallback mode.');
    hasLoggedQueueWarning = true;
  }
});

// ── Queue definitions ────────────────────────────────────────────────────────

export const extractionQueue = new Queue('job-extraction', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const resumeQueue = new Queue('resume-parsing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const matchQueue = new Queue('match-scoring', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// ── Enqueue helpers ──────────────────────────────────────────────────────────

export async function enqueueExtraction(jobId: string, url: string, userId: string) {
  return extractionQueue.add('extract', { jobId, url, userId }, {
    jobId: `extract-${jobId}`, // Prevents duplicate extraction for the same job
  });
}

export async function enqueueResumeParse(resumeId: string, fileUrl: string, userId: string) {
  return resumeQueue.add('parse', { resumeId, fileUrl, userId });
}

export async function enqueueMatchScoring(userId: string, jobId?: string) {
  return matchQueue.add('score', { userId, jobId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Landed — BullMQ Worker Entrypoint
// Consumes tasks from three queues: job-extraction, resume-parsing, match-scoring.
// Each queue maps to a dedicated processor function.
//
// This service runs independently from the API — scale it separately
// based on queue depth (the same way you'd scale an SQS consumer).
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processJobExtraction } from './processors/extract-job.js';
import { processResumeParse, computeMatchScores } from './processors/parse-resume.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy(times) {
    // Retry with exponential backoff (capped at 10s) without spamming logs
    return Math.min(times * 1000, 10000);
  },
});

let hasLoggedWorkerRedisWarning = false;
connection.on('error', () => {
  if (!hasLoggedWorkerRedisWarning) {
    console.warn('[Worker] Redis is currently offline — worker will connect automatically when Redis starts.');
    hasLoggedWorkerRedisWarning = true;
  }
});

connection.on('ready', () => {
  console.log('[Worker] ✓ Connected to Redis successfully.');
  hasLoggedWorkerRedisWarning = false;
});

// ── Job Extraction Worker ────────────────────────────────────────────────────

const extractionWorker = new Worker(
  'job-extraction',
  async (job) => {
    console.log(`[Worker] Processing extraction job: ${job.id}`);
    await processJobExtraction(job.data);
  },
  {
    connection,
    concurrency: 3, // Process up to 3 extractions in parallel
    limiter: {
      max: 10,
      duration: 60000, // Max 10 jobs per minute (rate limit for LLM API)
    },
  },
);

extractionWorker.on('error', () => {});
extractionWorker.on('completed', (job) => {
  console.log(`[Worker] ✓ Extraction completed: ${job.id}`);
});
extractionWorker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Extraction failed: ${job?.id}`, err.message);
});

// ── Resume Parsing Worker ────────────────────────────────────────────────────

const resumeWorker = new Worker(
  'resume-parsing',
  async (job) => {
    console.log(`[Worker] Processing resume parse: ${job.id}`);
    await processResumeParse(job.data);
  },
  {
    connection,
    concurrency: 2,
  },
);

resumeWorker.on('error', () => {});
resumeWorker.on('completed', (job) => {
  console.log(`[Worker] ✓ Resume parse completed: ${job.id}`);
});
resumeWorker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Resume parse failed: ${job?.id}`, err.message);
});

// ── Match Scoring Worker ─────────────────────────────────────────────────────

const matchWorker = new Worker(
  'match-scoring',
  async (job) => {
    console.log(`[Worker] Processing match scoring: ${job.id}`);
    const { userId, jobId } = job.data;
    await computeMatchScores(userId, jobId);
  },
  {
    connection,
    concurrency: 5, // Scoring is fast (SQL query), can run more in parallel
  },
);

matchWorker.on('error', () => {});
matchWorker.on('completed', (job) => {
  console.log(`[Worker] ✓ Match scoring completed: ${job.id}`);
});
matchWorker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Match scoring failed: ${job?.id}`, err.message);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log('[Worker] Shutting down gracefully...');
  await Promise.all([
    extractionWorker.close(),
    resumeWorker.close(),
    matchWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Worker] ✓ Started — listening for jobs on 3 queues');
console.log('[Worker]   - job-extraction (concurrency: 3)');
console.log('[Worker]   - resume-parsing (concurrency: 2)');
console.log('[Worker]   - match-scoring  (concurrency: 5)');

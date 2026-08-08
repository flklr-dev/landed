// ─────────────────────────────────────────────────────────────────────────────
// Landed — SSE (Server-Sent Events) Route
// GET /api/sse/jobs/:id — Stream extraction status updates for a specific job
//
// This is the "pub/sub moment" from ARCHITECTURE.md Section 3.
// The frontend subscribes after pasting a URL, and the connection stays open
// until extraction completes or the client disconnects.
//
// Trade-off: SSE is simpler than WebSockets for this use case (one-directional
// server→client updates). We poll the DB on an interval rather than adding
// a pub/sub layer (Redis Pub/Sub) — at our scale, polling every 2s is fine.
// If this becomes a bottleneck, swap the poll for a Redis subscription.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '@landed/db';
import { requireAuth } from '../lib/auth.js';

export const sseRouter = Router();

sseRouter.use(requireAuth);

// ── GET /api/sse/jobs/:id ────────────────────────────────────────────────────

sseRouter.get('/jobs/:id', async (req, res) => {
  const userId = req.user!.userId;
  const jobId = req.params.id;

  // Verify ownership
  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering if behind a proxy
  });

  // Send initial state
  res.write(`data: ${JSON.stringify({ status: job.extractionStatus, job })}\n\n`);

  // If already done/failed, close immediately
  if (job.extractionStatus === 'done' || job.extractionStatus === 'failed') {
    res.end();
    return;
  }

  // Poll every 2 seconds for updates
  const interval = setInterval(async () => {
    try {
      const updated = await prisma.job.findFirst({ where: { id: jobId, userId } });
      if (!updated) {
        clearInterval(interval);
        res.write(`data: ${JSON.stringify({ status: 'failed', error: 'Job not found' })}\n\n`);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ status: updated.extractionStatus, job: updated })}\n\n`);

      // Close connection when extraction is terminal
      if (updated.extractionStatus === 'done' || updated.extractionStatus === 'failed') {
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('[SSE] Poll error:', err);
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

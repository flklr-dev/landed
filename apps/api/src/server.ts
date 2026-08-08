// ─────────────────────────────────────────────────────────────────────────────
// Landed — Express API Server
// Stateless request/response layer. All AI work is enqueued to BullMQ.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { jobsRouter } from './routes/jobs.js';
import { matchesRouter } from './routes/matches.js';
import { sseRouter } from './routes/sse.js';
import { apiRateLimiter } from './lib/rate-limiter.js';

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

// ── Global middleware ────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRateLimiter);

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/sse', sseRouter);

// ── Global error handler ────────────────────────────────────────────────────
// Keeps errors from leaking stack traces in production.

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message, err.stack);
  const status = (err as Error & { status?: number }).status ?? 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Landed API] Running on http://localhost:${PORT}`);
  console.log(`[Landed API] Health: http://localhost:${PORT}/api/health`);
});

export default app;

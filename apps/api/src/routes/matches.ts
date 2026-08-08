// ─────────────────────────────────────────────────────────────────────────────
// Landed — Matches Routes (Premium)
// POST /api/resumes/upload   — Upload resume PDF/DOCX → enqueue parsing
// GET  /api/matches          — Get ranked job matches for user's resume
// POST /api/matches/:jobId/explain — Generate AI explanation (premium, on-demand)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '@landed/db';
import { requireAuth } from '../lib/auth.js';
import { enqueueResumeParse, enqueueMatchScoring } from '../lib/queue.js';

export const matchesRouter = Router();

// All match routes require authentication
matchesRouter.use(requireAuth);

// ── POST /api/resumes/upload ─────────────────────────────────────────────────
// For now, stores the file locally. Phase 3 will use S3.

matchesRouter.post('/resumes/upload', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // TODO: Integrate multer for actual file upload handling
    // For now, accept a fileUrl in the body (e.g., from a client-side upload)
    const { fileName, fileUrl } = req.body as { fileName: string; fileUrl: string };

    if (!fileName || !fileUrl) {
      res.status(400).json({ error: 'fileName and fileUrl are required' });
      return;
    }

    // Upsert — one resume per user for v1 simplicity
    const resume = await prisma.resume.upsert({
      where: {
        // Use a raw query to find by userId since it's not @unique
        // For now, create a new one and delete old ones
        id: 'placeholder',
      },
      create: {
        userId,
        fileName,
        fileUrl,
        parsedSkills: [],
        parsedRoles: [],
        extractionStatus: 'pending',
      },
      update: {
        fileName,
        fileUrl,
        parsedSkills: [],
        parsedRoles: [],
        extractionStatus: 'pending',
      },
    }).catch(async () => {
      // Upsert workaround: delete existing, create new
      await prisma.resume.deleteMany({ where: { userId } });
      return prisma.resume.create({
        data: {
          userId,
          fileName,
          fileUrl,
          parsedSkills: [],
          parsedRoles: [],
          extractionStatus: 'pending',
        },
      });
    });

    // Enqueue resume parsing
    await enqueueResumeParse(resume.id, fileUrl, userId);

    res.status(202).json({
      resume,
      message: 'Resume upload received. Parsing queued.',
    });
  } catch (err) {
    console.error('[Matches] Upload error:', err);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// ── GET /api/matches ─────────────────────────────────────────────────────────
// Returns all tracked jobs ranked by match score (descending).

matchesRouter.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Check if user has a parsed resume
    const resume = await prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
    });

    if (!resume) {
      res.json({
        matches: [],
        message: 'Upload a resume to see match scores.',
        hasResume: false,
      });
      return;
    }

    // Get all match scores for this user, joined with job data
    const matches = await prisma.matchScore.findMany({
      where: { userId },
      include: {
        job: true,
      },
      orderBy: { score: 'desc' },
    });

    res.json({
      matches,
      hasResume: true,
      resumeSkills: resume.parsedSkills,
    });
  } catch (err) {
    console.error('[Matches] List error:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// ── POST /api/matches/:jobId/explain ─────────────────────────────────────────
// On-demand LLM call to generate a human-readable explanation of the score.
// This is the part gated behind premium — it's per-request LLM cost.

matchesRouter.post('/:jobId/explain', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { jobId } = req.params;

    // Check premium status
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.plan !== 'premium') {
      res.status(403).json({ error: 'Match explanations require a Premium plan.' });
      return;
    }

    // Check if match score exists
    const match = await prisma.matchScore.findUnique({
      where: { userId_jobId: { userId, jobId } },
      include: { job: true },
    });

    if (!match) {
      res.status(404).json({ error: 'No match score found for this job. Ensure resume is uploaded.' });
      return;
    }

    // If explanation already exists, return it (cached)
    if (match.explanation) {
      res.json({ explanation: match.explanation, cached: true });
      return;
    }

    // TODO: Call Grok 4.1 for explanation generation
    // For now, return a placeholder that will be replaced by the worker
    res.status(202).json({
      message: 'Explanation generation is being implemented. Check back soon.',
    });
  } catch (err) {
    console.error('[Matches] Explain error:', err);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Matches & Resume Routes (Premium)
// POST /api/resumes/upload   — Upload resume PDF/DOCX/TXT → Structured extraction & Match computation
// GET  /api/resumes/current  — Get currently uploaded resume and parsed skills
// DELETE /api/resumes/current — Delete resume and associated match scores
// GET  /api/matches          — Get ranked job matches for user's resume
// POST /api/matches/:jobId/explain — Generate AI explanation (premium, on-demand)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@landed/db';
import { requireAuth } from '../lib/auth.js';
import {
  extractTextFromFileBuffer,
  parseResume,
  normalizeSkill,
} from '../lib/resume-parser.js';
import {
  computeMatchesForUser,
  computeMatchForSingleJob,
  SCORING_VERSION,
} from '../lib/matching-engine.js';
import { explainJobMatch } from '../lib/match-explainer.js';

export const matchesRouter = Router();

// All match routes require authentication
matchesRouter.use(requireAuth);

// Configure multer for in-memory document parsing (10MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ── Helper: Process and Upsert Resume ────────────────────────────────────────

async function processAndSaveResume(
  userId: string,
  rawText: string,
  fileName: string,
  fileUrl?: string
) {
  if (!rawText || rawText.trim().length < 20) {
    throw new Error('Resume content is too short to extract candidate information.');
  }

  // 1. Extract structured candidate skills, roles, experience
  const parsed = await parseResume(rawText);

  // 2. Delete any old resume record for this user (1 active resume per user)
  await prisma.resume.deleteMany({ where: { userId } });

  // 3. Create fresh resume record in PostgreSQL
  const resume = await prisma.resume.create({
    data: {
      userId,
      fileName,
      fileUrl: fileUrl || null,
      parsedSkills: parsed.skills,
      parsedRoles: parsed.roles,
      yearsOfExperience: parsed.yearsOfExperience ?? null,
      extractionStatus: 'done',
    },
  });

  // 4. Immediately calculate match scores against all active tracked jobs
  await computeMatchesForUser(userId);

  return { resume, parsed };
}

// ── POST /resumes/upload & POST /upload ───────────────────────────────────────

const handleResumeUpload = async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;
    let rawText = '';
    let fileName = 'resume.txt';
    let fileUrl: string | undefined;

    if (req.file) {
      // Multipart file upload (PDF, DOCX, TXT)
      fileName = req.file.originalname || 'resume.pdf';
      rawText = await extractTextFromFileBuffer(
        req.file.buffer,
        req.file.mimetype,
        fileName
      );
    } else if (req.body) {
      // JSON body upload (raw text or pasted resume)
      const body = req.body as { text?: string; fileName?: string; fileUrl?: string };
      rawText = body.text || '';
      if (body.fileName) fileName = body.fileName;
      if (body.fileUrl) fileUrl = body.fileUrl;
    }

    if (!rawText || rawText.trim().length < 20) {
      res.status(400).json({
        error: 'Please provide a valid resume file (.pdf, .docx, .txt) or text content with at least 20 characters.',
      });
      return;
    }

    const { resume, parsed } = await processAndSaveResume(userId, rawText, fileName, fileUrl);

    res.status(200).json({
      resume,
      parsed,
      message: 'Resume parsed and matches calculated successfully.',
    });
  } catch (err: any) {
    console.error('[Matches] Resume upload error:', err);
    res.status(500).json({
      error: err.message || 'Failed to parse and store resume.',
    });
  }
};

matchesRouter.post('/resumes/upload', upload.single('file'), handleResumeUpload);
matchesRouter.post('/upload', upload.single('file'), handleResumeUpload);

// ── GET /resumes/current & GET /current ───────────────────────────────────────

const handleGetCurrentResume = async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;

    const resume = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!resume) {
      res.json({
        resume: null,
        hasResume: false,
      });
      return;
    }

    res.json({
      resume,
      hasResume: true,
    });
  } catch (err) {
    console.error('[Matches] Get current resume error:', err);
    res.status(500).json({ error: 'Failed to fetch active resume.' });
  }
};

matchesRouter.get('/resumes/current', handleGetCurrentResume);
matchesRouter.get('/current', handleGetCurrentResume);

// ── DELETE /resumes/current & DELETE /current ─────────────────────────────────

const handleDeleteCurrentResume = async (req: any, res: any) => {
  try {
    const userId = req.user!.userId;

    await prisma.resume.deleteMany({ where: { userId } });
    await prisma.matchScore.deleteMany({ where: { userId } });

    res.json({
      message: 'Resume and match calculations removed successfully.',
    });
  } catch (err) {
    console.error('[Matches] Delete resume error:', err);
    res.status(500).json({ error: 'Failed to delete resume.' });
  }
};

matchesRouter.delete('/resumes/current', handleDeleteCurrentResume);
matchesRouter.delete('/current', handleDeleteCurrentResume);

// ── GET /api/matches ─────────────────────────────────────────────────────────

const ACTIVE_MATCH_STATUSES = ['saved', 'applied', 'interview'];

matchesRouter.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Check if user has a parsed resume
    const resume = await prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!resume) {
      // Return user's active jobs without match scores (max 10)
      const jobs = await prisma.job.findMany({
        where: {
          userId,
          status: { in: ACTIVE_MATCH_STATUSES },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      const matches = jobs.map((job) => ({
        ...job,
        matchScore: undefined,
      }));

      res.json({
        matches,
        message: 'Upload a resume in Best Matches to calculate compatibility scores.',
        hasResume: false,
      });
      return;
    }

    // Fetch all active jobs (saved, applied, interview) with their associated MatchScore
    let jobsWithScores = await prisma.job.findMany({
      where: {
        userId,
        status: { in: ACTIVE_MATCH_STATUSES },
      },
      include: {
        matches: {
          where: { userId },
          take: 1,
        },
      },
    });

    // Auto-compute missing or legacy scores so deployments migrate existing
    // rankings without requiring an offline backfill.
    const staleJobs = jobsWithScores.filter((job) => {
      const match = job.matches?.[0];
      return !match || match.scoringVersion !== SCORING_VERSION;
    });
    if (staleJobs.length > 0) {
      await Promise.all(
        staleJobs.map(async (job) => {
          await computeMatchForSingleJob(userId, job.id);
        })
      );

      // Refetch with updated match scores
      jobsWithScores = await prisma.job.findMany({
        where: {
          userId,
          status: { in: ACTIVE_MATCH_STATUSES },
        },
        include: {
          matches: {
            where: { userId },
            take: 1,
          },
        },
      });
    }

    // Rank by match score descending and cap at top 10
    const matches = jobsWithScores
      .map((job) => ({
        ...job,
        matchScore: job.matches[0] || undefined,
      }))
      .sort((a, b) => (b.matchScore?.score ?? -1) - (a.matchScore?.score ?? -1))
      .slice(0, 10);

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

matchesRouter.post('/:jobId/explain', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { jobId } = req.params;

    const result = await explainJobMatch(userId, jobId);
    res.json(result);
  } catch (err: any) {
    console.error('[Matches] Explain error:', err);
    res.status(err.message?.includes('No match score') ? 404 : 500).json({
      error: err.message || 'Failed to generate match breakdown.',
    });
  }
});

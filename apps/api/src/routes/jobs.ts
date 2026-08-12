// ─────────────────────────────────────────────────────────────────────────────
// Landed — Jobs Routes
// GET    /api/jobs          — List user's tracked jobs (paginated, filterable)
// POST   /api/jobs          — Create a job manually
// POST   /api/jobs/extract  — Paste URL → enqueue AI extraction (202 Accepted)
// PATCH  /api/jobs/:id      — Update job fields or status
// DELETE /api/jobs/:id      — Delete a job entry
// GET    /api/jobs/:id      — Get a single job by ID
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@landed/db';
import { requireAuth } from '../lib/auth.js';
import { validate } from '../lib/validate.js';
import { enqueueExtraction, enqueueMatchScoring } from '../lib/queue.js';

export const jobsRouter = Router();

// All job routes require authentication
jobsRouter.use(requireAuth);

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateJobSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(150, 'Company name cannot exceed 150 characters'),
  title: z.string().trim().min(1, 'Title is required').max(150, 'Job title cannot exceed 150 characters'),
  location: z.string().trim().max(200, 'Location cannot exceed 200 characters').optional(),
  salaryRaw: z.string().trim().max(100, 'Salary text cannot exceed 100 characters').optional(),
  remoteType: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).optional(),
  experienceLevel: z.string().trim().max(100).optional(),
  requiredSkills: z.array(z.string().trim().max(50)).max(50, 'Cannot specify more than 50 skills').default([]),
  description: z.string().max(20000, 'Description cannot exceed 20,000 characters').optional(),
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']).default('saved'),
  notes: z.string().max(5000, 'Notes cannot exceed 5,000 characters').optional(),
  sourceUrl: z.string().url('Must be a valid URL').max(2000, 'URL cannot exceed 2,000 characters').optional(),
});

const UpdateJobSchema = z.object({
  company: z.string().trim().min(1).max(150).optional(),
  title: z.string().trim().min(1).max(150).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  salaryRaw: z.string().trim().max(100).nullable().optional(),
  remoteType: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).nullable().optional(),
  experienceLevel: z.string().trim().max(100).nullable().optional(),
  requiredSkills: z.array(z.string().trim().max(50)).max(50).optional(),
  description: z.string().max(20000).nullable().optional(),
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const ExtractUrlSchema = z.object({
  url: z.string().url('Must be a valid URL').max(2000, 'URL cannot exceed 2,000 characters'),
});

const ListJobsQuery = z.object({
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  sort: z.enum(['createdAt', 'updatedAt', 'company', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ── GET /api/jobs ────────────────────────────────────────────────────────────

// ── GET /api/jobs ────────────────────────────────────────────────────────────

jobsRouter.get('/', async (req, res) => {
  try {
    const parseResult = ListJobsQuery.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid search filter parameters.' });
      return;
    }

    const { status, page, limit, sort, order } = parseResult.data;
    const userId = req.user!.userId;

    const where = {
      userId,
      ...(status ? { status } : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Jobs] List error:', err);
    res.status(500).json({ error: 'Unable to load your applications. Please refresh or try again.' });
  }
});

// ── GET /api/jobs/:id ────────────────────────────────────────────────────────

jobsRouter.get('/:id', async (req, res) => {
  try {
    const id = req.params.id as string;
    const job = await prisma.job.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!job) {
      res.status(404).json({ error: 'Job application not found.' });
      return;
    }

    res.json({ job });
  } catch (err) {
    console.error('[Jobs] Get error:', err);
    res.status(500).json({ error: 'Unable to load application details.' });
  }
});

// ── POST /api/jobs ───────────────────────────────────────────────────────────

jobsRouter.post('/', validate('body', CreateJobSchema), async (req, res) => {
  try {
    const data = req.body as z.infer<typeof CreateJobSchema>;
    const userId = req.user!.userId;

    const job = await prisma.job.create({
      data: {
        company: data.company,
        title: data.title,
        location: data.location,
        salaryRaw: data.salaryRaw,
        remoteType: data.remoteType,
        jobType: data.jobType,
        experienceLevel: data.experienceLevel,
        requiredSkills: data.requiredSkills,
        description: data.description,
        status: data.status,
        notes: data.notes,
        sourceUrl: data.sourceUrl,
        user: { connect: { id: userId } },
        extractionStatus: 'idle',
      },
    });

    // If there's a resume, trigger match scoring for this new job
    const hasResume = await prisma.resume.findFirst({ where: { userId, extractionStatus: 'done' } });
    if (hasResume) {
      await enqueueMatchScoring(userId, job.id);
    }

    res.status(201).json({ job });
  } catch (err) {
    console.error('[Jobs] Create error:', err);
    res.status(500).json({ error: 'Unable to create job application. Please check your inputs and try again.' });
  }
});

// ── POST /api/jobs/extract ───────────────────────────────────────────────────
// This is the core "paste a URL" flow from the PRD.
// Creates a placeholder job, enqueues extraction, returns immediately.

jobsRouter.post('/extract', validate('body', ExtractUrlSchema), async (req, res) => {
  try {
    const { url } = req.body as z.infer<typeof ExtractUrlSchema>;
    const userId = req.user!.userId;

    // Create a placeholder job with pending status
    const job = await prisma.job.create({
      data: {
        user: { connect: { id: userId } },
        sourceUrl: url,
        company: 'Extracting…',
        title: 'Extracting…',
        status: 'saved',
        extractionStatus: 'pending',
        requiredSkills: [],
      },
    });

    // Enqueue the extraction — worker will fill in the real fields
    await enqueueExtraction(job.id, url, userId);

    // Return 202 Accepted — the client should poll or use SSE for updates
    res.status(202).json({
      job,
      message: 'Extraction queued.',
    });
  } catch (err) {
    console.error('[Jobs] Extract error:', err);
    res.status(500).json({ error: 'Unable to extract job details. Please check the URL and try again.' });
  }
});

// ── PATCH /api/jobs/:id ──────────────────────────────────────────────────────

jobsRouter.patch('/:id', validate('body', UpdateJobSchema), async (req, res) => {
  try {
    const data = req.body as z.infer<typeof UpdateJobSchema>;
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.job.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Job application not found.' });
      return;
    }

    // If status changed to "applied", set appliedAt
    const appliedAt = data.status === 'applied' && existing.status !== 'applied'
      ? new Date()
      : undefined;

    const job = await prisma.job.update({
      where: { id },
      data: {
        ...(data.company !== undefined ? { company: data.company } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.salaryRaw !== undefined ? { salaryRaw: data.salaryRaw } : {}),
        ...(data.remoteType !== undefined ? { remoteType: data.remoteType } : {}),
        ...(data.jobType !== undefined ? { jobType: data.jobType } : {}),
        ...(data.experienceLevel !== undefined ? { experienceLevel: data.experienceLevel } : {}),
        ...(data.requiredSkills !== undefined ? { requiredSkills: data.requiredSkills } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(appliedAt ? { appliedAt } : {}),
      },
    });

    res.json({ job });
  } catch (err) {
    console.error('[Jobs] Update error:', err);
    res.status(500).json({ error: 'Unable to update job application. Please try again.' });
  }
});

// ── DELETE /api/jobs/:id ─────────────────────────────────────────────────────

jobsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership before deletion
    const existing = await prisma.job.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Job application not found.' });
      return;
    }

    await prisma.job.delete({ where: { id } });

    res.json({ message: 'Job application deleted.' });
  } catch (err) {
    console.error('[Jobs] Delete error:', err);
    res.status(500).json({ error: 'Unable to delete job application. Please try again.' });
  }
});

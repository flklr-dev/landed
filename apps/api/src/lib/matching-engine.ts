// ─────────────────────────────────────────────────────────────────────────────
// Landed — Hybrid Deterministic & Semantic Match Scoring Engine
// Calculates 0–100% compatibility scores, skill intersection, and missing gaps
// comparing candidate resume data against tracked job opportunities.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@landed/db';
import { normalizeSkill } from './resume-parser.js';
import type { Job, Resume, MatchScore } from '@landed/shared-types';

export interface MatchCalculationResult {
  score: number; // 0–100
  matchedSkills: string[];
  missingSkills: string[];
}

/**
 * Calculates experience alignment (0–100) based on candidate years vs role seniority.
 */
function calculateExperienceScore(
  candidateYears: number | null | undefined,
  jobTitle: string,
  experienceLevel?: string | null
): number {
  const years = candidateYears ?? 3;
  const titleLower = jobTitle.toLowerCase();
  const levelLower = (experienceLevel || '').toLowerCase();

  const isSenior =
    titleLower.includes('senior') ||
    titleLower.includes('lead') ||
    titleLower.includes('staff') ||
    titleLower.includes('principal') ||
    levelLower.includes('senior');

  const isJunior =
    titleLower.includes('junior') ||
    titleLower.includes('entry') ||
    titleLower.includes('associate') ||
    titleLower.includes('intern') ||
    levelLower.includes('junior') ||
    levelLower.includes('entry');

  if (isSenior) {
    if (years >= 5) return 100;
    if (years >= 3) return 75;
    return 45;
  }

  if (isJunior) {
    if (years <= 3) return 100;
    return 90;
  }

  // Mid-level default
  if (years >= 2) return 100;
  return 70;
}

/**
 * Calculates role title similarity (0–100) between candidate roles and target job title.
 */
function calculateRoleScore(candidateRoles: string[], jobTitle: string): number {
  if (!candidateRoles || candidateRoles.length === 0) return 70;

  const jobTokens = new Set(
    jobTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['senior', 'junior', 'lead', 'staff', 'the', 'and', 'for'].includes(w))
  );

  let bestRoleScore = 50;

  for (const role of candidateRoles) {
    const roleTokens = role
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['senior', 'junior', 'lead', 'staff', 'the', 'and', 'for'].includes(w));

    if (roleTokens.length === 0) continue;

    let matchCount = 0;
    for (const token of roleTokens) {
      if (jobTokens.has(token)) {
        matchCount++;
      }
    }

    const overlap = matchCount / Math.max(roleTokens.length, 1);
    const score = Math.round(overlap * 100);
    if (score > bestRoleScore) {
      bestRoleScore = score;
    }
  }

  return Math.min(Math.max(bestRoleScore, 30), 100);
}

/**
 * Core matching algorithm comparing a candidate's resume against a job posting.
 */
export function calculateJobMatch(
  resume: { parsedSkills: string[]; parsedRoles: string[]; yearsOfExperience?: number | null },
  job: { requiredSkills: string[]; title: string; description?: string | null; experienceLevel?: string | null }
): MatchCalculationResult {
  const resumeSkillSet = new Set(resume.parsedSkills.map(normalizeSkill));
  const rawJobSkills = job.requiredSkills || [];
  const normalizedJobSkills = [...new Set(rawJobSkills.map(normalizeSkill))];

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of normalizedJobSkills) {
    if (resumeSkillSet.has(skill)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // 1. Skill Compatibility (60% of total score)
  let skillScore = 0;
  if (normalizedJobSkills.length > 0) {
    skillScore = (matchedSkills.length / normalizedJobSkills.length) * 100;
  } else {
    // If job has no explicit required skills, evaluate keyword mentions in description
    if (job.description && resume.parsedSkills.length > 0) {
      const descLower = job.description.toLowerCase();
      let matchedDescSkills = 0;
      for (const skill of resume.parsedSkills) {
        if (descLower.includes(skill.toLowerCase())) {
          matchedDescSkills++;
          matchedSkills.push(skill);
        }
      }
      skillScore = matchedDescSkills > 0 ? Math.min(matchedDescSkills * 20, 85) : 70;
    } else {
      skillScore = 75; // Neutral baseline when no skills specified
    }
  }

  // 2. Role & Title Alignment (25% of total score)
  const roleScore = calculateRoleScore(resume.parsedRoles, job.title);

  // 3. Seniority & Experience Alignment (15% of total score)
  const expScore = calculateExperienceScore(resume.yearsOfExperience, job.title, job.experienceLevel);

  // Composite Weighted Score
  const rawComposite = skillScore * 0.6 + roleScore * 0.25 + expScore * 0.15;
  const finalScore = Math.round(Math.min(Math.max(rawComposite, 10), 99));

  return {
    score: finalScore,
    matchedSkills,
    missingSkills,
  };
}

/**
 * Computes and persists match scores for all tracked jobs for a given user.
 */
export async function computeMatchesForUser(userId: string): Promise<number> {
  const resume = await prisma.resume.findFirst({
    where: { userId, extractionStatus: 'done' },
    orderBy: { uploadedAt: 'desc' },
  });

  if (!resume) return 0;

  const jobs = await prisma.job.findMany({
    where: { userId },
  });

  if (jobs.length === 0) return 0;

  let computedCount = 0;

  for (const job of jobs) {
    const match = calculateJobMatch(
      {
        parsedSkills: resume.parsedSkills,
        parsedRoles: resume.parsedRoles,
        yearsOfExperience: resume.yearsOfExperience,
      },
      {
        requiredSkills: job.requiredSkills,
        title: job.title,
        description: job.description,
        experienceLevel: job.experienceLevel,
      }
    );

    await prisma.matchScore.upsert({
      where: {
        userId_jobId: {
          userId,
          jobId: job.id,
        },
      },
      create: {
        userId,
        jobId: job.id,
        score: match.score,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
      },
      update: {
        score: match.score,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        computedAt: new Date(),
      },
    });

    computedCount++;
  }

  return computedCount;
}

/**
 * Computes and persists match score for a single newly created/updated job.
 */
export async function computeMatchForSingleJob(userId: string, jobId: string): Promise<boolean> {
  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
      orderBy: { uploadedAt: 'desc' },
    }),
    prisma.job.findUnique({
      where: { id: jobId },
    }),
  ]);

  if (!resume || !job) return false;

  const match = calculateJobMatch(
    {
      parsedSkills: resume.parsedSkills,
      parsedRoles: resume.parsedRoles,
      yearsOfExperience: resume.yearsOfExperience,
    },
    {
      requiredSkills: job.requiredSkills,
      title: job.title,
      description: job.description,
      experienceLevel: job.experienceLevel,
    }
  );

  await prisma.matchScore.upsert({
    where: {
      userId_jobId: {
        userId,
        jobId: job.id,
      },
    },
    create: {
      userId,
      jobId: job.id,
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
    },
    update: {
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      computedAt: new Date(),
    },
  });

  return true;
}

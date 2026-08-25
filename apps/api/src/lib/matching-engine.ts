// ─────────────────────────────────────────────────────────────────────────────
// Landed — Hybrid Deterministic & Semantic Match Scoring Engine
// Calculates 0–100% compatibility scores, skill intersection, and missing gaps
// comparing candidate resume data against tracked job opportunities.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@landed/db';
import {
  calculateJobMatch,
  SCORING_VERSION,
} from '@landed/shared-types';
export { calculateJobMatch, SCORING_VERSION } from '@landed/shared-types';

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
        preferredSkills: job.preferredSkills,
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
        transferableSkills: match.transferableSkills,
        skillScore: match.skillScore,
        preferredSkillScore: match.preferredSkillScore,
        roleScore: match.roleScore,
        experienceScore: match.experienceScore,
        confidence: match.confidence,
        scoringVersion: match.scoringVersion,
      },
      update: {
        score: match.score,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        transferableSkills: match.transferableSkills,
        skillScore: match.skillScore,
        preferredSkillScore: match.preferredSkillScore,
        roleScore: match.roleScore,
        experienceScore: match.experienceScore,
        confidence: match.confidence,
        scoringVersion: match.scoringVersion,
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
      preferredSkills: job.preferredSkills,
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
      transferableSkills: match.transferableSkills,
      skillScore: match.skillScore,
      preferredSkillScore: match.preferredSkillScore,
      roleScore: match.roleScore,
      experienceScore: match.experienceScore,
      confidence: match.confidence,
      scoringVersion: match.scoringVersion,
    },
    update: {
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      transferableSkills: match.transferableSkills,
      skillScore: match.skillScore,
      preferredSkillScore: match.preferredSkillScore,
      roleScore: match.roleScore,
      experienceScore: match.experienceScore,
      confidence: match.confidence,
      scoringVersion: match.scoringVersion,
      computedAt: new Date(),
    },
  });

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Resume Parsing Processor
// Downloads resume file, extracts text, sends to Grok 4.1 for structured
// parsing, computes embedding, then triggers match scoring for all jobs.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@landed/db';
import { calculateJobMatch, normalizeSkills } from '@landed/shared-types';
import { parseResumeText } from '../lib/llm.js';
import { generateEmbedding } from '../lib/embeddings.js';

interface ParseResumeData {
  resumeId: string;
  fileUrl: string;
  userId: string;
}

/**
 * Process a resume parsing task:
 * 1. Download the resume file
 * 2. Extract text (PDF or plain text for now)
 * 3. Send to Grok 4.1 for structured extraction
 * 4. Store parsed skills, roles, and embedding in the DB
 *
 * Note: Full PDF parsing (pdf-parse) and DOCX parsing (mammoth) will be
 * added when we integrate file uploads with multer + S3. For now, this
 * handles text content passed as the fileUrl body.
 */
export async function processResumeParse(data: ParseResumeData): Promise<void> {
  const { resumeId, fileUrl, userId } = data;
  console.log(`[Resume] Starting parse for resume ${resumeId}`);

  try {
    // 1. Fetch the resume content
    // For v1, we accept a URL to a text file or raw text content
    let resumeText: string;

    if (fileUrl.startsWith('http')) {
      const response = await fetch(fileUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch resume: ${response.status}`);
      }
      resumeText = await response.text();
    } else {
      // Treat fileUrl as raw text content (for development/testing)
      resumeText = fileUrl;
    }

    if (resumeText.length < 20) {
      throw new Error('Resume text too short to parse');
    }

    // Cap at 10k chars for LLM context
    resumeText = resumeText.slice(0, 10000);

    console.log(`[Resume] Text length: ${resumeText.length} chars`);

    // 2. Send to Grok 4.1 for structured parsing
    const parsed = await parseResumeText(resumeText);
    const normalizedSkills = normalizeSkills(parsed.skills);
    console.log(`[Resume] Parsed ${parsed.skills.length} skills, ${parsed.roles.length} roles`);

    // 3. Update the resume record with parsed data
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parsedSkills: normalizedSkills,
        parsedRoles: parsed.roles,
        yearsOfExperience: parsed.yearsOfExperience ?? null,
        extractionStatus: 'done',
      },
    });

    // 4. Compute embedding for the resume
    const embeddingText = [
      parsed.roles.join(', '),
      normalizedSkills.join(', '),
      parsed.summary ?? '',
    ].filter(Boolean).join(' — ');

    const embedding = await generateEmbedding(embeddingText);

    // Store embedding via raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE resumes SET embedding = $1::vector WHERE id = $2`,
      `[${embedding.join(',')}]`,
      resumeId,
    );

    console.log(`[Resume] ✓ Completed parse for resume ${resumeId}`);

    // 5. Trigger match scoring for all of this user's jobs
    // The match scoring processor will compute cosine similarity
    // between this resume embedding and all job embeddings
    const jobs = await prisma.job.findMany({
      where: { userId },
      select: { id: true },
    });

    if (jobs.length > 0) {
      console.log(`[Resume] Triggering match scoring for ${jobs.length} jobs`);
      // We'll import and call the match scoring inline here
      // to avoid circular dependency with the queue
      await computeMatchScores(userId);
    }

  } catch (err) {
    console.error(`[Resume] ✗ Failed parse for resume ${resumeId}:`, err);

    await prisma.resume.update({
      where: { id: resumeId },
      data: { extractionStatus: 'failed' },
    }).catch(() => {});

    throw err;
  }
}

// ── Match scoring ────────────────────────────────────────────────────────────
// Uses the same shared, versioned evidence scorer as the synchronous API path.
// Embeddings remain available for future ranking experiments but never silently
// overwrite the production score with a different formula.

export async function computeMatchScores(userId: string, specificJobId?: string): Promise<void> {
  console.log(`[Match] Computing scores for user ${userId}`);

  try {
    const resume = await prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
      orderBy: { uploadedAt: 'desc' },
    });
    if (!resume) {
      console.log('[Match] No parsed resume found — skipping');
      return;
    }

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        ...(specificJobId ? { id: specificJobId } : {}),
      },
    });
    console.log(`[Match] Computing ${jobs.length} evidence scores`);

    const candidateSkills = normalizeSkills(resume.parsedSkills);
    for (const job of jobs) {
      const match = calculateJobMatch(
        {
          parsedSkills: candidateSkills,
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
        where: { userId_jobId: { userId, jobId: job.id } },
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
    }

    console.log(`[Match] ✓ Updated ${jobs.length} match scores for user ${userId}`);

  } catch (err) {
    console.error(`[Match] ✗ Failed scoring for user ${userId}:`, err);
    throw err;
  }
}

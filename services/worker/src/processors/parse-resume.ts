// ─────────────────────────────────────────────────────────────────────────────
// Landed — Resume Parsing Processor
// Downloads resume file, extracts text, sends to Grok 4.1 for structured
// parsing, computes embedding, then triggers match scoring for all jobs.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@landed/db';
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
    console.log(`[Resume] Parsed ${parsed.skills.length} skills, ${parsed.roles.length} roles`);

    // 3. Update the resume record with parsed data
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parsedSkills: parsed.skills,
        parsedRoles: parsed.roles,
        yearsOfExperience: parsed.yearsOfExperience ?? null,
        extractionStatus: 'done',
      },
    });

    // 4. Compute embedding for the resume
    const embeddingText = [
      parsed.roles.join(', '),
      parsed.skills.join(', '),
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
// Computes cosine similarity between resume and all job embeddings using
// pgvector's <=> operator directly in SQL.

export async function computeMatchScores(userId: string, specificJobId?: string): Promise<void> {
  console.log(`[Match] Computing scores for user ${userId}`);

  try {
    // Get resume embedding via raw SQL
    const resumeRows = await prisma.$queryRawUnsafe<Array<{ id: string; embedding: string }>>(
      `SELECT id, embedding::text FROM resumes WHERE user_id = $1 AND extraction_status = 'done' LIMIT 1`,
      userId,
    );

    if (resumeRows.length === 0) {
      console.log('[Match] No parsed resume found — skipping');
      return;
    }

    const resumeEmbedding = resumeRows[0]!.embedding;

    // Compute cosine similarity for all (or one specific) job(s)
    // pgvector's <=> operator returns cosine distance (1 - similarity),
    // so we convert: score = (1 - distance) * 100
    const jobFilter = specificJobId ? `AND j.id = $2` : '';
    const params = specificJobId ? [userId, specificJobId, resumeEmbedding] : [userId, resumeEmbedding];
    const embeddingParamIdx = specificJobId ? 3 : 2;

    const matchRows = await prisma.$queryRawUnsafe<Array<{
      job_id: string;
      score: number;
      required_skills: string[];
    }>>(
      `SELECT j.id as job_id, 
              ROUND(((1 - (j.embedding <=> $${embeddingParamIdx}::vector)) * 100)::numeric, 1) as score,
              j.required_skills
       FROM jobs j 
       WHERE j.user_id = $1 
         AND j.embedding IS NOT NULL
         ${jobFilter}
       ORDER BY j.embedding <=> $${embeddingParamIdx}::vector ASC`,
      ...params,
    );

    console.log(`[Match] Computed ${matchRows.length} match scores`);

    // Get resume skills for comparison
    const resume = await prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
      select: { parsedSkills: true },
    });

    const resumeSkills = new Set((resume?.parsedSkills ?? []).map(s => s.toLowerCase()));

    // Upsert match scores
    for (const row of matchRows) {
      const jobSkills = row.required_skills ?? [];
      const matchedSkills = jobSkills.filter(s => resumeSkills.has(s.toLowerCase()));
      const missingSkills = jobSkills.filter(s => !resumeSkills.has(s.toLowerCase()));

      await prisma.matchScore.upsert({
        where: { userId_jobId: { userId, jobId: row.job_id } },
        create: {
          userId,
          jobId: row.job_id,
          score: Number(row.score),
          matchedSkills,
          missingSkills,
        },
        update: {
          score: Number(row.score),
          matchedSkills,
          missingSkills,
          computedAt: new Date(),
        },
      });
    }

    console.log(`[Match] ✓ Updated ${matchRows.length} match scores for user ${userId}`);

  } catch (err) {
    console.error(`[Match] ✗ Failed scoring for user ${userId}:`, err);
    throw err;
  }
}

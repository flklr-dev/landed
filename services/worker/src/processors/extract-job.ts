// ─────────────────────────────────────────────────────────────────────────────
// Landed — Job Extraction Processor
// Fetches a job posting URL, strips HTML, sends to Grok 4.1 for structured
// extraction, computes embeddings, and writes everything back to the DB.
//
// This is the core "paste a URL" flow from ARCHITECTURE.md Section 3.
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { prisma } from '@landed/db';
import { normalizeSkills } from '@landed/shared-types';
import { extractJobFromHTML } from '../lib/llm.js';
import { generateEmbedding } from '../lib/embeddings.js';
import { computeMatchScores } from './parse-resume.js';

interface ExtractJobData {
  jobId: string;
  url: string;
  userId: string;
}

/**
 * Process a job extraction task:
 * 1. Fetch URL HTML
 * 2. Strip to clean text (cheerio)
 * 3. Send to Grok 4.1 for structured extraction (JSON schema enforced)
 * 4. Validate output with Zod
 * 5. Write extracted fields to database
 * 6. Compute embedding vector and store via raw SQL (pgvector)
 */
export async function processJobExtraction(data: ExtractJobData): Promise<void> {
  const { jobId, url, userId } = data;
  console.log(`[Extract] Starting extraction for job ${jobId}: ${url}`);

  try {
    // 1. Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        // Pretend to be a browser to avoid being blocked by simple bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Strip HTML to clean text
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, header — noise that confuses the LLM
    $('script, style, nav, footer, header, iframe, noscript, svg, img').remove();

    // Get clean text, collapse whitespace
    const cleanText = $('body').text()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 8000); // Cap at ~8k chars to stay within context window

    if (cleanText.length < 50) {
      throw new Error('Extracted text too short — page may require JavaScript rendering');
    }

    console.log(`[Extract] Cleaned text: ${cleanText.length} chars`);

    // 3. Send to Grok 4.1 for extraction (Zod-validated inside extractJobFromHTML)
    const extracted = await extractJobFromHTML(cleanText);
    console.log(`[Extract] Extracted: ${extracted.company} — ${extracted.title}`);

    // 4. Write extracted fields to database
    await prisma.job.update({
      where: { id: jobId },
      data: {
        company: extracted.company,
        title: extracted.title,
        location: extracted.location ?? null,
        salaryRaw: extracted.salaryRaw ?? null,
        remoteType: extracted.remoteType ?? null,
        jobType: extracted.jobType ?? null,
        experienceLevel: extracted.experienceLevel ?? null,
        requiredSkills: normalizeSkills(extracted.requiredSkills),
        preferredSkills: normalizeSkills(extracted.preferredSkills),
        description: extracted.description ?? null,
        extractionStatus: 'done',
      },
    });

    // 5. Compute embedding for the job description
    // Combine title + company + description + skills for a rich vector
    const embeddingText = [
      extracted.title,
      extracted.company,
      extracted.description ?? '',
      extracted.requiredSkills.join(', '),
      extracted.preferredSkills.join(', '),
      extracted.experienceLevel ?? '',
    ].filter(Boolean).join(' — ');

    const embedding = await generateEmbedding(embeddingText);

    // 6. Store embedding via raw SQL (Prisma doesn't support vector type natively)
    await prisma.$executeRawUnsafe(
      `UPDATE jobs SET embedding = $1::vector WHERE id = $2`,
      `[${embedding.join(',')}]`,
      jobId,
    );

    // Extraction changes scoring inputs; refresh with the shared scorer.
    await computeMatchScores(userId, jobId);

    console.log(`[Extract] ✓ Completed extraction for job ${jobId}`);

  } catch (err) {
    console.error(`[Extract] ✗ Failed extraction for job ${jobId}:`, err);

    // Mark the job as failed so the frontend can show an error state
    await prisma.job.update({
      where: { id: jobId },
      data: { extractionStatus: 'failed' },
    }).catch(() => {}); // Don't throw if the job was already deleted

    throw err; // Re-throw so BullMQ can retry
  }
}

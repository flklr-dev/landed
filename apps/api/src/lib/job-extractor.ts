import { z } from 'zod';
import {
  extractDeterministicJob,
  extractFromUrlSlug,
  mergeJobCandidates,
  type ParsedJob,
} from './deterministic-job-parser.js';

export { extractFromUrlSlug } from './deterministic-job-parser.js';

export const ExtractedJobSchema = z.object({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: z.string().nullable().optional(),
  salaryRaw: z.string().nullable().optional(),
  remoteType: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});

export type ExtractedJob = z.infer<typeof ExtractedJobSchema>;

function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('linkedin.com')) {
      const jobId = parsed.searchParams.get('currentJobId');
      if (jobId && /^\d+$/.test(jobId)) return `https://www.linkedin.com/jobs/view/${jobId}/`;
    }
    return url;
  } catch {
    return url;
  }
}

function isGenericFeedOrSearchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.includes('linkedin.com')) {
      return (path.includes('/jobs/collections') || path.includes('/jobs/search')) &&
        !parsed.searchParams.get('currentJobId');
    }
    if (host.includes('indeed.')) {
      return (path === '/jobs' || path.startsWith('/q-') || path.startsWith('/l-')) &&
        !parsed.searchParams.get('jk') &&
        !parsed.searchParams.get('vjk');
    }
    if (host.includes('glassdoor.')) {
      return (path.includes('/job/jobs.htm') || path.includes('/job-search/')) &&
        !parsed.searchParams.get('jl');
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchJobPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn(`[Extractor] Fetch returned ${response.status} for ${url}`);
      return null;
    }

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > 5_000_000) {
      console.warn(`[Extractor] Page exceeded the 5 MB extraction limit for ${url}`);
      return null;
    }

    const html = await response.text();
    return html.length <= 5_000_000 ? html : null;
  } catch (error) {
    console.warn(
      `[Extractor] Page fetch failed for ${url}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function extractWithLLM(cleanText: string): Promise<ParsedJob | null> {
  // Hard fence: URL extraction remains purely deterministic unless explicitly enabled
  if (process.env.EXTRACT_USE_LLM !== 'true') return null;

  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || cleanText.length < 50) return null;

  const apiUrl = process.env.XAI_API_KEY
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = process.env.XAI_API_KEY ? 'grok-4-1' : 'gpt-4o-mini';
  const prompt = `Extract the job posting into JSON. Do not use the job board's name as the employer.
Return only this shape:
{"company":string,"title":string,"location":string|null,"salaryRaw":string|null,"remoteType":"remote"|"hybrid"|"onsite"|null,"jobType":"full-time"|"part-time"|"contract"|"freelance"|"internship"|null,"experienceLevel":string|null,"requiredSkills":string[],"description":string|null}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: cleanText.slice(0, 10_000) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return ExtractedJobSchema.partial().parse(JSON.parse(content));
  } catch (error) {
    console.warn(
      '[Extractor] Optional LLM extraction failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function needsOptionalEnrichment(job: ParsedJob): boolean {
  return !job.company ||
    !job.title ||
    (!job.location && !job.remoteType) ||
    (!job.salaryRaw && !job.jobType && (job.requiredSkills?.length || 0) === 0);
}

function finalizeJob(job: ParsedJob): ExtractedJob | null {
  if (!job.company || !job.title) return null;
  return ExtractedJobSchema.parse({
    company: job.company,
    title: job.title,
    location: job.location ?? null,
    salaryRaw: job.salaryRaw ?? null,
    remoteType: job.remoteType ?? null,
    jobType: job.jobType ?? null,
    experienceLevel: job.experienceLevel ?? null,
    requiredSkills: job.requiredSkills || [],
    description: job.description ?? null,
  });
}

export function extractJobDetailsFromHtml(html: string, url: string): ExtractedJob {
  const deterministic = extractDeterministicJob(html, url).job;
  const result = finalizeJob(deterministic);
  if (!result) {
    throw new Error('The page did not expose enough job information to identify the employer and role.');
  }
  return result;
}

export async function extractJobDetails(rawUrl: string): Promise<ExtractedJob> {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('Please enter a valid URL (including https://).');
  }

  if (isGenericFeedOrSearchUrl(rawUrl)) {
    throw new Error('Open the specific job posting and copy its direct link, not a search or collection page.');
  }

  const url = normalizeJobUrl(rawUrl);
  const html = await fetchJobPage(url);
  if (html) {
    const { job: deterministic, cleanText } = extractDeterministicJob(html, url);
    let merged = deterministic;
    if (needsOptionalEnrichment(deterministic)) {
      const llm = await extractWithLLM(cleanText);
      if (llm) merged = mergeJobCandidates([deterministic, llm], url);
    }

    const result = finalizeJob(merged);
    if (result) return result;
  }

  const slug = finalizeJob(extractFromUrlSlug(url));
  if (slug) return slug;

  throw new Error(
    'This page hides or does not publish enough job details. Please review and fill in the missing fields manually.',
  );
}

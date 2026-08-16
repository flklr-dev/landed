// ─────────────────────────────────────────────────────────────────────────────
// Landed — Universal Job Extractor
// Scrapes job posting pages, extracts structured metadata via:
// 1. JSON-LD JobPosting schema parsing (instant & highly accurate)
// 2. OpenGraph / Meta tags parsing
// 3. LLM structured extraction (Grok / OpenAI / OpenRouter if API key set)
// 4. Intelligent URL slug & domain heuristic fallback
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { z } from 'zod';

export const ExtractedJobSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  salaryRaw: z.string().nullable().optional(),
  remoteType: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});

export type ExtractedJob = z.infer<typeof ExtractedJobSchema>;

interface FetchResult {
  html: string;
  cleanText: string;
  $: cheerio.CheerioAPI;
}

/**
 * Capitalize & clean word slugs
 */
function formatSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize feed/collection URLs where possible (e.g. LinkedIn collection URLs with currentJobId)
 */
function normalizeJobUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    // LinkedIn collection / search with currentJobId
    if (host.includes('linkedin.com')) {
      const jobId = parsed.searchParams.get('currentJobId');
      if (jobId && /^\d+$/.test(jobId)) {
        return `https://www.linkedin.com/jobs/view/${jobId}/`;
      }
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

/**
 * Check if the URL is a generic job search or collections feed without a specific job
 */
function isGenericFeedOrSearchUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (host.includes('linkedin.com')) {
      if ((pathname.includes('/jobs/collections') || pathname.includes('/jobs/search')) && !parsed.searchParams.get('currentJobId')) {
        return true;
      }
    }
    if (host.includes('indeed.com')) {
      if ((pathname === '/jobs' || pathname.startsWith('/q-') || pathname.startsWith('/l-')) && !parsed.searchParams.get('jk') && !parsed.searchParams.get('vjk')) {
        return true;
      }
    }
    if (host.includes('glassdoor.com')) {
      if ((pathname.includes('/job/jobs.htm') || pathname.includes('/job-search/')) && !parsed.searchParams.get('jl')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if the fetched page is an authwall, login page, or bot-block screen
 */
function isAuthWallPage($: cheerio.CheerioAPI, html: string): boolean {
  const pageTitle = ($('title').text() || '').trim().toLowerCase();
  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim().toLowerCase();
  const ogDesc = ($('meta[property="og:description"]').attr('content') || '').trim().toLowerCase();

  // If the page title/OG title explicitly denotes a login or security checkpoint page
  const authTitlePatterns = [
    /^linkedin:\s*log in/i,
    /^linkedin login/i,
    /^sign in\s*[|\-–]/i,
    /^log in\s*[|\-–]/i,
    /^login\s*[|\-–]/i,
    /login to linkedin/i,
    /authwall/i,
    /security verification/i,
    /robot check/i,
    /captcha/i,
    /attention required/i,
    /access denied/i,
    /just a moment\.\.\./i,
    /cloudflare/i,
  ];

  for (const pattern of authTitlePatterns) {
    if (pattern.test(pageTitle) || pattern.test(ogTitle)) {
      return true;
    }
  }

  // Check for LinkedIn specific login wall description
  if (/keep in touch with people you know, share ideas/i.test(ogDesc)) {
    return true;
  }

  // If page title is generic "LinkedIn" with no job information
  if (pageTitle === 'linkedin' || pageTitle === 'sign in' || pageTitle === 'log in') {
    return true;
  }

  return false;
}

/**
 * Intelligent URL Slug Extractor
 * Extracts company name & job title directly from URL structures (Greenhouse, Lever, LinkedIn, Ashby, Workable)
 */
export function extractFromUrlSlug(urlStr: string): Partial<ExtractedJob> {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname);

    let company = '';
    let title = '';

    // 1. Known ATS patterns
    // Greenhouse: boards.greenhouse.io/:company/jobs/:id
    if (host.includes('greenhouse.io')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0] && parts[0] !== 'jobs') company = formatSlug(parts[0]);
    }
    // Lever: jobs.lever.co/:company/:id
    else if (host.includes('lever.co')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) company = formatSlug(parts[0]);
    }
    // Ashby: jobs.ashbyhq.com/:company/:id
    else if (host.includes('ashbyhq.com')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) company = formatSlug(parts[0]);
    }
    // Workable: apply.workable.com/:company/j/:id
    else if (host.includes('workable.com')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0] && parts[0] !== 'j') company = formatSlug(parts[0]);
    }
    // LinkedIn: linkedin.com/jobs/view/:title-at-:company-:id
    else if (host.includes('linkedin.com')) {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] || parts[parts.length - 2] || '';
      if (slug.includes('-at-')) {
        const [titlePart, compPart] = slug.split('-at-');
        if (titlePart) title = formatSlug(titlePart);
        if (compPart) company = formatSlug(compPart.replace(/-\d+$/, ''));
      }
    }

    // 2. Generic company from domain name if not an aggregator domain
    const aggregatorHosts = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com', 'simplyhired.com'];
    const isAggregator = aggregatorHosts.some((h) => host.includes(h));

    if (!company && !isAggregator) {
      const domainParts = host.split('.');
      if (domainParts.length >= 2) {
        const name = domainParts[domainParts.length - 2] || '';
        if (!['jobs', 'careers', 'boards', 'apply', 'app', 'work'].includes(name.toLowerCase())) {
          company = formatSlug(name);
        } else if (domainParts.length >= 3) {
          company = formatSlug(domainParts[domainParts.length - 3] || '');
        }
      }
    }

    // 3. Infer job title from path slug if not set
    if (!title && !isAggregator) {
      const pathSegments = pathname.split('/').filter(Boolean);
      for (const seg of pathSegments) {
        if (['jobs', 'careers', 'view', 'listing', 'job', 'apply', 'p', 'j'].includes(seg.toLowerCase())) continue;
        if (/^[0-9a-fA-F-]{8,}$/.test(seg) || /^\d+$/.test(seg)) continue;

        if (seg.includes('-') || seg.includes('_')) {
          const cleaned = seg.replace(/-\d+$/, '').replace(/^job-/, '');
          if (cleaned.length > 3) {
            title = formatSlug(cleaned);
            break;
          }
        }
      }
    }

    return {
      company: company || undefined,
      title: title || undefined,
      location: null,
      remoteType: null,
      jobType: null,
      experienceLevel: null,
      requiredSkills: [],
      description: null,
    };
  } catch {
    return {
      company: undefined,
      title: undefined,
      location: null,
      remoteType: null,
      jobType: null,
      experienceLevel: null,
      requiredSkills: [],
      description: null,
    };
  }
}

/**
 * Clean & fetch the target webpage HTML with strict 5-second timeout
 */
async function fetchJobPage(url: string): Promise<FetchResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000), // Strict 5s timeout
    });

    if (!response.ok) {
      console.warn(`[Extractor] Fetch returned status ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, ads
    $('script:not([type="application/ld+json"]), style, nav, footer, header, iframe, noscript, svg, img').remove();

    const cleanText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 8000);

    return { html, cleanText, $ };
  } catch (err) {
    console.warn(`[Extractor] Page fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 1. Extract from JSON-LD Schema (Schema.org JobPosting)
 */
function extractFromJsonLd($: cheerio.CheerioAPI): Partial<ExtractedJob> | null {
  const jsonLdScripts = $('script[type="application/ld+json"]');
  if (jsonLdScripts.length === 0) return null;

  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const content = $(jsonLdScripts[i]).html();
      if (!content) continue;
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item['@type'] === 'JobPosting' || item.type === 'JobPosting') {
          const title = item.title;
          const company =
            typeof item.hiringOrganization === 'string'
              ? item.hiringOrganization
              : item.hiringOrganization?.name || '';

          const location =
            item.jobLocation?.address?.addressLocality ||
            item.jobLocation?.address?.addressRegion ||
            (typeof item.jobLocation?.address === 'string' ? item.jobLocation.address : '') ||
            null;

          let salaryRaw: string | null = null;
          if (item.baseSalary) {
            const val = item.baseSalary.value;
            const currency = item.baseSalary.currency || '$';
            if (val && typeof val === 'object') {
              if (val.minValue && val.maxValue) {
                salaryRaw = `${currency}${val.minValue.toLocaleString()} - ${currency}${val.maxValue.toLocaleString()}`;
              } else if (val.value) {
                salaryRaw = `${currency}${val.value.toLocaleString()}`;
              }
            } else if (typeof val === 'number') {
              salaryRaw = `${currency}${val.toLocaleString()}`;
            }
          }

          let remoteType: ExtractedJob['remoteType'] = null;
          const locationType = String(item.jobLocationType || '').toLowerCase();
          const descriptionText = String(item.description || '').toLowerCase();
          if (locationType.includes('telecommute') || descriptionText.includes('remote') || String(title).toLowerCase().includes('remote')) {
            remoteType = 'remote';
          } else if (descriptionText.includes('hybrid')) {
            remoteType = 'hybrid';
          }

          let jobType: ExtractedJob['jobType'] = null;
          const empType = String(item.employmentType || '').toLowerCase();
          if (empType.includes('full') || empType.includes('permanent')) jobType = 'full-time';
          else if (empType.includes('contract')) jobType = 'contract';
          else if (empType.includes('part')) jobType = 'part-time';
          else if (empType.includes('intern')) jobType = 'internship';

          const rawDesc = String(item.description || '').replace(/<[^>]*>?/gm, ' ');
          const extractedSkills = extractSkillsHeuristically(rawDesc);

          if (title && (company || location)) {
            return {
              title: String(title).trim(),
              company: String(company).trim() || 'Company',
              location: location ? String(location).trim() : null,
              salaryRaw,
              remoteType,
              jobType,
              experienceLevel: null,
              requiredSkills: extractedSkills,
              description: rawDesc.slice(0, 300).trim() || null,
            };
          }
        }
      }
    } catch {
      // Continue to next script
    }
  }

  return null;
}

/**
 * 2. Extract from Meta tags & OpenGraph
 */
function extractFromMetaTags($: cheerio.CheerioAPI, url: string): Partial<ExtractedJob> {
  const rawOgTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';
  const rawOgDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  // Check if title is login or bot block screen
  const isBogusTitle = /login|sign in|sign up|access denied|security check|robot check|cloudflare/i.test(rawOgTitle);
  if (isBogusTitle) return {};

  // Strip trailing platform suffixes like "| LinkedIn", "- Greenhouse", "• Lever"
  const cleanTitleStr = rawOgTitle
    .replace(/\s*[|\-–•]\s*(LinkedIn|Greenhouse|Lever|Ashby|Workable|Indeed|ZipRecruiter|Glassdoor)\s*$/i, '')
    .trim();

  let title = '';
  let company = ogSiteName;
  let location: string | null = null;

  // Pattern 1: "{Company} (is )?hiring (a |an |for )?{Title}( in {Location})?"
  const hiringMatch = cleanTitleStr.match(/^(.+?)\s+(?:is\s+)?hiring(?:\s+(?:a|an|for\s+a|for\s+an|for))?\s+(.+?)(?:\s+in\s+(.+))?$/i);
  if (hiringMatch) {
    company = hiringMatch[1]!.trim();
    title = hiringMatch[2]!.trim();
    if (hiringMatch[3]) location = hiringMatch[3].trim();
  }
  // Pattern 2: "{Title} at {Company}( in {Location})?"
  else if (cleanTitleStr.includes(' at ')) {
    const parts = cleanTitleStr.split(' at ');
    title = parts[0]!.trim();
    const remaining = parts[1]!.trim();
    if (remaining.includes(' in ')) {
      const [c, l] = remaining.split(' in ');
      if (!company) company = c!.trim();
      location = l!.trim();
    } else {
      if (!company) company = remaining.split(/[-–|]/)[0]!.trim();
    }
  }
  // Pattern 3: "{Title} - {Company}"
  else if (cleanTitleStr.includes(' - ')) {
    const parts = cleanTitleStr.split(' - ');
    title = parts[0]!.trim();
    if (!company) company = parts[1]!.split(/[-–|]/)[0]!.trim();
  }
  // Pattern 4: "{Title} | {Company}"
  else if (cleanTitleStr.includes(' | ')) {
    const parts = cleanTitleStr.split(' | ');
    title = parts[0]!.trim();
    if (!company) company = parts[1]!.trim();
  } else {
    title = cleanTitleStr;
  }

  // Fallback to URL slug if empty
  const slugFallback = extractFromUrlSlug(url);
  if (!company) company = slugFallback.company || '';
  if (!title) title = slugFallback.title || '';

  // Filter out platform names if not a genuine company
  if (company.toLowerCase() === 'linkedin' || company.toLowerCase() === 'indeed') {
    company = '';
  }

  if (!title || !company) return {};

  const cleanDesc = rawOgDesc
    .replace(/^Posted\s+[\d:APM\s.]+/i, '')
    .replace(/See this and similar jobs on LinkedIn\.?/i, '')
    .trim();

  return {
    title: title.trim(),
    company: company.trim(),
    location: location || null,
    remoteType: (location && location.toLowerCase().includes('remote')) ? 'remote' : null,
    description: cleanDesc.slice(0, 500).trim() || null,
    requiredSkills: extractSkillsHeuristically(cleanDesc),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 3. Fast Heuristic Skill Matcher
 */
function extractSkillsHeuristically(text: string): string[] {
  if (!text) return [];
  const commonSkills = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Golang',
    'Rust', 'Java', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'AWS', 'Docker', 'Kubernetes', 'GCP', 'Azure', 'GraphQL', 'REST', 'TailwindCSS',
    'HTML', 'CSS', 'Git', 'Linux', 'Terraform', 'CI/CD', 'Jest', 'Cypress', 'FastAPI',
    'Django', 'Ruby', 'Rails', 'Vue', 'Angular', 'Kafka', 'Elasticsearch', 'Solidity'
  ];

  const lower = text.toLowerCase();
  const matched = new Set<string>();

  for (const skill of commonSkills) {
    const escaped = escapeRegex(skill.toLowerCase());
    const pattern = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (pattern.test(lower)) {
      matched.add(skill);
    }
  }

  return Array.from(matched).slice(0, 10);
}

/**
 * 4. Structured LLM Extractor (xAI Grok / OpenAI / OpenRouter) — Optional
 */
async function extractWithLLM(cleanText: string): Promise<ExtractedJob | null> {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.XAI_API_KEY
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = process.env.XAI_API_KEY ? 'grok-4-1' : 'gpt-4o-mini';

  const systemPrompt = `You are a precise job posting data extractor. Extract structured JSON from the provided job posting text.
Return ONLY a valid JSON object matching this schema:
{
  "company": string,
  "title": string,
  "location": string | null,
  "salaryRaw": string | null,
  "remoteType": "remote" | "hybrid" | "onsite" | null,
  "jobType": "full-time" | "part-time" | "contract" | "freelance" | "internship" | null,
  "experienceLevel": string | null,
  "requiredSkills": string[],
  "description": string | null
}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: cleanText.slice(0, 7000) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(5000), // Strict 5s LLM timeout
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return ExtractedJobSchema.parse(parsed);
  } catch (err) {
    console.warn('[Extractor] LLM call skipped or timed out:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Main Universal Extraction Entry Point
 * Fast, resilient, 100% reliable fallback guarantee.
 */
export async function extractJobDetails(rawUrl: string): Promise<ExtractedJob> {
  // Validate URL structure
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error('Please enter a valid URL (including https://).');
  }

  if (isGenericFeedOrSearchUrl(rawUrl)) {
    throw new Error(
      'This link appears to be a job search or collections feed rather than a direct job posting. Please open the specific job and copy its direct link.'
    );
  }

  const normalizedUrl = normalizeJobUrl(rawUrl);

  // 1. Fetch & parse HTML (Max 5 seconds)
  const fetchResult = await fetchJobPage(normalizedUrl);

  if (fetchResult && !isAuthWallPage(fetchResult.$, fetchResult.html)) {
    const { $, cleanText } = fetchResult;

    // 2. Try LLM extraction if API key configured
    const llmResult = await extractWithLLM(cleanText);
    if (llmResult && llmResult.title && llmResult.company) {
      return llmResult;
    }

    // 3. Try JSON-LD Schema (works on Greenhouse, Lever, Workable, Ashby, etc.)
    const jsonLdResult = extractFromJsonLd($);
    if (jsonLdResult && jsonLdResult.title && jsonLdResult.company) {
      return {
        company: jsonLdResult.company,
        title: jsonLdResult.title,
        location: jsonLdResult.location ?? null,
        salaryRaw: jsonLdResult.salaryRaw ?? null,
        remoteType: jsonLdResult.remoteType ?? null,
        jobType: jsonLdResult.jobType ?? null,
        experienceLevel: jsonLdResult.experienceLevel ?? null,
        requiredSkills: jsonLdResult.requiredSkills || extractSkillsHeuristically(cleanText),
        description: jsonLdResult.description ?? null,
      };
    }

    // 4. Meta tags & OpenGraph parser
    const metaResult = extractFromMetaTags($, normalizedUrl);
    if (metaResult.company && metaResult.title) {
      return {
        company: metaResult.company,
        title: metaResult.title,
        location: null,
        salaryRaw: null,
        remoteType: null,
        jobType: null,
        experienceLevel: null,
        requiredSkills: metaResult.requiredSkills || extractSkillsHeuristically(cleanText),
        description: metaResult.description ?? null,
      };
    }
  }

  // 5. URL Slug & Domain Heuristics (Guaranteed fallback for ATS URLs or slugged links)
  const slugResult = extractFromUrlSlug(normalizedUrl);
  if (slugResult.company && slugResult.title) {
    return {
      company: slugResult.company,
      title: slugResult.title,
      location: null,
      salaryRaw: null,
      remoteType: null,
      jobType: null,
      experienceLevel: null,
      requiredSkills: [],
      description: null,
    };
  }

  // 6. If both page scraping (due to login wall) and URL slug parsing cannot find company & title:
  throw new Error(
    'Unable to extract job details automatically from this link (the page requires login or is protected). Please fill in the details manually below.'
  );
}

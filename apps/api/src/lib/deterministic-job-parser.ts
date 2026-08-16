import * as cheerio from 'cheerio';

export type RemoteType = 'remote' | 'hybrid' | 'onsite';
export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';

export interface ParsedJob {
  company?: string | null;
  title?: string | null;
  location?: string | null;
  salaryRaw?: string | null;
  remoteType?: RemoteType | null;
  jobType?: JobType | null;
  experienceLevel?: string | null;
  requiredSkills?: string[];
  description?: string | null;
}

const PLATFORM_HOSTS = [
  'bossjob.',
  'linkedin.',
  'indeed.',
  'glassdoor.',
  'jobstreet.',
  'seek.',
  'ziprecruiter.',
  'monster.',
  'simplyhired.',
  'wellfound.',
  'dice.',
  'careerbuilder.',
  'workdayjobs.',
];

const PLATFORM_NAMES = [
  'bossjob',
  'linkedin',
  'indeed',
  'glassdoor',
  'jobstreet',
  'seek',
  'ziprecruiter',
  'monster',
  'simplyhired',
  'wellfound',
  'greenhouse',
  'lever',
  'ashby',
  'workable',
];

const SKILL_CATALOG = [
  // Software and cloud
  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Golang',
  'Rust', 'Java', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'AWS', 'Docker', 'Kubernetes', 'GCP', 'Azure', 'GraphQL', 'REST', 'HTML', 'CSS',
  'Git', 'Linux', 'Terraform', 'CI/CD', 'Jest', 'Cypress', 'FastAPI', 'Django',
  'Ruby', 'Rails', 'Vue', 'Angular', 'Kafka', 'Elasticsearch', 'Figma',
  // Business, operations, and common professional skills
  'Project Management', 'Product Management', 'Data Analysis', 'Market Research',
  'User Research', 'Internet Research', 'Customer Service', 'Sales', 'Marketing',
  'Digital Marketing', 'SEO', 'Copywriting', 'Content Writing', 'Accounting',
  'Bookkeeping', 'Financial Analysis', 'Recruiting', 'Human Resources',
  'Supply Chain', 'Inventory Management', 'Quality Assurance', 'Operations',
  'Microsoft Excel', 'Microsoft Office', 'Google Workspace', 'Salesforce', 'HubSpot',
  'Power BI', 'Tableau', 'QuickBooks', 'SAP', 'AutoCAD', 'Adobe Photoshop',
  'Communication', 'Leadership', 'Problem Solving', 'Time Management',
  'Attention to Detail', 'Teamwork', 'English', 'Spanish', 'Mandarin',
  'ChatGPT', 'Medical Equipment', 'Networking', 'IT Hardware',
];

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim()
    : '';
}

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return normalizeText(
    value
      .replace(/<(?:br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function formatSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isPlatformHost(host: string): boolean {
  return PLATFORM_HOSTS.some((platform) => host.includes(platform));
}

function isPlatformCompany(company: string, host: string): boolean {
  const normalized = company.toLowerCase().trim();
  if (!normalized) return true;
  if (isPlatformHost(host) && PLATFORM_NAMES.some((name) => normalized === name || normalized.startsWith(`${name} -`))) {
    return true;
  }
  return /career platform|job search|jobs marketplace|recruitment platform/i.test(company);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
}

function inferRemoteType(text: string): RemoteType | null {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\b(remote|work[\s-]?from[\s-]?home|telecommut(?:e|ing))\b/i.test(text)) return 'remote';
  if (/\b(on[\s-]?site|in[\s-]?office)\b/i.test(text)) return 'onsite';
  return null;
}

function inferJobType(value: unknown): JobType | null {
  const text = normalizeText(value).toLowerCase().replace(/_/g, ' ');
  if (/\b(part time|part-time)\b/.test(text)) return 'part-time';
  if (/\b(full time|full-time|permanent)\b/.test(text)) return 'full-time';
  if (/\b(intern|internship)\b/.test(text)) return 'internship';
  if (/\b(freelance|freelancer)\b/.test(text)) return 'freelance';
  if (/\b(contract|contractor|temporary|temp)\b/.test(text)) return 'contract';
  return null;
}

function inferExperienceLevel(text: string): string | null {
  if (/\b(no experience|required experience:\s*none|fresh graduate)\b/i.test(text)) return 'Entry Level';
  if (/\b(intern|internship)\b/i.test(text)) return 'Intern';
  if (/\b(entry[\s-]?level|junior)\b/i.test(text)) return 'Entry Level';
  if (/\b(senior|sr\.)\b/i.test(text)) return 'Senior';
  if (/\b(staff|principal|team lead|technical lead|lead (?:engineer|developer|designer|manager|analyst|architect))\b/i.test(text)) return 'Lead';
  if (/\b(director|vice president|vp|chief|executive)\b/i.test(text)) return 'Executive';
  if (/\b(mid[\s-]?level|intermediate)\b/i.test(text)) return 'Mid';
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSkillsHeuristically(text: string): string[] {
  if (!text) return [];
  const matched = new Set<string>();

  for (const skill of SKILL_CATALOG) {
    if (skill === 'Sales' && /\bnot (?:a )?sales (?:job|role)\b/i.test(text)) continue;
    const pattern = new RegExp(
      `(?:^|[^a-zA-Z0-9_#+])${escapeRegex(skill)}(?:$|[^a-zA-Z0-9_#+])`,
      'i',
    );
    if (pattern.test(text)) matched.add(skill);
  }

  return [...matched].slice(0, 20);
}

function splitSkills(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const skills = values
    .flatMap((item) => normalizeText(item).split(/[,;|•\n]/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 50);
  return [...new Set(skills)].slice(0, 20);
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    PHP: '₱',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    INR: '₹',
  };
  return symbols[currency.toUpperCase()] || `${currency.toUpperCase()} `;
}

function formatAmount(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('en-US') : null;
}

function formatStructuredSalary(baseSalary: unknown): string | null {
  if (!baseSalary || typeof baseSalary !== 'object') return null;
  const salary = baseSalary as Record<string, unknown>;
  const currency = currencySymbol(normalizeText(salary.currency) || 'USD');
  const rawValue = salary.value;
  const value = rawValue && typeof rawValue === 'object'
    ? rawValue as Record<string, unknown>
    : { value: rawValue };
  const min = formatAmount(value.minValue);
  const max = formatAmount(value.maxValue);
  const exact = formatAmount(value.value);
  const amount = min && max ? `${currency}${min}–${currency}${max}` : exact ? `${currency}${exact}` : null;
  if (!amount) return null;

  const unit = normalizeText(value.unitText).toLowerCase();
  const units: Record<string, string> = {
    hour: 'hour',
    hourly: 'hour',
    day: 'day',
    daily: 'day',
    week: 'week',
    weekly: 'week',
    month: 'month',
    monthly: 'month',
    year: 'year',
    yearly: 'year',
    annual: 'year',
  };
  return units[unit] ? `${amount}/${units[unit]}` : amount;
}

function extractSalaryFromText(text: string): string | null {
  const salaryPattern =
    /(?:\b(?:PHP|USD|EUR|GBP|AUD|CAD|SGD|INR)\s*)?(?:₱|\$|€|£|¥|₹)\s*\d[\d,.]*(?:\s*[kK])?(?:\s*(?:-|–|to)\s*(?:(?:PHP|USD|EUR|GBP|AUD|CAD|SGD|INR)\s*)?(?:₱|\$|€|£|¥|₹)?\s*\d[\d,.]*(?:\s*[kK])?)?(?:\s*(?:\/|per\s+|\[)(?:hour|hourly|day|daily|week|weekly|month|monthly|year|yearly|annual)(?:\])?)?/i;
  const match = text.match(salaryPattern);
  return match ? normalizeText(match[0]).replace(/\[(\w+)\]/, '/$1').replace(/\s+\/\s*/, '/') : null;
}

function getType(value: unknown): string[] {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>)['@type'] : undefined;
  return (Array.isArray(raw) ? raw : [raw]).map(normalizeText).filter(Boolean);
}

function findJobPostingNodes(value: unknown, depth = 0, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (depth > 12 || found.length >= 10 || value === null || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) findJobPostingNodes(item, depth + 1, found);
    return found;
  }

  const object = value as Record<string, unknown>;
  if (getType(object).some((type) => type.toLowerCase() === 'jobposting')) found.push(object);
  for (const child of Object.values(object)) findJobPostingNodes(child, depth + 1, found);
  return found;
}

function balancedJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseEmbeddedJobPostings(script: string): Record<string, unknown>[] {
  if (!script.includes('JobPosting') || script.length > 600_000) return [];
  const payloads = [script];
  const nextFlightPattern = /self\.__next_f\.push\(\[\d+,("(?:\\.|[^"\\])*")\]\)/gs;
  for (const match of script.matchAll(nextFlightPattern)) {
    try {
      payloads.push(JSON.parse(match[1]!) as string);
    } catch {
      // Ignore malformed framework payloads.
    }
  }

  const found: Record<string, unknown>[] = [];
  for (const payload of payloads) {
    let marker = payload.indexOf('JobPosting');
    while (marker >= 0 && found.length < 10) {
      let start = payload.lastIndexOf('{', marker);
      while (start >= 0) {
        const json = balancedJsonObject(payload, start);
        if (json) {
          try {
            const parsed = JSON.parse(json);
            const nodes = findJobPostingNodes(parsed);
            if (nodes.length > 0) {
              found.push(...nodes);
              break;
            }
          } catch {
            // Try the next enclosing object.
          }
        }
        start = payload.lastIndexOf('{', start - 1);
      }
      marker = payload.indexOf('JobPosting', marker + 10);
    }
  }
  return found;
}

function readOrganization(value: unknown): string | null {
  if (typeof value === 'string') return normalizeText(value) || null;
  if (!value || typeof value !== 'object') return null;
  return firstString((value as Record<string, unknown>).name);
}

function readAddress(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.map(readAddress).find(Boolean) || null;
  }
  if (typeof value === 'string') return normalizeText(value) || null;
  if (!value || typeof value !== 'object') return null;

  const object = value as Record<string, unknown>;
  const address = object.address && typeof object.address === 'object'
    ? object.address as Record<string, unknown>
    : object;
  const parts = [
    address.addressLocality,
    address.addressRegion,
    address.addressCountry && typeof address.addressCountry === 'object'
      ? (address.addressCountry as Record<string, unknown>).name
      : address.addressCountry,
  ].map(normalizeText).filter(Boolean);
  return [...new Set(parts)].join(', ') || null;
}

function candidateFromJobPosting(posting: Record<string, unknown>): ParsedJob {
  const title = firstString(posting.title, posting.name);
  const description = stripHtml(posting.description);
  const locationType = normalizeText(posting.jobLocationType);
  const remoteType = inferRemoteType(`${locationType} ${title || ''} ${description.slice(0, 1000)}`);
  const location = remoteType === 'remote'
    ? 'Remote'
    : readAddress(posting.jobLocation) || readAddress(posting.applicantLocationRequirements);
  const explicitSkills = splitSkills(posting.skills);
  const requiredSkills = [...new Set([...explicitSkills, ...extractSkillsHeuristically(description)])].slice(0, 20);

  return {
    title,
    company: readOrganization(posting.hiringOrganization),
    location,
    salaryRaw: formatStructuredSalary(posting.baseSalary),
    remoteType,
    jobType: inferJobType(posting.employmentType),
    experienceLevel: inferExperienceLevel(`${normalizeText(posting.experienceRequirements)} ${description.slice(0, 1500)}`),
    requiredSkills,
    description: description.slice(0, 4000) || null,
  };
}

function extractStructuredCandidates($: cheerio.CheerioAPI): ParsedJob[] {
  const postings: Record<string, unknown>[] = [];
  $('script').each((_index, element) => {
    const script = $(element).html() || '';
    const type = ($(element).attr('type') || '').toLowerCase();

    if (type === 'application/ld+json' && script.length <= 600_000) {
      try {
        postings.push(...findJobPostingNodes(JSON.parse(script)));
      } catch {
        // Some sites emit invalid JSON-LD; embedded parsing below may still recover it.
      }
    }
    postings.push(...parseEmbeddedJobPostings(script));
  });

  return postings.map(candidateFromJobPosting);
}

function extractSemanticCandidate($: cheerio.CheerioAPI): ParsedJob {
  const read = (selector: string): string => normalizeText($(selector).first().attr('content') || $(selector).first().text());
  const title = firstString(
    read('[itemprop="title"]'),
    read('[data-automation="job-detail-title"]'),
    read('[data-testid="job-title"]'),
    read('h1'),
  );
  const company = firstString(
    read('[itemprop="hiringOrganization"] [itemprop="name"]'),
    read('[itemprop="hiringOrganization"]'),
    read('[data-automation="advertiser-name"]'),
    read('[data-testid="company-name"]'),
  );
  const location = firstString(
    read('[itemprop="jobLocation"]'),
    read('[data-automation="job-detail-location"]'),
    read('[data-testid="job-location"]'),
  );
  const employment = firstString(
    read('[itemprop="employmentType"]'),
    read('[data-automation="job-detail-work-type"]'),
    read('[data-testid="job-type"]'),
  );

  return {
    title,
    company,
    location,
    remoteType: inferRemoteType(`${location || ''} ${title || ''}`),
    jobType: inferJobType(employment),
  };
}

function extractMetaCandidate($: cheerio.CheerioAPI, url: string): ParsedJob {
  const host = hostFor(url);
  const rawTitle = normalizeText(
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text(),
  );
  const description = normalizeText(
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content'),
  );
  const siteName = normalizeText($('meta[property="og:site_name"]').attr('content'));
  const cleanTitle = rawTitle
    .replace(
      new RegExp(`\\s*[|\\-–•]\\s*(?:${PLATFORM_NAMES.join('|')})(?:\\..*)?$`, 'i'),
      '',
    )
    .trim();

  let title = cleanTitle;
  let company = !isPlatformHost(host) ? siteName : '';
  let location: string | null = null;

  const hiringMatch = cleanTitle.match(/^(.+?)\s+(?:is\s+)?hiring(?:\s+(?:a|an|for))?\s+(.+?)(?:\s+in\s+(.+))?$/i);
  const atMatch = cleanTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s+in\s+(.+))?$/i);
  if (hiringMatch) {
    company = hiringMatch[1]!.trim();
    title = hiringMatch[2]!.trim();
    location = hiringMatch[3]?.trim() || null;
  } else if (atMatch) {
    title = atMatch[1]!.trim();
    company = atMatch[2]!.trim();
    location = atMatch[3]?.trim() || null;
  } else if (!company) {
    const dashParts = cleanTitle.split(/\s+[-–|]\s+/);
    if (dashParts.length >= 2) {
      title = dashParts[0]!;
      company = dashParts[1]!;
    }
  }

  return {
    title: title || null,
    company: company && !isPlatformCompany(company, host) ? company : null,
    location,
    salaryRaw: extractSalaryFromText(description),
    remoteType: inferRemoteType(`${title} ${location || ''} ${description}`),
    jobType: inferJobType(description),
    experienceLevel: inferExperienceLevel(description),
    requiredSkills: extractSkillsHeuristically(description),
    description: description.slice(0, 1000) || null,
  };
}

function candidateFromBody(cleanText: string): ParsedJob {
  const remoteType = inferRemoteType(cleanText);
  const labeledLocation = cleanText.match(/\b(?:job\s+location|work\s+location|location)\s*[:：]\s*([^|•\n]{2,80})/i)?.[1];
  return {
    location: firstString(labeledLocation, remoteType === 'remote' ? 'Remote' : null),
    salaryRaw: extractSalaryFromText(cleanText),
    remoteType,
    jobType: inferJobType(cleanText),
    experienceLevel: inferExperienceLevel(cleanText),
    requiredSkills: extractSkillsHeuristically(cleanText),
  };
}

export function extractFromUrlSlug(url: string): ParsedJob {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const segments = decodeURIComponent(parsed.pathname).split('/').filter(Boolean);
    let company = '';
    let title = '';

    if (host.includes('greenhouse.io')) company = formatSlug(segments[0] || '');
    else if (host.includes('lever.co')) company = formatSlug(segments[0] || '');
    else if (host.includes('ashbyhq.com')) company = formatSlug(segments[0] || '');
    else if (host.includes('workable.com')) company = formatSlug(segments[0] || '');
    else if (host.includes('linkedin.com')) {
      const slug = [...segments].reverse().find((segment) => segment.includes('-at-'));
      if (slug) {
        const [titlePart, companyPart] = slug.split('-at-');
        title = formatSlug(titlePart || '');
        company = formatSlug((companyPart || '').replace(/-\d+$/, ''));
      }
    }

    if (!company && !isPlatformHost(host)) {
      const domain = host.split('.');
      const candidate = domain.at(-2) || '';
      if (!['jobs', 'careers', 'boards', 'apply', 'app', 'work'].includes(candidate)) {
        company = formatSlug(candidate);
      } else {
        company = formatSlug(domain.at(-3) || '');
      }
    }

    if (!title) {
      const ignored = new Set(['jobs', 'careers', 'view', 'listing', 'job', 'apply', 'p', 'j']);
      const candidates = segments.filter((segment) => {
        const lower = segment.toLowerCase();
        return !ignored.has(lower) &&
          !/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment) &&
          !/^\d+$/.test(segment) &&
          !/^[0-9a-f-]{8,}$/i.test(segment) &&
          /[-_]/.test(segment);
      });
      const slug = candidates.at(-1);
      if (slug) title = formatSlug(slug.replace(/-\d+$/, '').replace(/^job-/, ''));
    }

    return {
      company: company && !isPlatformCompany(company, host) ? company : null,
      title: title || null,
      location: inferRemoteType(title) === 'remote' ? 'Remote' : null,
      remoteType: inferRemoteType(title),
      jobType: inferJobType(title),
      requiredSkills: [],
    };
  } catch {
    return { requiredSkills: [] };
  }
}

function meaningful(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function mergeJobCandidates(candidates: ParsedJob[], url: string): ParsedJob {
  const host = hostFor(url);
  const merged: ParsedJob = { requiredSkills: [] };
  const scalarFields: Array<keyof Omit<ParsedJob, 'requiredSkills'>> = [
    'company',
    'title',
    'location',
    'salaryRaw',
    'remoteType',
    'jobType',
    'experienceLevel',
    'description',
  ];

  for (const candidate of candidates) {
    for (const field of scalarFields) {
      const value = candidate[field];
      if (!meaningful(merged[field]) && meaningful(value)) {
        (merged as Record<string, unknown>)[field] = value;
      }
    }
  }

  const company = normalizeText(merged.company);
  merged.company = company && !isPlatformCompany(company, host) ? company : null;
  merged.title = normalizeText(merged.title) || null;
  if (merged.remoteType === 'remote' && !meaningful(merged.location)) merged.location = 'Remote';
  merged.requiredSkills = [...new Set(candidates.flatMap((candidate) => candidate.requiredSkills || []))].slice(0, 20);
  return merged;
}

export function extractDeterministicJob(html: string, url: string): { job: ParsedJob; cleanText: string } {
  const $ = cheerio.load(html);
  const structured = extractStructuredCandidates($);
  const semantic = extractSemanticCandidate($);
  const meta = extractMetaCandidate($, url);

  $('script, style, nav, footer, header, iframe, noscript, svg, img').remove();
  const cleanText = stripHtml($('body').html() || '').slice(0, 20_000);
  const body = candidateFromBody(cleanText);
  const slug = extractFromUrlSlug(url);
  const job = mergeJobCandidates([...structured, semantic, meta, body, slug], url);
  return { job, cleanText };
}

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Natural-Language Quick Update Engine (Gemini-Powered)
// Fast, resilient intent resolution & weighted fuzzy job matching:
// 1. Stage 1: Deterministic regex/token fast path (<10ms)
// 2. Stage 2: Gemini 2.5 Flash-Lite structured JSON parser (~0.5–2s, 3s timeout)
// 3. Stage 3: Weighted fuzzy matcher against user's active jobs (Company > Title)
// 4. Decision Engine:
//    - Score >= 0.85 (unique) -> Direct update
//    - 0.50 <= Score < 0.85 or multiple candidates -> Disambiguation picker
//    - Score < 0.50 -> Offer to create new job
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Job,
  JobStatus,
  QuickUpdateParser,
  QuickUpdateProposedChanges,
  QuickUpdateResult,
} from '@landed/shared-types';
import { z } from 'zod';

export interface ParsedIntent {
  intent: 'update_status' | 'add_note' | 'create_job';
  company?: string | null;
  title?: string | null;
  reference?: string | null;
  status?: JobStatus | null;
  notes?: string | null;
  location?: string | null;
  salaryRaw?: string | null;
  parsedBy?: QuickUpdateParser;
}

const ParsedIntentSchema = z.object({
  intent: z.enum(['update_status', 'add_note', 'create_job']),
  company: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).nullable().optional(),
  reference: z.string().trim().min(1).nullable().optional(),
  status: z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).nullable().optional(),
  salaryRaw: z.string().trim().min(1).nullable().optional(),
}).refine((value) => Boolean(value.company || value.title || value.reference), {
  message: 'A company, role title, or application reference is required.',
});

// ── 1. Levenshtein & Token Similarity ─────────────────────────────────────────

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }

  return dp[m]![n]!;
}

export function computeStringSimilarity(a: string, b: string): number {
  const cleanA = cleanString(a);
  const cleanB = cleanString(b);

  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 1.0;

  // Substring match bonus
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const ratio = Math.min(cleanA.length, cleanB.length) / Math.max(cleanA.length, cleanB.length);
    return Math.max(0.85, ratio);
  }

  // Token Jaccard similarity
  const tokensA = new Set(cleanA.split(' ').filter(Boolean));
  const tokensB = new Set(cleanB.split(' ').filter(Boolean));

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Normalized Levenshtein similarity
  const maxLen = Math.max(cleanA.length, cleanB.length);
  const levScore = 1 - levenshteinDistance(cleanA, cleanB) / maxLen;

  return Math.max(jaccard, levScore);
}

function fieldSimilarity(query: string, field: string): number {
  const legalSuffixes = new Set(['inc', 'ltd', 'llc', 'corp', 'plc', 'limited', 'incorporated', 'company']);
  const meaningfulTokens = (value: string) =>
    cleanString(value)
      .split(' ')
      .filter((token) => token.length > 2 && !legalSuffixes.has(token));

  const direct = computeStringSimilarity(query, field);
  const queryTokens = meaningfulTokens(query);
  if (queryTokens.length !== 1) return direct;

  const alias = queryTokens[0]!;
  const tokenBest = meaningfulTokens(field).reduce(
    (best, token) => Math.max(best, computeStringSimilarity(alias, token)),
    0,
  );
  return Math.max(direct, tokenBest);
}

function cleanTitleString(title?: string | null): string | null {
  if (!title) return null;
  const cleaned = title.replace(/\s+(?:role|position|job)$/i, '').trim();
  return cleaned || null;
}

export function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0]?.replace(/[),.;!?]+$/g, '') || null;
}

const STATUS_RULES: Array<{ status: JobStatus; pattern: RegExp }> = [
  {
    status: 'rejected',
    pattern: /\b(?:reject(?:ed|ion|s)?|denied|declined|turned\s+down|said\s+no|ghosted|did\s*n(?:o|')?t\s+(?:get|make|move))\b/i,
  },
  {
    status: 'offer',
    pattern: /\b(?:got\s+(?:an?\s+)?)?offers?\b|\bmade\s+(?:me\s+)?an?\s+offer\b|\baccepted\s+(?:the\s+)?offer\b/i,
  },
  {
    status: 'interview',
    pattern: /\b(?:interviews?|interviewed|interviewing|screening|recruiter\s+call|tech(?:nical)?\s+round|onsite|next\s+round|invit(?:e|ed|es|ing)|got\s+accepted|accepted)\b/i,
  },
  {
    status: 'applied',
    pattern: /\b(?:appl(?:y|ied)|submitted|sent\s+(?:in\s+)?(?:an?\s+)?(?:application|resume))\b/i,
  },
  {
    status: 'saved',
    pattern: /\b(?:save[d]?|bookmark(?:ed)?|track(?:ing|ed)?)\b/i,
  },
];

export function inferStatusFromText(text: string): JobStatus | null {
  const haystack = text.replace(/https?:\/\/\S+/gi, ' ');
  for (const rule of STATUS_RULES) {
    if (rule.pattern.test(haystack)) return rule.status;
  }
  return null;
}

function leftoverReference(text: string): string | null {
  const leftover = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(
      /\b(?:reject(?:ed|ion|s)?|denied|declined|turned\s+down|said\s+no|ghosted|offers?|interviews?|interviewed|interviewing|screening|recruiter\s+call|tech(?:nical)?\s+round|onsite|next\s+round|invit(?:e|ed|es|ing)|accepted|accepts?|appl(?:y|ied|ication)|submitted|save[d]?|bookmark(?:ed)?|track(?:ing|ed)?|got|get|have|has|had|was|were|said|i|i'm|im|me|my|they|their|the|a|an|to|for|from|by|at|with|as|please|this|that|new|can|you|on|in|job|role|position|application|scheduled|received|made)\b/gi,
      ' ',
    )
    .replace(/[^\w\s.,&'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return leftover || null;
}

function intentFromStatus(
  status: JobStatus,
  target: { company?: string | null; title?: string | null; reference?: string | null },
): ParsedIntent {
  return {
    intent: 'update_status',
    company: target.company ?? null,
    title: cleanTitleString(target.title),
    reference: target.reference ? cleanTitleString(target.reference) : null,
    status,
  };
}

// ── 2. Stage 1: Deterministic Fast Parser (<10ms) ──────────────────────────────

export function parseIntentDeterministic(text: string): ParsedIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Pattern B first: Notes update (colon is unambiguous)
  const noteMatch = trimmed.match(
    /(?:(?:add\s+)?note\s+(?:for|on|about|to)|notes?\s*[:：])\s*(?:the\s+)?(.+?)\s*[:：]\s*(.+)$/i
  );
  if (noteMatch) {
    return {
      intent: 'add_note',
      company: noteMatch[1]!.trim(),
      notes: noteMatch[2]!.trim(),
    };
  }

  // Pattern C: Add / Create new role
  const addMatch = trimmed.match(
    /(?:save|add|track)\s+(?:new\s+)?(?:job|role|application)?\s*(?:at|for|by)?\s*(.+?)\s*[:：]\s*(.+)$/i
  );
  if (addMatch && !extractUrlFromText(trimmed)) {
    return {
      intent: 'create_job',
      company: addMatch[1]!.trim(),
      title: cleanTitleString(addMatch[2]),
      status: inferStatusFromText(trimmed) || 'saved',
    };
  }

  const withoutUrl = trimmed.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();

  // Pattern A: Status updates
  const transitionMatch = withoutUrl.match(
    /^(?:move\s+)?(.+?)\s+(?:(?:from\s+)?(?:saved|applied|interview|offer|rejected)\s+)?(?:to|as)\s+(saved|applied|interview|offer|rejected)$/i
  );
  if (transitionMatch && !extractUrlFromText(trimmed)) {
    return {
      intent: 'update_status',
      company: transitionMatch[1]!.trim(),
      status: transitionMatch[2]!.toLowerCase() as JobStatus,
    };
  }

  const invitationMatch = withoutUrl.match(
    /^(.+?)\s+invit(?:e|ed|es|ing)\s+(?:me\s+)?(?:to\s+(?:the\s+)?next\s+round|for\s+(?:an?\s+)?interview).*$/i
  );
  if (invitationMatch) {
    return intentFromStatus('interview', { company: invitationMatch[1]!.trim() });
  }

  const acceptedMatch = withoutUrl.match(
    /^(?:i\s+)?(?:got\s+)?accepted\s+(?:at|by|from|for)\s+(?:the\s+)?(.+)$/i
  );
  if (acceptedMatch) {
    return intentFromStatus('interview', { reference: acceptedMatch[1]!.trim() });
  }

  const saidNoMatch = withoutUrl.match(
    /^(?:they\s+)?said\s+no\s+(?:at|from|by|for)\s+(?:the\s+)?(.+)$/i
  );
  if (saidNoMatch) {
    return intentFromStatus('rejected', { reference: saidNoMatch[1]!.trim() });
  }

  // Grammar-tolerant stems: "got reject" should not depend on Gemini.
  const rejectedForTitleMatch = withoutUrl.match(
    /^(?:i\s+)?(?:got\s+)?(?:reject(?:ed|ion|s)?|declined|denied|turned\s+down)\s+for\s+(?:the\s+)?(.+?)(?:\s+(?:role|position|job))?$/i
  );
  if (rejectedForTitleMatch) {
    return intentFromStatus('rejected', { reference: rejectedForTitleMatch[1]!.trim() });
  }

  const rejectedMatch = withoutUrl.match(
    /(?:i\s+)?(?:got\s+)?(?:reject(?:ed|ion|s)?|declined|denied|turned\s+down|did\s+not\s+move\s+forward)\s+(?:from|by|at)\s+(?:the\s+)?(.+?)(?:\s+(?:for|as)\s+(.+))?$/i
  );
  if (rejectedMatch) {
    return intentFromStatus('rejected', {
      company: rejectedMatch[1]!.trim(),
      title: rejectedMatch[2],
    });
  }

  const interviewForTitleMatch = withoutUrl.match(
    /^(?:i\s+(?:have|got)\s+(?:an?\s+)?)?(?:interview(?:s|ed|ing)?|screening|recruiter\s+call|tech(?:nical)?\s+round|onsite)\s+(?:scheduled\s+)?for\s+(?:the\s+)?(.+)$/i
  );
  if (interviewForTitleMatch) {
    return intentFromStatus('interview', { reference: interviewForTitleMatch[1]!.trim() });
  }

  const interviewMatch = withoutUrl.match(
    /(?:interview(?:s|ed|ing)?|screening|recruiter\s+call|tech(?:nical)?\s+round|onsite)\s+(?:scheduled\s+)?(?:with|at)\s+(?:the\s+)?(.+?)(?:\s+(?:for|as)\s+(.+))?$/i
  );
  if (interviewMatch) {
    return intentFromStatus('interview', {
      company: interviewMatch[1]!.trim(),
      title: interviewMatch[2],
    });
  }

  const appliedForTitleMatch = withoutUrl.match(
    /^(?:i\s+)?(?:appl(?:y|ied)|submitted\s+(?:an?\s+)?application)\s+for\s+(?:the\s+)?(.+)$/i
  );
  if (appliedForTitleMatch) {
    return intentFromStatus('applied', { reference: appliedForTitleMatch[1]!.trim() });
  }

  const appliedMatch = withoutUrl.match(
    /(?:appl(?:y|ied)|submitted\s+(?:an?\s+)?application|sent\s+(?:an?\s+)?application)\s+(?:to|at)\s+(?:the\s+)?(.+?)(?:\s+(?:for|as)\s+(.+))?$/i
  );
  if (appliedMatch) {
    return intentFromStatus('applied', {
      company: appliedMatch[1]!.trim(),
      title: appliedMatch[2],
    });
  }

  const offerMatch = withoutUrl.match(
    /(?:got\s+(?:an?\s+)?)?offers?\s+(?:from|at|received\s+from)\s+(?:the\s+)?(.+?)(?:\s+(?:for|as)\s+(.+))?$/i
  );
  if (offerMatch) {
    return intentFromStatus('offer', {
      company: offerMatch[1]!.trim(),
      title: offerMatch[2],
    });
  }

  const status = inferStatusFromText(withoutUrl);
  const reference = leftoverReference(withoutUrl);
  if (status && reference && !extractUrlFromText(trimmed)) {
    return intentFromStatus(status, { reference });
  }

  return null;
}

// ── 3. Stage 2: Gemini Flash-Lite LLM Parser (~0.5–2s) ────────────────────────

export async function parseIntentWithGemini(text: string): Promise<ParsedIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || text.trim().length < 3) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are a precise job application tracker command parser.
Analyze the user's natural language update about their job search and extract structured intent.
Possible intents:
- "update_status": User is reporting a status change (applied, interview, offer, rejected, saved).
- "add_note": User wants to append a note or interview detail to a role.
- "create_job": User wants to add a new job to their tracker.

Valid status values: "saved", "applied", "interview", "offer", "rejected".
Respond ONLY with a JSON object matching this schema:
{
  "intent": "update_status" | "add_note" | "create_job",
  "company": "company name or null when only the role title is mentioned",
  "title": "string or null",
  "status": "saved" | "applied" | "interview" | "offer" | "rejected" | null,
  "notes": "string or null",
  "location": "string or null",
  "salaryRaw": "string or null"
}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `User phrase: "${text.trim()}"` }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      }),
      signal: AbortSignal.timeout(3000), // Strict 3s timeout
    });

    if (!response.ok) {
      console.warn(`[QuickUpdate] Gemini API returned status ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsedResult = ParsedIntentSchema.safeParse(JSON.parse(rawJson));
    if (!parsedResult.success) {
      console.warn('[QuickUpdate] Gemini returned an invalid intent payload.');
      return null;
    }
    const parsed = parsedResult.data;

    return {
      intent: parsed.intent || 'update_status',
      company: parsed.company ? parsed.company.trim() : null,
      title: parsed.title ? parsed.title.trim() : null,
      reference: parsed.reference ? parsed.reference.trim() : null,
      status: parsed.status || null,
      notes: parsed.notes ? parsed.notes.trim() : null,
      location: parsed.location ? parsed.location.trim() : null,
      salaryRaw: parsed.salaryRaw ? parsed.salaryRaw.trim() : null,
    };
  } catch (error) {
    console.warn('[QuickUpdate] Gemini call skipped or timed out:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ── 4. Unified Intent Parser (Stage 1 + Stage 2) ───────────────────────────────

export async function parseQuickUpdateText(text: string): Promise<ParsedIntent | null> {
  // Stage 1: Deterministic fast path (<10ms)
  const deterministic = parseIntentDeterministic(text);
  if (
    deterministic &&
    (deterministic.company || deterministic.title || deterministic.reference) &&
    (deterministic.status || deterministic.notes || deterministic.intent === 'create_job')
  ) {
    return { ...deterministic, parsedBy: 'regex' };
  }

  // Stage 2: Gemini Flash-Lite LLM fallback (~0.5–2s)
  const geminiResult = await parseIntentWithGemini(text);
  if (geminiResult && (geminiResult.company || geminiResult.title || geminiResult.reference)) {
    return { ...geminiResult, parsedBy: 'gemini' };
  }

  // Do not invent an employer from the last word of an unrecognized sentence.
  return null;
}

// ── 5. Weighted Fuzzy Matcher & Decision Engine ────────────────────────────────

export interface MatchScore {
  job: Job;
  score: number;
}

export function matchJobsWeighted(target: ParsedIntent, userJobs: Job[]): MatchScore[] {
  const targetCompany = target.company?.trim() || '';
  const targetTitle = target.title?.trim() || '';
  const targetReference = target.reference?.trim() || '';
  if ((!targetCompany && !targetTitle && !targetReference) || userJobs.length === 0) return [];

  const scored = userJobs.map((job) => {
    const companyScore = targetCompany ? fieldSimilarity(targetCompany, job.company) : 0;
    const titleScore = targetTitle ? fieldSimilarity(targetTitle, job.title) : 0;
    const referenceScore = targetReference
      ? Math.max(fieldSimilarity(targetReference, job.company), fieldSimilarity(targetReference, job.title))
      : 0;
    const totalScore = targetReference
      ? referenceScore
      : targetCompany && targetTitle
        ? 0.65 * companyScore + 0.35 * titleScore
        : targetCompany
          ? companyScore
          : titleScore;

    return { job, score: totalScore };
  });

  // Sort descending by score
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Process a natural-language quick update command against the user's jobs.
 */
export async function resolveQuickUpdate(
  text: string,
  userJobs: Job[]
): Promise<QuickUpdateResult> {
  const parsed = await parseQuickUpdateText(text);
  const parsedBy = parsed?.parsedBy;

  if (!parsed || (!parsed.company && !parsed.title && !parsed.reference)) {
    return {
      action: 'not_found',
      message: 'I could not understand that update. Mention a company or role, such as "Got rejected for Junior Android Developer".',
      parsedBy,
    };
  }

  if (parsed.intent === 'update_status' && !parsed.status) {
    return {
      action: 'not_found',
      message: 'I found the role reference, but not the status change. Try "Move OLVRC Inc to rejected".',
      parsedBy,
    };
  }

  const proposedChanges: QuickUpdateProposedChanges = {
    company: parsed.company || undefined,
    title: parsed.title || undefined,
    status: parsed.status || undefined,
    // Status descriptions inferred by Gemini are context, not explicit note requests.
    notes: parsed.intent === 'add_note' ? parsed.notes || undefined : undefined,
    location: parsed.location || undefined,
    salaryRaw: parsed.salaryRaw || undefined,
  };

  // If user explicitly asks to create a new job
  if (parsed.intent === 'create_job') {
    if (!parsed.company) {
      return {
        action: 'not_found',
        message: 'Please include the company name before creating a new application.',
        proposedChanges,
        parsedBy,
      };
    }
    return {
      action: 'created',
      message: `Ready to track new role at ${parsed.company}.`,
      proposedChanges: {
        ...proposedChanges,
        status: parsed.status || 'saved',
      },
      parsedBy,
    };
  }

  const matches = matchJobsWeighted(parsed, userJobs);
  const bestMatch = matches[0];
  const secondBest = matches[1];
  const targetLabel = parsed.company || parsed.title || parsed.reference || 'that role';

  // Case A: Unique enough match. 0.80 covers one-letter aliases like "olvro" → OLVRC.
  if (bestMatch && bestMatch.score >= 0.80) {
    const tiedWithAnother =
      Boolean(secondBest) &&
      secondBest!.score >= 0.80 &&
      bestMatch.score - secondBest!.score < 0.15;

    if (tiedWithAnother) {
      const candidates = matches.filter((m) => m.score >= 0.70).map((m) => m.job);
      return {
        action: 'disambiguate',
        message: `I found ${candidates.length} matches for "${targetLabel}". Which one should I update?`,
        candidates,
        proposedChanges,
        parsedBy,
      };
    }

    const ambiguousNearMatch =
      bestMatch.score < 0.85 &&
      Boolean(secondBest) &&
      bestMatch.score - secondBest!.score < 0.20;

    if (!ambiguousNearMatch) {
      if (
        parsed.status &&
        bestMatch.job.status === parsed.status &&
        !proposedChanges.notes
      ) {
        return {
          action: 'unchanged',
          message: `${bestMatch.job.title} at ${bestMatch.job.company} is already ${parsed.status}.`,
          job: bestMatch.job,
          parsedBy,
        };
      }

      const statusDesc = parsed.status ? `status to "${parsed.status}"` : 'notes';
      return {
        action: 'updated',
        message: `Updated ${bestMatch.job.title} at ${bestMatch.job.company} ${statusDesc}.`,
        job: bestMatch.job,
        proposedChanges,
        parsedBy,
      };
    }
  }

  // Case B: Moderate similarity / Multiple candidate matches (0.50 <= Score < 0.85)
  const candidates = matches.filter((m) => m.score >= 0.50).map((m) => m.job);
  if (candidates.length > 0) {
    return {
      action: 'disambiguate',
      message: `I found ${candidates.length} potential matches for "${targetLabel}". Which one should I update?`,
      candidates,
      proposedChanges,
      parsedBy,
    };
  }

  // Case C: No match found (< 0.50) -> Offer to create a new application
  return {
    action: 'not_found',
    message: `No tracked application matched "${targetLabel}".`,
    proposedChanges: {
      ...proposedChanges,
      title: parsed.title || 'Job Position',
      status: parsed.status || 'saved',
    },
    parsedBy,
  };
}

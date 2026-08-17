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

import type { Job, JobStatus, QuickUpdateResult, QuickUpdateProposedChanges } from '@landed/shared-types';

export interface ParsedIntent {
  intent: 'update_status' | 'add_note' | 'create_job';
  company: string;
  title?: string | null;
  status?: JobStatus | null;
  notes?: string | null;
  location?: string | null;
  salaryRaw?: string | null;
}

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

function cleanTitleString(title?: string | null): string | null {
  if (!title) return null;
  const cleaned = title.replace(/\s+(?:role|position|job)$/i, '').trim();
  return cleaned || null;
}

// ── 2. Stage 1: Deterministic Fast Parser (<10ms) ──────────────────────────────

export function parseIntentDeterministic(text: string): ParsedIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Pattern A: Status updates
  // "Got rejected from Cloudstaff for Frontend Developer role"
  // "Rejected by Stripe"
  const rejectedMatch = trimmed.match(
    /(?:got\s+)?(?:rejected|declined|turned\s+down|did\s+not\s+move\s+forward)\s+(?:from|by|at)\s+(?:the\s+)?([A-Za-z0-9\s._&-]+?)(?:\s+(?:for|as)\s+([A-Za-z0-9\s._&-]+))?$/i
  );
  if (rejectedMatch) {
    return {
      intent: 'update_status',
      company: rejectedMatch[1]!.trim(),
      title: cleanTitleString(rejectedMatch[2]),
      status: 'rejected',
    };
  }

  // "Interview scheduled with Discernis for Frontend Engineer"
  // "Interview at Vercel"
  // "Recruiter screening with Anthropic"
  const interviewMatch = trimmed.match(
    /(?:interview|screening|recruiter\s+call|tech(?:nical)?\s+round|onsite)\s+(?:scheduled\s+)?(?:with|at|for)\s+(?:the\s+)?([A-Za-z0-9\s._&-]+?)(?:\s+(?:for|as)\s+([A-Za-z0-9\s._&-]+))?$/i
  );
  if (interviewMatch) {
    return {
      intent: 'update_status',
      company: interviewMatch[1]!.trim(),
      title: cleanTitleString(interviewMatch[2]),
      status: 'interview',
    };
  }

  // "Applied to Netflix for Senior Engineer"
  // "Sent application to Google"
  const appliedMatch = trimmed.match(
    /(?:applied|submitted\s+application|sent\s+application)\s+(?:to|at|for)\s+(?:the\s+)?([A-Za-z0-9\s._&-]+?)(?:\s+(?:for|as)\s+([A-Za-z0-9\s._&-]+))?$/i
  );
  if (appliedMatch) {
    return {
      intent: 'update_status',
      company: appliedMatch[1]!.trim(),
      title: cleanTitleString(appliedMatch[2]),
      status: 'applied',
    };
  }

  // "Got offer from Figma"
  // "Offer received at Stripe"
  const offerMatch = trimmed.match(
    /(?:got\s+(?:an\s+)?)?offer\s+(?:from|at|received\s+from)\s+(?:the\s+)?([A-Za-z0-9\s._&-]+?)(?:\s+(?:for|as)\s+([A-Za-z0-9\s._&-]+))?$/i
  );
  if (offerMatch) {
    return {
      intent: 'update_status',
      company: offerMatch[1]!.trim(),
      title: cleanTitleString(offerMatch[2]),
      status: 'offer',
    };
  }

  // Pattern B: Notes update
  // "Add note for Stripe: Follow up with recruiter on Friday"
  // "Note for Anthropic: Technical round went well"
  const noteMatch = trimmed.match(
    /(?:(?:add\s+)?note\s+(?:for|on|about|to)|notes?\s*[:：])\s*(?:the\s+)?([A-Za-z0-9\s._&-]+?)\s*[:：]\s*(.+)$/i
  );
  if (noteMatch) {
    return {
      intent: 'add_note',
      company: noteMatch[1]!.trim(),
      notes: noteMatch[2]!.trim(),
    };
  }

  // Pattern C: Add / Create new role
  // "Add new job at Vercel: Staff Engineer in Remote"
  // "Save role at OpenAI: Research Scientist"
  const addMatch = trimmed.match(
    /(?:save|add|track)\s+(?:new\s+)?(?:job|role|application)?\s*(?:at|for|by)?\s*([A-Za-z0-9\s._&-]+?)\s*[:：]\s*([A-Za-z0-9\s._&-]+)/i
  );
  if (addMatch) {
    return {
      intent: 'create_job',
      company: addMatch[1]!.trim(),
      title: cleanTitleString(addMatch[2]),
      status: 'saved',
    };
  }

  return null;
}

// ── 3. Stage 2: Gemini 2.5 Flash-Lite LLM Parser (~0.5–2s) ────────────────────

export async function parseIntentWithGemini(text: string): Promise<ParsedIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || text.trim().length < 3) return null;

  // Use Gemini 2.5 Flash-Lite (or Gemini 1.5/2.0 Flash) with structured JSON response
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
  "company": "string (company name)",
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

    const parsed = JSON.parse(rawJson) as ParsedIntent;
    if (!parsed.company) return null;

    return {
      intent: parsed.intent || 'update_status',
      company: parsed.company.trim(),
      title: parsed.title ? parsed.title.trim() : null,
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
  if (deterministic && deterministic.company && (deterministic.status || deterministic.notes || deterministic.title)) {
    return deterministic;
  }

  // Stage 2: Gemini 2.5 Flash-Lite LLM fallback (~0.5–2s)
  const geminiResult = await parseIntentWithGemini(text);
  if (geminiResult && geminiResult.company) {
    return geminiResult;
  }

  // Fallback: If no structured status was detected, extract simple words
  if (!deterministic) {
    const words = text.trim().split(/\s+/);
    if (words.length > 0) {
      return {
        intent: 'update_status',
        company: words[words.length - 1] || text.trim(),
        title: null,
        status: null,
      };
    }
  }

  return deterministic;
}

// ── 5. Weighted Fuzzy Matcher & Decision Engine ────────────────────────────────

export interface MatchScore {
  job: Job;
  score: number;
}

export function matchJobsWeighted(target: ParsedIntent, userJobs: Job[]): MatchScore[] {
  if (!target.company || userJobs.length === 0) return [];

  const targetCompany = target.company;
  const targetTitle = target.title || '';

  const scored = userJobs.map((job) => {
    const companyScore = computeStringSimilarity(targetCompany, job.company);

    let titleScore = 0;
    if (targetTitle && job.title) {
      titleScore = computeStringSimilarity(targetTitle, job.title);
    } else {
      // If user did not mention a title (e.g. "Got rejected from Stripe"), neutral title match
      titleScore = 1.0;
    }

    // Weighted match: Company carries 65% weight, Title carries 35% weight
    const totalScore = 0.65 * companyScore + 0.35 * titleScore;

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

  if (!parsed || !parsed.company) {
    return {
      action: 'not_found',
      message: 'Could not understand the update. Please include a company name (e.g., "Got rejected from Stripe").',
    };
  }

  const proposedChanges: QuickUpdateProposedChanges = {
    company: parsed.company,
    title: parsed.title || undefined,
    status: parsed.status || undefined,
    notes: parsed.notes || undefined,
    location: parsed.location || undefined,
    salaryRaw: parsed.salaryRaw || undefined,
  };

  // If user explicitly asks to create a new job
  if (parsed.intent === 'create_job') {
    return {
      action: 'created',
      message: `Ready to track new role at ${parsed.company}.`,
      proposedChanges: {
        ...proposedChanges,
        status: parsed.status || 'saved',
      },
    };
  }

  const matches = matchJobsWeighted(parsed, userJobs);
  const bestMatch = matches[0];
  const secondBest = matches[1];

  // Case A: High-confidence unique match (Score >= 0.85)
  if (bestMatch && bestMatch.score >= 0.85) {
    // If there is a tie or close second candidate (e.g., 2 roles at Google both with company match)
    if (secondBest && secondBest.score >= 0.80) {
      const candidates = matches.filter((m) => m.score >= 0.70).map((m) => m.job);
      return {
        action: 'disambiguate',
        message: `We found ${candidates.length} matching roles at ${parsed.company}. Which one would you like to update?`,
        candidates,
        proposedChanges,
      };
    }

    const statusDesc = parsed.status ? `status to "${parsed.status}"` : 'notes';
    return {
      action: 'updated',
      message: `Updated ${bestMatch.job.title} at ${bestMatch.job.company} ${statusDesc}.`,
      job: bestMatch.job,
      proposedChanges,
    };
  }

  // Case B: Moderate similarity / Multiple candidate matches (0.50 <= Score < 0.85)
  const candidates = matches.filter((m) => m.score >= 0.50).map((m) => m.job);
  if (candidates.length > 0) {
    return {
      action: 'disambiguate',
      message: `Found ${candidates.length} potential matches for "${parsed.company}". Please select the intended role:`,
      candidates,
      proposedChanges,
    };
  }

  // Case C: No match found (< 0.50) -> Offer to create a new application
  return {
    action: 'not_found',
    message: `No tracked application found for "${parsed.company}". Would you like to create a new entry?`,
    proposedChanges: {
      ...proposedChanges,
      title: parsed.title || 'Job Position',
      status: parsed.status || 'saved',
    },
  };
}

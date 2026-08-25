// ─────────────────────────────────────────────────────────────────────────────
// Landed — LLM Client (Grok 4.1 via xAI API)
// OpenAI-compatible API — uses fetch directly, no SDK dependency needed.
//
// Trade-off: xAI's Grok 4.1 chosen over Claude Haiku based on cost/quality
// comparison documented in PRD.md Section 7.1. The API is OpenAI-compatible,
// so we can swap models by changing the base URL and model name.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_API_KEY = process.env.XAI_API_KEY;
const MODEL = 'grok-4-1'; // xAI Grok 4.1

if (!XAI_API_KEY) {
  console.warn('[LLM] XAI_API_KEY not set — extraction will fail at runtime');
}

// ── Extraction schema ────────────────────────────────────────────────────────
// This is the structured output schema we enforce on Grok.
// The worker validates the response against this before writing to the DB.

export const ExtractionResultSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  salaryRaw: z.string().nullable().optional(),
  remoteType: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
  jobType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ── Resume parsing schema ────────────────────────────────────────────────────

export const ResumeParseResultSchema = z.object({
  skills: z.array(z.string()),
  roles: z.array(z.string()),
  yearsOfExperience: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type ResumeParseResult = z.infer<typeof ResumeParseResultSchema>;

// ── Call LLM ─────────────────────────────────────────────────────────────────

interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}

async function callLLM({ systemPrompt, userMessage, maxTokens = 2000 }: LLMCallOptions): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.1, // Low temp for deterministic extraction
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

// ── Extract job details from HTML ────────────────────────────────────────────

export async function extractJobFromHTML(cleanText: string): Promise<ExtractionResult> {
  const systemPrompt = `You are a precise job posting data extractor. Extract structured data from the provided job posting text.

Return a JSON object with these fields:
- company: string (the company name)
- title: string (the job title)
- location: string | null (city/state/country, e.g. "San Francisco, CA")
- salaryRaw: string | null (salary range as written, e.g. "$120k–$180k" or "€50,000–€70,000")
- remoteType: "remote" | "hybrid" | "onsite" | null
- jobType: "full-time" | "part-time" | "contract" | "freelance" | "internship" | null
- experienceLevel: string | null (e.g. "Senior", "Mid-Senior", "Entry Level", "Lead")
- requiredSkills: string[] (explicit must-have skills, technologies, or qualifications)
- preferredSkills: string[] (skills described as preferred, optional, a bonus, or nice-to-have)
- description: string | null (a concise 2-3 sentence summary of the role — NOT the full posting)

Rules:
- Extract exactly what's stated — do not infer or make up missing fields.
- If a field is not mentioned in the posting, set it to null.
- Extract specific technical skills and tools, not generic soft skills.
- Never put preferred, optional, bonus, or nice-to-have skills in requiredSkills.
- Keep the description to a brief summary, not the entire posting text.`;

  const response = await callLLM({
    systemPrompt,
    userMessage: cleanText,
    maxTokens: 1500,
  });

  const parsed = JSON.parse(response);
  return ExtractionResultSchema.parse(parsed);
}

// ── Parse resume text ────────────────────────────────────────────────────────

export async function parseResumeText(resumeText: string): Promise<ResumeParseResult> {
  const systemPrompt = `You are a resume parser. Extract structured data from the provided resume text.

Return a JSON object with these fields:
- skills: string[] (list of specific technical skills, tools, frameworks, and languages)
- roles: string[] (list of job titles/roles the person has held)
- yearsOfExperience: number | null (estimated total years of professional experience)
- summary: string | null (a one-sentence professional summary)

Rules:
- Extract specific, concrete skills — not vague descriptions.
- For roles, list the actual job titles as written.
- Estimate years of experience from the dates if available.`;

  const response = await callLLM({
    systemPrompt,
    userMessage: resumeText,
    maxTokens: 1500,
  });

  const parsed = JSON.parse(response);
  return ResumeParseResultSchema.parse(parsed);
}

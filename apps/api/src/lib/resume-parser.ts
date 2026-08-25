// ─────────────────────────────────────────────────────────────────────────────
// Landed — Resume Text & Structured Skill Extractor
// Ingests PDF, DOCX, or raw text and extracts structured candidate data
// (skills, roles, years of experience, and career summary).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import * as pdfModule from 'pdf-parse';
import mammoth from 'mammoth';
import {
  SKILL_ALIASES,
  normalizeSkill,
} from '@landed/shared-types';

export { normalizeSkill } from '@landed/shared-types';

export const ParsedResumeSchema = z.object({
  skills: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  yearsOfExperience: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

// ── Common Target Roles ──────────────────────────────────────────────────────

const COMMON_ROLES = [
  'Senior Frontend Engineer',
  'Frontend Engineer',
  'Frontend Developer',
  'Senior Backend Engineer',
  'Backend Engineer',
  'Backend Developer',
  'Senior Full Stack Engineer',
  'Full Stack Engineer',
  'Full Stack Developer',
  'Software Engineer',
  'Senior Software Engineer',
  'Lead Software Engineer',
  'Staff Software Engineer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Platform Engineer',
  'Site Reliability Engineer',
  'Mobile Developer',
  'iOS Developer',
  'Android Developer',
  'React Native Developer',
  'Data Engineer',
  'Machine Learning Engineer',
  'AI Engineer',
  'Product Designer',
  'UI/UX Designer',
  'Engineering Manager',
  'QA Engineer',
  'Solutions Architect',
];

/**
 * Extracts raw textual content from uploaded file buffers (PDF, DOCX, TXT).
 */
export async function extractTextFromFileBuffer(
  buffer: Buffer,
  mimetype?: string,
  filename?: string
): Promise<string> {
  const name = (filename || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  // 1. PDF extraction
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    try {
      const anyPdf = pdfModule as any;
      // Support pdf-parse v2 (PDFParse class)
      if (anyPdf.PDFParse) {
        const parser = new anyPdf.PDFParse({ data: buffer });
        const result = await parser.getText();
        if (result && typeof result.text === 'string' && result.text.trim().length > 0) {
          return result.text;
        }
      }

      // Support pdf-parse v1 (default function export)
      const parseFn = anyPdf.default || anyPdf;
      if (typeof parseFn === 'function') {
        const data = await parseFn(buffer);
        if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
          return data.text;
        }
      }
    } catch (pdfErr) {
      console.warn('[ResumeParser] PDF parsing library error, attempting stream extraction fallback:', pdfErr);
    }

    // Fallback: extract plain text characters from stream
    const raw = buffer.toString('binary');
    const matches = [...raw.matchAll(/\(([^()]{2,})\)[\s]*Tj/g)];
    if (matches.length > 0) {
      return matches.map((m) => m[1]).join(' ');
    }

    return buffer.toString('utf-8');
  }

  // 2. DOCX extraction
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // 3. Plain text / Markdown
  return buffer.toString('utf-8');
}

/**
 * Deterministically parses resume text to extract skills, roles, experience, and summary.
 */
export function parseResumeDeterministically(text: string): ParsedResume {
  const lowerText = text.toLowerCase();
  const detectedSkills = new Set<string>();

  // 1. Scan for all dictionary skills
  for (const [key, canonical] of Object.entries(SKILL_ALIASES)) {
    // Word boundary check
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+.-])${escaped}(?:$|[^a-zA-Z0-9#+.-])`, 'i');
    if (regex.test(lowerText)) {
      detectedSkills.add(canonical);
    }
  }

  // 2. Detect candidate roles
  const detectedRoles = new Set<string>();
  for (const role of COMMON_ROLES) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      detectedRoles.add(role);
    }
  }

  // 3. Estimate years of experience
  let yearsOfExperience: number | null = null;
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i);
  if (yearsMatch && yearsMatch[1]) {
    const num = parseInt(yearsMatch[1], 10);
    if (!Number.isNaN(num) && num > 0 && num < 50) {
      yearsOfExperience = num;
    }
  }

  // Fallback: estimate from date ranges (e.g. 2018 - 2024 or 2019 - Present)
  if (yearsOfExperience === null) {
    const yearMatches = [...text.matchAll(/\b(19\d\d|20\d\d)\s*[-–—]\s*(Present|Current|\b19\d\d|\b20\d\d)\b/gi)];
    if (yearMatches.length > 0) {
      const currentYear = new Date().getFullYear();
      let earliestYear = currentYear;

      for (const m of yearMatches) {
        if (!m[1]) continue;
        const start = parseInt(m[1], 10);
        if (start >= 1990 && start <= currentYear && start < earliestYear) {
          earliestYear = start;
        }
      }

      if (earliestYear < currentYear) {
        yearsOfExperience = Math.min(Math.max(currentYear - earliestYear, 1), 35);
      }
    }
  }

  // 4. Generate candidate career summary snippet
  let summary: string | null = null;
  const summaryHeaderMatch = text.match(/(?:summary|professional summary|about me|profile)[\s:\n\r]+([^\n\r]+(?:\n[^\n\r]+){1,3})/i);
  if (summaryHeaderMatch && summaryHeaderMatch[1]) {
    summary = summaryHeaderMatch[1].trim().replace(/\s+/g, ' ').slice(0, 300);
  } else {
    // First non-empty lines snippet
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 20 && !l.includes('@') && !l.includes('http'));
    if (lines[0]) {
      summary = lines[0].slice(0, 250);
    }
  }

  return {
    skills: Array.from(detectedSkills),
    roles: Array.from(detectedRoles).slice(0, 3),
    // Unknown experience is intentionally preserved instead of fabricating a
    // value from skill count. The scorer renormalizes around unknown evidence.
    yearsOfExperience,
    summary: summary || (detectedSkills.size > 0 ? `Experienced professional skilled in ${Array.from(detectedSkills).slice(0, 4).join(', ')}.` : null),
  };
}

/**
 * Main resume parsing pipeline. Uses deterministic extractor with optional LLM augmentation.
 */
export async function parseResume(text: string): Promise<ParsedResume> {
  const cleaned = text.trim();
  if (cleaned.length < 20) {
    throw new Error('Resume text is too short to extract candidate information.');
  }

  // Deterministic baseline extraction
  const parsed = parseResumeDeterministically(cleaned);

  // Optional: Grok/Gemini augmentation if API key is present
  const apiKey = process.env.XAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || process.env.NODE_ENV === 'test') {
    return parsed;
  }

  try {
    if (process.env.XAI_API_KEY) {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-4-1',
          messages: [
            {
              role: 'system',
              content:
                'You are a resume parsing assistant. Extract candidate skills as canonical names, target roles, years of experience, and summary in JSON format: {"skills": string[], "roles": string[], "yearsOfExperience": number, "summary": string}',
            },
            { role: 'user', content: cleaned.slice(0, 6000) },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const llmParsed = JSON.parse(content) as ParsedResume;
          const mergedSkills = [...new Set([...parsed.skills, ...(llmParsed.skills || []).map(normalizeSkill)])];
          const mergedRoles = [...new Set([...parsed.roles, ...(llmParsed.roles || [])])];
          return {
            skills: mergedSkills,
            roles: mergedRoles.length > 0 ? mergedRoles : parsed.roles,
            yearsOfExperience: llmParsed.yearsOfExperience ?? parsed.yearsOfExperience,
            summary: llmParsed.summary || parsed.summary,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[ResumeParser] LLM call failed, using deterministic parse:', err);
  }

  return parsed;
}

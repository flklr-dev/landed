// ─────────────────────────────────────────────────────────────────────────────
// Landed — On-Demand AI Match Explanation Engine
// Generates personalized interview talking points, candidate strengths,
// and skill gap advice for a specific tracked job application.
//
// Provider priority: Gemini Flash → xAI Grok → Deterministic Fallback
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@landed/db';

export interface ExplanationInput {
  candidate: {
    skills: string[];
    roles: string[];
    yearsOfExperience?: number | null;
    summary?: string | null;
  };
  job: {
    company: string;
    title: string;
    requiredSkills: string[];
    description?: string | null;
  };
  match: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
}

// ── Deterministic Fallback Engine ─────────────────────────────────────────────
// Produces varied, context-aware output based on match data and job description.

/**
 * Extracts domain keywords from a job description for contextual advice.
 */
function extractDomainKeywords(description: string | null | undefined): string[] {
  if (!description) return [];
  const lower = description.toLowerCase();

  const domainPatterns: Record<string, string[]> = {
    'mobile development': ['android', 'ios', 'mobile', 'flutter', 'react native', 'swift', 'kotlin'],
    'cloud infrastructure': ['aws', 'gcp', 'azure', 'cloud', 'infrastructure', 'devops', 'terraform'],
    'frontend engineering': ['frontend', 'front-end', 'ui', 'ux', 'css', 'browser', 'responsive'],
    'backend systems': ['backend', 'back-end', 'api', 'microservices', 'server', 'database'],
    'data engineering': ['data pipeline', 'etl', 'data warehouse', 'spark', 'airflow', 'analytics'],
    'machine learning': ['ml', 'machine learning', 'deep learning', 'model', 'training', 'inference'],
    'security engineering': ['security', 'vulnerability', 'penetration', 'compliance', 'soc'],
    'full-stack development': ['full-stack', 'full stack', 'fullstack'],
  };

  const detected: string[] = [];
  for (const [domain, keywords] of Object.entries(domainPatterns)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(domain);
    }
  }

  return detected.slice(0, 2);
}

/**
 * Extracts culture/team signals from a job description.
 */
function extractCultureSignals(description: string | null | undefined): string | null {
  if (!description) return null;
  const lower = description.toLowerCase();

  if (lower.includes('startup') || lower.includes('fast-paced') || lower.includes('early-stage')) {
    return 'a fast-paced startup environment';
  }
  if (lower.includes('enterprise') || lower.includes('large-scale') || lower.includes('fortune')) {
    return 'enterprise-scale operations';
  }
  if (lower.includes('open source') || lower.includes('community')) {
    return 'open-source and community-driven development';
  }
  if (lower.includes('agile') || lower.includes('scrum') || lower.includes('sprint')) {
    return 'agile development practices';
  }
  if (lower.includes('remote') || lower.includes('distributed')) {
    return 'distributed remote collaboration';
  }
  return null;
}

/**
 * Deterministically constructs varied, context-aware match feedback.
 * Uses job description, domain signals, and match data to avoid templated output.
 */
export function generateDeterministicExplanation(input: ExplanationInput): string {
  const { candidate, job, match } = input;
  const sections: string[] = [];
  const domains = extractDomainKeywords(job.description);
  const culture = extractCultureSignals(job.description);
  const domainContext = domains.length > 0 ? domains.join(' and ') : 'software engineering';

  // ── 1. Key Strengths ─────────────────────────────────────────────────────
  const cultureNote = culture ? ` Your experience maps well to ${culture}.` : '';

  if (match.matchedSkills.length >= 4) {
    const topSkills = match.matchedSkills.slice(0, 4).join(', ');
    const remaining = match.matchedSkills.length - 4;
    sections.push(
      `**Key Strengths:** You cover ${match.matchedSkills.length} of the core requirements — ${topSkills}${remaining > 0 ? ` and ${remaining} more` : ''} — putting you in strong technical alignment for the ${job.title} role at ${job.company} (${match.score}% fit).${cultureNote}`
    );
  } else if (match.matchedSkills.length >= 2) {
    const skills = match.matchedSkills.join(' and ');
    sections.push(
      `**Key Strengths:** Your proficiency in ${skills} gives you a solid foundation for this ${domainContext} position at ${job.company}. The ${job.title} role values these competencies directly (${match.score}% fit).${cultureNote}`
    );
  } else if (match.matchedSkills.length === 1) {
    sections.push(
      `**Key Strengths:** Your experience with ${match.matchedSkills[0]} provides a relevant entry point for the ${job.title} ${domainContext} position at ${job.company}. Build your interview narrative around projects where ${match.matchedSkills[0]} was central to delivery (${match.score}% fit).${cultureNote}`
    );
  } else {
    const candidateStrengths = candidate.skills.slice(0, 3).join(', ') || 'your technical background';
    sections.push(
      `**Key Strengths:** While the ${job.title} role at ${job.company} targets a different primary stack, ${candidateStrengths} demonstrates transferable engineering fundamentals in ${domainContext} that are valuable during interviews (${match.score}% fit).${cultureNote}`
    );
  }

  // ── 2. Skill Gaps & Strategy ──────────────────────────────────────────────
  if (match.missingSkills.length >= 3) {
    const priorityGaps = match.missingSkills.slice(0, 2).join(' and ');
    const remaining = match.missingSkills.slice(2).join(', ');
    sections.push(
      `**Skill Gaps & Strategy:** The posting emphasizes ${priorityGaps} as primary requirements, with ${remaining} also mentioned. Focus your preparation on demonstrating adjacent experience — if you've worked with similar tools in the ${domainContext} space, frame that as rapid onboarding capability rather than a gap.`
    );
  } else if (match.missingSkills.length > 0) {
    const gaps = match.missingSkills.join(' and ');
    sections.push(
      `**Skill Gaps & Strategy:** The role requires ${gaps}, which isn't currently on your resume. In the interview, proactively address this by discussing how you've picked up analogous technologies in past roles and outline a concrete 30-day learning plan for ${match.missingSkills[0]}.`
    );
  } else {
    sections.push(
      `**Skill Gaps & Strategy:** You cover all primary skills listed in the ${job.title} posting. Use this advantage to shift the interview conversation toward system design decisions, team collaboration, and impact — areas where technical fit alone doesn't differentiate candidates.`
    );
  }

  // ── 3. Recommended Talking Point ──────────────────────────────────────────
  const primaryRole = candidate.roles[0] || 'engineering';
  const years = candidate.yearsOfExperience;

  if (years && years >= 5) {
    const topMatchedSkill = match.matchedSkills[0] || candidate.skills[0] || 'your core stack';
    sections.push(
      `**Recommended Talking Point:** Lead with your ${years}+ years of ${primaryRole} experience. Prepare a specific story about a ${topMatchedSkill} project where you drove architecture decisions or mentored junior engineers — ${job.company} interviewers at this level prioritize impact narratives over syntax fluency.`
    );
  } else if (years && years >= 2) {
    const projectSkill = match.matchedSkills.slice(0, 2).join(' and ') || 'your strongest tools';
    sections.push(
      `**Recommended Talking Point:** Prepare 2-3 concrete project examples using ${projectSkill} that demonstrate ownership and delivery. For a ${job.title} role at ${job.company}, quantify outcomes where possible (performance improvements, user impact, lines of code shipped).`
    );
  } else {
    const learnableSkill = match.matchedSkills[0] || candidate.skills[0] || 'relevant technologies';
    sections.push(
      `**Recommended Talking Point:** Emphasize your hands-on projects and self-driven learning trajectory with ${learnableSkill}. For the ${job.title} role, show genuine curiosity about ${job.company}'s product and come prepared with thoughtful questions about their ${domainContext} challenges.`
    );
  }

  return sections.join('\n\n');
}

// ── Gemini Flash LLM Provider ─────────────────────────────────────────────────

async function generateWithGemini(input: ExplanationInput, apiKey: string): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Include first 500 chars of job description for context
  const descriptionExcerpt = input.job.description
    ? input.job.description.substring(0, 500).trim()
    : 'No description available.';

  const systemInstruction = `You are an elite career coach specializing in tech interview preparation.
Generate a concise, highly personalized 3-section interview strategy for a specific job application.

CRITICAL RULES:
- Each section MUST be unique to this specific company and role — never use generic filler.
- Reference specific technologies, the company's domain, and the candidate's exact skill profile.
- Write in second person ("you", "your").
- Keep each section to 2-3 sentences max.
- Use markdown bold headers exactly as shown below.

Output format (3 sections separated by blank lines):
**Key Strengths:** (Why this candidate is a strong fit for THIS specific role. Reference matched skills by name.)
**Skill Gaps & Strategy:** (How to address missing skills in the interview. Give specific, actionable advice for THIS posting.)
**Recommended Talking Point:** (One high-impact interview talking point tailored to the company and role level.)`;

  const userPrompt = `Candidate Profile:
- Skills: ${input.candidate.skills.join(', ')}
- Past Roles: ${input.candidate.roles.join(', ') || 'Not specified'}
- Experience: ${input.candidate.yearsOfExperience || 'Unknown'} years

Target Position:
- Company: ${input.job.company}
- Role: ${input.job.title}
- Required Skills: ${input.job.requiredSkills.join(', ') || 'Not specified'}
- Job Description Excerpt: ${descriptionExcerpt}

Match Analysis:
- Fit Score: ${input.match.score}%
- Matched Skills: ${input.match.matchedSkills.join(', ') || 'None'}
- Missing Skills: ${input.match.missingSkills.join(', ') || 'None'}

Generate the personalized 3-section interview strategy now.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[MatchExplainer] Gemini API returned status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (content && content.length > 80) {
      return content;
    }
  } catch (err) {
    console.warn('[MatchExplainer] Gemini call failed:', err);
  }

  return null;
}

// ── xAI Grok LLM Provider (Legacy) ───────────────────────────────────────────

async function generateWithXai(input: ExplanationInput, apiKey: string): Promise<string | null> {
  const descriptionExcerpt = input.job.description
    ? input.job.description.substring(0, 500).trim()
    : '';

  const prompt = `You are an elite career coach. Provide a concise, personalized 3-paragraph match breakdown for a candidate applying to ${input.job.company} as a ${input.job.title}.
Candidate skills: ${input.candidate.skills.join(', ')} (${input.candidate.yearsOfExperience || 3} yrs exp).
Matched skills: ${input.match.matchedSkills.join(', ')}.
Missing skills: ${input.match.missingSkills.join(', ')}.
Overall fit score: ${input.match.score}%.
${descriptionExcerpt ? `Job description excerpt: ${descriptionExcerpt}` : ''}
Format using markdown bold headers:
**Key Strengths:** (1-2 sentences)
**Skill Gaps & Strategy:** (1-2 sentences on how to address missing skills in the interview)
**Recommended Talking Point:** (1 sentence interview hook)`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (content && content.trim().length > 50) {
        return content.trim();
      }
    }
  } catch (err) {
    console.warn('[MatchExplainer] xAI call failed:', err);
  }

  return null;
}

// ── Main Generator: Gemini → xAI → Deterministic ─────────────────────────────

/**
 * Generates an explanation for a match.
 * Provider priority: Gemini Flash → xAI Grok → Deterministic Fallback.
 */
export async function generateMatchExplanation(input: ExplanationInput): Promise<string> {
  // Skip LLM calls in test environment
  if (process.env.NODE_ENV === 'test') {
    return generateDeterministicExplanation(input);
  }

  // 1. Try Gemini Flash (primary)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const result = await generateWithGemini(input, geminiKey);
    if (result) return result;
  }

  // 2. Try xAI Grok (secondary)
  const xaiKey = process.env.XAI_API_KEY;
  if (xaiKey) {
    const result = await generateWithXai(input, xaiKey);
    if (result) return result;
  }

  // 3. Deterministic fallback
  return generateDeterministicExplanation(input);
}

// ── Public API: Explain a Specific Job Match ──────────────────────────────────

/**
 * Explains a specific job match for a user and caches the result in PostgreSQL.
 * Set force=true to bypass cache and regenerate (e.g. when upgrading from deterministic to LLM).
 */
export async function explainJobMatch(
  userId: string,
  jobId: string,
  force = false
): Promise<{ explanation: string; cached: boolean }> {
  // 1. Fetch match score with job and user's active resume
  const [match, resume] = await Promise.all([
    prisma.matchScore.findUnique({
      where: { userId_jobId: { userId, jobId } },
      include: { job: true },
    }),
    prisma.resume.findFirst({
      where: { userId, extractionStatus: 'done' },
      orderBy: { uploadedAt: 'desc' },
    }),
  ]);

  if (!match) {
    throw new Error('No match score found for this job. Ensure your resume is uploaded.');
  }

  // 2. Return cached explanation if already generated (unless forced)
  if (!force && match.explanation && match.explanation.trim().length > 0) {
    return { explanation: match.explanation, cached: true };
  }

  // 3. Generate fresh explanation
  const explanation = await generateMatchExplanation({
    candidate: {
      skills: resume?.parsedSkills || match.matchedSkills,
      roles: resume?.parsedRoles || [],
      yearsOfExperience: resume?.yearsOfExperience,
    },
    job: {
      company: match.job.company,
      title: match.job.title,
      requiredSkills: match.job.requiredSkills,
      description: match.job.description,
    },
    match: {
      score: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
    },
  });

  // 4. Cache explanation in PostgreSQL
  await prisma.matchScore.update({
    where: { id: match.id },
    data: { explanation },
  });

  return { explanation, cached: false };
}

import {
  normalizeSkills,
  skillsForScoring,
  skillEvidenceCredit,
} from './skills.js';

export const SCORING_VERSION = 'v2.2-evidence';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchCalculationResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  transferableSkills: string[];
  skillScore: number | null;
  preferredSkillScore: number | null;
  roleScore: number | null;
  experienceScore: number | null;
  confidence: MatchConfidence;
  scoringVersion: typeof SCORING_VERSION;
}

export interface MatchResumeInput {
  parsedSkills: string[];
  parsedRoles: string[];
  yearsOfExperience?: number | null;
}

export interface MatchJobInput {
  requiredSkills: string[];
  preferredSkills?: string[];
  title: string;
  description?: string | null;
  experienceLevel?: string | null;
}

function calculateExperienceScore(
  candidateYears: number | null | undefined,
  jobTitle: string,
  experienceLevel?: string | null
): number | null {
  if (candidateYears === null || candidateYears === undefined) return null;
  const title = jobTitle.toLowerCase();
  const level = (experienceLevel || '').toLowerCase();
  const senior = ['senior', 'lead', 'staff', 'principal'].some(
    (value) => title.includes(value) || level.includes(value)
  );
  const junior = ['junior', 'entry', 'associate', 'intern'].some(
    (value) => title.includes(value) || level.includes(value)
  );

  if (senior) {
    if (candidateYears >= 5) return 100;
    if (candidateYears >= 3) return 75;
    return 45;
  }
  if (junior) return candidateYears <= 3 ? 100 : 90;
  return candidateYears >= 2 ? 100 : 70;
}

function roleTokens(role: string): Set<string> {
  const synonyms: Record<string, string> = {
    developer: 'engineer',
    programmer: 'engineer',
    dev: 'engineer',
    architect: 'architecture',
    sre: 'reliability',
  };
  return new Set(
    role
      .toLowerCase()
      .replace(/full[\s-]?stack/g, 'fullstack')
      .replace(/front[\s-]?end/g, 'frontend')
      .replace(/back[\s-]?end/g, 'backend')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => synonyms[token] ?? token)
      .filter(
        (token) =>
          token.length > 2 &&
          !['senior', 'junior', 'lead', 'staff', 'principal', 'the', 'and', 'for'].includes(token)
      )
  );
}

function calculateRoleScore(candidateRoles: string[], jobTitle: string): number | null {
  if (!candidateRoles.length) return null;
  const jobTokens = roleTokens(jobTitle);
  if (!jobTokens.size) return null;

  let best = 30;
  for (const role of candidateRoles) {
    const candidateTokens = roleTokens(role);
    if (!candidateTokens.size) continue;
    let matches = 0;
    for (const token of candidateTokens) {
      if (jobTokens.has(token)) matches += 1;
    }
    best = Math.max(
      best,
      Math.round((2 * matches * 100) / (candidateTokens.size + jobTokens.size))
    );
  }
  return Math.min(best, 100);
}

function calculateSkillEvidence(candidateSkills: string[], targetSkills: string[]) {
  const candidate = normalizeSkills(candidateSkills);
  const target = normalizeSkills(targetSkills);
  if (!target.length) {
    return {
      score: null,
      matched: [] as string[],
      transferable: [] as string[],
      missing: [] as string[],
    };
  }

  let creditTotal = 0;
  const matched: string[] = [];
  const transferable: string[] = [];
  const missing: string[] = [];
  for (const skill of target) {
    const credit = skillEvidenceCredit(candidate, skill);
    creditTotal += credit;
    if (credit === 1) matched.push(skill);
    else if (credit > 0) transferable.push(skill);
    else missing.push(skill);
  }

  return {
    score: Math.round((creditTotal / target.length) * 100),
    matched,
    transferable,
    missing,
  };
}

function calculateConfidence(
  resume: MatchResumeInput,
  requiredCount: number,
  preferredCount: number
): MatchConfidence {
  if (requiredCount + preferredCount === 0 || normalizeSkills(resume.parsedSkills).length === 0) {
    return 'low';
  }
  const hasExperience =
    resume.yearsOfExperience !== null && resume.yearsOfExperience !== undefined;
  if (requiredCount >= 3 && resume.parsedRoles.length > 0 && hasExperience) return 'high';
  return 'medium';
}

export function calculateJobMatch(
  resume: MatchResumeInput,
  job: MatchJobInput
): MatchCalculationResult {
  const { requiredSkills, preferredSkills } = skillsForScoring(
    job.requiredSkills || [],
    job.preferredSkills || []
  );
  const required = calculateSkillEvidence(resume.parsedSkills, requiredSkills);
  const preferred = calculateSkillEvidence(resume.parsedSkills, preferredSkills);
  const roleScore = calculateRoleScore(resume.parsedRoles, job.title);
  const experienceScore = calculateExperienceScore(
    resume.yearsOfExperience,
    job.title,
    job.experienceLevel
  );

  const dimensions = [
    { score: required.score, weight: 50 },
    { score: preferred.score, weight: 15 },
    { score: roleScore, weight: 25 },
    { score: experienceScore, weight: 10 },
  ].filter((dimension): dimension is { score: number; weight: number } => dimension.score !== null);
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const rawScore = totalWeight
    ? dimensions.reduce(
        (sum, dimension) => sum + dimension.score * dimension.weight,
        0
      ) / totalWeight
    : 0;
  const confidence = calculateConfidence(
    resume,
    requiredSkills.length,
    preferredSkills.length
  );
  // STRONG (85+) requires high-confidence evidence and no fully missing must-haves.
  // Related/transferable credit can still support a STRONG result.
  let scoreCeiling = confidence === 'high' ? 99 : confidence === 'medium' ? 84 : 69;
  if (required.missing.length > 0) {
    scoreCeiling = Math.min(scoreCeiling, 84);
  }

  return {
    score: Math.round(Math.min(Math.max(rawScore, 0), scoreCeiling)),
    matchedSkills: [...new Set([...required.matched, ...preferred.matched])],
    missingSkills: required.missing,
    transferableSkills: [...new Set([...required.transferable, ...preferred.transferable])],
    skillScore: required.score,
    preferredSkillScore: preferred.score,
    roleScore,
    experienceScore,
    confidence,
    scoringVersion: SCORING_VERSION,
  };
}

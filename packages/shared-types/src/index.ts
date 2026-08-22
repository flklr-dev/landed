// ─────────────────────────────────────────────────────────────────────────────
// Landed — Shared Types
// These types are the single source of truth across frontend, API, and worker.
// When the backend is built, the DB schema and API response shapes should
// map directly to these types.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type JobStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export type RemoteType = 'remote' | 'hybrid' | 'onsite';

export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';

export type UserPlan = 'free' | 'premium';

export type ExtractionStatus = 'idle' | 'pending' | 'done' | 'failed';

// ── Core entities ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  plan: UserPlan;
  createdAt: string; // ISO 8601
  avatarUrl?: string;
  authProvider?: 'local' | 'google' | 'both';
}

export interface Job {
  id: string;
  userId: string;

  // Source
  sourceUrl?: string;
  extractionStatus: ExtractionStatus;

  // Extracted / manually entered fields
  company: string;
  title: string;
  location?: string;
  salaryRaw?: string; // e.g. "$80k–$120k" — raw string, not parsed
  remoteType?: RemoteType;
  jobType?: JobType;
  experienceLevel?: string; // e.g. "Senior", "Mid", "Entry Level"
  requiredSkills: string[];
  description?: string;

  // Application state
  status: JobStatus;
  notes?: string;
  appliedAt?: string; // ISO 8601

  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Application {
  id: string;
  jobId: string;
  status: JobStatus;
  statusHistory: StatusHistoryEntry[];
  appliedAt?: string;
}

export interface StatusHistoryEntry {
  status: JobStatus;
  changedAt: string; // ISO 8601
  note?: string;
}

export interface Resume {
  id: string;
  userId: string;
  fileName: string;
  s3Key?: string; // Phase 2 — S3 object key
  parsedSkills: string[];
  parsedRoles: string[];
  yearsOfExperience?: number;
  uploadedAt: string; // ISO 8601
  extractionStatus: ExtractionStatus;
}

export interface MatchScore {
  id: string;
  userId: string;
  jobId: string;
  score: number; // 0–100
  explanation?: string; // AI-generated, on-demand (premium)
  matchedSkills: string[];
  missingSkills: string[];
  computedAt: string; // ISO 8601
}

// ── Composite / view types ────────────────────────────────────────────────────

/** Job with its match score — used in the Best Matches tab */
export interface JobWithMatch extends Job {
  matchScore?: MatchScore;
}

/** Dashboard summary stats */
export interface DashboardStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  recentActivity: ActivityEntry[];
}

export interface ActivityEntry {
  jobId: string;
  jobTitle: string;
  company: string;
  action: string; // e.g. "Status changed to Interview"
  timestamp: string; // ISO 8601
}

// ── Queue message shapes (Phase 3) ────────────────────────────────────────────

export type QueueMessageType = 'extract-job' | 'parse-resume' | 'compute-match';

export interface QueueMessage<T = unknown> {
  type: QueueMessageType;
  payload: T;
  userId: string;
  enqueuedAt: string;
}

export interface ExtractJobPayload {
  jobId: string;
  url: string;
}

export interface ParseResumePayload {
  resumeId: string;
  s3Key: string;
}

export interface ComputeMatchPayload {
  userId: string;
  jobId?: string; // undefined = recompute all
}

// ── Natural-Language Quick Update Types ────────────────────────────────────────

export type QuickUpdateAction =
  | 'updated'
  | 'unchanged'
  | 'disambiguate'
  | 'created'
  | 'not_found';

export interface QuickUpdateProposedChanges {
  company?: string;
  title?: string;
  status?: JobStatus;
  notes?: string;
  location?: string;
  salaryRaw?: string;
}

export type QuickUpdateParser = 'regex' | 'gemini';

export interface QuickUpdateResult {
  action: QuickUpdateAction;
  message: string;
  job?: Job;
  candidates?: Job[];
  proposedChanges?: QuickUpdateProposedChanges;
  parsedBy?: QuickUpdateParser;
}

export interface QuickUpdateRequest {
  text?: string;
  confirmedJobId?: string;
  proposedChanges?: QuickUpdateProposedChanges;
}

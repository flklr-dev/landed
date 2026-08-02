// ─────────────────────────────────────────────────────────────────────────────
// Landed — Mock Data
// Realistic seed data for Phase 1.1 frontend. All shapes match @landed/shared-types.
// When the backend is wired up in Phase 2, replace these imports at the
// call sites with real API/server-action calls — components don't need to change.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  User,
  Job,
  Resume,
  MatchScore,
  JobWithMatch,
  DashboardStats,
  ActivityEntry,
} from '@landed/shared-types';

// ── Current user ─────────────────────────────────────────────────────────────

export const mockUser: User = {
  id: 'user-1',
  email: 'kit@example.com',
  name: 'Kit Adrian',
  plan: 'premium',
  createdAt: '2026-06-15T08:00:00Z',
};

// ── Jobs ─────────────────────────────────────────────────────────────────────

export const mockJobs: Job[] = [
  {
    id: 'job-1',
    userId: 'user-1',
    sourceUrl: 'https://jobs.lever.co/vercel/frontend-engineer',
    extractionStatus: 'done',
    company: 'Vercel',
    title: 'Senior Frontend Engineer',
    location: 'Remote',
    salaryRaw: '$140k–180k',
    remoteType: 'remote',
    jobType: 'full-time',
    experienceLevel: 'Senior',
    requiredSkills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'GraphQL'],
    description:
      'Build the future of the web with the team behind Next.js and Vercel Edge Network.',
    status: 'interview',
    appliedAt: '2026-07-18T10:00:00Z',
    notes: '2nd round technical — system design focus',
    createdAt: '2026-07-15T09:30:00Z',
    updatedAt: '2026-07-28T14:00:00Z',
  },
  {
    id: 'job-2',
    userId: 'user-1',
    sourceUrl: 'https://stripe.com/jobs/listing/software-engineer',
    extractionStatus: 'done',
    company: 'Stripe',
    title: 'Software Engineer, Payments Infrastructure',
    location: 'San Francisco, CA',
    salaryRaw: '$160k–220k',
    remoteType: 'hybrid',
    jobType: 'full-time',
    experienceLevel: 'Mid-Senior',
    requiredSkills: ['Go', 'Ruby', 'Distributed Systems', 'PostgreSQL', 'gRPC'],
    description:
      'Work on the core payment processing systems that power millions of businesses worldwide.',
    status: 'applied',
    appliedAt: '2026-07-22T14:00:00Z',
    notes: 'Applied via referral from Alex',
    createdAt: '2026-07-20T11:00:00Z',
    updatedAt: '2026-07-22T14:00:00Z',
  },
  {
    id: 'job-3',
    userId: 'user-1',
    sourceUrl: 'https://jobs.ashbyhq.com/linear/fullstack',
    extractionStatus: 'done',
    company: 'Linear',
    title: 'Full Stack Engineer',
    location: 'Remote',
    salaryRaw: '$130k–170k',
    remoteType: 'remote',
    jobType: 'contract',
    experienceLevel: 'Mid',
    requiredSkills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    description: 'Help build the project management tool loved by the best software teams.',
    status: 'saved',
    createdAt: '2026-07-25T08:00:00Z',
    updatedAt: '2026-07-25T08:00:00Z',
  },
  {
    id: 'job-4',
    userId: 'user-1',
    sourceUrl: 'https://planetscale.com/careers/backend',
    extractionStatus: 'done',
    company: 'PlanetScale',
    title: 'Backend Engineer',
    location: 'Remote',
    salaryRaw: '$120k–160k',
    remoteType: 'remote',
    jobType: 'full-time',
    experienceLevel: 'Mid',
    requiredSkills: ['Go', 'MySQL', 'Kubernetes', 'gRPC', 'Vitess'],
    description: 'Build the MySQL-compatible serverless database platform.',
    status: 'saved',
    createdAt: '2026-07-26T10:00:00Z',
    updatedAt: '2026-07-26T10:00:00Z',
  },
  {
    id: 'job-5',
    userId: 'user-1',
    extractionStatus: 'idle',
    company: 'Cloudflare',
    title: 'Software Engineer, Workers Platform',
    location: 'Austin, TX',
    salaryRaw: '$130k–175k',
    remoteType: 'hybrid',
    jobType: 'part-time',
    experienceLevel: 'Senior',
    requiredSkills: ['Rust', 'JavaScript', 'V8', 'WebAssembly', 'TypeScript'],
    description: 'Build the edge computing runtime that runs at 300+ data centres worldwide.',
    status: 'applied',
    appliedAt: '2026-07-10T09:00:00Z',
    createdAt: '2026-07-08T15:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
  },
  {
    id: 'job-6',
    userId: 'user-1',
    sourceUrl: 'https://notion.so/careers/senior-eng',
    extractionStatus: 'done',
    company: 'Notion',
    title: 'Senior Software Engineer, Editor',
    location: 'New York, NY / Remote',
    salaryRaw: '$145k–185k',
    remoteType: 'hybrid',
    jobType: 'full-time',
    experienceLevel: 'Senior',
    requiredSkills: ['React', 'TypeScript', 'CRDTs', 'Node.js', 'PostgreSQL'],
    description: 'Build the connected workspace for knowledge, notes, and project management.',
    status: 'rejected',
    appliedAt: '2026-07-05T12:00:00Z',
    notes: 'Rejected after final round — went with someone with more CRDT experience',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-28T09:00:00Z',
  },
  {
    id: 'job-7',
    userId: 'user-1',
    sourceUrl: 'https://figma.com/careers/engineering',
    extractionStatus: 'done',
    company: 'Figma',
    title: 'Frontend Engineer, Core Editor',
    location: 'San Francisco, CA',
    salaryRaw: '$150k–200k',
    remoteType: 'onsite',
    jobType: 'contract',
    experienceLevel: 'Senior',
    requiredSkills: ['TypeScript', 'WebAssembly', 'C++', 'React', 'Canvas API'],
    description: 'Push the limits of what is possible in the browser for collaborative design.',
    status: 'saved',
    createdAt: '2026-07-29T11:00:00Z',
    updatedAt: '2026-07-29T11:00:00Z',
  },
  {
    id: 'job-8',
    userId: 'user-1',
    sourceUrl: 'https://supabase.com/careers/dx',
    extractionStatus: 'done',
    company: 'Supabase',
    title: 'Developer Experience Engineer',
    location: 'Remote',
    salaryRaw: '₱110k–145k',
    remoteType: 'remote',
    jobType: 'freelance',
    experienceLevel: 'Mid-Senior',
    requiredSkills: ['TypeScript', 'Next.js', 'PostgreSQL', 'Technical Writing', 'Node.js'],
    description:
      'Make Supabase the default backend for every developer, through docs, tools, and examples.',
    status: 'offer',
    appliedAt: '2026-07-01T08:00:00Z',
    notes: 'Offer received! Deliberating vs Vercel interview.',
    createdAt: '2026-06-28T09:00:00Z',
    updatedAt: '2026-07-30T16:00:00Z',
  },
  {
    id: 'job-9',
    userId: 'user-1',
    extractionStatus: 'pending',
    company: 'Loom',
    title: 'Full Stack Engineer',
    location: 'Remote',
    remoteType: 'remote',
    jobType: 'internship',
    experienceLevel: 'Entry Level',
    requiredSkills: [],
    status: 'saved',
    createdAt: '2026-08-01T14:00:00Z',
    updatedAt: '2026-08-01T14:00:00Z',
  },
];

// ── Resume ────────────────────────────────────────────────────────────────────

export const mockResume: Resume = {
  id: 'resume-1',
  userId: 'user-1',
  fileName: 'Kit_Adrian_Diocares_Resume.pdf',
  parsedSkills: [
    'TypeScript',
    'React',
    'Next.js',
    'Node.js',
    'PostgreSQL',
    'AWS',
    'Docker',
    'REST APIs',
    'Technical Writing',
  ],
  parsedRoles: ['Full Stack Developer', 'Frontend Engineer', 'Software Engineer'],
  yearsOfExperience: 4,
  uploadedAt: '2026-07-14T09:00:00Z',
  extractionStatus: 'done',
};

// ── Match scores ──────────────────────────────────────────────────────────────

export const mockMatchScores: MatchScore[] = [
  {
    id: 'match-1',
    userId: 'user-1',
    jobId: 'job-8',
    score: 91,
    explanation:
      'Strong match — covers 5/5 core skills. TypeScript, Next.js, and PostgreSQL are direct hits from your resume. Technical Writing is explicitly listed in your parsed roles. Node.js confirmed.',
    matchedSkills: ['TypeScript', 'Next.js', 'PostgreSQL', 'Technical Writing', 'Node.js'],
    missingSkills: [],
    computedAt: '2026-07-30T17:00:00Z',
  },
  {
    id: 'match-2',
    userId: 'user-1',
    jobId: 'job-1',
    score: 78,
    explanation:
      'Good match — covers 4/5 required skills. React, Next.js, TypeScript, and Node.js are all confirmed. Missing: GraphQL. Consider adding a GraphQL side project before the next interview round.',
    matchedSkills: ['React', 'Next.js', 'TypeScript', 'Node.js'],
    missingSkills: ['GraphQL'],
    computedAt: '2026-07-30T17:01:00Z',
  },
  {
    id: 'match-3',
    userId: 'user-1',
    jobId: 'job-3',
    score: 74,
    explanation:
      'Good match — 4/4 required skills present. React, TypeScript, Node.js, and PostgreSQL are all on your resume. Solid overlap for this role.',
    matchedSkills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    missingSkills: [],
    computedAt: '2026-07-30T17:02:00Z',
  },
  {
    id: 'match-4',
    userId: 'user-1',
    jobId: 'job-7',
    score: 52,
    explanation:
      'Partial match — 2/5 skills confirmed. TypeScript and React are present. Missing: WebAssembly, C++, Canvas API. This is a highly specialized browser-engine role — significant skill gap in native browser internals.',
    matchedSkills: ['TypeScript', 'React'],
    missingSkills: ['WebAssembly', 'C++', 'Canvas API'],
    computedAt: '2026-07-30T17:03:00Z',
  },
  {
    id: 'match-5',
    userId: 'user-1',
    jobId: 'job-5',
    score: 38,
    explanation:
      'Low match — 1/5 skills confirmed. TypeScript is present. Missing: Rust, JavaScript (V8 internals), WebAssembly. This role focuses on systems-level runtime engineering.',
    matchedSkills: ['TypeScript'],
    missingSkills: ['Rust', 'V8 internals', 'WebAssembly'],
    computedAt: '2026-07-30T17:04:00Z',
  },
  {
    id: 'match-6',
    userId: 'user-1',
    jobId: 'job-2',
    score: 29,
    explanation:
      'Low match — 0/5 primary skills confirmed. Your profile is TypeScript/React focused; this role requires Go, Ruby, and distributed systems expertise. Significant language and systems gap.',
    matchedSkills: [],
    missingSkills: ['Go', 'Ruby', 'Distributed Systems', 'PostgreSQL (high-scale)', 'gRPC'],
    computedAt: '2026-07-30T17:05:00Z',
  },
];

// ── Computed: jobs with match scores (for Best Matches tab) ──────────────────

export const mockJobsWithMatches: JobWithMatch[] = mockJobs
  .map((job) => ({
    ...job,
    matchScore: mockMatchScores.find((m) => m.jobId === job.id),
  }))
  .filter((j) => j.matchScore !== undefined)
  .sort((a, b) => (b.matchScore?.score ?? 0) - (a.matchScore?.score ?? 0));

// ── Dashboard stats ───────────────────────────────────────────────────────────

export const mockDashboardStats: DashboardStats = {
  total: mockJobs.length,
  byStatus: {
    saved: mockJobs.filter((j) => j.status === 'saved').length,
    applied: mockJobs.filter((j) => j.status === 'applied').length,
    interview: mockJobs.filter((j) => j.status === 'interview').length,
    offer: mockJobs.filter((j) => j.status === 'offer').length,
    rejected: mockJobs.filter((j) => j.status === 'rejected').length,
  },
  recentActivity: [
    {
      jobId: 'job-8',
      jobTitle: 'Developer Experience Engineer',
      company: 'Supabase',
      action: 'Offer received',
      timestamp: '2026-07-30T16:00:00Z',
    },
    {
      jobId: 'job-1',
      jobTitle: 'Senior Frontend Engineer',
      company: 'Vercel',
      action: 'Moved to Interview',
      timestamp: '2026-07-28T14:00:00Z',
    },
    {
      jobId: 'job-6',
      jobTitle: 'Senior Software Engineer, Editor',
      company: 'Notion',
      action: 'Rejected after final round',
      timestamp: '2026-07-28T09:00:00Z',
    },
    {
      jobId: 'job-2',
      jobTitle: 'Software Engineer, Payments Infrastructure',
      company: 'Stripe',
      action: 'Applied',
      timestamp: '2026-07-22T14:00:00Z',
    },
    {
      jobId: 'job-9',
      jobTitle: 'Full Stack Engineer',
      company: 'Loom',
      action: 'Saved — AI extracting details',
      timestamp: '2026-08-01T14:00:00Z',
    },
    {
      jobId: 'job-7',
      jobTitle: 'Frontend Engineer, Core Editor',
      company: 'Figma',
      action: 'Saved',
      timestamp: '2026-07-29T11:00:00Z',
    },
  ] satisfies ActivityEntry[],
};

// ── Kanban columns helper ─────────────────────────────────────────────────────

import type { JobStatus } from '@landed/shared-types';

export const KANBAN_COLUMNS: { id: JobStatus; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

export function getJobsByStatus(status: JobStatus): Job[] {
  return mockJobs.filter((j) => j.status === status);
}

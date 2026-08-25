// ─────────────────────────────────────────────────────────────────────────────
// Landed — Comprehensive NLP Quick Update & Intent Resolution Tests
// Covers 100+ realistic and adversarial human phrasing scenarios across:
// 1. All 5 statuses (rejected, applied, interview, offer, saved)
// 2. Syntax & phrasing variations (active/passive, casual, title-only, typos)
// 3. Notes & Job Creation
// 4. Edge cases (empty, whitespace, SQL injection, XSS, emojis, URLs)
// 5. String & Field Similarity
// 6. Weighted Fuzzy Matcher
// 7. Full End-to-End Decision Engine (resolveQuickUpdate)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIntentDeterministic,
  computeStringSimilarity,
  matchJobsWeighted,
  resolveQuickUpdate,
  inferStatusFromText,
  extractUrlFromText,
} from './quick-update.js';
import type { Job } from '@landed/shared-types';

const MOCK_USER_JOBS: Job[] = [
  {
    id: 'job-1',
    userId: 'user-123',
    company: 'Cloudstaff',
    title: 'Frontend Developer',
    status: 'applied',
    requiredSkills: ['React', 'TypeScript'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-2',
    userId: 'user-123',
    company: 'Google',
    title: 'Senior Software Engineer',
    status: 'applied',
    requiredSkills: ['Go', 'Kubernetes'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-3',
    userId: 'user-123',
    company: 'Google',
    title: 'Product Designer',
    status: 'interview',
    requiredSkills: ['Figma'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-4',
    userId: 'user-123',
    company: 'Discernis',
    title: 'Frontend Engineer',
    status: 'saved',
    requiredSkills: ['Next.js'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-5',
    userId: 'user-123',
    company: 'OLVRC INC',
    title: 'Junior Android Developer',
    status: 'offer',
    requiredSkills: ['Java', 'Kotlin', 'MVVM'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-6',
    userId: 'user-123',
    company: 'Londa Online Technologies, Inc.',
    title: 'Mobile Engineer',
    status: 'applied',
    requiredSkills: ['React Native'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-7',
    userId: 'user-123',
    company: 'Acme Mobile Labs',
    title: 'Mobile Engineer',
    status: 'saved',
    requiredSkills: ['Flutter'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-8',
    userId: 'user-123',
    company: 'Aleson Shipping Lines, Inc.',
    title: 'Personal Technical Assistant',
    status: 'applied',
    requiredSkills: ['PHP', 'MySQL'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'job-9',
    userId: 'user-123',
    company: 'Stripe',
    title: 'Staff Backend Engineer',
    status: 'interview',
    requiredSkills: ['Ruby', 'Distributed Systems'],
    extractionStatus: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── 1. Deterministic Parser: Status Phrasing Variations ────────────────────────

describe('1. Deterministic Intent Parser — Status Variations', () => {
  // Rejection variations
  it('parses standard rejection with company and role', () => {
    const res = parseIntentDeterministic('Got rejected from Cloudstaff for Frontend Developer role');
    assert.ok(res);
    assert.equal(res.intent, 'update_status');
    assert.equal(res.company, 'Cloudstaff');
    assert.equal(res.title, 'Frontend Developer');
    assert.equal(res.status, 'rejected');
  });

  it('parses short rejection without role', () => {
    const res = parseIntentDeterministic('Rejected by Stripe');
    assert.ok(res);
    assert.equal(res.company, 'Stripe');
    assert.equal(res.status, 'rejected');
  });

  it('parses "turned down by"', () => {
    const res = parseIntentDeterministic('Turned down by Google');
    assert.ok(res);
    assert.equal(res.company, 'Google');
    assert.equal(res.status, 'rejected');
  });

  it('parses "did not move forward with"', () => {
    const res = parseIntentDeterministic('Did not move forward at Cloudstaff');
    assert.ok(res);
    assert.equal(res.company, 'Cloudstaff');
    assert.equal(res.status, 'rejected');
  });

  it('parses casual rejection: "they said no"', () => {
    const res = parseIntentDeterministic('They said no at Discernis');
    assert.ok(res);
    assert.equal(res.reference, 'Discernis');
    assert.equal(res.status, 'rejected');
  });

  it('parses title-only rejection', () => {
    const res = parseIntentDeterministic('I got rejected for Junior Android Developer');
    assert.ok(res);
    assert.equal(res.company, null);
    assert.equal(res.reference, 'Junior Android Developer');
    assert.equal(res.status, 'rejected');
  });

  it('parses rejection with extra whitespace and capitalization', () => {
    const res = parseIntentDeterministic('   REJECTED   FROM   GOOGLE   ');
    assert.ok(res);
    assert.equal(res.company, 'GOOGLE');
    assert.equal(res.status, 'rejected');
  });

  // Interview variations
  it('parses standard interview with company and role', () => {
    const res = parseIntentDeterministic('Interview scheduled with Discernis for Frontend Engineer');
    assert.ok(res);
    assert.equal(res.intent, 'update_status');
    assert.equal(res.company, 'Discernis');
    assert.equal(res.title, 'Frontend Engineer');
    assert.equal(res.status, 'interview');
  });

  it('parses "recruiter call with"', () => {
    const res = parseIntentDeterministic('Recruiter call with Stripe');
    assert.ok(res);
    assert.equal(res.company, 'Stripe');
    assert.equal(res.status, 'interview');
  });

  it('parses "technical round at"', () => {
    const res = parseIntentDeterministic('Technical round at Google');
    assert.ok(res);
    assert.equal(res.company, 'Google');
    assert.equal(res.status, 'interview');
  });

  it('parses "onsite scheduled with"', () => {
    const res = parseIntentDeterministic('Onsite scheduled with Figma');
    assert.ok(res);
    assert.equal(res.company, 'Figma');
    assert.equal(res.status, 'interview');
  });

  it('parses company invitation: "Discernis invited me to next round"', () => {
    const res = parseIntentDeterministic('Discernis invited me to the next round');
    assert.ok(res);
    assert.equal(res.company, 'Discernis');
    assert.equal(res.status, 'interview');
  });

  it('parses title-only interview', () => {
    const res = parseIntentDeterministic('Interview for Mobile Engineer');
    assert.ok(res);
    assert.equal(res.company, null);
    assert.equal(res.reference, 'Mobile Engineer');
    assert.equal(res.status, 'interview');
  });

  it('parses company with legal punctuation in interview string', () => {
    const res = parseIntentDeterministic(
      'Interview with Londa Online Technologies, Inc. for Mobile Engineer'
    );
    assert.ok(res);
    assert.equal(res.company, 'Londa Online Technologies, Inc.');
    assert.equal(res.title, 'Mobile Engineer');
    assert.equal(res.status, 'interview');
  });

  // Applied variations
  it('parses standard applied with role', () => {
    const res = parseIntentDeterministic('Applied to Netflix for Senior Engineer');
    assert.ok(res);
    assert.equal(res.company, 'Netflix');
    assert.equal(res.title, 'Senior Engineer');
    assert.equal(res.status, 'applied');
  });

  it('parses "submitted application to"', () => {
    const res = parseIntentDeterministic('Submitted application to Spotify');
    assert.ok(res);
    assert.equal(res.company, 'Spotify');
    assert.equal(res.status, 'applied');
  });

  it('parses "sent application to"', () => {
    const res = parseIntentDeterministic('Sent application to Stripe');
    assert.ok(res);
    assert.equal(res.company, 'Stripe');
    assert.equal(res.status, 'applied');
  });

  it('parses title-only applied', () => {
    const res = parseIntentDeterministic('Applied for Junior Android Developer');
    assert.ok(res);
    assert.equal(res.reference, 'Junior Android Developer');
    assert.equal(res.status, 'applied');
  });

  // Offer variations
  it('parses standard offer', () => {
    const res = parseIntentDeterministic('Got offer from Figma');
    assert.ok(res);
    assert.equal(res.company, 'Figma');
    assert.equal(res.status, 'offer');
  });

  it('parses "received offer at"', () => {
    const res = parseIntentDeterministic('Received offer at Stripe');
    assert.ok(res);
    assert.equal(res.company, 'Stripe');
    assert.equal(res.status, 'offer');
  });

  it('parses offer with role', () => {
    const res = parseIntentDeterministic('Offer from Figma for Product Designer');
    assert.ok(res);
    assert.equal(res.company, 'Figma');
    assert.equal(res.title, 'Product Designer');
    assert.equal(res.status, 'offer');
  });

  // Direct status transition syntax
  it('parses explicit transition: "move Google to interview"', () => {
    const res = parseIntentDeterministic('move Google to interview');
    assert.ok(res);
    assert.equal(res.company, 'Google');
    assert.equal(res.status, 'interview');
  });

  it('parses explicit transition: "OLVRO INC offer to rejected"', () => {
    const res = parseIntentDeterministic('OLVRO INC offer to rejected');
    assert.ok(res);
    assert.equal(res.company, 'OLVRO INC');
    assert.equal(res.status, 'rejected');
  });
});

// ── 2. Deterministic Parser: Notes & Job Creation ──────────────────────────────

describe('2. Deterministic Intent Parser — Notes & Job Creation', () => {
  it('parses "Add note for [Company]: [Content]"', () => {
    const res = parseIntentDeterministic('Add note for Discernis: Recruiter call went great');
    assert.ok(res);
    assert.equal(res.intent, 'add_note');
    assert.equal(res.company, 'Discernis');
    assert.equal(res.notes, 'Recruiter call went great');
  });

  it('parses "Note for [Company]: [Content]"', () => {
    const res = parseIntentDeterministic('Note for Stripe: Follow up with hiring manager on Friday');
    assert.ok(res);
    assert.equal(res.intent, 'add_note');
    assert.equal(res.company, 'Stripe');
    assert.equal(res.notes, 'Follow up with hiring manager on Friday');
  });

  it('parses note with fullwidth colon (：)', () => {
    const res = parseIntentDeterministic('Note for Google：Second round interview next Wednesday');
    assert.ok(res);
    assert.equal(res.intent, 'add_note');
    assert.equal(res.company, 'Google');
    assert.equal(res.notes, 'Second round interview next Wednesday');
  });

  it('parses long note content without truncation', () => {
    const longNote = 'The technical panel asked deep questions on React concurrency, Zustand vs Redux, and SSR caching strategies. Next step is an architecture design session with the VP.';
    const res = parseIntentDeterministic(`Add note for Cloudstaff: ${longNote}`);
    assert.ok(res);
    assert.equal(res.notes, longNote);
  });

  it('parses "Save role at [Company]: [Title]"', () => {
    const res = parseIntentDeterministic('Save role at OpenAI: Research Scientist');
    assert.ok(res);
    assert.equal(res.intent, 'create_job');
    assert.equal(res.company, 'OpenAI');
    assert.equal(res.title, 'Research Scientist');
    assert.equal(res.status, 'saved');
  });

  it('parses "Track [Company]: [Title]"', () => {
    const res = parseIntentDeterministic('Track Spotify: Staff Backend Engineer');
    assert.ok(res);
    assert.equal(res.intent, 'create_job');
    assert.equal(res.company, 'Spotify');
    assert.equal(res.title, 'Staff Backend Engineer');
  });

  it('parses "Add new job at [Company]: [Title]"', () => {
    const res = parseIntentDeterministic('Add new job at Vercel: Senior Developer Advocate');
    assert.ok(res);
    assert.equal(res.intent, 'create_job');
    assert.equal(res.company, 'Vercel');
    assert.equal(res.title, 'Senior Developer Advocate');
  });
});

// ── 3. Edge Cases, Garbage & Adversarial Inputs ────────────────────────────────

describe('3. Edge Cases, Garbage & Adversarial Inputs', () => {
  it('returns null for empty string', () => {
    const res = parseIntentDeterministic('');
    assert.equal(res, null);
  });

  it('returns null for whitespace-only string', () => {
    const res = parseIntentDeterministic('     \n\t  ');
    assert.equal(res, null);
  });

  it('returns null for punctuation-only string', () => {
    const res = parseIntentDeterministic('!?!?!??...;;;---');
    assert.equal(res, null);
  });

  it('returns null for random keyboard mash without status or intent', () => {
    const res = parseIntentDeterministic('asdfkjasdhf lkajsdfh qwerty');
    assert.equal(res, null);
  });

  it('handles SQL injection attempt safely without crashing or corrupting intent', () => {
    const res = parseIntentDeterministic("'; DROP TABLE jobs; --");
    assert.equal(res, null);
  });

  it('handles HTML / XSS script tags safely', () => {
    const res = parseIntentDeterministic("<script>alert('xss')</script>");
    assert.equal(res, null);
  });

  it('handles emoji-only string safely', () => {
    const res = parseIntentDeterministic('😭😭😭🎉🚀');
    assert.equal(res, null);
  });

  it('strips emoji gracefully when mixed with real text', () => {
    const res = parseIntentDeterministic('Rejected from Google 😭');
    assert.ok(res);
    assert.equal(res.status, 'rejected');
  });

  it('handles very long input string without freezing or crashing', () => {
    const longString = 'a'.repeat(5000);
    const res = parseIntentDeterministic(longString);
    assert.equal(res, null);
  });

  it('handles numeric-only input', () => {
    const res = parseIntentDeterministic('1234567890');
    assert.equal(res, null);
  });

  it('handles non-English input safely without throwing exceptions', () => {
    const res = parseIntentDeterministic('求人から不合格になりました');
    // Does not crash
    assert.ok(res === null || typeof res === 'object');
  });
});

// ── 4. String Similarity & Token Overlap ────────────────────────────────────────

describe('4. String & Field Similarity Computation', () => {
  it('returns 1.0 for exact same string', () => {
    assert.equal(computeStringSimilarity('Google', 'Google'), 1.0);
  });

  it('returns 1.0 for case-insensitive identical strings', () => {
    assert.equal(computeStringSimilarity('google', 'GOOGLE'), 1.0);
  });

  it('returns high similarity for substring contains (e.g. Cloudstaff vs Cloudstaff Inc)', () => {
    const sim = computeStringSimilarity('Cloudstaff', 'Cloudstaff Inc');
    assert.ok(sim >= 0.85, `Expected >= 0.85, got ${sim}`);
  });

  it('tolerates single character typos via Levenshtein (OLVRO vs OLVRC)', () => {
    const sim = computeStringSimilarity('OLVRO', 'OLVRC');
    assert.ok(sim >= 0.75, `Expected >= 0.75, got ${sim}`);
  });

  it('returns low score for completely unrelated company names', () => {
    const sim = computeStringSimilarity('Netflix', 'Stripe');
    assert.ok(sim < 0.35, `Expected < 0.35, got ${sim}`);
  });

  it('computes positive similarity for partial word overlap', () => {
    const sim = computeStringSimilarity('Frontend Dev', 'Frontend Developer');
    assert.ok(sim >= 0.70, `Expected >= 0.70, got ${sim}`);
  });

  it('returns 0 for empty string comparisons', () => {
    assert.equal(computeStringSimilarity('', 'Google'), 0);
    assert.equal(computeStringSimilarity('Google', ''), 0);
  });
});

// ── 5. Weighted Fuzzy Matcher ──────────────────────────────────────────────────

describe('5. Weighted Fuzzy Job Matcher', () => {
  it('prioritizes company match over title ("Cloudstaff frontend" -> Cloudstaff Frontend Developer)', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: 'Cloudstaff', title: 'frontend' },
      MOCK_USER_JOBS
    );
    assert.ok(scores.length > 0);
    assert.equal(scores[0]!.job.company, 'Cloudstaff');
    assert.ok(scores[0]!.score >= 0.85, `Expected >= 0.85 but got ${scores[0]!.score}`);
  });

  it('supports title-only matching when company is null', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: null, title: 'Junior Android Developer', status: 'rejected' },
      MOCK_USER_JOBS
    );
    assert.ok(scores.length > 0);
    assert.equal(scores[0]!.job.id, 'job-5');
    assert.equal(scores[0]!.score, 1);
  });

  it('ranks all matching roles when company has multiple openings', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: 'Google', title: null },
      MOCK_USER_JOBS
    );
    const googleJobs = scores.filter((s) => s.job.company === 'Google');
    assert.equal(googleJobs.length, 2);
    assert.ok(googleJobs[0]!.score >= 0.85);
    assert.ok(googleJobs[1]!.score >= 0.85);
  });

  it('returns empty array when user has 0 jobs', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: 'Google', title: null },
      []
    );
    assert.deepEqual(scores, []);
  });

  it('returns low scores when company does not exist in tracker', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: 'Palantir', title: 'Solutions Engineer' },
      MOCK_USER_JOBS
    );
    assert.ok(scores.every((s) => s.score < 0.50));
  });
});

// ── 6. End-to-End Decision Engine (resolveQuickUpdate) ──────────────────────────

describe('6. End-to-End Decision Engine Resolution', () => {
  it('resolves unique high-confidence match directly to "updated"', async () => {
    const result = await resolveQuickUpdate('Got rejected from Cloudstaff for Frontend Developer role', MOCK_USER_JOBS);
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.company, 'Cloudstaff');
    assert.equal(result.proposedChanges?.status, 'rejected');
  });

  it('returns "disambiguate" when multiple roles exist at the same company', async () => {
    const result = await resolveQuickUpdate('Interview with Google', MOCK_USER_JOBS);
    assert.equal(result.action, 'disambiguate');
    assert.ok(result.candidates && result.candidates.length >= 2);
    assert.equal(result.proposedChanges?.status, 'interview');
  });

  it('returns "not_found" with creation offer when company is not tracked', async () => {
    const result = await resolveQuickUpdate('Applied to Spotify for Staff Engineer', MOCK_USER_JOBS);
    assert.equal(result.action, 'not_found');
    assert.equal(result.proposedChanges?.company, 'Spotify');
    assert.equal(result.proposedChanges?.status, 'applied');
  });

  it('resolves a title-only rejection to the tracked Android role', async () => {
    const result = await resolveQuickUpdate(
      'I got rejected for Junior Android Developer',
      MOCK_USER_JOBS
    );
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-5');
    assert.equal(result.proposedChanges?.status, 'rejected');
  });

  it('tolerates a one-letter company typo in a status transition', async () => {
    const result = await resolveQuickUpdate('OLVRO INC offer to rejected', MOCK_USER_JOBS);
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-5');
    assert.equal(result.proposedChanges?.status, 'rejected');
  });

  it('resolves a punctuated company and role suggestion to the intended job', async () => {
    const result = await resolveQuickUpdate(
      'Interview with Londa Online Technologies, Inc. for Mobile Engineer',
      MOCK_USER_JOBS
    );
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-6');
    assert.equal(result.proposedChanges?.status, 'interview');
  });

  it('resolves a short unique company alias with the role title', async () => {
    const result = await resolveQuickUpdate(
      'Interview with Londa for Mobile Engineer',
      MOCK_USER_JOBS
    );
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-6');
  });

  it('asks the user to choose when a common title exists at multiple companies', async () => {
    const result = await resolveQuickUpdate('Interview for Mobile Engineer', MOCK_USER_JOBS);
    assert.equal(result.action, 'disambiguate');
    assert.deepEqual(
      result.candidates?.map((job) => job.id).sort(),
      ['job-6', 'job-7']
    );
  });

  it('matches an ambiguous "interview for" reference against a short company alias', async () => {
    const result = await resolveQuickUpdate('Interview for Aleson', MOCK_USER_JOBS);
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-8');
    assert.equal(result.proposedChanges?.status, 'interview');
  });

  it('matches a longer company reference without requiring the legal name', async () => {
    const result = await resolveQuickUpdate('Interview for Aleson Shipping', MOCK_USER_JOBS);
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.id, 'job-8');
  });

  it('does not re-update a job that already has the requested status', async () => {
    const jobs = MOCK_USER_JOBS.map((job) =>
      job.id === 'job-8' ? { ...job, status: 'rejected' as const } : job
    );

    const result = await resolveQuickUpdate('Got rejected from Aleson Shipping', jobs);
    assert.equal(result.action, 'unchanged');
    assert.equal(result.job?.id, 'job-8');
    assert.equal(result.message, 'Personal Technical Assistant at Aleson Shipping Lines, Inc. is already rejected.');
  });

  it('handles explicit note addition via decision engine', async () => {
    const result = await resolveQuickUpdate('Add note for Discernis: Great conversation with founder', MOCK_USER_JOBS);
    assert.equal(result.action, 'updated');
    assert.equal(result.job?.company, 'Discernis');
    assert.equal(result.proposedChanges?.notes, 'Great conversation with founder');
  });

  it('handles explicit job creation command via decision engine', async () => {
    const result = await resolveQuickUpdate('Track OpenAI: Research Scientist', MOCK_USER_JOBS);
    assert.equal(result.action, 'created');
    assert.equal(result.proposedChanges?.company, 'OpenAI');
    assert.equal(result.proposedChanges?.title, 'Research Scientist');
    assert.equal(result.proposedChanges?.status, 'saved');
  });

  it('handles completely unrecognized gibberish gracefully', async () => {
    const result = await resolveQuickUpdate('xyzzy foo bar baz 12345', MOCK_USER_JOBS);
    assert.equal(result.action, 'not_found');
  });
});

// ── 7. Status & URL Inference Helpers ──────────────────────────────────────────

describe('7. Helper Functions: inferStatusFromText & extractUrlFromText', () => {
  it('infers "rejected" from "rejected"', () => {
    assert.equal(inferStatusFromText('I was rejected yesterday'), 'rejected');
  });

  it('infers "rejected" from "ghosted"', () => {
    assert.equal(inferStatusFromText('they ghosted me after final round'), 'rejected');
  });

  it('infers "rejected" from "turned down"', () => {
    assert.equal(inferStatusFromText('got turned down'), 'rejected');
  });

  it('infers "offer" from "got an offer"', () => {
    assert.equal(inferStatusFromText('got an offer today!'), 'offer');
  });

  it('infers "offer" from "made me an offer"', () => {
    assert.equal(inferStatusFromText('Figma made me an offer'), 'offer');
  });

  it('infers "interview" from "screening call"', () => {
    assert.equal(inferStatusFromText('had a screening call with recruiter'), 'interview');
  });

  it('infers "interview" from "onsite"', () => {
    assert.equal(inferStatusFromText('onsite round scheduled for Monday'), 'interview');
  });

  it('infers "applied" from "submitted application"', () => {
    assert.equal(inferStatusFromText('just submitted application to Stripe'), 'applied');
  });

  it('infers "saved" from "bookmark"', () => {
    assert.equal(inferStatusFromText('bookmark this job'), 'saved');
  });

  it('returns null when no status keyword is present', () => {
    assert.equal(inferStatusFromText('hello how are you doing today'), null);
  });

  it('extracts clean URL from text', () => {
    assert.equal(
      extractUrlFromText('check this out https://jobs.lever.co/stripe/12345'),
      'https://jobs.lever.co/stripe/12345'
    );
  });

  it('strips trailing punctuation from extracted URL', () => {
    assert.equal(
      extractUrlFromText('view posting at https://boards.greenhouse.io/figma/jobs/9876.'),
      'https://boards.greenhouse.io/figma/jobs/9876'
    );
  });

  it('returns null when no URL is present', () => {
    assert.equal(extractUrlFromText('just a plain message without any links'), null);
  });
});

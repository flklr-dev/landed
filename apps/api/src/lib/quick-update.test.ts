// ─────────────────────────────────────────────────────────────────────────────
// Landed — Quick Update & Intent Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIntentDeterministic,
  computeStringSimilarity,
  matchJobsWeighted,
  resolveQuickUpdate,
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
];

describe('Stage 1: Deterministic Intent Parser', () => {
  it('parses rejection phrases correctly', () => {
    const res = parseIntentDeterministic('Got rejected from Cloudstaff for Frontend Developer role');
    assert.ok(res);
    assert.equal(res.intent, 'update_status');
    assert.equal(res.company, 'Cloudstaff');
    assert.equal(res.title, 'Frontend Developer');
    assert.equal(res.status, 'rejected');
  });

  it('parses short rejection phrases without title', () => {
    const res = parseIntentDeterministic('Rejected by Stripe');
    assert.ok(res);
    assert.equal(res.company, 'Stripe');
    assert.equal(res.status, 'rejected');
  });

  it('parses interview phrases correctly', () => {
    const res = parseIntentDeterministic('Interview scheduled with Discernis for Frontend Engineer');
    assert.ok(res);
    assert.equal(res.intent, 'update_status');
    assert.equal(res.company, 'Discernis');
    assert.equal(res.title, 'Frontend Engineer');
    assert.equal(res.status, 'interview');
  });

  it('parses applied phrases correctly', () => {
    const res = parseIntentDeterministic('Applied to Netflix for Senior Engineer');
    assert.ok(res);
    assert.equal(res.company, 'Netflix');
    assert.equal(res.title, 'Senior Engineer');
    assert.equal(res.status, 'applied');
  });

  it('parses offer phrases correctly', () => {
    const res = parseIntentDeterministic('Got offer from Figma');
    assert.ok(res);
    assert.equal(res.company, 'Figma');
    assert.equal(res.status, 'offer');
  });

  it('parses note addition phrases correctly', () => {
    const res = parseIntentDeterministic('Add note for Discernis: Recruiter call went great');
    assert.ok(res);
    assert.equal(res.intent, 'add_note');
    assert.equal(res.company, 'Discernis');
    assert.equal(res.notes, 'Recruiter call went great');
  });

  it('parses new job creation phrases correctly', () => {
    const res = parseIntentDeterministic('Save role at OpenAI: Research Scientist');
    assert.ok(res);
    assert.equal(res.intent, 'create_job');
    assert.equal(res.company, 'OpenAI');
    assert.equal(res.title, 'Research Scientist');
  });
});

describe('Weighted Fuzzy Matcher & String Similarity', () => {
  it('computes high similarity for matching tokens and substrings', () => {
    const sim = computeStringSimilarity('Cloudstaff', 'Cloudstaff Inc');
    assert.ok(sim >= 0.85, `Expected >= 0.85 but got ${sim}`);
  });

  it('prioritizes company match over title ("Cloudstaff frontend" -> Cloudstaff Frontend Developer)', () => {
    const scores = matchJobsWeighted(
      { intent: 'update_status', company: 'Cloudstaff', title: 'frontend' },
      MOCK_USER_JOBS
    );
    assert.ok(scores.length > 0);
    assert.equal(scores[0]!.job.company, 'Cloudstaff');
    assert.ok(scores[0]!.score >= 0.85, `Expected >= 0.85 but got ${scores[0]!.score}`);
  });
});

describe('Decision Engine Resolution', () => {
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
});

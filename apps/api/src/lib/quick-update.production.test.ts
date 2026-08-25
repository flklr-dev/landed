import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUrlFromText,
  inferStatusFromText,
  parseIntentDeterministic,
  resolveQuickUpdate,
} from './quick-update.js';
import type { Job, JobStatus } from '@landed/shared-types';

const NOW = new Date().toISOString();

const JOBS: Job[] = [
  {
    id: 'cloudstaff',
    userId: 'user-123',
    company: 'Cloudstaff',
    title: 'Frontend Developer',
    status: 'applied',
    requiredSkills: ['React'],
    extractionStatus: 'done',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'olvrc',
    userId: 'user-123',
    company: 'OLVRC INC',
    title: 'Junior Android Developer',
    status: 'offer',
    requiredSkills: ['Kotlin'],
    extractionStatus: 'done',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'aleson',
    userId: 'user-123',
    company: 'Aleson Shipping Lines, Inc.',
    title: 'Personal Technical Assistant',
    status: 'applied',
    requiredSkills: ['PHP'],
    extractionStatus: 'done',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'londa',
    userId: 'user-123',
    company: 'Londa Online Technologies, Inc.',
    title: 'Mobile Engineer',
    status: 'applied',
    requiredSkills: ['React Native'],
    extractionStatus: 'done',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'acme',
    userId: 'user-123',
    company: 'Acme Mobile Labs',
    title: 'Mobile Engineer',
    status: 'saved',
    requiredSkills: ['Flutter'],
    extractionStatus: 'done',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const LINKEDIN_URL = 'https://www.linkedin.com/jobs/view/4418836657/';

describe('Chat URL commands', () => {
  it('pulls a LinkedIn URL out of surrounding text', () => {
    assert.equal(
      extractUrlFromText(`add this application as applied ${LINKEDIN_URL}`),
      LINKEDIN_URL,
    );
  });

  it('infers create-status from the text around a URL', () => {
    const cases: Array<[string, JobStatus | null]> = [
      [LINKEDIN_URL, null],
      [`add this ${LINKEDIN_URL}`, null],
      [`add this application as applied ${LINKEDIN_URL}`, 'applied'],
      [`save this as interview ${LINKEDIN_URL}`, 'interview'],
      [`track this as offer ${LINKEDIN_URL}`, 'offer'],
      [`add as rejected ${LINKEDIN_URL}`, 'rejected'],
      [`bookmark ${LINKEDIN_URL}`, 'saved'],
    ];

    for (const [text, expected] of cases) {
      assert.equal(inferStatusFromText(text), expected, text);
    }
  });
});

describe('Production chat phrases use regex, not Gemini', () => {
  const parseCases: Array<{
    phrase: string;
    status: JobStatus;
    company?: string | null;
    title?: string | null;
    reference?: string | null;
  }> = [
    { phrase: 'got reject for olvro', status: 'rejected', reference: 'olvro' },
    { phrase: 'got rejected for olvro', status: 'rejected', reference: 'olvro' },
    { phrase: 'Got rejected for olvro', status: 'rejected', reference: 'olvro' },
    { phrase: 'i got reject from aleson', status: 'rejected', company: 'aleson' },
    { phrase: 'they said no at Aleson', status: 'rejected', reference: 'Aleson' },
    { phrase: 'Aleson invited me to the next round', status: 'interview', company: 'Aleson' },
    { phrase: 'Londa invited me to the next round', status: 'interview', company: 'Londa' },
    { phrase: 'I got accepted at Aleson', status: 'interview', reference: 'Aleson' },
    { phrase: 'got accepted at aleson shipping', status: 'interview', reference: 'aleson shipping' },
    { phrase: 'apply to Cloudstaff', status: 'applied', company: 'Cloudstaff' },
    { phrase: 'applied to Cloudstaff', status: 'applied', company: 'Cloudstaff' },
    { phrase: 'I apply for Frontend Developer', status: 'applied', reference: 'Frontend Developer' },
    { phrase: 'got offer from Aleson', status: 'offer', company: 'Aleson' },
    { phrase: 'got an offer from Aleson', status: 'offer', company: 'Aleson' },
    { phrase: 'interview for olvro', status: 'interview', reference: 'olvro' },
    { phrase: 'Interview with Londa for Mobile Engineer', status: 'interview', company: 'Londa', title: 'Mobile Engineer' },
  ];

  for (const testCase of parseCases) {
    it(`parses "${testCase.phrase}" with regex`, () => {
      const parsed = parseIntentDeterministic(testCase.phrase);
      assert.ok(parsed, `expected regex parse for "${testCase.phrase}"`);
      assert.equal(parsed.status, testCase.status);
      if (testCase.company !== undefined) assert.equal(parsed.company, testCase.company);
      if (testCase.title !== undefined) assert.equal(parsed.title, testCase.title);
      if (testCase.reference !== undefined) assert.equal(parsed.reference, testCase.reference);
    });
  }
});

describe('Production resolution paths', () => {
  const resolutionCases: Array<{
    phrase: string;
    action: 'updated' | 'unchanged' | 'disambiguate';
    jobId?: string;
    status?: JobStatus;
  }> = [
    { phrase: 'got reject for olvro', action: 'updated', jobId: 'olvrc', status: 'rejected' },
    { phrase: 'got rejected for olvro', action: 'updated', jobId: 'olvrc', status: 'rejected' },
    { phrase: 'they said no at Aleson', action: 'updated', jobId: 'aleson', status: 'rejected' },
    { phrase: 'Aleson invited me to the next round', action: 'updated', jobId: 'aleson', status: 'interview' },
    { phrase: 'I got accepted at Aleson', action: 'updated', jobId: 'aleson', status: 'interview' },
    { phrase: 'apply to Cloudstaff', action: 'unchanged', jobId: 'cloudstaff', status: 'applied' },
    { phrase: 'applied to Cloudstaff', action: 'unchanged', jobId: 'cloudstaff' },
    { phrase: 'got offer from Aleson', action: 'updated', jobId: 'aleson', status: 'offer' },
    { phrase: 'Interview for Mobile Engineer', action: 'disambiguate' },
    { phrase: 'Interview with Londa for Mobile Engineer', action: 'updated', jobId: 'londa', status: 'interview' },
  ];

  for (const testCase of resolutionCases) {
    it(`resolves "${testCase.phrase}"`, async () => {
      const result = await resolveQuickUpdate(testCase.phrase, JOBS);
      assert.equal(result.action, testCase.action, result.message);
      assert.equal(result.parsedBy, 'regex');
      if (testCase.jobId) assert.equal(result.job?.id, testCase.jobId);
      if (testCase.status && result.action === 'updated') {
        assert.equal(result.proposedChanges?.status, testCase.status);
      }
      if (testCase.action === 'disambiguate') {
        assert.deepEqual(result.candidates?.map((job) => job.id).sort(), ['acme', 'londa']);
      }
    });
  }

  it('does not write again when Aleson is already rejected', async () => {
    const jobs = JOBS.map((job) =>
      job.id === 'aleson' ? { ...job, status: 'rejected' as const } : job,
    );
    const result = await resolveQuickUpdate('they said no at Aleson', jobs);
    assert.equal(result.action, 'unchanged');
    assert.equal(result.parsedBy, 'regex');
  });
});

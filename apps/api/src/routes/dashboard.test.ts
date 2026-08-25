// ─────────────────────────────────────────────────────────────────────────────
// Landed — Dashboard Aggregation Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { JobStatus, DashboardStats } from '@landed/shared-types';

interface MockJobInput {
  id: string;
  company: string;
  title: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  requiredSkills?: string[];
  matchScore?: number;
}

function computeDashboardMetrics(
  jobs: MockJobInput[],
  options: { hasResume?: boolean } = {}
): DashboardStats {
  const byStatus: Record<JobStatus, number> = {
    saved: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };

  for (const job of jobs) {
    if (job.status in byStatus) {
      byStatus[job.status]++;
    }
  }

  const sortedJobs = [...jobs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 8);

  const recentActivity = sortedJobs.map((job) => {
    let action: string = job.status;
    switch (job.status) {
      case 'applied': action = 'Applied'; break;
      case 'interview': action = 'Interview'; break;
      case 'offer': action = 'Offer'; break;
      case 'rejected': action = 'Rejected'; break;
      case 'saved': action = 'Saved'; break;
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      action,
      timestamp: job.updatedAt.toISOString(),
    };
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyAppliedCount = jobs.filter(
    (j) => ['applied', 'interview', 'offer'].includes(j.status) && j.updatedAt.getTime() >= sevenDaysAgo
  ).length;

  const skillCountMap = new Map<string, number>();
  for (const job of jobs) {
    for (const skill of job.requiredSkills || []) {
      const trimmed = skill.trim();
      if (!trimmed) continue;
      skillCountMap.set(trimmed, (skillCountMap.get(trimmed) || 0) + 1);
    }
  }
  const topSkills = Array.from(skillCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const hasResume = Boolean(options.hasResume);
  const topSavedMatches = jobs
    .filter((j) => j.status === 'saved')
    .map((j) => ({
      id: j.id,
      company: j.company,
      title: j.title,
      score: hasResume && j.matchScore !== undefined ? Math.round(j.matchScore) : null,
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 2);

  return {
    total: jobs.length,
    byStatus,
    recentActivity,
    weeklyAppliedCount,
    topSkills,
    topSavedMatches,
    hasResume,
  };
}

describe('Dashboard Analytics & Aggregation Logic', () => {
  it('handles 0 tracked jobs safely without division by zero', () => {
    const result = computeDashboardMetrics([]);
    assert.equal(result.total, 0);
    assert.deepEqual(result.byStatus, {
      saved: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    });
    assert.deepEqual(result.recentActivity, []);
    assert.equal(result.weeklyAppliedCount, 0);
    assert.deepEqual(result.topSkills, []);
    assert.deepEqual(result.topSavedMatches, []);
    assert.equal(result.hasResume, false);

    const conversionRate = result.total > 0
      ? Math.round(((result.byStatus.interview + result.byStatus.offer) / result.total) * 100)
      : 0;
    assert.equal(conversionRate, 0);
  });

  it('aggregates status counts accurately and calculates conversion rate', () => {
    const now = new Date();
    const mockJobs: MockJobInput[] = [
      { id: '1', company: 'Google', title: 'Senior SWE', status: 'interview', createdAt: now, updatedAt: now, requiredSkills: ['Go', 'Kubernetes'] },
      { id: '2', company: 'Stripe', title: 'Staff SWE', status: 'offer', createdAt: now, updatedAt: now, requiredSkills: ['Ruby', 'Go'] },
      { id: '3', company: 'Figma', title: 'Product Designer', status: 'applied', createdAt: now, updatedAt: now, requiredSkills: ['Figma', 'UI/UX'] },
      { id: '4', company: 'Vercel', title: 'Frontend Engineer', status: 'saved', createdAt: now, updatedAt: now, requiredSkills: ['Next.js', 'React'], matchScore: 92 },
      { id: '5', company: 'Amazon', title: 'SDE II', status: 'rejected', createdAt: now, updatedAt: now, requiredSkills: ['Java', 'AWS'] },
    ];

    const result = computeDashboardMetrics(mockJobs, { hasResume: true });
    assert.equal(result.total, 5);
    assert.equal(result.byStatus.saved, 1);
    assert.equal(result.byStatus.applied, 1);
    assert.equal(result.byStatus.interview, 1);
    assert.equal(result.byStatus.offer, 1);
    assert.equal(result.byStatus.rejected, 1);

    // Conversion rate: (1 interview + 1 offer) / 5 total = 40%
    const conversionRate = Math.round(((result.byStatus.interview + result.byStatus.offer) / result.total) * 100);
    assert.equal(conversionRate, 40);

    // Weekly momentum: 1 interview + 1 offer + 1 applied = 3
    assert.equal(result.weeklyAppliedCount, 3);

    // Top skills: 'Go' appears twice (Google, Stripe)
    assert.equal(result.topSkills[0]!.name, 'Go');
    assert.equal(result.topSkills[0]!.count, 2);

    // Top saved matches with resume: 92%
    assert.equal(result.topSavedMatches.length, 1);
    assert.equal(result.topSavedMatches[0]!.company, 'Vercel');
    assert.equal(result.topSavedMatches[0]!.score, 92);
  });

  it('formats recent activity with proper simplified action descriptions', () => {
    const past = new Date(Date.now() - 3600000); // 1 hr ago
    const recent = new Date(); // now

    const mockJobs: MockJobInput[] = [
      { id: '1', company: 'Discernis', title: 'Frontend Engineer', status: 'interview', createdAt: past, updatedAt: recent },
      { id: '2', company: 'Cloudstaff', title: 'React Dev', status: 'applied', createdAt: recent, updatedAt: recent },
    ];

    const result = computeDashboardMetrics(mockJobs);
    assert.equal(result.recentActivity.length, 2);

    assert.equal(result.recentActivity[0]!.company, 'Discernis');
    assert.equal(result.recentActivity[0]!.action, 'Interview');

    assert.equal(result.recentActivity[1]!.company, 'Cloudstaff');
    assert.equal(result.recentActivity[1]!.action, 'Applied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Dashboard Analytics & Activity Feed Routes
// GET /api/dashboard — Live pipeline metrics, status counts & recent activity
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '@landed/db';
import { requireAuth } from '../lib/auth.js';
import type { DashboardStats, JobStatus, ActivityEntry } from '@landed/shared-types';

export const dashboardRouter = Router();

// All dashboard endpoints require authentication
dashboardRouter.use(requireAuth);

function formatActivityAction(status: string): string {
  switch (status) {
    case 'applied':
      return 'Applied';
    case 'interview':
      return 'Interview';
    case 'offer':
      return 'Offer';
    case 'rejected':
      return 'Rejected';
    case 'saved':
      return 'Saved';
    default:
      return status;
  }
}

dashboardRouter.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Efficient parallel fetch: status counts, recent jobs, momentum, skills & saved matches
    const [
      statusGroups,
      recentJobs,
      totalJobs,
      weeklyAppliedCount,
      allJobsSkills,
      savedJobs,
      resumeCount,
    ] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.job.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          company: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.job.count({ where: { userId } }),
      prisma.job.count({
        where: {
          userId,
          status: { in: ['applied', 'interview', 'offer'] },
          updatedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.job.findMany({
        where: { userId },
        select: { requiredSkills: true },
      }),
      prisma.job.findMany({
        where: { userId, status: 'saved' },
        select: {
          id: true,
          company: true,
          title: true,
          matches: {
            where: { userId },
            select: { score: true },
            take: 1,
          },
        },
      }),
      prisma.resume.count({ where: { userId } }),
    ]);

    // 2. Initialize default counts
    const byStatus: Record<JobStatus, number> = {
      saved: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    };

    for (const group of statusGroups) {
      const statusKey = group.status as JobStatus;
      if (statusKey in byStatus) {
        byStatus[statusKey] = group._count._all;
      }
    }

    // 3. Format recent activity stream
    const recentActivity: ActivityEntry[] = recentJobs.map((job) => ({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      action: formatActivityAction(job.status),
      timestamp: job.updatedAt.toISOString(),
    }));

    // 4. Compute Top Skills Frequency
    const skillCountMap = new Map<string, number>();
    for (const item of allJobsSkills) {
      for (const rawSkill of item.requiredSkills || []) {
        const skill = rawSkill.trim();
        if (!skill) continue;
        skillCountMap.set(skill, (skillCountMap.get(skill) || 0) + 1);
      }
    }

    const topSkills = Array.from(skillCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Compute Top Saved Matches (Premium Preview)
    const hasResume = resumeCount > 0;
    const topSavedMatches = savedJobs
      .map((job) => ({
        id: job.id,
        company: job.company,
        title: job.title,
        score: hasResume && job.matches?.[0]?.score != null ? Math.round(job.matches[0].score) : null,
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 2);

    const response: DashboardStats = {
      total: totalJobs,
      byStatus,
      recentActivity,
      weeklyAppliedCount,
      topSkills,
      topSavedMatches,
      hasResume,
    };

    res.json(response);
  } catch (err) {
    console.error('[Dashboard] Stats aggregation error:', err);
    res.status(500).json({ error: 'Unable to load dashboard statistics. Please refresh or try again.' });
  }
});

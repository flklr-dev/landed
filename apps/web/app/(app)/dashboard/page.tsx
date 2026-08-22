'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Live Dashboard Analytics & Pipeline Overview
// Real-time status counts, conversion rate, weekly momentum, skill demand,
// top saved matches (premium preview), and activity feed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/features/TopBar';
import { StatsCard } from '@/components/features/StatsCard';
import { fetchDashboardStats } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';
import type { DashboardStats, JobStatus } from '@landed/shared-types';
import {
  ArrowRight,
  TrendingUp,
  Plus,
  Inbox,
  RefreshCw,
  Sparkles,
  Flame,
  FileText,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

// ── Pipeline Bar Component ───────────────────────────────────────────────────

function PipelineBar({ stats }: { stats: DashboardStats }) {
  const total = stats.total || 1;
  const { byStatus } = stats;
  const stages: { status: JobStatus; color: string }[] = [
    { status: 'saved', color: 'bg-ink/20' },
    { status: 'applied', color: 'bg-blue-500' },
    { status: 'interview', color: 'bg-amber-500' },
    { status: 'offer', color: 'bg-emerald-500' },
    { status: 'rejected', color: 'bg-red-400' },
  ];

  if (stats.total === 0) {
    return (
      <div className="h-2 rounded-full bg-ink/10 w-full" title="No tracked applications" />
    );
  }

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      {stages.map(({ status, color }) => {
        const count = byStatus[status] || 0;
        if (count === 0) return null;
        return (
          <div
            key={status}
            className={[color, 'transition-all duration-500'].join(' ')}
            style={{ flex: count / total }}
            title={`${status}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Overview Skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-20 bg-ink/10 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border border-line overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-bg space-y-2">
              <div className="h-3 w-16 bg-ink/10 rounded" />
              <div className="h-7 w-12 bg-ink/10 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Skeleton */}
      <div className="border border-line p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-3 w-32 bg-ink/10 rounded" />
          <div className="h-3 w-24 bg-ink/10 rounded" />
        </div>
        <div className="h-2 w-full bg-ink/10 rounded-full" />
      </div>

      {/* Skills & Saved Matches Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-line p-4 space-y-3">
          <div className="h-3 w-28 bg-ink/10 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-6 bg-ink/5 rounded" />
            ))}
          </div>
        </div>
        <div className="border border-line p-4 space-y-3">
          <div className="h-3 w-28 bg-ink/10 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 bg-ink/5 rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Activity Skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-28 bg-ink/10 rounded" />
        <div className="border border-line divide-y divide-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="h-3.5 w-48 bg-ink/10 rounded" />
                <div className="h-3 w-32 bg-ink/10 rounded" />
              </div>
              <div className="space-y-1.5 text-right shrink-0">
                <div className="h-3 w-16 bg-ink/10 rounded ml-auto" />
                <div className="h-2.5 w-24 bg-ink/10 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyDashboardState() {
  return (
    <div className="border border-dashed border-line rounded-lg p-10 text-center flex flex-col items-center justify-center space-y-4 bg-ink/[0.02]">
      <div className="w-12 h-12 rounded-full bg-ink/5 border border-line flex items-center justify-center text-ink-muted">
        <Inbox size={22} />
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-sm font-semibold text-ink">No applications tracked yet</h3>
        <p className="text-xs text-ink-muted leading-relaxed">
          Add your first job to start seeing real-time pipeline analytics, interview conversion rates, and activity timelines.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link
          href="/board"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-bg bg-ink rounded-md hover:bg-ink/90 transition-colors shadow-sm"
        >
          <Plus size={13} />
          <span>Add on Board</span>
        </Link>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch stats:', err);
      toast.error('Could not load dashboard data', 'Please check your connection and try refreshing.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const total = stats?.total ?? 0;
  const byStatus = stats?.byStatus ?? {
    saved: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };
  const recentActivity = stats?.recentActivity ?? [];
  const weeklyAppliedCount = stats?.weeklyAppliedCount ?? 0;
  const topSkills = stats?.topSkills ?? [];
  const topSavedMatches = stats?.topSavedMatches ?? [];
  const hasResume = stats?.hasResume ?? false;

  const conversionRate = total > 0
    ? Math.round(((byStatus.interview + byStatus.offer) / total) * 100)
    : 0;

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Your job search at a glance"
        action={
          <button
            type="button"
            onClick={() => loadStats(true)}
            disabled={isLoading || isRefreshing}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 border border-line rounded-md transition-colors"
            title="Refresh dashboard stats"
            aria-label="Refresh dashboard stats"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-signal' : ''} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="p-6 max-w-5xl mx-auto space-y-6">

            {/* Summary stats */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                  Overview
                </p>
                {weeklyAppliedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Flame size={13} className="text-amber-500" />
                    <span className="font-mono text-ink font-medium">{weeklyAppliedCount}</span>
                    <span>applied in the last 7 days</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border border-line overflow-hidden bg-line">
                <StatsCard label="Total" value={total} />
                <StatsCard label="Saved" value={byStatus.saved} status="saved" />
                <StatsCard label="Applied" value={byStatus.applied} status="applied" />
                <StatsCard label="Interview" value={byStatus.interview} status="interview" />
                <StatsCard label="Offers" value={byStatus.offer} status="offer" />
              </div>
            </section>

            {/* Pipeline viz */}
            <section className="border border-line p-4 space-y-3 bg-bg">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                  Application Pipeline
                </p>
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <span className="font-mono font-medium text-ink">{conversionRate}%</span>
                  <span>to interview / offer</span>
                </div>
              </div>

              {stats && <PipelineBar stats={stats} />}

              {/* Legend */}
              <div className="flex flex-wrap gap-3 pt-1">
                {(
                  [
                    { status: 'saved' as JobStatus, color: 'bg-ink/20', label: 'Saved' },
                    { status: 'applied' as JobStatus, color: 'bg-blue-500', label: 'Applied' },
                    { status: 'interview' as JobStatus, color: 'bg-amber-500', label: 'Interview' },
                    { status: 'offer' as JobStatus, color: 'bg-emerald-500', label: 'Offer' },
                    { status: 'rejected' as JobStatus, color: 'bg-red-400', label: 'Rejected' },
                  ]
                ).map(({ status, color, label }) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={['w-2 h-2 rounded-full', color].join(' ')} />
                    <span className="text-[10px] font-mono text-ink-muted">
                      {label} ({byStatus[status] || 0})
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Empty state when 0 applications are tracked */}
            {total === 0 ? (
              <EmptyDashboardState />
            ) : (
              <>
                {/* 2-Column Intelligence Grid: In-Demand Skills & Top Saved Matches */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* 1. In-Demand Skills Frequency */}
                  <section className="border border-line p-4 space-y-3 bg-bg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                          Top Required Skills
                        </p>
                        <span className="text-[10px] font-mono text-ink-muted/70">From tracked jobs</span>
                      </div>

                      {topSkills.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {topSkills.map((skill) => (
                            <div key={skill.name} className="flex items-center justify-between text-xs">
                              <span className="font-medium text-ink truncate">{skill.name}</span>
                              <span className="text-[10px] font-mono text-ink-muted bg-ink/5 px-2 py-0.5 rounded border border-line">
                                {skill.count} {skill.count === 1 ? 'role' : 'roles'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-muted py-3">
                          Skills extracted from your job postings will aggregate here.
                        </p>
                      )}
                    </div>

                    <p className="text-[10px] text-ink-muted/70 pt-2 border-t border-line/60">
                      Tailor your resume highlights toward these recurring skills.
                    </p>
                  </section>

                  {/* 2. Top Saved Matches (Premium Preview) */}
                  <section className="border border-line p-4 space-y-3 bg-bg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                          Saved Opportunities
                        </p>
                        <Link
                          href="/matches"
                          className="text-[10px] font-mono text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                        >
                          Best Matches <ArrowRight size={10} />
                        </Link>
                      </div>

                      {!hasResume ? (
                        <div className="p-3 bg-ink/[0.02] border border-dashed border-line rounded space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                            <Sparkles size={13} className="text-signal" />
                            <span>Resume Fit Ranking</span>
                          </div>
                          <p className="text-xs text-ink-muted leading-relaxed">
                            Upload your resume in Best Matches to score and rank your saved jobs automatically by fit.
                          </p>
                          <Link
                            href="/matches"
                            className="inline-flex items-center gap-1 text-xs font-medium text-ink underline underline-offset-2 hover:text-signal pt-1"
                          >
                            <FileText size={12} />
                            Upload Resume
                          </Link>
                        </div>
                      ) : topSavedMatches.length > 0 ? (
                        <div className="space-y-2.5 pt-1">
                          {topSavedMatches.map((job) => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between p-2 rounded border border-line hover:bg-ink/[0.02] transition-colors"
                            >
                              <div className="min-w-0 flex-1 mr-3">
                                <p className="text-xs font-medium text-ink truncate">{job.title}</p>
                                <p className="text-[11px] text-ink-muted truncate">{job.company}</p>
                              </div>
                              {job.score != null ? (
                                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                  {job.score}% Fit
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-ink-muted shrink-0">Saved</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-muted py-3">
                          No saved jobs right now. Save openings from your search to see fit recommendations here.
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[10px] text-ink-muted">
                      <span>Ready to apply?</span>
                      <Link href="/board" className="hover:text-ink transition-colors flex items-center gap-0.5">
                        Open Board <ArrowRight size={10} />
                      </Link>
                    </div>
                  </section>

                </div>

                {/* Recent activity */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                      Recent Activity
                    </p>
                    <Link
                      href="/board"
                      className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                    >
                      View board <ArrowRight size={12} />
                    </Link>
                  </div>

                  <div className="border border-line divide-y divide-line bg-bg">
                    {recentActivity.map((entry, i) => (
                      <div
                        key={`${entry.jobId}-${i}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink/[0.02] transition-colors"
                      >
                        {/* Left: Role title & Company name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{entry.jobTitle}</p>
                          <p className="text-xs text-ink-muted truncate">{entry.company}</p>
                        </div>

                        {/* Right: Action/Status (medium, top) & Date/Time on one line (bottom) */}
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-ink">{entry.action}</p>
                          <p className="text-[10px] font-mono text-ink-muted">
                            {formatDate(entry.timestamp)} · {formatTime(entry.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Rejected — quick insight */}
            {byStatus.rejected > 0 && (
              <section className="border border-red-500/20 bg-red-500/5 p-4 rounded-md">
                <p className="text-xs font-mono text-red-500 uppercase tracking-widest mb-1 font-semibold">
                  {byStatus.rejected} Rejected Application{byStatus.rejected !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Check{' '}
                  <Link href="/matches" className="text-ink underline underline-offset-2 font-medium hover:text-signal">
                    Best Matches
                  </Link>{' '}
                  to find new high-fit roles and adjust your search strategy.
                </p>
              </section>
            )}

          </div>
        )}
      </div>
    </>
  );
}

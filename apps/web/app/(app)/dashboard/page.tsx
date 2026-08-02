import type { Metadata } from 'next';
import { TopBar } from '@/components/features/TopBar';
import { StatsCard } from '@/components/features/StatsCard';
import { mockDashboardStats, mockJobs } from '@/lib/mock-data';
import { Badge } from '@/components/ui/Badge';
import type { JobStatus } from '@landed/shared-types';
import { ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Dashboard' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Simple pipeline visualizer
function PipelineBar() {
  const total = mockDashboardStats.total || 1;
  const { byStatus } = mockDashboardStats;
  const stages: { status: JobStatus; color: string }[] = [
    { status: 'saved', color: 'bg-ink/20' },
    { status: 'applied', color: 'bg-blue-500' },
    { status: 'interview', color: 'bg-amber-500' },
    { status: 'offer', color: 'bg-green-500' },
    { status: 'rejected', color: 'bg-red-400' },
  ];

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      {stages.map(({ status, color }) => {
        const count = byStatus[status];
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

export default function DashboardPage() {
  const { total, byStatus, recentActivity } = mockDashboardStats;
  const conversionRate = total > 0 ? Math.round(((byStatus.interview + byStatus.offer) / total) * 100) : 0;

  return (
    <>
      <TopBar title="Dashboard" subtitle="Your job search at a glance" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">

          {/* Summary stats */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-3">
              Overview
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border border-line overflow-hidden">
              <StatsCard label="Total" value={total} />
              <StatsCard label="Saved" value={byStatus.saved} status="saved" />
              <StatsCard label="Applied" value={byStatus.applied} status="applied" />
              <StatsCard label="Interview" value={byStatus.interview} status="interview" />
              <StatsCard label="Offers" value={byStatus.offer} status="offer" />
            </div>
          </section>

          {/* Pipeline viz */}
          <section className="border border-line p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                Application Pipeline
              </p>
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <TrendingUp size={12} />
                <span className="font-mono">{conversionRate}% to interview</span>
              </div>
            </div>
            <PipelineBar />
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { status: 'saved' as JobStatus, color: 'bg-ink/20', label: 'Saved' },
                  { status: 'applied' as JobStatus, color: 'bg-blue-500', label: 'Applied' },
                  { status: 'interview' as JobStatus, color: 'bg-amber-500', label: 'Interview' },
                  { status: 'offer' as JobStatus, color: 'bg-green-500', label: 'Offer' },
                  { status: 'rejected' as JobStatus, color: 'bg-red-400', label: 'Rejected' },
                ]
              ).map(({ status, color, label }) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={['w-2 h-2 rounded-full', color].join(' ')} />
                  <span className="text-[10px] font-mono text-ink-muted">{label} ({byStatus[status]})</span>
                </div>
              ))}
            </div>
          </section>

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

            <div className="border border-line divide-y divide-line">
              {recentActivity.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-ink/2 transition-colors"
                >
                  {/* Company initial */}
                  <div className="w-7 h-7 rounded-sm bg-ink/6 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono font-semibold text-ink-muted uppercase">
                      {entry.company[0]}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{entry.jobTitle}</p>
                    <p className="text-xs text-ink-muted truncate">{entry.company} · {entry.action}</p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-mono text-ink-muted">{formatDate(entry.timestamp)}</p>
                    <p className="text-[10px] font-mono text-ink-muted/60">{formatTime(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Rejected — quick insight */}
          {byStatus.rejected > 0 && (
            <section className="border border-red-200 bg-red-50/50 p-4">
              <p className="text-xs font-mono text-red-600 uppercase tracking-widest mb-1">
                {byStatus.rejected} Rejected
              </p>
              <p className="text-sm text-ink-muted">
                {byStatus.rejected} application{byStatus.rejected !== 1 ? 's' : ''} didn't move forward. Check{' '}
                <Link href="/matches" className="text-ink underline underline-offset-2">
                  Best Matches
                </Link>{' '}
                to prioritize where to focus next.
              </p>
            </section>
          )}

        </div>
      </div>
    </>
  );
}

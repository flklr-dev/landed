import type { JobWithMatch } from '@landed/shared-types';
import { MatchScoreBadge } from './MatchScoreBadge';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Check, AlertCircle, ArrowUpRight, Sparkles } from 'lucide-react';

interface MatchCardProps {
  jobWithMatch: JobWithMatch;
  rank: number;
  onOpenPrep?: (job: JobWithMatch) => void;
}

export function MatchCard({ jobWithMatch, rank, onOpenPrep }: MatchCardProps) {
  const { matchScore, company, title, location, remoteType, salaryRaw, status, sourceUrl } =
    jobWithMatch;
  const score = matchScore?.score ?? 0;

  return (
    <div className="bg-white border border-line rounded-xl p-4 sm:p-5 hover:border-ink/25 hover:shadow-xs transition-all duration-150">
      {/* ── Top Meta Row: #Rank, Company Name, Status Pill (Left) & AI Prep Button (Right) ── */}
      <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-bg text-ink-muted border border-line shrink-0">
            #{String(rank).padStart(2, '0')}
          </span>
          <span className="font-mono text-xs font-medium text-ink-muted uppercase tracking-[0.05em] truncate">
            {company}
          </span>
          <Badge variant={status} label={status} dot />
        </div>

        <button
          type="button"
          onClick={() => onOpenPrep?.(jobWithMatch)}
          className="group/prep inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-md bg-signal/15 text-ink border border-signal/30 hover:bg-signal transition-all shadow-xs cursor-pointer shrink-0"
          title="Open AI Interview Prep & Strategy Guide"
        >
          <Sparkles size={11} className="text-signal group-hover/prep:text-ink transition-colors" />
          <span>AI Prep</span>
        </button>
      </div>

      {/* ── Body: Score Circular Gauge + Main Info ───────────────────────────── */}
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Left Circular Gauge */}
        <div className="shrink-0 pt-0.5">
          <MatchScoreBadge score={score} size="md" />
        </div>

        {/* Right Details Column */}
        <div className="flex-1 min-w-0">
          {/* Job Title with Embedded Link & North-East Hover Arrow */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/title inline-flex items-center gap-1.5 max-w-full hover:text-signal transition-colors"
                title="Open job posting"
              >
                <h2 className="text-base sm:text-lg font-semibold text-ink leading-snug group-hover/title:text-signal transition-colors line-clamp-1">
                  {title}
                </h2>
                <ArrowUpRight
                  size={15}
                  className="text-ink-muted group-hover/title:text-signal opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
                />
              </a>
            ) : (
              <h2 className="text-base sm:text-lg font-semibold text-ink leading-snug line-clamp-1">
                {title}
              </h2>
            )}
          </div>

          {/* Location & Salary */}
          <div className="flex items-center gap-3 text-xs font-mono text-ink-muted mt-1.5 flex-wrap">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} className="text-ink-muted/70 shrink-0" />
                {remoteType === 'remote' ? 'Remote' : location}
              </span>
            )}
            {salaryRaw && (
              <span className="font-semibold text-ink">
                {salaryRaw}
              </span>
            )}
          </div>

          {/* Hairline Divider */}
          <div className="border-t border-line/60 my-3" />

          {/* Skills Breakdown Section */}
          {matchScore && (
            <div className="space-y-2.5">
              {/* MATCHED */}
              {matchScore.matchedSkills.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-muted font-semibold mb-1.5">
                    MATCHED
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchScore.matchedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 text-[11px] font-mono font-medium"
                      >
                        <Check size={10} strokeWidth={2.5} className="text-emerald-700" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GAPS */}
              {matchScore.missingSkills.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-muted font-semibold mb-1.5">
                    GAPS
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchScore.missingSkills.slice(0, 5).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[11px] font-mono font-medium"
                      >
                        <AlertCircle size={10} className="text-amber-700" />
                        {skill}
                      </span>
                    ))}
                    {matchScore.missingSkills.length > 5 && (
                      <span className="text-[11px] font-mono text-ink-muted self-center px-1">
                        +{matchScore.missingSkills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

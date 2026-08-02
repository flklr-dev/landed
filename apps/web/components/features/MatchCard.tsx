import type { JobWithMatch } from '@landed/shared-types';
import { MatchScoreBadge } from './MatchScoreBadge';
import { MapPin, Check, X } from 'lucide-react';

interface MatchCardProps {
  jobWithMatch: JobWithMatch;
  rank: number;
  onViewDetails?: () => void;
}

export function MatchCard({ jobWithMatch, rank, onViewDetails }: MatchCardProps) {
  const { matchScore, company, title, location, remoteType, requiredSkills } = jobWithMatch;
  const score = matchScore?.score ?? 0;

  return (
    // Console layer — dark panel
    <div
      className="bg-panel border border-panel-fg/10 p-4 group cursor-pointer hover:border-panel-fg/20 transition-all duration-[120ms] animate-fade-in"
      onClick={onViewDetails}
    >
      <div className="flex items-start gap-4">
        {/* Rank + Score */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <span className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest">
            #{String(rank).padStart(2, '0')}
          </span>
          <MatchScoreBadge score={score} size="md" />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-sm bg-panel-fg/10 flex items-center justify-center">
              <span className="text-[8px] font-mono font-bold text-panel-fg/50 uppercase">
                {company[0]}
              </span>
            </div>
            <span className="text-xs text-panel-fg/60 font-medium">{company}</span>
          </div>

          <h3 className="text-sm font-semibold text-panel-fg leading-snug mb-2 line-clamp-1">
            {title}
          </h3>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1 text-panel-fg/40 mb-3">
              <MapPin size={10} />
              <span className="text-[10px] font-mono">
                {remoteType === 'remote' ? 'Remote' : location}
              </span>
            </div>
          )}

          {/* Matched / Missing skills */}
          {matchScore && (
            <div className="space-y-1.5">
              {matchScore.matchedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {matchScore.matchedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-sm"
                    >
                      <Check size={8} />
                      {skill}
                    </span>
                  ))}
                </div>
              )}
              {matchScore.missingSkills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {matchScore.missingSkills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 bg-red-500/8 text-red-400/70 border border-red-500/15 rounded-sm"
                    >
                      <X size={8} />
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Explanation preview */}
          {matchScore?.explanation && (
            <p className="text-[11px] text-panel-fg/45 mt-2.5 leading-relaxed line-clamp-2 font-mono">
              {matchScore.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

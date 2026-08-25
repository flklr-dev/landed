'use client';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getTierDetails(score: number) {
  if (score >= 85) {
    return {
      label: 'STRONG',
      color: '#10B981', // emerald
      pillBg: 'bg-emerald-50',
      pillText: 'text-emerald-800',
      pillBorder: 'border-emerald-200',
    };
  }
  if (score >= 70) {
    return {
      label: 'GOOD',
      color: '#F5A05C', // --signal accent
      pillBg: 'bg-amber-50',
      pillText: 'text-amber-800',
      pillBorder: 'border-amber-200',
    };
  }
  if (score >= 50) {
    return {
      label: 'MODERATE',
      color: '#D97706', // warm clay / amber
      pillBg: 'bg-orange-50',
      pillText: 'text-orange-800',
      pillBorder: 'border-orange-200',
    };
  }
  return {
    label: 'REACH',
    color: '#8C827A', // muted ink
    pillBg: 'bg-bg',
    pillText: 'text-ink-muted',
    pillBorder: 'border-line',
  };
}

export function MatchScoreBadge({ score, size = 'md' }: MatchScoreBadgeProps) {
  const tier = getTierDetails(score);

  // Compact sizing adhering strictly to DESIGN.md
  const config =
    size === 'lg'
      ? { diameter: 80, stroke: 5.5, textClass: 'text-xl', pillClass: 'text-[10px] px-2.5 py-0.5' }
      : size === 'sm'
        ? { diameter: 48, stroke: 3.5, textClass: 'text-xs', pillClass: 'text-[8px] px-1.5 py-0.5' }
        : { diameter: 64, stroke: 4.5, textClass: 'text-base', pillClass: 'text-[9px] px-2 py-0.5' };

  const radius = (config.diameter - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference * (1 - Math.max(score, 2) / 100);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative" style={{ width: config.diameter, height: config.diameter }}>
        <svg
          width={config.diameter}
          height={config.diameter}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Background track using token hairline border color */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            stroke="#E8E5DF"
            strokeWidth={config.stroke}
            fill="none"
          />
          {/* Active progress arc */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            stroke={tier.color}
            strokeWidth={config.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>

        {/* Score & percentage inside circle on single line */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-baseline justify-center tracking-tight">
            <span className={`font-mono font-bold text-ink leading-none ${config.textClass}`}>
              {score}
            </span>
            <span className="font-mono font-semibold text-[10px] text-ink-muted ml-0.5 leading-none">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Tier pill underneath */}
      <span
        className={`font-mono font-semibold uppercase tracking-[0.05em] rounded-full border ${tier.pillBg} ${tier.pillText} ${tier.pillBorder} ${config.pillClass}`}
      >
        {tier.label}
      </span>
    </div>
  );
}

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#4ade80'; // green
  if (score >= 50) return '#f5a05c'; // signal orange
  return '#f87171'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Good';
  if (score >= 30) return 'Low';
  return 'Poor';
}

const SIZES = {
  sm: { outer: 48, stroke: 4, fontSize: 'text-xs' },
  md: { outer: 64, stroke: 5, fontSize: 'text-sm' },
  lg: { outer: 88, stroke: 6, fontSize: 'text-base' },
};

export function MatchScoreBadge({ score, size = 'md' }: MatchScoreBadgeProps) {
  const { outer, stroke, fontSize } = SIZES[size];
  const radius = (outer - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - score / 100);
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: outer, height: outer }}>
        <svg
          width={outer}
          height={outer}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="rgba(241,240,234,0.12)"
            strokeWidth={stroke}
            fill="none"
          />
          {/* Progress */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Score text — panel-fg on panel bg */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={['font-mono font-semibold leading-none', fontSize].join(' ')}
            style={{ color }}
          >
            {score}
          </span>
          <span className="text-[8px] font-mono text-panel-fg/50 uppercase tracking-wider mt-0.5">
            %
          </span>
        </div>
      </div>
      {size !== 'sm' && (
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color }}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}

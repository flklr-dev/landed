'use client';

import { Plus, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showAddButton?: boolean;
  onAddJob?: () => void;
  onQuickUpdate?: () => void;
}

export function TopBar({
  title,
  subtitle,
  action,
  showAddButton = false,
  onAddJob,
  onQuickUpdate,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-line bg-bg flex items-center justify-between px-6 gap-4 sticky top-0 z-30">
      <div className="flex flex-col justify-center min-w-0">
        <h1 className="text-sm font-semibold text-ink truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ink-muted truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onQuickUpdate && (
          <button
            type="button"
            onClick={onQuickUpdate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink bg-ink/5 hover:bg-ink/10 border border-line rounded-md transition-colors"
            title="Quick Update with natural language (⌘K)"
          >
            <Sparkles size={13} className="text-signal" />
            <span>Quick Update</span>
            <kbd className="hidden md:inline-flex items-center px-1 text-[10px] font-mono text-ink-muted bg-bg border border-line rounded">
              ⌘K
            </kbd>
          </button>
        )}
        {action}
        {showAddButton && (
          <Button size="sm" onClick={onAddJob}>
            <Plus size={14} />
            Add Job
          </Button>
        )}
      </div>
    </header>
  );
}

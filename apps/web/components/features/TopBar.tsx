'use client';

import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showAddButton?: boolean;
  onAddJob?: () => void;
}

export function TopBar({ title, subtitle, action, showAddButton = false, onAddJob }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-line bg-bg flex items-center justify-between px-6 gap-4 sticky top-0 z-30">
      <div className="flex flex-col justify-center min-w-0">
        <h1 className="text-sm font-semibold text-ink truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ink-muted truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
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

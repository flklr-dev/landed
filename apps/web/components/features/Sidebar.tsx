'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Sparkles,
  BarChart2,
  Settings,
  LogOut,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { mockUser } from '@/lib/mock-data';

const NAV_ITEMS = [
  {
    href: '/board',
    label: 'Board',
    icon: LayoutGrid,
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: BarChart2,
  },
  {
    href: '/matches',
    label: 'Best Matches',
    icon: Sparkles,
    premium: true,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-bg border-r border-line flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-line">
        <Link href="/board" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-ink rounded-sm flex items-center justify-center">
            <Target size={13} className="text-bg" />
          </div>
          <span className="font-semibold text-ink tracking-tight text-sm">Landed</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, premium }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm',
                'transition-colors duration-[120ms]',
                isActive
                  ? 'bg-ink text-bg font-medium'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/6',
              ].join(' ')}
            >
              <Icon size={15} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {premium && !isActive && (
                <Badge variant="premium" label="Pro" className="py-0 px-1.5 text-[9px]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User area */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-ink">
              {mockUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink truncate">{mockUser.name}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              {mockUser.plan}
            </p>
          </div>
          <button
            className="p-1 text-ink-muted hover:text-ink transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

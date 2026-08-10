'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Sidebar Navigation Component
// Includes active link highlighting, real user profile, and confirmation
// modal for sign out.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

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
  const { user, logout } = useAuth();
  const toast = useToast();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const userName = user?.name || 'User';
  const userPlan = user?.plan || 'Free';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleConfirmLogout = () => {
    setLogoutModalOpen(false);
    toast.info('Signed out', 'You have been signed out of your account.');
    logout();
  };

  return (
    <>
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
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={userName}
                className="w-7 h-7 rounded-full shrink-0 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-ink">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{userName}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                {userPlan}
              </p>
            </div>
            <button
              onClick={() => setLogoutModalOpen(true)}
              className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-md"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* macOS-style Sign Out Alert Dialog */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-[320px] bg-bg border border-line rounded-xl p-5 shadow-xl space-y-4 animate-in zoom-in-95 duration-150"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">Sign out of Landed?</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Are you sure you want to sign out?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoutModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmLogout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Mini nav */}
      <nav className="border-b border-line h-14 flex items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-ink rounded-sm flex items-center justify-center">
            <Target size={13} className="text-bg" />
          </div>
          <span className="font-semibold tracking-tight text-sm">Landed</span>
        </Link>
      </nav>

      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div>
            <h1
              className="text-2xl font-bold text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Welcome back
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Sign in to your Landed account.
            </p>
          </div>

          {/* Form */}
          <form
            action="/board"
            className="space-y-4"
          >
            <Input
              label="Email"
              type="email"
              id="login-email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <div className="space-y-1.5">
              <Input
                label="Password"
                type="password"
                id="login-password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <div className="text-right">
                <Link
                  href="#"
                  className="text-xs text-ink-muted hover:text-ink transition-colors underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Link href="/board">
              <Button fullWidth type="button" className="mt-2">
                Sign in
                <ArrowRight size={14} />
              </Button>
            </Link>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* OAuth placeholder */}
          <Button
            variant="secondary"
            fullWidth
            type="button"
            className="gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          {/* Sign up link */}
          <p className="text-center text-sm text-ink-muted">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-ink font-medium underline underline-offset-2 hover:text-ink/70 transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

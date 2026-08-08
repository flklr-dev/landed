'use client';

import React, { useState } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { name?: string; email?: string; password?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Full name is required';
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.push('/board');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">

          {/* Header */}
          <div>
            <h1
              className="text-2xl font-bold text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Create your account
            </h1>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Track job applications, auto-extract listings with AI, and manage your pipeline seamlessly.
            </p>
          </div>

          {/* Alert Banner for Server Error / Lockout */}
          {serverError && (
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-signal-rejected/10 border border-signal-rejected/20 text-xs text-signal-rejected">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{serverError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Input
                label="Full Name"
                type="text"
                id="signup-name"
                placeholder="Kit Adrian"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                disabled={isSubmitting}
                required
                autoComplete="name"
              />
              {errors.name && <p className="text-xs text-signal-rejected mt-1 font-medium">{errors.name}</p>}
            </div>

            <div>
              <Input
                label="Email"
                type="email"
                id="signup-email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={isSubmitting}
                required
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-signal-rejected mt-1 font-medium">{errors.email}</p>}
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                id="signup-password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={isSubmitting}
                required
                autoComplete="new-password"
                hint="Must be at least 8 characters."
              />
              {errors.password && <p className="text-xs text-signal-rejected mt-1 font-medium">{errors.password}</p>}
            </div>

            <Button fullWidth type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* OAuth */}
          <Button variant="secondary" fullWidth type="button" className="gap-2" disabled={isSubmitting}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </Button>

          <p className="text-xs text-ink-muted text-center">
            By signing up you agree to our{' '}
            <Link href="#" className="underline underline-offset-2 hover:text-ink transition-colors">Terms</Link>{' '}
            and{' '}
            <Link href="#" className="underline underline-offset-2 hover:text-ink transition-colors">Privacy Policy</Link>.
          </p>

          <p className="text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-ink font-medium underline underline-offset-2 hover:text-ink/70 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

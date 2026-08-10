'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useGoogleSignIn } from '@/lib/use-google-signin';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google OAuth handler
  const handleGoogleCredential = useCallback(async (credential: string) => {
    setIsGoogleLoading(true);
    setServerError(null);

    try {
      const res = await loginWithGoogle(credential);
      if (res.isNew) {
        toast.success('Account created successfully!', `Welcome to Landed, ${res.user.name}!`);
        router.push('/board?new=true');
      } else {
        toast.success('Welcome back!');
        router.push('/board');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed. Try again.';
      setServerError(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [loginWithGoogle, router, toast]);

  const { buttonContainerRef: googleButtonRef } = useGoogleSignIn({
    onCredential: handleGoogleCredential,
    onError: (msg) => setServerError(msg),
    buttonText: 'signin_with',
  });

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
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
      await login(email.trim().toLowerCase(), password);
      toast.success('Welcome back!');
      router.push('/board');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const anyLoading = isSubmitting || isGoogleLoading;

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

      {/* Centered form box with fixed top padding to prevent layout shift */}
      <div className="flex-1 flex flex-col items-center justify-start pt-12 md:pt-16 pb-12 px-6">
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

          {/* Inline error */}
          {serverError && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              {serverError}
            </p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              id="login-email"
              placeholder="you@example.com"
              value={email}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              disabled={anyLoading}
              required
              autoComplete="email"
            />

            <div className="space-y-1.5">
              <Input
                label="Password"
                type="password"
                id="login-password"
                placeholder="Enter your password"
                value={password}
                error={errors.password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={anyLoading}
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

            <Button fullWidth type="submit" disabled={anyLoading} className="mt-2">
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
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

          {/* Google OAuth */}
          <div
            className={[
              'google-button-host min-h-[40px] w-full',
              anyLoading ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
            aria-busy={isGoogleLoading}
          >
            <div ref={googleButtonRef} className={isGoogleLoading ? 'hidden' : ''} />
            {isGoogleLoading && (
              <Button variant="secondary" fullWidth type="button" disabled className="gap-2">
                <Loader2 size={14} className="animate-spin" />
                Signing in with Google...
              </Button>
            )}
          </div>

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


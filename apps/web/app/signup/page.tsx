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

export default function SignupPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
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
      } else {
        toast.success('Welcome back!', 'Signed in with your existing account.');
      }
      router.push(res.isNew ? '/board?new=true' : '/board');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-up failed. Try again.';
      setServerError(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [loginWithGoogle, router, toast]);

  const { buttonContainerRef: googleButtonRef } = useGoogleSignIn({
    onCredential: handleGoogleCredential,
    onError: (msg) => setServerError(msg),
    buttonText: 'signup_with',
  });

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
      toast.success('Account created successfully!', `Welcome to Landed, ${name.trim()}!`);
      router.push('/board?new=true');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
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
              Create your account
            </h1>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Track job applications, auto-extract listings with AI, and manage your pipeline seamlessly.
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
              label="Full Name"
              type="text"
              id="signup-name"
              placeholder="Kit Adrian"
              value={name}
              error={errors.name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              disabled={anyLoading}
              required
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              id="signup-email"
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

            <Input
              label="Password"
              type="password"
              id="signup-password"
              placeholder="Create a password"
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={anyLoading}
              required
              autoComplete="new-password"
              hint="Must be at least 8 characters."
            />

            <Button fullWidth type="submit" disabled={anyLoading} className="mt-2">
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
                Signing up with Google...
              </Button>
            )}
          </div>

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


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Landed â€” Auth Routes
// POST /api/auth/register  â€” Create account (email + password)
// POST /api/auth/login     â€” Sign in with password, get JWT
// POST /api/auth/google    â€” Sign in / sign up with Google ID token
// GET  /api/auth/me        â€” Get current user (protected)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@landed/db';
import { validate } from '../lib/validate.js';
import { hashPassword, comparePassword, signToken, requireAuth } from '../lib/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../lib/rate-limiter.js';

export const authRouter = Router();

// â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const GoogleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

// â”€â”€ POST /register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

authRouter.post('/register', registerRateLimiter, validate('body', RegisterSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body as z.infer<typeof RegisterSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, authProvider: 'local' },
    });

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatarUrl: user.avatarUrl, authProvider: user.authProvider },
      token,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// â”€â”€ POST /login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

authRouter.post('/login', loginRateLimiter, validate('body', LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Google-only account trying password login
    if (!user.passwordHash) {
      res.status(401).json({
        error: 'This account uses Google Sign-In. Please sign in with Google.',
        authProvider: 'google',
      });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatarUrl: user.avatarUrl, authProvider: user.authProvider },
      token,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// â”€â”€ POST /google â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Handles both sign-in and sign-up via Google One Tap / Sign In With Google.
//
// E2E scenarios:
// 1. New user (no account) â†’ auto-create with Google profile, return isNew=true
// 2. Existing Google user â†’ update avatar, log in
// 3. Existing manual user with same email â†’ link Google account, log in

authRouter.post('/google', validate('body', GoogleAuthSchema), async (req, res) => {
  const { credential } = req.body as z.infer<typeof GoogleAuthSchema>;

  const googleClientId = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  if (!googleClientId) {
    console.error('[Auth] Google client ID is not configured');
    res.status(500).json({ error: 'Google authentication is not configured on the server.' });
    return;
  }

  let payload: {
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const verifiedPayload = ticket.getPayload();
    if (!verifiedPayload || !verifiedPayload.email || !verifiedPayload.email_verified) {
      res.status(401).json({ error: 'Invalid Google credentials' });
      return;
    }

    payload = {
      sub: verifiedPayload.sub,
      email: verifiedPayload.email,
      email_verified: verifiedPayload.email_verified,
      name: verifiedPayload.name,
      picture: verifiedPayload.picture,
    };
  } catch (err) {
    console.error('[Auth] Google token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Invalid Google credentials' });
    return;
  }

  try {
    const { sub: googleId, email, name, picture: avatarUrl } = payload;
    const displayName = name || email.split('@')[0];

    let user = await prisma.user.findUnique({ where: { googleId } });
    let isNew = false;

    if (user) {
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl },
        });
      }
    } else {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId,
            avatarUrl: avatarUrl || existingByEmail.avatarUrl,
            authProvider: existingByEmail.passwordHash ? 'both' : 'google',
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: displayName,
            googleId,
            avatarUrl,
            authProvider: 'google',
          },
        });
        isNew = true;
      }
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatarUrl: user.avatarUrl, authProvider: user.authProvider },
      token,
      isNew,
    });
  } catch (err) {
    console.error('[Auth] Google account persistence error:', err);
    res.status(500).json({ error: 'Google sign-in succeeded, but the server could not save your account.' });
  }
});
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, plan: true, createdAt: true, avatarUrl: true, authProvider: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

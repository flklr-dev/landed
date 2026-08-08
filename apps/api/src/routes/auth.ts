// ─────────────────────────────────────────────────────────────────────────────
// Landed — Auth Routes
// POST /api/auth/register  — Create account
// POST /api/auth/login     — Sign in, get JWT
// GET  /api/auth/me        — Get current user (protected)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@landed/db';
import { validate } from '../lib/validate.js';
import { hashPassword, comparePassword, signToken, requireAuth } from '../lib/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../lib/rate-limiter.js';

export const authRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ── POST /register ───────────────────────────────────────────────────────────

authRouter.post('/register', registerRateLimiter, validate('body', RegisterSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body as z.infer<typeof RegisterSchema>;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
      token,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────

authRouter.post('/login', loginRateLimiter, validate('body', LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Deliberately vague to prevent email enumeration
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
      token,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// ── GET /me ──────────────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
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

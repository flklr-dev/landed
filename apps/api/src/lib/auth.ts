// ─────────────────────────────────────────────────────────────────────────────
// Landed — JWT Auth Helpers
// Sign, verify, and Express middleware for protecting routes.
// ─────────────────────────────────────────────────────────────────────────────

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

// ── Token payload ────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
}

// Extend Express Request to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Auth middleware ──────────────────────────────────────────────────────────
// Extracts JWT from Authorization header, verifies, attaches user to request.

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

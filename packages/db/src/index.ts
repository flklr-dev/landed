// ─────────────────────────────────────────────────────────────────────────────
// Landed — Prisma Client Singleton
// Re-exports the Prisma Client so that all packages import from @landed/db
// instead of instantiating their own client.
//
// Trade-off note: We use a global singleton pattern to avoid exhausting
// connection pool during hot-reload in development (standard Next.js/Express
// pattern). In production each container gets its own instance anyway.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export everything from Prisma Client so consumers don't need
// a direct dependency on @prisma/client
export * from '@prisma/client';
export type { PrismaClient } from '@prisma/client';

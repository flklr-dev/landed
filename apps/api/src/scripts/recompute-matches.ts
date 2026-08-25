// Recomputes all match scores with the current shared evidence scorer.
// Usage: pnpm --filter @landed/api recompute-matches

import { prisma } from '@landed/db';
import { computeMatchesForUser } from '../lib/matching-engine.js';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      resumes: {
        some: { extractionStatus: 'done' },
      },
    },
    select: { id: true, email: true },
  });

  console.log(`[Recompute] Found ${users.length} users with parsed resumes`);

  let total = 0;
  for (const user of users) {
    const count = await computeMatchesForUser(user.id);
    total += count;
    console.log(`[Recompute] ${user.email}: ${count} scores`);
  }

  console.log(`[Recompute] Done. Updated ${total} match scores.`);
}

main()
  .catch((error) => {
    console.error('[Recompute] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

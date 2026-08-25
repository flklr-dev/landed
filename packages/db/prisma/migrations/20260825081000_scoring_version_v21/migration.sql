-- Keep the Prisma default aligned with the current scorer version.
ALTER TABLE "match_scores"
ALTER COLUMN "scoring_version" SET DEFAULT 'v2.1-evidence';

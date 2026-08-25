-- Soft-skill demotion + required-skill cap (v2.2-evidence).
ALTER TABLE "match_scores" ALTER COLUMN "scoring_version" SET DEFAULT 'v2.2-evidence';
UPDATE "match_scores" SET "scoring_version" = 'legacy' WHERE "scoring_version" IN ('v2-evidence', 'v2.1-evidence');

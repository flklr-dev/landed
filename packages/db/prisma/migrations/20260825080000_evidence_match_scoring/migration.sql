ALTER TABLE "jobs"
ADD COLUMN "preferred_skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "match_scores"
ADD COLUMN "transferable_skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "skill_score" DOUBLE PRECISION,
ADD COLUMN "preferred_skill_score" DOUBLE PRECISION,
ADD COLUMN "role_score" DOUBLE PRECISION,
ADD COLUMN "experience_score" DOUBLE PRECISION,
ADD COLUMN "confidence" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN "scoring_version" TEXT NOT NULL DEFAULT 'v2-evidence';

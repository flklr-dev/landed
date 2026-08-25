-- The additive schema migration gives all existing rows the new default.
-- Mark only rows without a v2 breakdown as legacy so the API can lazily
-- recompute them with the shared evidence scorer.
UPDATE "match_scores"
SET "scoring_version" = 'legacy-v1'
WHERE "skill_score" IS NULL
  AND "preferred_skill_score" IS NULL
  AND "role_score" IS NULL
  AND "experience_score" IS NULL;

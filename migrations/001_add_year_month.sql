-- Migration: Add year and month columns for monthly rankings
-- Run this script to migrate from single-record-per-user to monthly records

-- Step 1: Add year and month columns
ALTER TABLE scores ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS month INTEGER;

-- Step 2: Populate year/month from existing created_at
UPDATE scores
SET year = EXTRACT(YEAR FROM created_at)::INTEGER,
    month = EXTRACT(MONTH FROM created_at)::INTEGER
WHERE year IS NULL OR month IS NULL;

-- Step 3: Make columns NOT NULL
ALTER TABLE scores ALTER COLUMN year SET NOT NULL;
ALTER TABLE scores ALTER COLUMN month SET NOT NULL;

-- Step 4: Drop old unique constraint
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_name_type_uniq;

-- Step 5: Create new unique constraint (name, type, year, month)
ALTER TABLE scores ADD CONSTRAINT scores_name_type_year_month_uniq
  UNIQUE (name, type, year, month);

-- Step 6: Create index for efficient monthly queries
CREATE INDEX IF NOT EXISTS idx_scores_year_month
  ON scores (year, month);

-- Step 7: Update upsert_score function to handle year/month
CREATE OR REPLACE FUNCTION upsert_score(
  p_name TEXT,
  p_type TEXT,
  p_score INT,
  p_extra JSONB
) RETURNS VOID AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_month INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
BEGIN
  INSERT INTO scores (name, type, score, extra, created_at, year, month)
  VALUES (p_name, p_type, p_score, p_extra, NOW(), v_year, v_month)
  ON CONFLICT (name, type, year, month)
  DO UPDATE SET
    score = EXCLUDED.score,
    extra = EXCLUDED.extra,
    created_at = EXCLUDED.created_at
  WHERE EXCLUDED.score > scores.score;
END;
$$ LANGUAGE plpgsql;

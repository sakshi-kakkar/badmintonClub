-- ============================================================
-- Migration v3: Home/Away double-leg league support
-- Run this on top of the existing schema (after migrate_v2.sql)
-- ============================================================

-- 1. Add league_legs column to tournaments
--    1 = single leg (default, existing behaviour)
--    2 = home & away (each pair plays twice, venues swapped)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS league_legs INT NOT NULL DEFAULT 1
    CHECK (league_legs IN (1, 2));

-- 2. Add leg tracking columns to matches
--    leg_number : 1 (first leg) or 2 (return leg)
--    is_home_leg: true when team1 is the designated home side
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS leg_number   INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_home_leg  BOOLEAN NOT NULL DEFAULT true;

-- Confirm
SELECT 'Migration v3 applied: home/away double-leg support added.' AS result;

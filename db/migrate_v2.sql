-- ============================================================
-- Migration v2: Add IPL playoff round types to rounds table
-- Run this if you already have the database from v1
-- ============================================================

-- Drop the old CHECK constraint and add the new one with IPL types
ALTER TABLE rounds
  DROP CONSTRAINT IF EXISTS rounds_round_type_check;

ALTER TABLE rounds
  ADD CONSTRAINT rounds_round_type_check
  CHECK (round_type IN (
    'league', 'group_stage', 'knockout',
    'quarterfinal', 'semifinal', 'final', 'third_place',
    'qualifier1', 'eliminator', 'qualifier2'
  ));

-- Confirm
SELECT 'Migration v2 applied: IPL round types added.' AS result;

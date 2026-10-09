-- ============================================================================
-- A date on every stop
-- ============================================================================
-- A stop carried a time of day and nothing else; the date lived once, on the
-- order. Every stop's day was therefore guessed from the order of the times -
-- a stop earlier on the clock than the one before it was "the next morning" -
-- and the guess could only stretch across one midnight. Bookings that run for
-- several days (up to a week) could not be written down at all, and the guess
-- was not shared: punctuality and stall detection read every stop as falling
-- on the order's own date, so a 03:00 drop on an overnight run was judged as
-- due a full day before it was.
--
-- "expectedDate" is the day the stop is due, beside "expectedTime".
--
-- NULLABLE ON PURPOSE. Nothing is backfilled. A stop with no date falls back
-- to what every reader does today - the order's deliverySchedule, with the
-- overnight reading in route order - so this changes nothing until the code
-- starts writing dates, and existing bookings keep meaning what they meant.
--
-- Safe to apply before the code that writes it is deployed; the code that
-- writes it must not be deployed before this is applied.
--
-- PRE-CHECK: none needed. ADD COLUMN IF NOT EXISTS with no default is a
-- metadata-only change and does not rewrite either table.
-- ============================================================================

ALTER TABLE "PickupStops"
  ADD COLUMN IF NOT EXISTS "expectedDate" date;

ALTER TABLE "BranchStops"
  ADD COLUMN IF NOT EXISTS "expectedDate" date;

COMMENT ON COLUMN "PickupStops"."expectedDate" IS
  'Day this pickup is due (Asia/Manila). NULL: the order''s deliverySchedule, read in route order.';
COMMENT ON COLUMN "BranchStops"."expectedDate" IS
  'Day this delivery is due (Asia/Manila). NULL: the order''s deliverySchedule, read in route order.';

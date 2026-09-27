-- The day a delivery was asked for, as a column.
--
-- One additive column plus a backfill. Nothing is removed and nothing existing
-- changes behaviour, because the note is still written as well.
--
-- WHY
--
-- A booking asks for a time of day and a date. The time is a real column,
-- BranchStops.expectedTime. The date has only ever been a line of text inside
-- Order.notes - "Delivery Schedule: 2026-09-30" - and six screens read it back
-- out with a regular expression.
--
-- That was survivable while the date was only ever displayed. It stopped being
-- survivable when punctuality started depending on it: whether a stop was late
-- is now decided by that date, and a scheduling fact that lives one stray
-- newline away from vanishing is not one to decide somebody's performance on.
--
-- The note is still written, so every existing screen keeps working untouched.
-- Nothing has to be migrated in a hurry, and the screens can move to the column
-- whenever their owner wants to.
--
-- WHAT THE BACKFILL WILL AND WILL NOT FIND
--
-- Only 24 of 2,065 bookings carry a parseable date, because the rest are seeded
-- rows that never had one. Those 2,041 stay null, which is the honest answer:
-- there is no scheduled date to recover, and punctuality correctly reports that
-- it cannot judge them rather than inventing a date from when the crew finished.

BEGIN;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliverySchedule" date;

COMMENT ON COLUMN "Order"."deliverySchedule" IS
  'The day the delivery was asked for. Also kept as "Delivery Schedule" in notes for the screens that still read it there.';

-- Lift whatever the notes already hold. Anything that is not a plain
-- YYYY-MM-DD is left alone rather than guessed at.
UPDATE "Order"
SET "deliverySchedule" = (substring("notes" FROM 'Delivery Schedule:[ \t]*(\d{4}-\d{2}-\d{2})'))::date
WHERE "deliverySchedule" IS NULL
  AND "notes" ~ 'Delivery Schedule:[ \t]*\d{4}-\d{2}-\d{2}';

-- Punctuality reads this for every stop on a trip, so it is worth an index.
CREATE INDEX IF NOT EXISTS order_delivery_schedule_idx
  ON "Order" ("deliverySchedule")
  WHERE "deliverySchedule" IS NOT NULL;

COMMIT;

-- AFTERWARDS
--   SELECT count(*) AS with_date FROM "Order" WHERE "deliverySchedule" IS NOT NULL;
-- Expect about 24. Everything booked from now on will have one, because
-- bookingService writes the column as well as the note.

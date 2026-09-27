-- Why a trip was turned down, as something a figure can be fair about.
--
-- Two additive columns. The free-text reason stays exactly as it is, and every
-- screen that shows it keeps working.
--
-- WHY
--
-- Declining a trip lowers the crew's completion figure, and it should: a trip
-- nobody would take still had to go out. But as it stands a driver who refused
-- an unsafe truck is marked down exactly as far as one who could not be
-- bothered, and that is the single most likely thing to make a crew decide the
-- whole rating is rigged. It also teaches the wrong lesson - the driver who
-- takes the brakeless truck rather than lose a star.
--
-- The free text cannot settle it. "Brakes" and "brakes are gone" and "unsafe"
-- are the same reason typed three ways, and no figure can be computed from that.
-- So the crew pick a reason as well as typing one, and three of the choices are
-- taken out of the figure entirely:
--
--   unsafe_truck       the truck was not fit to drive       not counted
--   unwell             the crew were not fit to drive       not counted
--   licence_mismatch   wrong licence class for the load     not counted
--   already_committed  double-booked                        counted
--   personal           anything else of their own           counted
--   other              counted, and the typed reason is all there is
--
-- The three that are not counted are exactly the three the company wants
-- reported. Refusing an unsafe truck is the crew doing their job, and it belongs
-- beside a breakdown and a stall alert with the other things that are recorded
-- and never scored.
--
-- Old rows stay null and are counted as before, because there is no honest way
-- to decide now what somebody meant by "cannot" eighteen months ago.

BEGIN;

ALTER TABLE "DispatchOrder"
  ADD COLUMN IF NOT EXISTS "declineCode" text
    CHECK ("declineCode" IS NULL OR "declineCode" IN (
      'unsafe_truck', 'unwell', 'licence_mismatch', 'already_committed', 'personal', 'other'));

ALTER TABLE "DispatchHelper"
  ADD COLUMN IF NOT EXISTS "declineCode" text
    CHECK ("declineCode" IS NULL OR "declineCode" IN (
      'unsafe_truck', 'unwell', 'licence_mismatch', 'already_committed', 'personal', 'other'));

COMMENT ON COLUMN "DispatchOrder"."declineCode" IS
  'Why the driver turned the trip down. unsafe_truck, unwell and licence_mismatch are left out of the completion figure; see app/lib/performance.ts.';
COMMENT ON COLUMN "DispatchHelper"."declineCode" IS
  'Why the helper turned the trip down. Same codes and same treatment as the driver.';

COMMIT;

-- AFTERWARDS
--   SELECT "declineCode", count(*) FROM "DispatchOrder"
--   WHERE "status" = 'Rejected' GROUP BY 1;
-- Expect every existing row to be null: the eleven declines on record predate
-- the codes and keep being counted the way they always were.

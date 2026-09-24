-- Employee.availability holds only what an admin decides.
--
-- Availability is now worked out from live trips (Booked, In Transit) when
-- employees are read, and the stored column is no longer written by a
-- dispatch. But it still carried trip states from before that change, and the
-- states an admin sets - On Leave, Unavailable - were being ignored
-- everywhere: someone on leave read as "Available" and was offered for
-- assignment.
--
-- From here the column means one thing: can this person be given work at all.
--
-- Apply BEFORE deploying the code that reads it this way. Otherwise the rows
-- still reading "On Delivery" below would count as not assignable, and those
-- twelve people would disappear from the crew pickers.

BEGIN;

-- 1. Trip states left in the column. Their trips are long finished; what the
-- person is doing now is calculated, so these mean "nothing set".
UPDATE "Employee"
SET "availability" = 'Available'
WHERE "availability" IS NULL
   OR "availability" NOT IN ('Available', 'On Leave', 'Unavailable');

-- 2. Only an admin's decision can be stored here from now on.
ALTER TABLE "Employee" ALTER COLUMN "availability" SET DEFAULT 'Available';
ALTER TABLE "Employee" ALTER COLUMN "availability" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_availability_manual_only') THEN
    ALTER TABLE "Employee" ADD CONSTRAINT employee_availability_manual_only
      CHECK ("availability" IN ('Available', 'On Leave', 'Unavailable'));
  END IF;
END $$;

COMMENT ON COLUMN "Employee"."availability" IS
  'What an admin set: Available, On Leave or Unavailable. Booked and In Transit are calculated from live dispatches, never stored.';

COMMIT;

-- AFTERWARDS
--   SELECT "availability", count(*) FROM "Employee" GROUP BY 1 ORDER BY 1;
-- Only Available, On Leave and Unavailable, with the 2 on leave and the 1
-- unavailable untouched.

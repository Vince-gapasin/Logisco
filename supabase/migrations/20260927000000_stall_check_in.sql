-- Letting the crew answer when we ask why they have gone quiet.
--
-- One additive table. Nothing existing is altered.
--
-- WHY THIS IS NEEDED AND NOT OPTIONAL
--
-- The thirty-minute alert already tells the office that "the crew have been
-- asked to get in touch". Until now there was no way for them to answer, so the
-- office was told to expect a confirmation that could never arrive.
--
-- The stronger reason is the law. Article 85 of the Labor Code requires at least
-- sixty minutes of uninterrupted time off for a meal. The crew app reports only
-- when the truck moves, so every lawful lunch break looks exactly like a
-- breakdown - and it lasts longer than the fifteen, thirty and forty-five
-- minute rungs put together. Without a way for a driver to say "I am on my
-- break", the urgent alert fires every single working day, at lunchtime, for
-- every truck that is not parked within 200 m of one of its own stops. An alarm
-- that is wrong every day at noon is one nobody reads by the end of the week.
--
-- So the crew can say what is happening, and what they say decides whether the
-- ladder keeps climbing:
--
--   on_break, traffic, waiting, loading   quietens the alert for a while
--   vehicle_problem, need_help            escalates it at once
--
-- A check-in never silences anything for good. It buys a stated number of
-- minutes (see CHECK_IN_QUIETENS_MIN in app/lib/stallRules.ts), after which the
-- silence is raised again - because "I am in traffic" two hours ago is not an
-- answer about now.

BEGIN;

CREATE TABLE IF NOT EXISTS "StallCheckIn" (
  "checkInID"   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatchID"  uuid NOT NULL REFERENCES "DispatchOrder" ("dispatchID") ON DELETE CASCADE,
  -- Who answered. A helper may answer for the trip; both are on the truck.
  "employeeID"  uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,

  "state"       text NOT NULL CHECK ("state" IN (
                  'on_break',         -- a meal or rest break
                  'traffic',
                  'waiting',          -- held at a gate, or by the client
                  'loading',          -- loading or unloading
                  'vehicle_problem',  -- the truck has trouble: escalates
                  'need_help')),      -- escalates, hard
  "note"        text,

  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

-- Every check-in is kept rather than overwritten: the sequence of them is the
-- story of the trip, and one that reads "traffic, traffic, vehicle_problem" is
-- worth more than whichever came last. The lookup only ever wants the newest.
CREATE INDEX IF NOT EXISTS stall_check_in_latest_idx
  ON "StallCheckIn" ("dispatchID", "createdAt" DESC);

ALTER TABLE "StallCheckIn" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "StallCheckIn" IS
  'What the crew said when asked why their truck had gone quiet. Quietens or escalates the stall ladder; never silences it for good.';

COMMIT;

-- AFTERWARDS
--   SELECT count(*) FROM "StallCheckIn";   -- expect 0
--
-- Nothing is backfilled: there is no honest way to say what a crew would have
-- answered about a silence last year.

-- Employee performance: what the client said, and what was not the crew's fault.
--
-- Two additive tables. Nothing existing is altered.
--
-- Apply this BEFORE deploying the code that reads them. The performance screen
-- reads both on every load and fails loudly without them, rather than reporting
-- an empty result that looks the same as nobody having answered.
--
-- WHY THESE TWO AND NOTHING ELSE
--
-- Almost everything a performance summary needs is already recorded. Trips
-- taken, declined and finished are on DispatchOrder; stop times are on
-- BranchStops ("expectedTime" is set on all 2,065 of them, "completedAt" on
-- 1,746); proof is on POD; breakdowns are on FoulTripIncident; when somebody
-- was assigned and when they answered are in AuditTrail (ASSIGN, CREW_ACCEPT).
-- None of that needs a new column, and a stored rating would only go stale.
-- The rating is worked out on read, from these facts.
--
-- What is genuinely missing is two things the system cannot observe.
--
-- 1. What the client thought. Nobody has ever been asked.
--
-- 2. Whether a late arrival was the crew's doing. The system sees only that a
--    stop was late. A client who kept the truck waiting an hour at the gate and
--    a driver who set off late look identical in the data, and scoring them
--    identically is the fastest way to make the whole thing distrusted. So a
--    coordinator can put a late stop aside, with a reason, on the record.
--
-- Both tables are written through the server (service key), so row-level
-- security is enabled with no policies: nothing reaches them from the browser.

BEGIN;

-- ----------------------------------------------------------------------------
-- What the client said
-- ----------------------------------------------------------------------------
-- Two yes/no questions, not stars.
--
-- Stars invite a client to re-score things the system already measures, and
-- measures better: whether it arrived on time is a timestamp, not an opinion.
-- What only the client can tell us is whether the goods turned up intact and
-- whether the crew behaved well. Two questions get answered; five do not.
--
-- One answer per trip, so a second submission on the same link corrects the
-- first rather than stuffing the ballot.

CREATE TABLE IF NOT EXISTS "DeliveryFeedback" (
  "feedbackID"      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatchID"      uuid NOT NULL UNIQUE REFERENCES "DispatchOrder" ("dispatchID") ON DELETE CASCADE,
  "orderID"         uuid NOT NULL REFERENCES "Order" ("orderID") ON DELETE CASCADE,

  -- The two questions.
  "goodCondition"   boolean NOT NULL,
  "courteous"       boolean NOT NULL,
  -- Optional, and the most useful part of the whole thing when it is filled in.
  "comment"         text,

  "submittedAt"     timestamptz NOT NULL DEFAULT now(),

  -- Where the answer came from. A client who phones the office instead of
  -- clicking the link still counts, but it should be visible that staff typed
  -- it in, and who.
  "source"          text NOT NULL DEFAULT 'tracking_link'
    CHECK ("source" IN ('tracking_link', 'office')),
  "recordedBy"      uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,

  CONSTRAINT feedback_office_entry_names_staff
    CHECK ("source" <> 'office' OR "recordedBy" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS feedback_order_idx ON "DeliveryFeedback" ("orderID");
CREATE INDEX IF NOT EXISTS feedback_submitted_idx ON "DeliveryFeedback" ("submittedAt" DESC);

ALTER TABLE "DeliveryFeedback" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "DeliveryFeedback" IS
  'One client answer per completed trip: goods intact, crew courteous, optional comment. Asked through the tracking link.';

-- ----------------------------------------------------------------------------
-- A delay that was not the crew's fault
-- ----------------------------------------------------------------------------
-- A coordinator takes one late stop out of the punctuality figure and says why.
--
-- One row per stop, and the reason is required: an excuse nobody has to justify
-- is an excuse that gets handed to whoever complains loudest. Who granted it is
-- kept so the pattern can be audited, because this is the obvious thing to
-- abuse.

CREATE TABLE IF NOT EXISTS "StopDelayExcuse" (
  "excuseID"   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchID"   integer NOT NULL UNIQUE REFERENCES "BranchStops" ("branchID") ON DELETE CASCADE,

  "reason"     text NOT NULL CHECK ("reason" IN (
                 'client_not_ready',      -- kept waiting at the gate
                 'loading_delay',         -- held up at the warehouse
                 'truck_breakdown',
                 'weather',
                 'road_closure',
                 'office_changed_plan',   -- our own doing: re-sequenced, added a stop
                 'other')),
  -- Required for 'other', because "other" on its own explains nothing.
  "notes"      text,

  "excusedBy"  uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "excusedAt"  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT excuse_other_is_explained
    CHECK ("reason" <> 'other' OR ("notes" IS NOT NULL AND length(btrim("notes")) > 0))
);

CREATE INDEX IF NOT EXISTS excuse_granted_by_idx ON "StopDelayExcuse" ("excusedBy", "excusedAt" DESC);

ALTER TABLE "StopDelayExcuse" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "StopDelayExcuse" IS
  'A late stop a coordinator put aside, with a reason. Removes it from the crew punctuality figure; never deletes the stop time itself.';

COMMIT;

-- AFTERWARDS
--   SELECT count(*) FROM "DeliveryFeedback";   -- expect 0: nobody has been asked yet
--   SELECT count(*) FROM "StopDelayExcuse";    -- expect 0
--
-- Nothing is backfilled, on purpose. There is no honest way to invent a client
-- answer for a delivery made last year, and marking old delays excused after
-- the fact would be inventing the reason too. Both tables fill from today
-- forward; until they do, the performance screen says which figures rest on
-- them and how thin they are.

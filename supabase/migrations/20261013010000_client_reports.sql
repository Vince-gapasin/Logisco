-- A client reporting a problem with their delivery, at any point.
--
-- WHAT WAS WRONG
--
-- The only thing a client could send from their tracking page was the two
-- feedback questions, and those appear once the delivery is finished. A
-- client whose truck was hours late, whose crew was rude at the gate, or whose
-- goods arrived broken had nowhere to say so but a phone call - and nothing
-- recorded that they had complained, or what the office did about it.
--
-- Now the tracking page has a "Report a problem" button at every stage. The
-- report lands here, the office is notified, and the Client Reports screen
-- (/admindashboard/client-reports) is where they resolve it. The reply they
-- write is shown back to the client on the same tracking page.
--
--   status  open      sent by the client, nobody has dealt with it yet
--           resolved  the office dealt with it; resolutionNote says how

BEGIN;

CREATE TABLE IF NOT EXISTS "ClientReport" (
  "reportID"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderID"         uuid NOT NULL REFERENCES "Order" ("orderID") ON DELETE CASCADE,
  -- The trip the booking was on when the client wrote. Null before a crew is
  -- assigned; a complaint about a booking is still a complaint.
  "dispatchID"      uuid REFERENCES "DispatchOrder" ("dispatchID") ON DELETE SET NULL,
  "category"        text NOT NULL CHECK ("category" IN ('late', 'damaged', 'crew', 'wrong_stop', 'billing', 'other')),
  "message"         text NOT NULL CHECK (length(trim("message")) > 0),
  -- How the client would like to be reached, if not the details on the booking.
  "contactBack"     text,
  "status"          text NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'resolved')),
  "resolvedBy"      uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "resolvedAt"      timestamptz,
  -- The office's reply. The client reads it on their tracking page.
  "resolutionNote"  text,
  "source"          text NOT NULL DEFAULT 'tracking_link',
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  -- Resolved means somebody said how.
  CONSTRAINT clientreport_resolution_check
    CHECK ("status" = 'open' OR coalesce(trim("resolutionNote"), '') <> '')
);

-- The office's queue: open reports, oldest first.
CREATE INDEX IF NOT EXISTS clientreport_open_idx
  ON "ClientReport" ("createdAt") WHERE "status" = 'open';
-- The tracking page: this booking's reports.
CREATE INDEX IF NOT EXISTS clientreport_order_idx ON "ClientReport" ("orderID", "createdAt" DESC);

-- Reached only through the server, like every other table here.
ALTER TABLE "ClientReport" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- AFTERWARDS
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'ClientReport';
-- Twelve rows.
--
-- What is waiting:
--   SELECT count(*) FROM "ClientReport" WHERE "status" = 'open';

-- Pickups become real rows, and stop progress becomes real timestamps.
--
-- Two problems, one cause: the itinerary was only half stored.
--
-- 1. PICKUPS WERE NEVER SAVED.
--    The booking form collects a list of pickups - warehouse, address,
--    contact, time - but only the first one was ever written, and only as
--    a line of prose inside Order.notes:
--
--      Pickup: Pacific Harvest Main Office @ 08:00
--
--    Four screens then re-parse that line with a regular expression, and
--    the crew API gives up entirely and returns the literal string
--    "Warehouse / Depot" as the pickup address. A driver is told to collect
--    the cargo from "Warehouse / Depot". Every pickup after the first is
--    silently discarded on save.
--
-- 2. PROGRESS WAS A NUMBER FROM THE BROWSER.
--    DispatchOrder.current_step is an index into a list the crew app builds
--    in memory. Nothing links it to a stop. Reorder the stops, add one, or
--    open the trip on a second phone, and the same number points somewhere
--    else. The admin dashboard reads current_step = 1 as "heading to
--    warehouse" purely by convention.
--
-- This migration gives both a home in the database. It is additive: no
-- column is dropped and no existing row is deleted, so the current code
-- keeps working until the new code is deployed.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PICKUP STOPS
-- ----------------------------------------------------------------------------
-- Mirrors BranchStops, which is the delivery half of the same itinerary.

CREATE TABLE IF NOT EXISTS "PickupStops" (
  "pickupID"      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "orderID"       uuid NOT NULL REFERENCES "Order" ("orderID") ON DELETE CASCADE,
  "dispatchID"    uuid REFERENCES "DispatchOrder" ("dispatchID") ON DELETE SET NULL,
  "warehouseID"   uuid REFERENCES "Warehouse" ("warehouseID") ON DELETE SET NULL,
  "warehouseName" text NOT NULL,
  "pickupAddress" text,
  "contactPerson" text,
  "contactNum"    text,
  "expectedTime"  time,
  "pickupLat"     double precision,
  "pickupLong"    double precision,
  "sequence"      integer NOT NULL DEFAULT 1,
  "stopStatus"    stop_status NOT NULL DEFAULT 'Pending',
  "arrivedAt"     timestamptz,
  "completedAt"   timestamptz,
  "createdAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickupstops_orderid_idx    ON "PickupStops" ("orderID");
CREATE INDEX IF NOT EXISTS pickupstops_dispatchid_idx ON "PickupStops" ("dispatchID");

ALTER TABLE "PickupStops" ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. DELIVERY STOPS GAIN AN ADDRESS AND A PLACE IN THE ORDER
-- ----------------------------------------------------------------------------
-- BranchStops stores a branch name and coordinates but never the address it
-- was geocoded from, so a stop that fails to geocode leaves nothing to
-- retry with and nothing to show the driver.
--
-- "sequence" is the itinerary position. Ordering by branchID happened to
-- work only because stops are inserted together; it is not the same thing.

ALTER TABLE "BranchStops"
  ADD COLUMN IF NOT EXISTS "deliveryAddress" text,
  ADD COLUMN IF NOT EXISTS "sequence"        integer,
  ADD COLUMN IF NOT EXISTS "arrivedAt"       timestamptz,
  ADD COLUMN IF NOT EXISTS "completedAt"     timestamptz;

-- Existing stops: keep the order they are displayed in today.
UPDATE "BranchStops" b
SET "sequence" = ranked.position
FROM (
  SELECT
    o."orderID",
    o."clientID",
    -- [^\n]* and not (.*): in Postgres "." matches a newline, so (.*)
    -- here swallowed the whole rest of the note - the delivery branch, the
    -- reference, the crew - into the warehouse name.
    btrim(split_part(substring(o.notes FROM 'Pickup:[ \t]*([^\n]*)'), '@', 1)) AS place,
    btrim(split_part(substring(o.notes FROM 'Pickup:[ \t]*([^\n]*)'), '@', 2)) AS at_time,
    -- Most notes carry the address on its own line below the name.
    btrim(coalesce(substring(o.notes FROM 'Pickup Address:[ \t]*([^\n]*)'), '')) AS addr
  FROM "Order" o
  WHERE o.notes ~ 'Pickup:[ \t]*\S'
) AS parsed
LEFT JOIN "Warehouse" w
  ON w."clientID" = parsed."clientID"
 AND (lower(btrim(w."whName")) = lower(parsed.place)
   OR lower(btrim(w."warehouseLoc")) = lower(parsed.place))
WHERE parsed.place <> ''
  AND parsed.place NOT IN ('undefined', 'null', 'N/A')
  AND NOT EXISTS (
    SELECT 1 FROM "PickupStops" p WHERE p."orderID" = parsed."orderID"
  );

COMMIT;

-- ----------------------------------------------------------------------------
-- AFTERWARDS: how much matched a real warehouse
-- ----------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE "warehouseID" IS NOT NULL) AS linked,
--          count(*) FILTER (WHERE "warehouseID" IS NULL)     AS text_only,
--          count(*)                                          AS total
--   FROM "PickupStops";
--
-- text_only rows are orders whose note named a place that is not one of
-- that client's warehouses. They keep the text and are still shown; they
-- simply have no coordinates until someone edits the booking.

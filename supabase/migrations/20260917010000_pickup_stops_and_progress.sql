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
  SELECT "branchID",
         ROW_NUMBER() OVER (PARTITION BY "orderID" ORDER BY "branchID") AS position
  FROM "BranchStops"
) AS ranked
WHERE b."branchID" = ranked."branchID"
  AND b."sequence" IS NULL;

-- Stops already marked delivered get a completion time, so the history
-- screens have something to show rather than a blank column.
UPDATE "BranchStops" b
SET "completedAt" = d."completedAt"
FROM "DispatchOrder" d
WHERE d."orderID" = b."orderID"
  AND b."completedAt" IS NULL
  AND d."completedAt" IS NOT NULL
  AND b."stopStatus" = 'Successfully Delivered';

CREATE INDEX IF NOT EXISTS branchstops_order_sequence_idx
  ON "BranchStops" ("orderID", "sequence");

-- ----------------------------------------------------------------------------
-- 3. THE PICKUP LEG OF A DISPATCH
-- ----------------------------------------------------------------------------
-- Set when the crew reports the cargo loaded. Until now this was
-- current_step = 1 and nothing else.

ALTER TABLE "DispatchOrder"
  ADD COLUMN IF NOT EXISTS "pickupCompletedAt" timestamptz;

UPDATE "DispatchOrder"
SET "pickupCompletedAt" = COALESCE("completedAt", now())
WHERE "pickupCompletedAt" IS NULL
  AND current_step >= 1;

-- ----------------------------------------------------------------------------
-- 4. BACKFILL THE PICKUPS OUT OF Order.notes
-- ----------------------------------------------------------------------------
-- The note line is "Pickup: <warehouse or address> @ <time>". The part
-- before the "@" is matched against the client's own warehouses by name and
-- then by address; whatever fails to match is still kept as free text, so
-- no order loses its pickup.

INSERT INTO "PickupStops" (
  "orderID", "warehouseID", "warehouseName", "pickupAddress",
  "contactPerson", "contactNum", "expectedTime", "sequence"
)
SELECT
  parsed."orderID",
  w."warehouseID",
  COALESCE(w."whName", parsed.place),
  COALESCE(w."warehouseLoc", parsed.place),
  w."contactPerson",
  w."contactNum",
  CASE
    WHEN parsed.at_time ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$' THEN parsed.at_time::time
    ELSE NULL
  END,
  1
FROM (
  SELECT
    o."orderID",
    o."clientID",
    btrim(split_part(substring(o.notes FROM 'Pickup:\s*(.*)'), '@', 1)) AS place,
    btrim(split_part(substring(o.notes FROM 'Pickup:\s*(.*)'), '@', 2)) AS at_time
  FROM "Order" o
  WHERE o.notes ~ 'Pickup:\s*\S'
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

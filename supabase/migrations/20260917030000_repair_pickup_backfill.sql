-- Repair the pickup backfill.
--
-- The backfill in 20260917010000 parsed the pickup out of Order.notes with
--
--   substring(o.notes FROM 'Pickup:\s*(.*)')
--
-- In Postgres regular expressions "." matches a newline. The notes are a
-- multi-line block:
--
--   Pickup: Batangas Beverage Main Plant
--   Pickup Address: JP Laurel Highway, Lipa City, Batangas
--   Delivery: Batangas Beverage Warehouse
--   Delivery Address: Lipa City, Batangas
--   Reference: OPS-HIST-01
--
-- so (.*) captured all five lines, and since none of them contains an "@"
-- the whole block ended up in "warehouseName". Roughly 2040 of the 2041
-- backfilled rows are affected.
--
-- Two things are fixed here. The name is re-read from the first line only,
-- and the address is taken from the "Pickup Address" line, which the
-- original backfill never looked at - so these rows gain a real address
-- rather than repeating the name.
--
-- Only backfilled rows are touched: a pickup saved by the application has a
-- warehouseID, or a name with no line break in it and an address of its own.
-- Safe to run more than once.
--
-- If 20260917010000 has not been applied yet, apply its corrected version
-- instead and skip this file - it does the right thing on the first pass.

BEGIN;

WITH parsed AS (
  SELECT
    o."orderID",
    o."clientID",
    btrim(split_part(substring(o.notes FROM 'Pickup:[ \t]*([^\n]*)'), '@', 1)) AS place,
    btrim(split_part(substring(o.notes FROM 'Pickup:[ \t]*([^\n]*)'), '@', 2)) AS at_time,
    btrim(coalesce(substring(o.notes FROM 'Pickup Address:[ \t]*([^\n]*)'), '')) AS addr
  FROM "Order" o
  WHERE o.notes ~ 'Pickup:[ \t]*\S'
)
UPDATE "PickupStops" p
SET
  "warehouseName" = COALESCE(w."whName", parsed.place),
  "pickupAddress" = COALESCE(w."warehouseLoc", NULLIF(parsed.addr, ''), parsed.place),
  "warehouseID"   = COALESCE(p."warehouseID", w."warehouseID"),
  "contactPerson" = COALESCE(p."contactPerson", w."contactPerson"),
  "contactNum"    = COALESCE(p."contactNum", w."contactNum"),
  "expectedTime"  = COALESCE(
    p."expectedTime",
    CASE
      WHEN parsed.at_time ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$' THEN parsed.at_time::time
      ELSE NULL
    END
  )
FROM parsed
LEFT JOIN "Warehouse" w
  ON w."clientID" = parsed."clientID"
 AND (lower(btrim(w."whName")) = lower(parsed.place)
   OR lower(btrim(w."warehouseLoc")) = lower(parsed.place))
WHERE p."orderID" = parsed."orderID"
  AND parsed.place <> ''
  -- Only the rows the buggy parse produced.
  AND p."warehouseName" LIKE '%' || chr(10) || '%';

COMMIT;

-- ----------------------------------------------------------------------------
-- AFTERWARDS: nothing should be left spanning several lines
-- ----------------------------------------------------------------------------
--   SELECT
--     count(*) FILTER (WHERE "warehouseName" LIKE '%' || chr(10) || '%') AS still_broken,
--     count(*) FILTER (WHERE "pickupAddress" IS NOT NULL)                AS has_address,
--     count(*) FILTER (WHERE "warehouseID" IS NOT NULL)                  AS linked,
--     count(*)                                                            AS total
--   FROM "PickupStops";
--
-- still_broken must be 0. linked stays low: the warehouse names in these
-- historical notes belong to a different set of companies than the Warehouse
-- table holds, so there is genuinely nothing for them to link to. They keep
-- their name and address as text and display normally.

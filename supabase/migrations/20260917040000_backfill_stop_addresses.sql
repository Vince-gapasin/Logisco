-- Give the historical delivery stops the address they were always missing.
--
-- BranchStops.deliveryAddress was added in 20260917010000 and is populated
-- for new bookings only, so all 2041 existing stops hold NULL and the crew
-- app falls back to showing a branch name where an address belongs.
--
-- The address is sitting in Order.notes and has been all along:
--
--   Pickup: Batangas Beverage Main Plant
--   Pickup Address: JP Laurel Highway, Lipa City, Batangas
--   Delivery: Batangas Beverage Warehouse
--   Delivery Address: Lipa City, Batangas          <-- this line
--   Reference: OPS-HIST-01
--
-- A note carries one delivery address and every existing order has exactly
-- one stop, so the mapping is unambiguous. The guard below keeps it that
-- way: an order with more than one stop is skipped rather than having the
-- same address written to all of them.
--
-- Only fills blanks. Safe to run more than once.

BEGIN;

WITH parsed AS (
  SELECT
    o."orderID",
    btrim(substring(o.notes FROM 'Delivery Address:[ \t]*([^\n]*)')) AS addr
  FROM "Order" o
  WHERE o.notes ~ 'Delivery Address:[ \t]*\S'
),
single_stop AS (
  SELECT "orderID"
  FROM "BranchStops"
  GROUP BY "orderID"
  HAVING count(*) = 1
)
UPDATE "BranchStops" b
SET "deliveryAddress" = parsed.addr
FROM parsed
JOIN single_stop ON single_stop."orderID" = parsed."orderID"
WHERE b."orderID" = parsed."orderID"
  AND parsed.addr <> ''
  AND b."deliveryAddress" IS NULL;

COMMIT;

-- ----------------------------------------------------------------------------
-- AFTERWARDS
-- ----------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE "deliveryAddress" IS NOT NULL) AS with_address,
--          count(*)                                              AS total
--   FROM "BranchStops";
--
-- Stops still without one are orders whose notes never carried the line, or
-- orders with more than one stop. They keep showing the branch name, which
-- is what every stop showed before this.

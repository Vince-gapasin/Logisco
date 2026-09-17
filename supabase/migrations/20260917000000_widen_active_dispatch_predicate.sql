-- Widen the "one active dispatch per truck/driver" guard.
--
-- The original predicate listed only Pending, Assigned, Accepted and
-- In Transit. The delivery_status enum also contains Start Delivery,
-- In Warehouse and Arrived, which are just as much "the truck is out on a
-- trip" as In Transit is. While a dispatch sat in one of those three, the
-- index stopped matching it and the same truck or driver could be assigned
-- to a second booking.
--
-- app/lib/enums.ts (ACTIVE_DELIVERY_STATUSES) now lists all seven. This
-- brings the database in line with it.
--
-- PRE-CHECK: run this first. It must return zero rows, otherwise the
-- CREATE UNIQUE INDEX below fails and nothing is applied.
--
--   SELECT "truckID", COUNT(*) FROM "DispatchOrder"
--   WHERE status IN ('Pending','Assigned','Accepted','Start Delivery',
--                    'In Warehouse','In Transit','Arrived')
--   GROUP BY "truckID" HAVING COUNT(*) > 1;
--
--   SELECT "driverID", COUNT(*) FROM "DispatchOrder"
--   WHERE status IN ('Pending','Assigned','Accepted','Start Delivery',
--                    'In Warehouse','In Transit','Arrived')
--   GROUP BY "driverID" HAVING COUNT(*) > 1;
--
-- If either returns rows, close or cancel the duplicates before applying.

BEGIN;

DROP INDEX IF EXISTS dispatchorder_one_active_per_truck;
DROP INDEX IF EXISTS dispatchorder_one_active_per_driver;

CREATE UNIQUE INDEX dispatchorder_one_active_per_truck
  ON "DispatchOrder" ("truckID")
  WHERE status IN (
    'Pending', 'Assigned', 'Accepted',
    'Start Delivery', 'In Warehouse', 'In Transit', 'Arrived'
  );

CREATE UNIQUE INDEX dispatchorder_one_active_per_driver
  ON "DispatchOrder" ("driverID")
  WHERE status IN (
    'Pending', 'Assigned', 'Accepted',
    'Start Delivery', 'In Warehouse', 'In Transit', 'Arrived'
  );

COMMIT;

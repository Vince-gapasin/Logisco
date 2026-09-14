-- ============================================================================
-- Logisco: integrity constraints, indexes and Row Level Security
-- ============================================================================
-- Review, then run in the Supabase SQL editor (or `supabase db push`).
-- Forecasting tables (WeatherHistory, FuelPriceHistory, ForecastSnapshot) are
-- deliberately left untouched here.
--
-- Run the PRE-CHECKS first: the unique indexes in section 2 fail if existing
-- data already violates them (e.g. a truck stuck on two active dispatches).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. PRE-CHECKS (read-only; each should return zero rows)
-- ----------------------------------------------------------------------------
-- Trucks on more than one active dispatch:
--   SELECT "truckID", count(*) FROM "DispatchOrder"
--   WHERE status IN ('Pending','Assigned','Accepted','In Transit')
--   GROUP BY "truckID" HAVING count(*) > 1;
--
-- Drivers on more than one active dispatch:
--   SELECT "driverID", count(*) FROM "DispatchOrder"
--   WHERE status IN ('Pending','Assigned','Accepted','In Transit')
--   GROUP BY "driverID" HAVING count(*) > 1;
--
-- Helpers assigned twice to the same dispatch:
--   SELECT "dispatchID", "helperID", count(*) FROM "DispatchHelper"
--   GROUP BY 1, 2 HAVING count(*) > 1;


BEGIN;

-- ----------------------------------------------------------------------------
-- 1. INDEXES on foreign keys and hot filters
-- ----------------------------------------------------------------------------
-- Postgres does not index foreign keys automatically; every crew/admin screen
-- filters on these columns.

CREATE INDEX IF NOT EXISTS dispatchorder_driverid_idx   ON "DispatchOrder" ("driverID");
CREATE INDEX IF NOT EXISTS dispatchorder_truckid_idx    ON "DispatchOrder" ("truckID");
CREATE INDEX IF NOT EXISTS dispatchorder_orderid_idx    ON "DispatchOrder" ("orderID");
CREATE INDEX IF NOT EXISTS dispatchorder_status_idx     ON "DispatchOrder" (status);

CREATE INDEX IF NOT EXISTS dispatchhelper_dispatchid_idx ON "DispatchHelper" ("dispatchID");
CREATE INDEX IF NOT EXISTS dispatchhelper_helperid_idx   ON "DispatchHelper" ("helperID");

CREATE INDEX IF NOT EXISTS branchstops_orderid_idx      ON "BranchStops" ("orderID");
CREATE INDEX IF NOT EXISTS branchstops_dispatchid_idx   ON "BranchStops" ("dispatchID");
CREATE INDEX IF NOT EXISTS orderdetails_orderid_idx     ON "OrderDetails" ("orderID");
CREATE INDEX IF NOT EXISTS order_clientid_idx           ON "Order" ("clientID");
CREATE INDEX IF NOT EXISTS pod_branchid_idx             ON "POD" ("branchID");
CREATE INDEX IF NOT EXISTS reports_dispatchid_idx       ON "Reports" ("dispatchID");

CREATE INDEX IF NOT EXISTS historylogsm_truckid_idx     ON "HistoryLogsM" ("truckID");
CREATE INDEX IF NOT EXISTS historylogsm_created_at_idx  ON "HistoryLogsM" (created_at DESC);
CREATE INDEX IF NOT EXISTS logmechanics_logid_idx       ON "LogMechanics" ("logID");
CREATE INDEX IF NOT EXISTS lognotes_logid_idx           ON "LogNotes" ("logID");
CREATE INDEX IF NOT EXISTS logphotos_logid_idx          ON "LogPhotos" ("logID");

CREATE INDEX IF NOT EXISTS employee_role_idx            ON "Employee" (role);
CREATE INDEX IF NOT EXISTS truck_status_idx             ON "Truck" ("truckStatus") WHERE "isActive";


-- ----------------------------------------------------------------------------
-- 2. DOUBLE-BOOKING PROTECTION
-- ----------------------------------------------------------------------------
-- The app checks availability before assigning, but two coordinators can
-- still race. These partial unique indexes make the database refuse a second
-- active dispatch for the same truck or driver.

CREATE UNIQUE INDEX IF NOT EXISTS dispatchorder_one_active_per_truck
  ON "DispatchOrder" ("truckID")
  WHERE status IN ('Pending', 'Assigned', 'Accepted', 'In Transit');

CREATE UNIQUE INDEX IF NOT EXISTS dispatchorder_one_active_per_driver
  ON "DispatchOrder" ("driverID")
  WHERE status IN ('Pending', 'Assigned', 'Accepted', 'In Transit');

CREATE UNIQUE INDEX IF NOT EXISTS dispatchhelper_unique_helper
  ON "DispatchHelper" ("dispatchID", "helperID");


-- ----------------------------------------------------------------------------
-- 3. CHECK CONSTRAINTS for values the app must never write
-- ----------------------------------------------------------------------------
-- NOT VALID: enforced for new writes without scanning existing rows. Run
-- `ALTER TABLE ... VALIDATE CONSTRAINT ...` later once old data is clean.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatchorder_current_step_nonnegative') THEN
    ALTER TABLE "DispatchOrder" ADD CONSTRAINT dispatchorder_current_step_nonnegative CHECK (current_step >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'truck_capacity_nonnegative') THEN
    ALTER TABLE "Truck" ADD CONSTRAINT truck_capacity_nonnegative CHECK (capacity >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orderdetails_quantity_positive') THEN
    ALTER TABLE "OrderDetails" ADD CONSTRAINT orderdetails_quantity_positive CHECK (quantity > 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orderdetails_weight_nonnegative') THEN
    ALTER TABLE "OrderDetails" ADD CONSTRAINT orderdetails_weight_nonnegative CHECK ("weightPerItem" >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fleetlocations_lat_range') THEN
    ALTER TABLE "FleetLocations" ADD CONSTRAINT fleetlocations_lat_range CHECK (latitude BETWEEN -90 AND 90) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fleetlocations_long_range') THEN
    ALTER TABLE "FleetLocations" ADD CONSTRAINT fleetlocations_long_range CHECK (longitude BETWEEN -180 AND 180) NOT VALID;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- The anon key is shipped to every browser (NEXT_PUBLIC_SUPABASE_ANON_KEY).
-- With RLS off, anyone holding it can read and write these tables directly
-- through the Supabase REST API, bypassing every check in the app.
--
-- All table access in this codebase goes through server routes using the
-- service-role key, which bypasses RLS, and the browser only uses Supabase
-- Auth. So enabling RLS with no policies locks out direct anon/auth access
-- without affecting the app.

ALTER TABLE "Employee"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubContractor"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Truck"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Maintenance"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderDetails"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchStops"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispatchOrder"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispatchHelper"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryTracking"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "POD"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispatchInterventionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reports"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperationalForecast"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditTrail"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HistoryLogsM"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogMechanics"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogNotes"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogPhotos"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetLocations"          ENABLE ROW LEVEL SECURITY;

COMMIT;

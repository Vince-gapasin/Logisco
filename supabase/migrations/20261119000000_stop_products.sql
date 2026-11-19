-- Several products on every stop: what is loaded at each pickup and what is
-- dropped at each delivery.
--
-- WHAT WAS WRONG
--
-- A booking had one line of free text for its cargo ("Product To Deliver"),
-- saved as a single OrderDetails row, and each stop had one number for how
-- much changed hands there. A booking that collects buns, cake, utensils and
-- biscuits from a warehouse and drops a different mix at each branch could
-- only say "buns, cake, utensils, biscuits" once and "120" per stop. The crew
-- could not see what went where.
--
-- WHAT THIS DOES
--
-- "StopItems": one row per product on one stop - its name, how many, and in
-- what unit (pcs, boxes, trays...). A row belongs to exactly one pickup or one
-- delivery, and goes when its stop or its order goes.
--
-- Nothing existing changes shape. The stop's own "quantity" is still written
-- (the total of its lines) and OrderDetails still gets a row per product, so
-- every screen, report and export that reads those keeps working. Bookings
-- made before this have no StopItems rows and show as they always have.
--
-- APPLY THIS BEFORE DEPLOYING the code that reads StopItems: the booking
-- screens and the crew's trip list ask for it with the stops, and fail
-- without it. Adding the table does not change anything the live app does
-- today, so it can go in ahead of the code.
--
-- Safe to run twice.

BEGIN;

-- StopItems has to point at BranchStops.branchID and PickupStops.pickupID with
-- the same types they have, and BranchStops' is not written down in this
-- repository, so both are read off the tables.
DO $$
DECLARE
  branch_id_type text;
  pickup_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO branch_id_type
  FROM pg_attribute a
  WHERE a.attrelid = '"BranchStops"'::regclass AND a.attname = 'branchID' AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO pickup_id_type
  FROM pg_attribute a
  WHERE a.attrelid = '"PickupStops"'::regclass AND a.attname = 'pickupID' AND NOT a.attisdropped;

  IF to_regclass('"StopItems"') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE "StopItems" (
        "itemID"      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "orderID"     uuid NOT NULL REFERENCES "Order" ("orderID") ON DELETE CASCADE,
        "pickupID"    %s REFERENCES "PickupStops" ("pickupID") ON DELETE CASCADE,
        "branchID"    %s REFERENCES "BranchStops" ("branchID") ON DELETE CASCADE,
        "productName" text NOT NULL,
        "quantity"    integer NOT NULL,
        "unit"        text NOT NULL DEFAULT 'pcs',
        -- The order the office listed them in.
        "position"    smallint NOT NULL DEFAULT 1,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT stop_items_one_stop_check CHECK (("pickupID" IS NULL) <> ("branchID" IS NULL)),
        CONSTRAINT stop_items_name_check CHECK (length(btrim("productName")) BETWEEN 1 AND 120),
        CONSTRAINT stop_items_quantity_check CHECK ("quantity" BETWEEN 1 AND 1000000),
        CONSTRAINT stop_items_unit_check CHECK ("unit" IN ('pcs', 'boxes', 'trays', 'packs', 'crates', 'bags', 'kg'))
      )
    $f$, pickup_id_type, branch_id_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stop_items_order_idx  ON "StopItems" ("orderID");
CREATE INDEX IF NOT EXISTS stop_items_pickup_idx ON "StopItems" ("pickupID") WHERE "pickupID" IS NOT NULL;
CREATE INDEX IF NOT EXISTS stop_items_branch_idx ON "StopItems" ("branchID") WHERE "branchID" IS NOT NULL;

-- Reads and writes go through server routes with the service-role key. With
-- RLS on and no policies, the anon key shipped to browsers gets nothing.
ALTER TABLE "StopItems" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "StopItems" IS
  'Products on one stop: loaded at a pickup (pickupID) or dropped at a delivery (branchID). The stop''s quantity is the total of its rows.';

COMMIT;

-- So the API sees the new table and its links straight away:
NOTIFY pgrst, 'reload schema';

-- AFTERWARDS
--
-- The table is there, empty, with RLS on:
--   SELECT count(*) FROM "StopItems";
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'StopItems';
--
-- After the first booking with products, its lines by stop:
--   SELECT o."orderCode", coalesce(p."warehouseName", b."branchName") AS stop,
--          i."productName", i."quantity", i."unit"
--   FROM "StopItems" i
--   JOIN "Order" o ON o."orderID" = i."orderID"
--   LEFT JOIN "PickupStops" p ON p."pickupID" = i."pickupID"
--   LEFT JOIN "BranchStops" b ON b."branchID" = i."branchID"
--   ORDER BY i."createdAt" DESC, i."position" LIMIT 20;

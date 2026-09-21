-- How much is collected at each pickup and dropped at each delivery.
--
-- The booking forms have always asked for a quantity on every pickup and
-- delivery row, but only the first pickup's was kept (as the order item's
-- quantity); the rest were discarded. Null on rows created before this.
--
-- Apply BEFORE deploying the code that writes these columns: the booking
-- screens read them, and would fail against a database without them.

ALTER TABLE "PickupStops" ADD COLUMN IF NOT EXISTS "quantity" integer;
ALTER TABLE "BranchStops" ADD COLUMN IF NOT EXISTS "quantity" integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pickupstops_quantity_positive') THEN
    ALTER TABLE "PickupStops" ADD CONSTRAINT pickupstops_quantity_positive CHECK ("quantity" IS NULL OR "quantity" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branchstops_quantity_positive') THEN
    ALTER TABLE "BranchStops" ADD CONSTRAINT branchstops_quantity_positive CHECK ("quantity" IS NULL OR "quantity" > 0);
  END IF;
END $$;

-- AFTERWARDS
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('PickupStops', 'BranchStops') AND column_name = 'quantity';
-- Two rows, both integer.

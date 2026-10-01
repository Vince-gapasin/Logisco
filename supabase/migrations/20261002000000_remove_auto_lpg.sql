-- Take Auto-LPG off the list of fuels a truck can be recorded as burning.
--
-- WHY
--
-- It was seeded with the others because it is a real vehicle fuel here. It is
-- the one of them this system cannot price: the DOE's weekly monitoring covers
-- the NCR liquid fuels, and LPG is published separately and in a different
-- shape, so the sync has never read it and was never going to. A truck recorded
-- as Auto-LPG therefore has a fuel type and no fuel price, for ever - which is
-- worse than having neither, because a costing that quietly skips it looks like
-- a costing that covered everything.
--
-- Offered on a form and never priced is a trap rather than a choice.
--
-- DELETED OR RETIRED
--
-- Whichever is honest. If no truck and no price has ever used it, the row is
-- removed and nothing is lost. If something does use it, it is retired instead:
-- the trucks keep their meaning and it simply stops being offered on new ones.
-- That is the same decision retireFuelType makes in the application, written
-- here so a database built from these files ends up in the same state.

BEGIN;

-- Retire it where something already points at it.
UPDATE "FuelType"
SET "isActive" = false
WHERE "name" = 'Auto-LPG'
  AND (
    EXISTS (SELECT 1 FROM "Truck" t WHERE t."fuelTypeID" = "FuelType"."fuelTypeID")
    OR EXISTS (
      SELECT 1 FROM "FuelPriceHistory" f
      WHERE lower(f."fuelType") = lower("FuelType"."name")
    )
  );

-- And remove it where nothing does.
DELETE FROM "FuelType"
WHERE "name" = 'Auto-LPG'
  AND "isActive";

COMMIT;

-- AFTERWARDS
--
-- Gone, or present and retired - never present and offered:
--   SELECT "name", "isActive" FROM "FuelType" WHERE "name" = 'Auto-LPG';
--
-- And what is left on the form:
--   SELECT "name", "unit", "sortOrder" FROM "FuelType"
--   WHERE "isActive" ORDER BY "sortOrder";

-- What a truck burns, as data rather than as schema.
--
-- WHY A TABLE AND NOT A CHECK CONSTRAINT
--
-- For this fleet the answer is one word: all 36 trucks are diesel, and both
-- models that looked ambiguous - the Ford Ranger and the Hyundai H-100 - are
-- sold diesel-only in the Philippines. A CHECK ('Diesel', 'Gasoline') would have
-- covered it entirely.
--
-- It would not cover the next company. A fixed list in the schema means a
-- migration every time a customer arrives with a fuel nobody anticipated, and
-- the person who needs it is the one least able to ship one. So the list is a
-- table they can edit, and adding Auto-LPG is a row, not a release.
--
-- WHY A ROW IS A PRICEABLE FUEL, NOT AN ABSTRACT KIND
--
-- Petrol grades are arguably a choice at the pump rather than a property of the
-- vehicle - the same pickup can take RON 91 one week and RON 95 the next. But
-- the DOE publishes a separate price series per grade, so if a truck's fuel is
-- to join to a price, the grade is where the join has to happen. Storing the
-- kind alone would need a second table deciding which grade to price it at, and
-- one level is simpler than two.
--
-- WHY THE PRICE COLUMN IS RENAMED
--
-- "pricePerLiter" is a lie the moment a customer has an electric van, which is
-- priced per kWh, or CNG, priced per kg. The unit now comes from the fuel type
-- and the column is "pricePerUnit". Renaming it costs nothing today - 239 rows,
-- three files read it, all updated in the same commit - and would be painful
-- once anybody's costing depends on it.

BEGIN;

-- ----------------------------------------------------------------------------
-- The list
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "FuelType" (
  "fuelTypeID"  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One canonical spelling. A unique name is what stops "diesel" and "Diesel"
  -- becoming two fuels that silently fail to join to each other's prices.
  "name"        text NOT NULL UNIQUE,
  -- What its price is quoted in. Not every fuel is sold by the litre.
  "unit"        text NOT NULL DEFAULT 'litre' CHECK ("unit" IN ('litre', 'kWh', 'kg')),
  -- Retired rather than deleted, so the trucks and prices that used it keep
  -- their meaning while it stops being offered on a form.
  "isActive"    boolean NOT NULL DEFAULT true,
  "sortOrder"   integer NOT NULL DEFAULT 100,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "FuelType" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "FuelType" IS
  'The fuels a truck can burn, and the unit each is priced in. Editable: a new company adds its own without a migration.';

-- Seeded with the fuels a truck in this country can actually run on.
--
-- The first draft of this list was taken from what the DOE publishes weekly,
-- which is a different question and produced two wrong answers. Kerosene is
-- monitored because it is a household cooking and lighting fuel, not a motor
-- fuel at all, and offering it here only invites somebody to pick it by mistake.
-- Electric and CNG are real vehicle fuels but barely real truck fuels in this
-- country: a handful of pilot fleets, and next to no refuelling infrastructure
-- for CNG outside them.
--
-- What is left is every fuel a Philippine truck realistically runs on, all of it
-- priced per litre.
--
-- Leaving the others out costs nothing, because the entire point of this being a
-- table rather than a CHECK constraint is that putting one back is a row rather
-- than a release. The unit column still allows kWh and kg for exactly that day -
-- it is what lets this system follow a fleet that electrifies, instead of
-- needing a migration when the first van arrives.
INSERT INTO "FuelType" ("name", "unit", "sortOrder") VALUES
  ('Diesel',           'litre', 10),
  ('Gasoline RON 91',  'litre', 20),
  ('Gasoline RON 95',  'litre', 30),
  ('Gasoline RON 97',  'litre', 40),
  -- Auto-LPG was seeded here too, and removed again by
  -- 20261002000000_remove_auto_lpg.sql: it is the one fuel on this list the DOE
  -- sync cannot price, so a truck recorded as burning it had a fuel type and no
  -- fuel price for ever. Left in place rather than edited out, because this
  -- file has already run and a migration that changes after it has run is a
  -- migration nobody can trust.
  ('Auto-LPG',         'litre', 50)
ON CONFLICT ("name") DO NOTHING;

-- ----------------------------------------------------------------------------
-- What each truck burns
-- ----------------------------------------------------------------------------

ALTER TABLE "Truck"
  ADD COLUMN IF NOT EXISTS "fuelTypeID" uuid REFERENCES "FuelType" ("fuelTypeID") ON DELETE SET NULL;

COMMENT ON COLUMN "Truck"."fuelTypeID" IS
  'What this truck burns. Null means nobody has recorded it - shown as "Not recorded" rather than assumed to be diesel.';

-- Every truck on record is diesel. This is a backfill of a fact, not a guess:
-- the heavy units are Hino, Fuso and UD commercial trucks, and the two light
-- ones are a Ford Ranger and a Hyundai H-100, both diesel-only in this market.
UPDATE "Truck"
SET "fuelTypeID" = (SELECT "fuelTypeID" FROM "FuelType" WHERE "name" = 'Diesel')
WHERE "fuelTypeID" IS NULL;

CREATE INDEX IF NOT EXISTS truck_fuel_type_idx ON "Truck" ("fuelTypeID");

-- ----------------------------------------------------------------------------
-- Prices, joined to the same list
-- ----------------------------------------------------------------------------

ALTER TABLE "FuelPriceHistory"
  ADD COLUMN IF NOT EXISTS "fuelTypeID" uuid REFERENCES "FuelType" ("fuelTypeID") ON DELETE RESTRICT;

UPDATE "FuelPriceHistory" p
SET "fuelTypeID" = f."fuelTypeID"
FROM "FuelType" f
WHERE p."fuelTypeID" IS NULL AND f."name" = p."fuelType";

CREATE INDEX IF NOT EXISTS fuel_price_type_date_idx
  ON "FuelPriceHistory" ("fuelTypeID", "region", "effectiveDate" DESC);

-- The old text column stays for now. The sync's upsert conflicts on
-- (effectiveDate, fuelType, region), and changing a conflict target in the same
-- migration that introduces the replacement is how a weekly job quietly stops
-- writing. It can be dropped once the sync has run a few times on the new key.

ALTER TABLE "FuelPriceHistory"
  RENAME COLUMN "pricePerLiter" TO "pricePerUnit";

COMMENT ON COLUMN "FuelPriceHistory"."pricePerUnit" IS
  'Price in the unit named by the fuel type: per litre, per kWh or per kg. Was pricePerLiter, which stopped being true the moment a fuel was not a liquid.';

COMMIT;

-- AFTERWARDS
--   SELECT f."name", count(t.*) AS trucks
--   FROM "FuelType" f LEFT JOIN "Truck" t ON t."fuelTypeID" = f."fuelTypeID"
--   GROUP BY 1 ORDER BY 1;
-- Expect 36 against Diesel and none against anything else.
--
--   SELECT count(*) FROM "FuelPriceHistory" WHERE "fuelTypeID" IS NULL;
-- Expect 0: every one of the 239 rows is Diesel and matches the seeded name.

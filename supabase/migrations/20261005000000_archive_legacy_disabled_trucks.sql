-- Put trucks still carrying the old "Disabled" status into the Archive.
--
-- WHY
--
-- "Disabled" used to be a truck status. It is not one any more: the
-- application stores four (Available, On Delivery, On Maintenance, Out of
-- Service), and taking a truck out of the fleet is isActive = false, which
-- moves it to the Archive. Rows written before that change kept the old
-- status and isActive = true, so they sat in the working fleet labelled
-- "Disabled" - counted under All, under no status, and with no way to restore
-- them, because the Archive only lists trucks that are not active.
--
-- WHAT
--
-- Each is put in the state the Disable Truck action leaves a truck in today:
-- not active, status Out of Service. In the Archive it reads "Disabled", and
-- Restore brings it back Available, as for any other disabled truck. Its
-- history - trips, maintenance logs - is untouched.

BEGIN;

UPDATE "Truck"
SET "isActive" = false,
    "truckStatus" = 'Out of Service'
WHERE "truckStatus" = 'Disabled'
  AND "isActive";

COMMIT;

-- AFTERWARDS
--
-- None left in the working fleet:
--   SELECT "plateNumber" FROM "Truck" WHERE "truckStatus" = 'Disabled';
--
-- And the Archive, which should now include CCC-000 and RRR-155:
--   SELECT "plateNumber", "truckStatus" FROM "Truck" WHERE NOT "isActive";

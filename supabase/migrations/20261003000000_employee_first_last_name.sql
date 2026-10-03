-- Keep an employee's first name and last name as they were typed.
--
-- WHY
--
-- The employee form asks for First Name, Middle Name, Last Name and Suffix, but
-- only the middle name and suffix had columns of their own. The first and last
-- names were joined into "employeeName" and split apart again on the first
-- space when the record was read back. A first name of two words - "Vince
-- Benedict" - came back as first name "Vince" and last name "Benedict Gapasin",
-- and saving the form again wrote that wrong split back.
--
-- WHAT
--
-- Two columns that hold the names as entered. "employeeName" stays, still
-- "First Last", because every screen, search, notification and report reads it.
-- The application writes all three together.
--
-- Existing rows are filled the way the screen already split them (first word,
-- then the rest), so nothing changes on screen until someone corrects a name -
-- which the form can now save properly.

BEGIN;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "firstName" text,
  ADD COLUMN IF NOT EXISTS "lastName" text;

UPDATE "Employee"
SET
  "firstName" = split_part(btrim("employeeName"), ' ', 1),
  "lastName" = NULLIF(btrim(substr(btrim("employeeName"), length(split_part(btrim("employeeName"), ' ', 1)) + 1)), '')
WHERE "firstName" IS NULL AND "lastName" IS NULL;

COMMIT;

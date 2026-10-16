-- The numbers read off each receipt, so two receipts on one form are not taken
-- for the same page.
--
-- WHAT WAS WRONG
--
-- A receipt photo already used for another stop is refused. "The same photo"
-- was judged by a fingerprint of the picture (imageDHash), which sees the
-- page's layout and not its writing - and every receipt on one client's form
-- has the same layout. Sample receipts printed on one template came out 0 to 3
-- bits apart against a limit of 6. So a crew member delivering to three
-- branches of one client in a day had the second and third receipts refused
-- as "already scanned for another stop".
--
-- Now a page counts as one already used only when the picture matches AND it
-- carries the same numbers: its DR or POD number, dates and quantities, as the
-- phone's text reader made them out. A different receipt has its own.
--
-- Space-separated, lowercase, at most 40. NULL on proofs from before this and
-- on photos from an app without the scanner; those are only ever matched by
-- their exact file.

BEGIN;

ALTER TABLE "POD" ADD COLUMN IF NOT EXISTS "docNumbers" text;

COMMENT ON COLUMN "POD"."docNumbers" IS
  'Numbers read off the receipt (document number, dates, quantities), space-separated. With imageDHash, tells a reused photo from another receipt on the same form.';

COMMIT;

-- AFTERWARDS
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'POD' AND column_name = 'docNumbers';

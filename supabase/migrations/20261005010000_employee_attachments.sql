-- Employee attachments: certificates, medical documents, IDs.
--
-- The employee form has had an "Upload Certificates" field and the profile an
-- Attachments tab for a long time, but neither was connected to anything. The
-- chosen file was dropped on save and the tab was a fixed placeholder, so every
-- file anybody "uploaded" is gone and has to be uploaded again.
--
-- One private bucket and one table. Nothing existing is altered.
--
-- Apply this BEFORE deploying the code that uses it: the Attachments tab reads
-- the table on open and says so when it cannot, rather than showing an empty
-- list that looks the same as nobody having uploaded anything.

BEGIN;

-- ----------------------------------------------------------------------------
-- The bucket
-- ----------------------------------------------------------------------------
-- Private from the start, unlike delivery_proofs was. These are medical
-- results and licences with a person's details on them. Files are read through
-- short-lived signed URLs handed out by the server
-- (services/storage/employeeAttachmentService.ts), and only to the office.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee_attachments',
  'employee_attachments',
  false,
  10485760, -- 10 MB, the same limit the server checks
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects policies: reads and writes go through server routes
-- holding the service-role key, which bypasses them, and with none defined
-- nothing gets in with the anon key.

-- ----------------------------------------------------------------------------
-- What is in it, and whose
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "EmployeeAttachment" (
  "attachmentID"  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Goes with the employee. The objects themselves are removed by the
  -- employee delete route; this only keeps a deleted employee's rows from
  -- lingering if that ever fails.
  "employeeID"    uuid NOT NULL REFERENCES "Employee" ("employeeID") ON DELETE CASCADE,

  -- The path inside the bucket, never a URL.
  "path"          text NOT NULL UNIQUE,
  -- As it was called on the uploader's computer, for display and download.
  "fileName"      text NOT NULL,
  "fileType"      text NOT NULL,
  "fileSize"      integer NOT NULL CHECK ("fileSize" > 0),

  "uploadedBy"    uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "uploadedAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EmployeeAttachment_employee_idx"
  ON "EmployeeAttachment" ("employeeID", "uploadedAt" DESC);

-- Written through the server only.
ALTER TABLE "EmployeeAttachment" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Check:
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'employee_attachments';
--   SELECT count(*) FROM "EmployeeAttachment";

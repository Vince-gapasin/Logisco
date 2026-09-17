-- Close the proof-of-delivery bucket.
--
-- delivery_proofs is a public bucket, so every object in it is readable by
-- anyone with the URL, with no session and no role. The app stored exactly
-- that URL - getPublicUrl() - on DispatchOrder.pod_url and POD.proof and
-- sent it to the browser. A proof of delivery is a photograph of a signed
-- receipt with a customer's name on it. Filenames are predictable too:
-- "pod-<dispatchID>-<timestamp>-<original name>".
--
-- The application now stores the object path and mints a short-lived signed
-- URL when an authorised request asks for the photo
-- (services/storage/podService.ts), so the bucket no longer needs to be
-- public. Apply this only once that code is deployed: while the old code is
-- live, the links it handed out stop working the moment this runs.

UPDATE storage.buckets
SET public = false
WHERE id = 'delivery_proofs';

-- Reads and writes go through server routes holding the service-role key,
-- which bypasses these policies. The policies below make sure nothing else
-- gets in with the anon key.

DROP POLICY IF EXISTS "delivery_proofs_no_anon_read"  ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_no_anon_write" ON storage.objects;

-- Check what is currently allowed before and after:
--   SELECT id, public FROM storage.buckets WHERE id = 'delivery_proofs';
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects';

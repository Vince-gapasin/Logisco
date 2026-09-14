-- ============================================================================
-- Logisco: GPS breadcrumb trail
-- ============================================================================
-- FleetLocations keeps only the newest fix per dispatch (one row, upserted),
-- so a finished trip leaves no record of the route taken. This table stores
-- the trail, which the live map draws and which is the audit record of where
-- a truck actually went.
--
-- The app writes here best-effort: until this migration is applied, tracking
-- keeps working and the trail is simply skipped.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public."FleetLocationHistory" (
  "historyID"   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id   uuid NOT NULL REFERENCES public."DispatchOrder"("dispatchID") ON DELETE CASCADE,
  driver_id     uuid REFERENCES public."Employee"("employeeID"),
  latitude      double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude     double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed         double precision,
  heading       double precision,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

-- The map reads the most recent points for one dispatch, in order.
CREATE INDEX IF NOT EXISTS fleetlocationhistory_dispatch_time_idx
  ON public."FleetLocationHistory" (dispatch_id, recorded_at DESC);

-- Same reasoning as the other tables: all access is server-side with the
-- service-role key, so no policy is needed and direct anon access is denied.
ALTER TABLE public."FleetLocationHistory" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Optional retention, once trails get long. Run periodically:
--   DELETE FROM public."FleetLocationHistory" WHERE recorded_at < now() - interval '90 days';

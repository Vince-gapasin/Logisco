-- ============================================================================
-- One lookup per request: is this session still signed in, and who is it
-- ============================================================================
-- Read by requireAuth in app/lib/auth.ts.
--
-- The server now checks a sign-in token itself (getClaims - the project signs
-- with ES256), instead of asking Supabase Auth over the network on every
-- request. A token checked that way says who it was issued to, not whether it
-- has since been signed out: changing a password signs out the other devices,
-- and their tokens would otherwise keep working until they expire, up to an
-- hour. So the Employee lookup every request already makes now also asks
-- auth.sessions whether the token's session still exists - the same one round
-- trip, and a signed-out device is refused on its very next request instead
-- of within the 30 seconds the old token cache allowed. A deleted login takes
-- its sessions with it, so it is refused the same way.
--
-- Until this is applied requireAuth cannot find the function and checks the
-- token over the network as before, so deploying the code first is safe.
--
-- Server-only: callable by the service role and nobody else, since it reads
-- the auth schema.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_session_employee(p_auth_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'sessionActive', EXISTS (
      SELECT 1
      FROM auth.sessions s
      WHERE s.id = p_session_id
        AND s.user_id = p_auth_id
        AND (s.not_after IS NULL OR s.not_after > now())
    ),
    'employee', (
      SELECT jsonb_build_object(
        'employeeID',   e."employeeID",
        'employeeName', e."employeeName",
        'role',         e."role",
        'isActive',     e."isActive"
      )
      FROM public."Employee" e
      WHERE e.auth_id = p_auth_id
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_session_employee(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_session_employee(uuid, uuid) TO service_role;

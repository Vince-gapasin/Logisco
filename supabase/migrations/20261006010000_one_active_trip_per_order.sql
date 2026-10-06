-- ============================================================================
-- One live trip per booking
-- ============================================================================
-- assignDispatch now refuses a booking that already has a live trip, but two
-- coordinators pressing Assign at the same moment both pass that check. The
-- truck and driver indexes would only catch them if they picked the same truck
-- or driver; this catches the booking itself.
--
-- The status list is the same one as dispatchorder_one_active_per_truck and
-- ACTIVE_DELIVERY_STATUSES in app/lib/enums.ts. A foul trip's failed trip is
-- 'Foul Trip', which is not in it, so recovery can still make the replacement.
--
-- PRE-CHECK (read-only; must return zero rows or the index will not build):
--   SELECT "orderID", count(*) FROM "DispatchOrder"
--   WHERE status IN ('Pending','Assigned','Accepted',
--                    'Start Delivery','In Warehouse','In Transit','Arrived')
--   GROUP BY "orderID" HAVING count(*) > 1;
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS dispatchorder_one_active_per_order
  ON "DispatchOrder" ("orderID")
  WHERE status IN (
    'Pending', 'Assigned', 'Accepted',
    'Start Delivery', 'In Warehouse', 'In Transit', 'Arrived'
  );

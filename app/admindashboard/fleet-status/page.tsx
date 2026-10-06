// ==========================================
// LOGISCO - FLEET STATUS PAGE
// ==========================================

"use client";

// The office's Fleet Status is the mechanic's, not a second page made to look
// like it. Two pages kept in step by hand drift apart: this one had its own
// status box that asked only for a reason, while the mechanic's opened the
// maintenance log. Now there is one page and one way to change a status.
//
// What differs for the office is decided inside it, from the signed-in role:
// they pick the mechanic on each log rather than being filed as one, a repair
// under way is never locked to them, and a repair record is read, not edited.
import MechanicFleetStatusPage from "@/app/mechanic/fleet-status/page";

export default function FleetStatusPage() {
  return <MechanicFleetStatusPage />;
}

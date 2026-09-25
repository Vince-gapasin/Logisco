import { describe, expect, it } from "vitest";

import { DELIVERY_STATUS, crewHasConfirmed, hasDriverAccepted, haveHelpersAccepted } from "@/app/lib/enums";

describe("who has agreed to carry a trip", () => {
  it("counts a driver who accepted", () => {
    expect(hasDriverAccepted(DELIVERY_STATUS.accepted)).toBe(true);
  });

  it("counts a driver whose trip has since moved on", () => {
    // A truck does not reach the road, or the end of it, unassented to.
    expect(hasDriverAccepted(DELIVERY_STATUS.inTransit)).toBe(true);
    expect(hasDriverAccepted(DELIVERY_STATUS.completed)).toBe(true);
    expect(hasDriverAccepted(DELIVERY_STATUS.returned)).toBe(true);
  });

  it("does not count one who has not answered, or has declined", () => {
    expect(hasDriverAccepted(DELIVERY_STATUS.assigned)).toBe(false);
    expect(hasDriverAccepted(DELIVERY_STATUS.pending)).toBe(false);
    expect(hasDriverAccepted(DELIVERY_STATUS.rejected)).toBe(false);
    expect(hasDriverAccepted(null)).toBe(false);
    expect(hasDriverAccepted(undefined)).toBe(false);
  });

  it("needs every helper, not just one", () => {
    expect(haveHelpersAccepted([{ status: "Accepted" }, { status: "Accepted" }])).toBe(true);
    expect(haveHelpersAccepted([{ status: "Accepted" }, { status: "Pending" }])).toBe(false);
    expect(haveHelpersAccepted([{ status: "Declined" }])).toBe(false);
  });

  it("says no helpers have accepted when there are none to ask", () => {
    expect(haveHelpersAccepted([])).toBe(false);
    expect(haveHelpersAccepted(null)).toBe(false);
  });

  it("treats a trip with no helpers as confirmed once its driver is", () => {
    expect(crewHasConfirmed(DELIVERY_STATUS.accepted, [])).toBe(true);
    expect(crewHasConfirmed(DELIVERY_STATUS.accepted, null)).toBe(true);
  });

  it("holds a trip back while a helper has not replied", () => {
    expect(crewHasConfirmed(DELIVERY_STATUS.accepted, [{ status: "Pending" }])).toBe(false);
    expect(crewHasConfirmed(DELIVERY_STATUS.accepted, [{ status: "Accepted" }])).toBe(true);
  });

  it("is not confirmed by helpers alone", () => {
    expect(crewHasConfirmed(DELIVERY_STATUS.assigned, [{ status: "Accepted" }])).toBe(false);
  });
});

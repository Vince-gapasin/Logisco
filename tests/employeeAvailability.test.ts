import { describe, expect, it, vi } from "vitest";

// The module builds a Supabase client on import; the rule under test does not
// touch it.
vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));

const { decideAvailability } = await import("@/services/employee/employeeAvailabilityService");
const { AVAILABILITY, isAssignable } = await import("@/app/lib/enums");

describe("what an employee's availability comes to", () => {
  it("is Available when nothing is set and no trip is near", () => {
    expect(decideAvailability({ manual: AVAILABILITY.available })).toBe(AVAILABILITY.available);
    expect(decideAvailability({})).toBe(AVAILABILITY.available);
  });

  it("is Booked once their trip is close", () => {
    expect(decideAvailability({ manual: AVAILABILITY.available, bookedSoon: true })).toBe(AVAILABILITY.booked);
  });

  it("is In Transit while they are on the road, whatever else is set", () => {
    expect(decideAvailability({ manual: AVAILABILITY.onLeave, onTheRoad: true })).toBe(AVAILABILITY.inTransit);
    expect(decideAvailability({ manual: AVAILABILITY.available, onTheRoad: true, bookedSoon: true })).toBe(
      AVAILABILITY.inTransit,
    );
  });

  it("keeps leave visible instead of reporting Available", () => {
    expect(decideAvailability({ manual: AVAILABILITY.onLeave })).toBe(AVAILABILITY.onLeave);
    expect(decideAvailability({ manual: AVAILABILITY.unavailable })).toBe(AVAILABILITY.unavailable);
    // Leave beats a trip that has not started.
    expect(decideAvailability({ manual: AVAILABILITY.onLeave, bookedSoon: true })).toBe(AVAILABILITY.onLeave);
  });

  it("treats a leftover trip state in the column as nothing set", () => {
    expect(decideAvailability({ manual: "On Delivery" })).toBe(AVAILABILITY.available);
    expect(decideAvailability({ manual: "On Delivery", bookedSoon: true })).toBe(AVAILABILITY.booked);
  });
});

describe("who can be given a trip", () => {
  it("excludes only the states an admin set", () => {
    expect(isAssignable(AVAILABILITY.onLeave)).toBe(false);
    expect(isAssignable(AVAILABILITY.unavailable)).toBe(false);
    expect(isAssignable(AVAILABILITY.available)).toBe(true);
    // Busy is judged from live trips, not from this.
    expect(isAssignable(AVAILABILITY.booked)).toBe(true);
    expect(isAssignable(AVAILABILITY.inTransit)).toBe(true);
    expect(isAssignable(null)).toBe(true);
  });
});

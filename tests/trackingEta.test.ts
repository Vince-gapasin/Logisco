import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// What a client is told about when their delivery will arrive.
//
// It used to be a straight line from the truck to their stop, asked of Mapbox
// separately on every poll. That ignored every stop the truck had to make on
// the way, so a delivery third in the run announced a time it could not make.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { legsUpTo } = await import("@/services/tracking/publicTrackingService");

const route = {
  path: [] as [number, number][],
  minutes: 75,
  distanceKm: 40,
  // Truck -> first drop (20 min) -> second drop (25 min) -> third drop (30 min)
  legMinutes: [20, 25, 30],
  waypoints: [
    { latitude: 14.6, longitude: 121.0, label: "Truck", kind: "truck" as const },
    { latitude: 14.5, longitude: 121.1, label: "First", kind: "delivery" as const, branchID: 1 },
    { latitude: 14.4, longitude: 121.2, label: "Second", kind: "delivery" as const, branchID: 2 },
    { latitude: 14.3, longitude: 121.3, label: "Third", kind: "delivery" as const, branchID: 3 },
  ],
};

describe("how long until a delivery reaches one client", () => {
  it("counts the drive to the first stop", () => {
    expect(legsUpTo(route, 1)).toBe(20);
  });

  it("counts the stops the truck has to make first", () => {
    // Not 25: the truck has to reach the first drop before starting the second.
    expect(legsUpTo(route, 2)).toBe(45);
    expect(legsUpTo(route, 3)).toBe(75);
  });

  it("says nothing about a stop the route does not visit", () => {
    // A stop with no coordinates is left out of the route, and an arrival time
    // for somewhere nobody is driving to would be invented.
    expect(legsUpTo(route, 99)).toBeNull();
  });

  it("says nothing when the truck itself is asked about", () => {
    expect(legsUpTo({ ...route, waypoints: [route.waypoints[0]] }, 1)).toBeNull();
  });

  it("does not invent time from legs that are missing", () => {
    expect(legsUpTo({ ...route, legMinutes: [] }, 2)).toBeNull();
  });
});

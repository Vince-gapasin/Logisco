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

describe("the order a delivery's history reads in", () => {
  it("never shows a later step happening earlier than the one above it", async () => {
    const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");

    const steps = buildTrackingSteps(
      "Completed",
      [
        {
          branchID: 1,
          branchName: "Corporate Office",
          expectedTime: null,
          status: "Delivered",
          latitude: null,
          longitude: null,
          arrivedAt: null,
          // Signed for in the evening.
          deliveredAt: "2026-09-25T11:01:00.000Z",
          receivedBy: "Panday",
        },
      ],
      true,
      [],
      // The trip was marked complete in the morning, hours before the proof
      // was uploaded against the stop.
      new Map([["completed", "2026-09-25T03:01:00.000Z"]]),
      null,
    );

    const times = steps.filter((s) => s.at).map((s) => new Date(s.at as string).getTime());
    const ascending = times.every((time, i) => i === 0 || time >= times[i - 1]);
    expect(ascending).toBe(true);
  });

  it("does not repeat the time inside the text beside it", async () => {
    const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");

    const steps = buildTrackingSteps(
      "Completed",
      [
        {
          branchID: 1,
          branchName: "Corporate Office",
          expectedTime: null,
          status: "Delivered",
          latitude: null,
          longitude: null,
          arrivedAt: null,
          deliveredAt: "2026-09-25T11:01:00.000Z",
          receivedBy: "Panday",
        },
      ],
      true,
      [],
      new Map(),
      null,
    );

    const stop = steps.find((s) => s.kind === "stop");
    expect(stop?.detail).toBe("Delivered, received by Panday.");
    expect(stop?.detail).not.toMatch(/2026|AM|PM/);
    expect(stop?.at).toBe("2026-09-25T11:01:00.000Z");
  });

  it("says how far away the stop being driven to is", async () => {
    const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");

    const steps = buildTrackingSteps(
      "In Transit",
      [
        {
          branchID: 1,
          branchName: "Corporate Office",
          expectedTime: "14:30",
          status: "Pending",
          latitude: 14.6,
          longitude: 121.0,
          arrivedAt: null,
          deliveredAt: null,
          receivedBy: null,
        },
      ],
      false,
      [],
      new Map(),
      25,
    );

    expect(steps.find((s) => s.kind === "stop")?.detail).toContain("About 25 min away");
  });
});

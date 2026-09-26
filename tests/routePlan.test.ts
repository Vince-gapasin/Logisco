import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Drawing the road a truck still has to take. The parts worth protecting are
// the ones that fail quietly: a coordinate pair written the wrong way round
// puts the route in the ocean, and an un-geocoded stop would route through
// 0,0 off the coast of Africa.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

// The routing service reads the token once, when it is first loaded, so it has
// to be there before the import rather than in a beforeEach.
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";

const { getRemainingWaypoints, getDispatchRoute, forgetDispatchRoute } = await import(
  "@/services/fleet/routePlanService"
);

const TRIP = "55555555-5555-4555-8555-555555555555";
const ORDER = "66666666-6666-4666-8666-666666666666";

// Quezon City to a Batangas warehouse, as Mapbox returns it: longitude first.
const MAPBOX_PATH = [
  [121.0229, 14.6108],
  [121.1, 14.2],
  [121.1618, 13.941],
];

function mockDirections(path = MAPBOX_PATH) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: { coordinates: path },
            duration: 6660,
            distance: 86_100,
            legs: [{ duration: 6660 }],
          },
        ],
      }),
    })),
  );
}

beforeEach(() => {
  db.calls.length = 0;
  forgetDispatchRoute(TRIP);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the stops a trip still has to make", () => {
  it("takes pickups through the order and deliveries through the trip", async () => {
    db.queue(
      { data: { orderID: ORDER } },
      { data: [{ warehouseName: "Depot", pickupLat: 13.94, pickupLong: 121.16, sequence: 1, stopStatus: "Pending" }] },
      { data: [{ branchName: "Branch", deliveryLat: 14.6, deliverLong: 121.02, sequence: 1, stopStatus: "Pending" }] },
    );

    const waypoints = await getRemainingWaypoints(TRIP);

    expect(waypoints.map((w) => w.kind)).toEqual(["pickup", "delivery"]);
    expect(waypoints[0].label).toBe("Depot");
  });

  it("leaves out a stop that was already delivered", async () => {
    db.queue(
      { data: { orderID: ORDER } },
      { data: [] },
      {
        data: [
          { branchName: "Done", deliveryLat: 14.6, deliverLong: 121.02, sequence: 1, stopStatus: "Delivered" },
          { branchName: "Next", deliveryLat: 14.7, deliverLong: 121.03, sequence: 2, stopStatus: "Pending" },
        ],
      },
    );

    const waypoints = await getRemainingWaypoints(TRIP);

    expect(waypoints).toHaveLength(1);
    expect(waypoints[0].label).toBe("Next");
  });

  it("leaves out a stop that was never geocoded", async () => {
    // 0,0 is the placeholder written when an address could not be found. It is
    // a real place: the Atlantic, about 600 km off Ghana.
    db.queue(
      { data: { orderID: ORDER } },
      { data: [{ warehouseName: "Nowhere", pickupLat: 0, pickupLong: 0, sequence: 1, stopStatus: "Pending" }] },
      { data: [{ branchName: "Real", deliveryLat: 14.6, deliverLong: 121.02, sequence: 1, stopStatus: "Pending" }] },
    );

    const waypoints = await getRemainingWaypoints(TRIP);

    expect(waypoints.map((w) => w.label)).toEqual(["Real"]);
  });
});

describe("the route itself", () => {
  it("starts where the truck is and keeps Mapbox's longitude-first order", async () => {
    mockDirections();
    db.queue(
      { data: { latitude: 14.6108, longitude: 121.0229 } }, // the truck
      { data: { orderID: ORDER } },
      { data: [{ warehouseName: "Depot", pickupLat: 13.941, pickupLong: 121.1618, sequence: 1, stopStatus: "Pending" }] },
      { data: [] },
    );

    const route = await getDispatchRoute(TRIP);

    expect(route?.waypoints[0].kind).toBe("truck");
    expect(route?.path).toEqual(MAPBOX_PATH);
    // Longitude first, and both inside the Philippines rather than the sea.
    for (const [longitude, latitude] of route?.path ?? []) {
      expect(longitude).toBeGreaterThan(115);
      expect(latitude).toBeLessThan(22);
    }
    expect(route?.distanceKm).toBe(86.1);
    expect(route?.minutes).toBe(111);
  });

  it("starts from the first stop when no truck has reported in", async () => {
    mockDirections();
    db.queue(
      { data: null }, // no position yet
      { data: { orderID: ORDER } },
      { data: [] },
      {
        data: [
          { branchName: "One", deliveryLat: 14.6, deliverLong: 121.02, sequence: 1, stopStatus: "Pending" },
          { branchName: "Two", deliveryLat: 14.7, deliverLong: 121.03, sequence: 2, stopStatus: "Pending" },
        ],
      },
    );

    const route = await getDispatchRoute(TRIP);

    expect(route?.waypoints.map((w) => w.label)).toEqual(["One", "Two"]);
  });

  it("draws nothing when there is only one point to go to", async () => {
    mockDirections();
    db.queue(
      { data: null },
      { data: { orderID: ORDER } },
      { data: [] },
      { data: [{ branchName: "Only", deliveryLat: 14.6, deliverLong: 121.02, sequence: 1, stopStatus: "Pending" }] },
    );

    expect(await getDispatchRoute(TRIP)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks Mapbox once and serves the rest from memory", async () => {
    mockDirections();
    const queueOnce = () => {
      db.queue(
        { data: { latitude: 14.6108, longitude: 121.0229 } },
        { data: { orderID: ORDER } },
        { data: [] },
        { data: [{ branchName: "Stop", deliveryLat: 13.941, deliverLong: 121.1618, sequence: 1, stopStatus: "Pending" }] },
      );
    };

    queueOnce();
    await getDispatchRoute(TRIP);
    db.queue({ data: { latitude: 14.6108, longitude: 121.0229 } }); // the position is still read
    await getDispatchRoute(TRIP);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The admin and crew dashboards ask every few seconds whether anything has
// changed, and fetch themselves again only when the fingerprint moves. So the
// fingerprint has two jobs: move whenever something the screen shows has
// moved, and stand still otherwise - the same rows in another order must not
// send every open screen off to fetch everything again.

const double = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: double.client }));

const { getDashboardVersion } = await import("@/services/booking/bookingService");
const { getCrewDispatchVersion, recentTripsFilter } = await import("@/services/dispatch/crewDispatchVersion");

beforeEach(() => {
  double.calls.length = 0;
  double.writes.length = 0;
});

// ---------------------------------------------------------------- dashboard

const trip = (dispatchID: string, status: string, helpers: { helperID: string; status: string }[] = []) => ({
  dispatchID,
  orderID: `order-${dispatchID}`,
  status,
  current_step: 0,
  truckID: "truck-1",
  driverID: "driver-1",
  subConID: null,
  partnerDriver: null,
  partnerPlate: null,
  DispatchHelper: helpers,
});

interface Board {
  count?: number;
  newest?: { orderID: string; createdAt: string };
  trips?: unknown[];
  foul?: unknown[];
}

const boardVersion = (board: Board) => {
  // Order, then DispatchOrder, then FoulTripIncident: the order they are asked in.
  double.queue(
    { data: [board.newest ?? { orderID: "o-1", createdAt: "2026-10-07T01:00:00Z" }], count: board.count ?? 12 },
    { data: board.trips ?? [] },
    { data: board.foul ?? [] },
  );
  return getDashboardVersion();
};

describe("the dashboard's fingerprint", () => {
  const helpers = [
    { helperID: "h-1", status: "Accepted" },
    { helperID: "h-2", status: "Pending" },
  ];
  const board: Board = { trips: [trip("d-1", "Accepted", helpers), trip("d-2", "In Transit")] };

  it("stands still when nothing has changed", async () => {
    expect(await boardVersion(board)).toBe(await boardVersion(board));
  });

  it("does not move for the same rows in another order", async () => {
    const shuffled: Board = {
      trips: [trip("d-2", "In Transit"), trip("d-1", "Accepted", [...helpers].reverse())],
    };
    expect(await boardVersion(shuffled)).toBe(await boardVersion(board));
  });

  it("moves when a trip moves on", async () => {
    const moved: Board = { trips: [trip("d-1", "Start Delivery", helpers), trip("d-2", "In Transit")] };
    expect(await boardVersion(moved)).not.toBe(await boardVersion(board));
  });

  it("moves when a trip finishes and leaves the unfinished ones", async () => {
    const finished: Board = { trips: [trip("d-1", "Accepted", helpers)] };
    expect(await boardVersion(finished)).not.toBe(await boardVersion(board));
  });

  it("moves when a helper answers", async () => {
    const answered: Board = {
      trips: [
        trip("d-1", "Accepted", [
          { helperID: "h-1", status: "Accepted" },
          { helperID: "h-2", status: "Accepted" },
        ]),
        trip("d-2", "In Transit"),
      ],
    };
    expect(await boardVersion(answered)).not.toBe(await boardVersion(board));
  });

  it("moves when a booking is made", async () => {
    const booked: Board = {
      ...board,
      count: 13,
      newest: { orderID: "o-2", createdAt: "2026-10-07T02:00:00Z" },
    };
    expect(await boardVersion(booked)).not.toBe(await boardVersion(board));
  });

  it("moves when a foul trip is dealt with", async () => {
    const open: Board = { ...board, foul: [{ incidentID: "i-1", orderID: "o-9", dispatchID: "d-9", status: "open" }] };
    expect(await boardVersion(board)).not.toBe(await boardVersion(open));
  });

  it("fails rather than answering for a read that failed", async () => {
    double.queue({ data: [], count: 1 }, { error: { message: "timeout" } }, { data: [] });
    await expect(getDashboardVersion()).rejects.toThrow("timeout");
  });
});

// ---------------------------------------------------------------- crew

const crewTrip = (dispatchID: string, overrides: Record<string, unknown> = {}) => ({
  dispatchID,
  status: "In Transit",
  current_step: 1,
  pickupCompletedAt: null,
  pod_url: null,
  dispatchNote: null,
  truckID: "truck-1",
  driverID: "me",
  DispatchHelper: [{ helperID: "h-1", status: "Accepted" }],
  Order: {
    notes: "Delivery Schedule: 2026-10-08",
    BranchStops: [
      { branchID: 1, stopStatus: "Successfully Delivered", dispatchID },
      { branchID: 2, stopStatus: "Pending", dispatchID },
    ],
    PickupStops: [{ pickupID: 1, stopStatus: "Successfully Delivered", dispatchID }],
  },
  ...overrides,
});

const crewVersion = (driving: unknown[], helping: { dispatchID: string; status: string }[] = [], helped: unknown[] = []) => {
  // Driving and the helper rows are asked together, then the trips helped on.
  double.queue({ data: driving }, { data: helping }, ...(helping.length > 0 ? [{ data: helped }] : []));
  return getCrewDispatchVersion("me", null);
};

describe("the crew dashboard's fingerprint", () => {
  it("stands still when nothing has changed", async () => {
    expect(await crewVersion([crewTrip("d-1")])).toBe(await crewVersion([crewTrip("d-1")]));
  });

  it("does not move for the same stops in another order", async () => {
    const reordered = crewTrip("d-1");
    reordered.Order.BranchStops.reverse();
    expect(await crewVersion([reordered])).toBe(await crewVersion([crewTrip("d-1")]));
  });

  it("moves when the other crew member finishes a stop", async () => {
    // The case this is for: the helper closes the stop, and the driver's
    // screen has to move on with them.
    const done = crewTrip("d-1");
    done.Order.BranchStops[1].stopStatus = "Successfully Delivered";
    expect(await crewVersion([done])).not.toBe(await crewVersion([crewTrip("d-1")]));
  });

  it("moves when the trip's step moves", async () => {
    expect(await crewVersion([crewTrip("d-1", { current_step: 2 })])).not.toBe(
      await crewVersion([crewTrip("d-1")]),
    );
  });

  it("moves when dispatch changes the truck", async () => {
    expect(await crewVersion([crewTrip("d-1", { truckID: "truck-2" })])).not.toBe(
      await crewVersion([crewTrip("d-1")]),
    );
  });

  it("moves when a helper accepts, which is what lets the trip start", async () => {
    const waiting = crewTrip("d-1", { status: "Accepted", DispatchHelper: [{ helperID: "h-1", status: "Pending" }] });
    const ready = crewTrip("d-1", { status: "Accepted", DispatchHelper: [{ helperID: "h-1", status: "Accepted" }] });
    expect(await crewVersion([ready])).not.toBe(await crewVersion([waiting]));
  });

  it("covers the trips this person helps on, not only the ones they drive", async () => {
    const helping = [{ dispatchID: "d-7", status: "Accepted" }];
    const before = await crewVersion([], helping, [crewTrip("d-7", { driverID: "someone" })]);
    const after = await crewVersion([], helping, [crewTrip("d-7", { driverID: "someone", current_step: 3 })]);
    expect(after).not.toBe(before);
  });

  it("moves when this person is taken off a trip", async () => {
    const before = await crewVersion([], [{ dispatchID: "d-7", status: "Accepted" }], [crewTrip("d-7")]);
    const after = await crewVersion([]);
    expect(after).not.toBe(before);
  });
});

describe("the window the crew's trips are read for", () => {
  const NOW = Date.parse("2026-10-07T00:00:00Z");

  it("keeps unfinished trips and those finished inside the window", () => {
    expect(recentTripsFilter("http://x/api?recentDays=30", NOW)).toBe(
      'completedAt.is.null,completedAt.gte."2026-09-07T00:00:00.000Z"',
    );
  });

  it("is no filter at all when no window is asked for", () => {
    expect(recentTripsFilter("http://x/api", NOW)).toBeNull();
    expect(recentTripsFilter("http://x/api?recentDays=abc", NOW)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// What the customer tracking page says while the order has not been picked up
// yet.
//
// A booking collecting at 9:14 PM and dropping at 3:14 AM had this page
// announce "Scheduled arrival by 3:14 AM" under the words "Next stop", with the
// truck still two stops from the customer's branch. The time was right about
// the delivery and wrong about the next stop, and the timeline went from "On
// the road" straight to the drop as though nothing came between.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { buildCollection, buildTrackingSteps, nextStopAhead } = await import(
  "@/services/tracking/publicTrackingService"
);

const pickup = (over: Record<string, unknown> = {}) => ({
  warehouseName: "Calamba Warehouse",
  expectedTime: "21:14",
  stopStatus: "Pending",
  sequence: 1,
  arrivedAt: null,
  completedAt: null,
  ...over,
});

describe("the collection a booking still owes", () => {
  it("is nothing at all when there is no pickup on the booking", () => {
    expect(buildCollection([])).toBeNull();
  });

  it("reads the time the customer reads", () => {
    const collection = buildCollection([pickup()]);
    expect(collection?.expectedTime).toBe("9:14 PM");
    expect(collection?.name).toBe("Calamba Warehouse");
    expect(collection?.done).toBe(false);
  });

  it("names the one being driven to, not the first on the list", () => {
    const collection = buildCollection([
      pickup({ sequence: 1, stopStatus: "Successfully Delivered", completedAt: "2026-10-02T13:20:00Z" }),
      pickup({ sequence: 2, warehouseName: "Santa Rosa Depot", expectedTime: "22:30" }),
    ]);
    expect(collection?.name).toBe("Santa Rosa Depot");
    expect(collection?.expectedTime).toBe("10:30 PM");
    expect(collection?.done).toBe(false);
  });

  it("is done only once every collection on the booking is", () => {
    const collection = buildCollection([
      pickup({ sequence: 1, stopStatus: "Successfully Delivered", completedAt: "2026-10-02T13:20:00Z" }),
      pickup({ sequence: 2, stopStatus: "Successfully Delivered", completedAt: "2026-10-02T14:05:00Z" }),
    ]);
    expect(collection?.done).toBe(true);
    // The later of the two, so the step is dated when the loading finished.
    expect(collection?.at).toBe("2026-10-02T14:05:00Z");
  });

  it("knows the crew are standing at it", () => {
    expect(buildCollection([pickup({ arrivedAt: "2026-10-02T13:10:00Z" })])?.arrived).toBe(true);
  });

  it("does not report a finished collection as one the crew are standing at", () => {
    const collection = buildCollection([
      pickup({ stopStatus: "Successfully Delivered", arrivedAt: "2026-10-02T13:10:00Z", completedAt: "2026-10-02T13:20:00Z" }),
    ]);
    expect(collection?.arrived).toBe(false);
  });

  it("takes a warehouse nobody named rather than printing nothing", () => {
    expect(buildCollection([pickup({ warehouseName: "  " })])?.name).toBe("the collection point");
  });
});

describe("where the collection sits in what the customer is shown", () => {
  const stop = {
    branchID: 1,
    branchName: "Batangas Beverage Main Plant",
    expectedTime: "03:14",
    status: "Pending",
    latitude: null,
    longitude: null,
    arrivedAt: null,
    deliveredAt: null,
    receivedBy: null,
  };

  const steps = (status: string, collection: ReturnType<typeof buildCollection>) =>
    buildTrackingSteps(status, [stop], false, [], new Map(), null, [], null, null, collection);

  it("comes before the customer's own stop, because the truck does", () => {
    const rows = steps("Assigned", buildCollection([pickup()]));
    const order = rows.map((row) => row.kind);
    expect(order.indexOf("collection")).toBeGreaterThan(order.indexOf("departed"));
    expect(order.indexOf("collection")).toBeLessThan(order.indexOf("stop"));
  });

  it("says when it is due while the truck has not left", () => {
    const row = steps("Assigned", buildCollection([pickup()])).find((s) => s.kind === "collection");
    expect(row?.title).toBe("Collection from Calamba Warehouse");
    expect(row?.detail).toBe("Not collected yet. Expected by 9:14 PM.");
    expect(row?.stage).toBe("upcoming");
  });

  it("is what is happening once the truck is on the road, not the drop", () => {
    // The drop cannot be the current step while the order is still at the
    // warehouse - that is the whole complaint.
    const rows = steps("In Transit", buildCollection([pickup()]));
    expect(rows.find((s) => s.kind === "collection")?.stage).toBe("current");
    expect(rows.find((s) => s.kind === "stop")?.stage).toBe("upcoming");
  });

  it("says the crew are loading when they have reported arriving", () => {
    const row = steps("In Transit", buildCollection([pickup({ arrivedAt: "2026-10-02T13:10:00Z" })]))
      .find((s) => s.kind === "collection");
    expect(row?.detail).toBe("Our crew are collecting your order now.");
    expect(row?.stage).toBe("current");
  });

  it("hands the current step on to the drop once the order is loaded", () => {
    const loaded = buildCollection([
      pickup({ stopStatus: "Successfully Delivered", completedAt: "2026-10-02T13:20:00Z" }),
    ]);
    const rows = steps("In Transit", loaded);
    expect(rows.find((s) => s.kind === "collection")?.stage).toBe("completed");
    expect(rows.find((s) => s.kind === "collection")?.at).toBe("2026-10-02T13:20:00Z");
    expect(rows.find((s) => s.kind === "stop")?.stage).toBe("current");
  });

  it("adds no step at all to a booking with no collection on it", () => {
    expect(steps("In Transit", null).some((row) => row.kind === "collection")).toBe(false);
    // And the drop is the current step again, as it was before any of this.
    expect(steps("In Transit", null).find((s) => s.kind === "stop")?.stage).toBe("current");
  });
});

describe("which stop the page headlines", () => {
  const drop = {
    branchID: 1,
    branchName: "Batangas Beverage Main Plant",
    expectedTime: "03:14",
    status: "Pending",
    latitude: null,
    longitude: null,
    arrivedAt: null,
    deliveredAt: null,
    receivedBy: null,
  };

  it("is the warehouse, while the order is still in it", () => {
    // The complaint, as a test: 3:14 AM was announced as the next stop with the
    // truck not yet at the 9:14 PM collection.
    const ahead = nextStopAhead(buildCollection([pickup()]), drop, false, false);
    expect(ahead.kind).toBe("collection");
    expect(ahead.name).toBe("Calamba Warehouse");
    expect(ahead.estimatedArrival).toBe("9:14 PM");
  });

  it("still carries the delivery time, which is what they came for", () => {
    const ahead = nextStopAhead(buildCollection([pickup()]), drop, false, false);
    expect(ahead.deliveryArrival).toBe("3:14 AM");
  });

  it("becomes the customer's own stop once the order is loaded", () => {
    const loaded = buildCollection([
      pickup({ stopStatus: "Successfully Delivered", completedAt: "2026-10-02T13:20:00Z" }),
    ]);
    const ahead = nextStopAhead(loaded, drop, false, false);
    expect(ahead.kind).toBe("delivery");
    expect(ahead.name).toBe("Batangas Beverage Main Plant");
    expect(ahead.estimatedArrival).toBe("3:14 AM");
  });

  it("is the customer's own stop on a booking with no collection, as before", () => {
    const ahead = nextStopAhead(null, drop, false, false);
    expect(ahead.kind).toBe("delivery");
    expect(ahead.estimatedArrival).toBe("3:14 AM");
  });

  it("promises nothing once the crew are standing at the stop", () => {
    const ahead = nextStopAhead(null, drop, false, true);
    expect(ahead.estimatedArrival).toBeNull();
    expect(ahead.deliveryArrival).toBeNull();
  });

  it("promises nothing once the delivery is done, collection or not", () => {
    const ahead = nextStopAhead(buildCollection([pickup()]), drop, true, false);
    expect(ahead.kind).toBe("delivery");
    expect(ahead.estimatedArrival).toBeNull();
  });
});

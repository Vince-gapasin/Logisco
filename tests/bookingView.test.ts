import { describe, expect, it } from "vitest";

import { DELIVERY_STATUS, STOP_STATUS } from "@/app/lib/enums";
import { mapOrderToBookingView, toFeedBooking } from "@/app/lib/bookingView";

function order(overrides: Record<string, unknown> = {}) {
  return {
    orderID: "order-1",
    orderCode: "ORD-000001-AAAA",
    clientID: "client-1",
    createdAt: "2026-09-01T02:00:00.000Z",
    isActive: true,
    notes: [
      "[DELIVERY DETAILS]",
      "Priority: Urgent",
      "Delivery Schedule: 2026-09-05",
      "Pickup: Pacific Harvest Main Office @ 08:00",
      "",
      "[NOTES]",
      "Handle with care",
    ].join("\n"),
    Client: { company: "Pacific Harvest", contactName: "Rosa", contact: "0917" },
    OrderDetails: [{ productName: "Rice", quantity: 40 }],
    BranchStops: [],
    PickupStops: [],
    DispatchOrder: [],
    ...overrides,
  };
}

describe("mapping an order to the booking screens", () => {
  it("orders stops by their itinerary position, not by row id", () => {
    const view = mapOrderToBookingView(
      order({
        BranchStops: [
          { branchID: 900, branchName: "Third", sequence: 3 },
          { branchID: 100, branchName: "Second", sequence: 2 },
          { branchID: 500, branchName: "First", sequence: 1 },
        ],
      }),
    );

    expect(view.stops.map((stop) => stop.branchName)).toEqual(["First", "Second", "Third"]);
  });

  it("falls back to insertion order for stops booked before sequence existed", () => {
    const view = mapOrderToBookingView(
      order({
        BranchStops: [
          { branchID: 12, branchName: "Later" },
          { branchID: 7, branchName: "Earlier" },
        ],
      }),
    );

    expect(view.stops.map((stop) => stop.branchName)).toEqual(["Later", "Earlier"]);
  });

  it("keeps the delivery address the stop was geocoded from", () => {
    const view = mapOrderToBookingView(
      order({
        BranchStops: [
          { branchID: 1, branchName: "Alabang", deliveryAddress: "Filinvest, Muntinlupa" },
        ],
      }),
    );

    expect(view.stops[0].deliveryAddress).toBe("Filinvest, Muntinlupa");
  });

  it("takes the live dispatch over one the crew rejected", () => {
    const view = mapOrderToBookingView(
      order({
        DispatchOrder: [
          { dispatchID: "d-1", status: DELIVERY_STATUS.rejected, rejectionreason: "Sick" },
          { dispatchID: "d-2", status: DELIVERY_STATUS.inTransit },
        ],
      }),
    );

    expect(view.dispatchID).toBe("d-2");
    expect(view.dispatchStatus).toBe(DELIVERY_STATUS.inTransit);
  });

  it("counts the crew as confirmed from Accepted onwards", () => {
    for (const status of [
      DELIVERY_STATUS.accepted,
      DELIVERY_STATUS.inWarehouse,
      DELIVERY_STATUS.arrived,
      DELIVERY_STATUS.completed,
    ]) {
      const view = mapOrderToBookingView(
        order({ DispatchOrder: [{ dispatchID: "d-1", status }] }),
      );
      expect(view.crews[0].status).toBe("Accepted");
    }
  });

  it("reports a rejected dispatch as declined, and a pending one as pending", () => {
    const declined = mapOrderToBookingView(
      order({ DispatchOrder: [{ dispatchID: "d-1", status: DELIVERY_STATUS.rejected }] }),
    );
    expect(declined.crews[0].status).toBe("Declined");

    const pending = mapOrderToBookingView(
      order({ DispatchOrder: [{ dispatchID: "d-1", status: DELIVERY_STATUS.assigned }] }),
    );
    expect(pending.crews[0].status).toBe("Pending");
  });

  it("reads the schedule and priority back out of the notes blob", () => {
    const view = mapOrderToBookingView(order());
    expect(view.scheduledDate).toBe("2026-09-05");
    expect(view.priorityLevel).toBe("Urgent");
    expect(view.plainNotes).toBe("Handle with care");
  });
});

describe("pickups on the booking feeds", () => {
  it("uses the pickup rows when the booking has them", () => {
    const view = mapOrderToBookingView(
      order({
        PickupStops: [
          {
            pickupID: 2,
            warehouseName: "Cavite Depot",
            pickupAddress: "Gen. Trias, Cavite",
            expectedTime: "09:30",
            sequence: 2,
            stopStatus: STOP_STATUS.pending,
          },
          {
            pickupID: 1,
            warehouseName: "Main Office",
            pickupAddress: "Pasig",
            expectedTime: "08:00",
            sequence: 1,
            stopStatus: STOP_STATUS.delivered,
          },
        ],
      }),
    );

    const feed = toFeedBooking(view);

    expect(feed.pickupList.map((pickup) => pickup.warehouseName)).toEqual([
      "Main Office",
      "Cavite Depot",
    ]);
    expect(feed.pickupList[0].stopStatus).toBe("Completed");
    expect(feed.pickupList[0].warehouseAddress).toBe("Pasig");
    expect(feed.pickupList[1].pickupTime).toBe("09:30");
  });

  it("still reads the notes line for bookings made before pickups were rows", () => {
    const feed = toFeedBooking(mapOrderToBookingView(order()));

    expect(feed.pickupList).toHaveLength(1);
    expect(feed.pickupList[0].warehouseName).toBe("Pacific Harvest Main Office");
    expect(feed.pickupList[0].pickupTime).toBe("08:00");
    expect(feed.pickupList[0].stopStatus).toBe("Pending");
  });

  it("shows nothing rather than a placeholder when there is no pickup at all", () => {
    const feed = toFeedBooking(mapOrderToBookingView(order({ notes: "" })));
    expect(feed.pickupList).toHaveLength(0);
  });
});

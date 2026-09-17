import { describe, expect, it } from "vitest";

import {
  ACTIVE_DELIVERY_STATUSES,
  DELIVERY_STATUS,
  FINISHED_DELIVERY_STATUSES,
  isDeliveryActive,
  isDeliveryFinished,
  isDeliveryTerminal,
  isStopDelivered,
  isStopFailed,
  STOP_STATUS,
  TERMINAL_DELIVERY_STATUSES,
} from "@/app/lib/enums";

// These labels are the ones Postgres holds. A typo here is a write that
// fails silently, which is how "Completed" ended up being written to a
// stopStatus column whose enum has never contained it.
describe("delivery status labels", () => {
  it("spells the stop statuses exactly as stop_status does", () => {
    expect(Object.values(STOP_STATUS)).toEqual([
      "Pending",
      "Arrived",
      "Successfully Delivered",
      "Foul Trip",
      "Cancelled",
    ]);
  });

  it("puts every delivery status in exactly one of active or terminal", () => {
    const all = Object.values(DELIVERY_STATUS);
    const covered = [...ACTIVE_DELIVERY_STATUSES, ...TERMINAL_DELIVERY_STATUSES];

    expect([...covered].sort()).toEqual([...all].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("counts a trip mid-route as active, not free", () => {
    // A truck in any of these is out on a job and must not be assigned a
    // second booking. Start Delivery, In Warehouse and Arrived used to be
    // in neither list, which left the truck looking available.
    for (const status of [
      DELIVERY_STATUS.startDelivery,
      DELIVERY_STATUS.inWarehouse,
      DELIVERY_STATUS.inTransit,
      DELIVERY_STATUS.arrived,
    ]) {
      expect(isDeliveryActive(status)).toBe(true);
      expect(isDeliveryTerminal(status)).toBe(false);
    }
  });

  it("separates finishing a trip from a trip merely ending", () => {
    expect(FINISHED_DELIVERY_STATUSES).not.toContain(DELIVERY_STATUS.foulTrip);
    expect(FINISHED_DELIVERY_STATUSES).not.toContain(DELIVERY_STATUS.cancelled);
    expect(isDeliveryFinished(DELIVERY_STATUS.completed)).toBe(true);
    expect(isDeliveryFinished(DELIVERY_STATUS.foulTrip)).toBe(false);
    expect(isDeliveryTerminal(DELIVERY_STATUS.foulTrip)).toBe(true);
  });
});

describe("stop status matching", () => {
  it("reads both the current and the older spellings as delivered", () => {
    expect(isStopDelivered(STOP_STATUS.delivered)).toBe(true);
    expect(isStopDelivered("Completed")).toBe(true);
    expect(isStopDelivered(STOP_STATUS.pending)).toBe(false);
  });

  it("treats a foul trip, a failure and a cancellation as failed", () => {
    expect(isStopFailed(STOP_STATUS.foulTrip)).toBe(true);
    expect(isStopFailed(STOP_STATUS.cancelled)).toBe(true);
    expect(isStopFailed("Delivery failed")).toBe(true);
    expect(isStopFailed(STOP_STATUS.delivered)).toBe(false);
  });

  it("says nothing about a missing status", () => {
    expect(isStopDelivered(null)).toBe(false);
    expect(isStopFailed(undefined)).toBe(false);
  });
});

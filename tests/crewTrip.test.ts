import { describe, expect, it } from "vitest";

import { describeItems, quantityOf, readPriority, totalQuantity } from "@/app/lib/crewTrip";

// The crew used to be shown "Assorted Goods", "See Manifest" and "Standard" on
// every trip. These read the real values off the booking.

describe("what the crew is told about a trip", () => {
  it("reads the priority the office booked with", () => {
    expect(readPriority("[DELIVERY DETAILS]\nPriority: Urgent\nDelivery Schedule: 2026-10-06")).toBe("Urgent");
    expect(readPriority("Delivery Schedule: 2026-10-06")).toBe("");
    expect(readPriority("Priority: undefined")).toBe("");
  });

  it("names what is on the truck, with how many of each", () => {
    expect(describeItems([{ productName: "Sardines", quantity: 120 }, { productName: "Noodles", quantity: 80 }])).toBe("Sardines ×120, Noodles ×80");
    expect(describeItems([])).toBe("");
  });

  it("totals the load", () => {
    expect(totalQuantity([{ quantity: 120 }, { quantity: 80 }])).toBe("200 items");
    expect(totalQuantity([{ quantity: 1 }])).toBe("1 item");
    expect(totalQuantity([])).toBe("");
  });

  it("shows a stop's quantity only when one was recorded", () => {
    expect(quantityOf(1500)).toBe("1,500");
    expect(quantityOf(null)).toBe("");
    expect(quantityOf(0)).toBe("");
  });
});

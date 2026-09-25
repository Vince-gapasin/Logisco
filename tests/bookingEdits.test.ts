import { describe, expect, it } from "vitest";

import { changedBookingFields } from "@/app/lib/bookingEdits";

const booking = {
  scheduledDate: "2026-09-05",
  priorityLevel: "Standard",
  product: "Rice",
  notes: "Handle with care",
};

const form = {
  deliverySchedule: "2026-09-05",
  priorityLevel: "Standard",
  product: "Rice",
  notes: "Handle with care",
};

describe("what a booking screen changed", () => {
  it("sends nothing when nothing was touched", () => {
    expect(changedBookingFields(booking, form)).toBeNull();
  });

  it("sends only the field that moved", () => {
    expect(changedBookingFields(booking, { ...form, deliverySchedule: "2026-09-11" })).toEqual({
      deliverySchedule: "2026-09-11",
    });
  });

  it("sends several at once", () => {
    expect(
      changedBookingFields(booking, { ...form, priorityLevel: "Urgent", product: "Sugar" }),
    ).toEqual({ priorityLevel: "Urgent", product: "Sugar" });
  });

  it("lets the notes be emptied, but not the schedule", () => {
    expect(changedBookingFields(booking, { ...form, notes: "   " })).toEqual({ notes: "" });
    expect(changedBookingFields(booking, { ...form, deliverySchedule: "" })).toBeNull();
  });

  it("ignores whitespace that changes nothing", () => {
    expect(changedBookingFields(booking, { ...form, product: "  Rice  " })).toBeNull();
  });

  it("treats a booking with no notes as empty rather than missing", () => {
    expect(changedBookingFields({ ...booking, notes: undefined }, { ...form, notes: "" })).toBeNull();
  });
});

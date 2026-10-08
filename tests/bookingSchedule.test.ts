import { afterEach, describe, expect, it, vi } from "vitest";

import { createOrderSchema, updateOrderSchema } from "@/app/schemas/booking/booking.schema";
import { CLOCK_RULE, isQuarterHour, PAST_TIME_RULE, QUARTER_HOUR_RULE } from "@/app/lib/bookingRules";
import { minutesUntil } from "@/app/lib/datetime";

// What the server will accept as a delivery date and a stop time.
//
// It accepted almost anything. expectedTime was z.string().min(1), so "banana"
// was a valid delivery time and the form's own <input type="time"> was the only
// thing enforcing a clock - which holds for the form and for nothing else that
// posts here. The schedule was not a field at all: it arrived inside the notes
// blob and was scraped back out with a regex that quietly produced null when it
// did not match, so a booking with an unreadable date was stored with no date
// and never appeared on the calendar.

// Mid-morning in Manila, which is 02:00 UTC on the same day.
const NOW = new Date("2026-10-05T02:00:00.000Z");

const booking = (over: Record<string, unknown> = {}) => ({
  clientID: null,
  deliverySchedule: "2026-10-06",
  notes: "",
  items: [{ productName: "Buns", productType: "General", quantity: 10, weightPerItem: 1 }],
  stops: [
    {
      branchName: "Makati Branch",
      contactPerson: "Trisha Molina",
      contactNum: "09281112013",
      expectedTime: "08:00",
      quantity: 10,
      deliveryAddress: "Ayala Ave, Makati City",
    },
  ],
  ...over,
});

const stopWith = (expectedTime: unknown) =>
  createOrderSchema.safeParse(
    booking({ stops: [{ ...booking().stops[0], expectedTime }] }),
  );

afterEach(() => {
  vi.useRealTimers();
});

const at = (now: Date) => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
};

describe("the day a delivery is for", () => {
  it("is a field the server checks, not a line in the notes", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking()).success).toBe(true);
    // Without it there is no booking, rather than a booking with no date.
    const missing = booking();
    delete (missing as Record<string, unknown>).deliverySchedule;
    expect(createOrderSchema.safeParse(missing).success).toBe(false);
  });

  it("refuses a day that has gone", () => {
    at(NOW);
    const result = createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-04" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toMatch(/already passed/i);
  });

  it("allows today, because most deliveries are for today", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-05", stops: [{ ...booking().stops[0], expectedTime: "14:00" }] })).success).toBe(true);
  });

  it("reads today in Manila, not in UTC", () => {
    // Half past midnight on the 6th in Manila is still 16:30 on the 5th in UTC.
    // Judged against UTC, a booking for the 6th made now would be "tomorrow"
    // and one for the 5th would be refused as past - both wrong where the
    // trucks are.
    at(new Date("2026-10-05T16:30:00.000Z"));
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-06", stops: [{ ...booking().stops[0], expectedTime: "08:00" }] })).success).toBe(true);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-05" })).success).toBe(false);
  });

  it("refuses a date that is the right shape and not a date", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2026-13-45" })).success).toBe(false);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "06/10/2026" })).success).toBe(false);
  });

  it("refuses a day the calendar does not have, which Date.parse rolled forward", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2027-02-30" })).success).toBe(false);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2027-04-31" })).success).toBe(false);
    expect(updateOrderSchema.safeParse({ deliverySchedule: "2027-02-29" }).success).toBe(false);
  });

  it("refuses a day more than a year out, which is a typo far more often than a plan", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2027-10-05" })).success).toBe(true);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2062-10-05" })).success).toBe(false);
    expect(updateOrderSchema.safeParse({ deliverySchedule: "2062-10-05" }).success).toBe(false);
  });
});

describe("the time a stop is expected", () => {
  it("has to be a clock", () => {
    at(NOW);
    expect(stopWith("08:00").success).toBe(true);
    expect(stopWith("23:45").success).toBe(true);
    // What the database hands back when a time is read and sent again.
    expect(stopWith("08:00:00").success).toBe(true);
  });

  it("says the same words the booking form says", () => {
    // One rule, imported by both, so a time the form accepted cannot be
    // refused by the server with different wording - or at all.
    at(NOW);
    const result = stopWith("banana");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toBe(CLOCK_RULE);
  });

  it("refuses what is not one", () => {
    at(NOW);
    for (const nonsense of ["banana", "8", "8am", "25:00", "08:60", "", "  "]) {
      expect(stopWith(nonsense).success, `accepted ${JSON.stringify(nonsense)}`).toBe(false);
    }
  });

  it("is required on a pickup, and checked", () => {
    // While it was optional, a pickup without a time made the whole itinerary unreadable
    // and every check on it was skipped without a word.
    at(NOW);
    const pickup = (expectedTime: unknown) =>
      createOrderSchema.safeParse(
        booking({ pickups: [{ warehouseName: "Valenzuela", pickupAddress: "Valenzuela City", quantity: 10, expectedTime }] }),
      );

    expect(pickup(undefined).success).toBe(false);
    expect(pickup("").success).toBe(false);
    expect(pickup("06:30").success).toBe(true);
    expect(pickup("whenever").success).toBe(false);
    expect(pickup("06:20").success).toBe(false);
  });

  it("is booked on the quarter hour", () => {
    // :00, :15, :30 and :45 are all the time picker offers.
    at(NOW);
    for (const quarter of ["00:00", "08:15", "13:30", "23:45", "08:00:00"]) {
      expect(stopWith(quarter).success, `refused ${quarter}`).toBe(true);
    }
    const result = stopWith("08:10");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toBe(QUARTER_HOUR_RULE);
  });

  it("does not call an older booking's 08:10 an invalid clock", () => {
    // Bookings made before the rule keep their times; only new ones are held to it.
    expect(isQuarterHour("08:10")).toBe(false);
    expect(isQuarterHour("08:15:30")).toBe(false);
    expect(isQuarterHour("banana")).toBe(false);
  });
});

describe("a stop booked for today", () => {
  // 10:00 in Manila.
  const today = (stops: unknown[], pickups: unknown[] = []) =>
    createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-05", stops, pickups }));
  const stop = (expectedTime: string, deliveryAddress = "Ayala Ave, Makati City") => ({ ...booking().stops[0], expectedTime, deliveryAddress });
  const pickup = (expectedTime: string) => ({ warehouseName: "Valenzuela", pickupAddress: "Valenzuela City", quantity: 10, expectedTime });

  it("cannot start at a time already gone", () => {
    at(NOW);
    const result = today([stop("08:00")]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toBe(PAST_TIME_RULE);
    expect(result.error.issues[0].path).toEqual(["stops", 0, "expectedTime"]);
  });

  it("is refused without needing the map, so a lost address cannot wave it through", () => {
    at(NOW);
    expect(today([stop("09:45")]).success).toBe(false);
    expect(today([stop("10:00")]).success).toBe(true);
  });

  it("is judged on the first pickup, which is where the truck goes first", () => {
    at(NOW);
    const result = today([stop("15:00")], [pickup("09:30")]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(["pickups", 0, "expectedTime"]);
  });

  it("lets a later stop be earlier on the clock - that is the next morning", () => {
    at(NOW);
    expect(today([stop("03:00")], [pickup("21:00")]).success).toBe(true);
  });

  it("says nothing about another day's times", () => {
    at(NOW);
    expect(createOrderSchema.safeParse(booking({ deliverySchedule: "2026-10-06", stops: [stop("06:00")] })).success).toBe(true);
  });
});

describe("the addresses on a booking", () => {
  const withStops = (stops: unknown[], pickups: unknown[] = []) => createOrderSchema.safeParse(booking({ stops, pickups }));
  const stop = (deliveryAddress: unknown) => ({ ...booking().stops[0], deliveryAddress });
  const pickup = (pickupAddress: unknown) => ({ warehouseName: "Valenzuela", pickupAddress, quantity: 10, expectedTime: "06:00" });

  it("are required on every stop", () => {
    at(NOW);
    expect(withStops([stop(undefined)]).success).toBe(false);
    expect(withStops([stop("   ")]).success).toBe(false);
    expect(withStops([stop("Makati")], [pickup(undefined)]).success).toBe(false);
    expect(withStops([stop("Makati")], [pickup("Valenzuela")]).success).toBe(true);
  });

  it("cannot be the same place twice, or a pickup that is also a delivery", () => {
    at(NOW);
    const repeated = withStops([stop("Makati City"), stop("makati, city")]);
    expect(repeated.success).toBe(false);
    if (!repeated.success) expect(repeated.error.issues[0].path).toEqual(["stops", 1, "deliveryAddress"]);

    const both = withStops([stop("Valenzuela City")], [pickup("Valenzuela City")]);
    expect(both.success).toBe(false);
    if (!both.success) expect(both.error.issues[0].message).toContain("Already used as pickup 1");
  });

  it("refuses one long enough to be something else", () => {
    at(NOW);
    expect(withStops([stop("x".repeat(501))]).success).toBe(false);
  });
});

describe("rescheduling", () => {
  it("cannot move a booking into the past either", () => {
    // Checked for shape but not for sense, so a delivery could be rescheduled
    // into last year.
    at(NOW);
    expect(updateOrderSchema.safeParse({ deliverySchedule: "2025-01-01" }).success).toBe(false);
    expect(updateOrderSchema.safeParse({ deliverySchedule: "2026-10-09" }).success).toBe(true);
  });
});

describe("counting the minutes to a stop", () => {
  it("reads the gap in Manila, not in UTC", () => {
    // 08:00 on the 5th in Manila is midnight UTC. A server comparing its own
    // clock against the wall clock on the stop is eight hours out, which is the
    // difference between a delivery that can be reached and one that cannot.
    const now = new Date("2026-10-05T00:00:00.000Z"); // 08:00 in Manila
    expect(minutesUntil("2026-10-05", "08:00", now)).toBe(0);
    expect(minutesUntil("2026-10-05", "11:30", now)).toBe(210);
    expect(minutesUntil("2026-10-06", "08:00", now)).toBe(1440);
  });

  it("goes negative for a time that has gone", () => {
    const now = new Date("2026-10-05T02:00:00.000Z"); // 10:00 in Manila
    expect(minutesUntil("2026-10-05", "08:00", now)).toBe(-120);
  });

  it("gives nothing for something that is not a date and a time", () => {
    expect(minutesUntil("not-a-date", "08:00")).toBeNull();
    expect(minutesUntil("2026-10-05", "banana")).toBeNull();
  });
});

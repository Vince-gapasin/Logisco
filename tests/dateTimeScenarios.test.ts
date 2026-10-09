import { afterEach, describe, expect, it, vi } from "vitest";

import { createOrderSchema } from "@/app/schemas/booking/booking.schema";
import {
  checkStopSchedule,
  moveRemainingRoute,
  EARLIER_SAME_DAY_RULE,
  RUN_TOO_LONG_RULE,
  SAME_TIME_RULE,
  stopMoment,
} from "@/app/lib/stopSchedule";
import { PAST_TIME_RULE } from "@/app/lib/bookingRules";
import { assessFeasibility } from "@/app/lib/deliveryFeasibility";
import { expectedAt, wasOnTime } from "@/app/lib/performance";

// The date and time of every stop, followed end to end: what the booking form
// works out, what the server then accepts or refuses, and how a stop is judged
// once it is made. Each case is one a coordinator will actually meet.

afterEach(() => vi.useRealTimers());
const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

// 10:00 on Friday 9 October in Manila.
const FRIDAY_10AM = "2026-10-09T02:00:00.000Z";

type Stop = { date?: string; time: string };

/**
 * The booking form's own step: resolve every row's day, and send each stop
 * with it - exactly what the form hands the dashboard to post.
 */
function submitFromForm(bookingDate: string, pickups: Stop[], deliveries: Stop[]) {
  const route = [...pickups, ...deliveries];
  const { dates, issues } = checkStopSchedule(route, { bookingDate });
  const body = {
    clientID: null,
    deliverySchedule: bookingDate,
    notes: "",
    items: [{ productName: "Tiles", productType: "General", quantity: 10, weightPerItem: 0 }],
    pickups: pickups.map((stop, i) => ({
      warehouseName: `Warehouse ${i + 1}`,
      pickupAddress: `Warehouse ${i + 1}, Valenzuela`,
      quantity: 10,
      expectedTime: stop.time,
      expectedDate: dates[i],
    })),
    stops: deliveries.map((stop, i) => ({
      branchName: `Branch ${i + 1}`,
      contactPerson: "Trisha",
      contactNum: "09281112013",
      deliveryAddress: `Branch ${i + 1}, Cebu`,
      quantity: 10,
      expectedTime: stop.time,
      expectedDate: dates[pickups.length + i],
    })),
  };
  return { formIssues: issues.map((issue) => issue.message), server: createOrderSchema.safeParse(body) };
}

const serverMessages = (result: ReturnType<typeof submitFromForm>["server"]) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("the form and the server agree", () => {
  it("on a one-day booking", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-10", [{ time: "08:00" }], [{ time: "14:00" }]);
    expect(formIssues).toEqual([]);
    expect(server.success).toBe(true);
  });

  it("on an overnight run, once the drop is given the next day", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-10", [{ time: "21:00" }], [{ date: "2026-10-11", time: "03:00" }]);
    expect(formIssues).toEqual([]);
    expect(server.success).toBe(true);
  });

  it("refusing an overnight run left on one day, in the same words", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-10", [{ time: "21:00" }], [{ time: "03:00" }]);
    expect(formIssues).toEqual([EARLIER_SAME_DAY_RULE]);
    expect(serverMessages(server)).toEqual([EARLIER_SAME_DAY_RULE]);
  });

  it("on a run of a week, Day 1 to Day 7", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm(
      "2026-10-10",
      [{ time: "08:00" }],
      [{ date: "2026-10-12", time: "10:00" }, { date: "2026-10-16", time: "17:00" }],
    );
    expect(formIssues).toEqual([]);
    expect(server.success).toBe(true);
  });

  it("refusing Day 8, in the same words", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-10", [{ time: "08:00" }], [{ date: "2026-10-17", time: "09:00" }]);
    expect(formIssues).toEqual([RUN_TOO_LONG_RULE]);
    expect(serverMessages(server)).toEqual([RUN_TOO_LONG_RULE]);
  });

  it("refusing two stops in the same minute", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-10", [{ time: "08:00" }], [{ time: "08:00" }]);
    expect(formIssues).toEqual([SAME_TIME_RULE]);
    expect(serverMessages(server)).toEqual([SAME_TIME_RULE]);
  });

  it("refusing a first stop already behind the clock, booked for today", () => {
    at(FRIDAY_10AM);
    const { formIssues, server } = submitFromForm("2026-10-09", [{ time: "09:30" }], [{ time: "15:00" }]);
    expect(formIssues).toEqual([PAST_TIME_RULE]);
    expect(serverMessages(server)).toEqual([PAST_TIME_RULE]);
  });
});

describe("Manila time, wherever the clock is", () => {
  it("reads a quarter past midnight in Manila as the new day, though UTC is still on the old one", () => {
    // 00:15 Saturday in Manila is 16:15 Friday in UTC.
    at("2026-10-09T16:15:00.000Z");
    // Booking for Saturday at 00:30 is still ahead.
    expect(submitFromForm("2026-10-10", [{ time: "00:30" }], [{ time: "06:00" }]).server.success).toBe(true);
    // Booking for Saturday at 00:00 has just gone.
    expect(serverMessages(submitFromForm("2026-10-10", [{ time: "00:00" }], [{ time: "06:00" }]).server)).toEqual([
      PAST_TIME_RULE,
    ]);
    // Friday is now yesterday.
    expect(submitFromForm("2026-10-09", [{ time: "22:00" }], [{ time: "23:00" }]).server.success).toBe(false);
  });

  it("places a stop at the same instant whatever zone the machine is in", () => {
    // 08:00 in Manila is 00:00 UTC; the moment is fixed by the +08:00 offset.
    expect(stopMoment("2026-10-10", "08:00")).toBe(Date.parse("2026-10-10T00:00:00Z") / 60_000);
  });
});

describe("the drive across days", () => {
  const moments = (stops: [string, string][]) => stops.map(([date, time]) => stopMoment(date, time) as number);

  it("lets a long-haul leg take the two days it was given", () => {
    const result = assessFeasibility({
      times: ["08:00", "16:00"],
      travelMinutes: 20 * 60,
      legMinutes: [20 * 60],
      moments: moments([["2026-10-10", "08:00"], ["2026-10-12", "16:00"]]),
    });
    expect(result.verdict).toBe("fine");
  });

  it("still refuses that leg squeezed into one day", () => {
    const result = assessFeasibility({
      times: ["08:00", "16:00"],
      travelMinutes: 20 * 60,
      legMinutes: [20 * 60],
      moments: moments([["2026-10-10", "08:00"], ["2026-10-10", "16:00"]]),
    });
    expect(result.verdict).toBe("impossible");
  });
});

describe("a stop judged once it is made", () => {
  it("is on time at its own day's time, and late against the booking's first day", () => {
    // Day 3 stop due 15:00 on the 12th; the crew got there at 14:40.
    const arrived = "2026-10-12T06:40:00.000Z";
    expect(wasOnTime(expectedAt("2026-10-12", "15:00"), arrived)).toBe(true);
    expect(wasOnTime(expectedAt("2026-10-10", "15:00"), arrived)).toBe(false);
  });
});

describe("a foul trip picked up again on a later day", () => {
  it("keeps made stops on their day and moves the rest together", () => {
    // Pickup and first drop made on the 10th; the truck broke down before the
    // drops on the 10th and the 11th. Recovered on the 14th.
    const moved = moveRemainingRoute(
      ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-11"],
      [true, true, false, false],
      "2026-10-14",
    );
    expect(moved).toEqual(["2026-10-10", "2026-10-10", "2026-10-14", "2026-10-15"]);
  });

  it("moves nothing when every stop is already made", () => {
    expect(moveRemainingRoute(["2026-10-10"], [true], "2026-10-14")).toEqual(["2026-10-10"]);
  });
});

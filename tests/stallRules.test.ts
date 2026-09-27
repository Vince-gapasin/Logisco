import { describe, expect, it } from "vitest";

import {
  assessStall,
  describeSilence,
  leftOpenAlert,
  leftOpenDedupeKey,
  stallAlert,
  stallDedupeKey,
  AT_STOP_METRES,
  LEFT_OPEN_AFTER_MIN,
  STALL_THRESHOLDS_MIN,
} from "@/app/lib/stallRules";

const NOW = new Date("2026-09-26T10:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const onTheRoad = (minutes: number, metresToNearestStop: number | null = 5_000) =>
  assessStall({
    lastReportedAt: minutesAgo(minutes),
    status: "In Transit",
    metresToNearestStop,
    now: NOW,
  });

describe("deciding a truck has gone quiet", () => {
  it("says nothing before the first threshold", () => {
    expect(onTheRoad(14).stalled).toBe(false);
    expect(onTheRoad(14).reason).toBe("reporting");
  });

  it("passes each threshold in turn", () => {
    expect(onTheRoad(15).threshold).toBe(15);
    expect(onTheRoad(29).threshold).toBe(15);
    expect(onTheRoad(30).threshold).toBe(30);
    expect(onTheRoad(44).threshold).toBe(30);
    expect(onTheRoad(45).threshold).toBe(45);
    expect(onTheRoad(119).threshold).toBe(45);
  });

  it("keeps escalating past forty-five minutes", () => {
    // It used to stop here, so a truck missing for two days produced one
    // notification and then nothing at all.
    expect(onTheRoad(120).threshold).toBe(120);
    expect(onTheRoad(359).threshold).toBe(120);
    expect(onTheRoad(360).threshold).toBe(360);
    expect(onTheRoad(1439).threshold).toBe(360);
  });

  it("counts the minutes it has been quiet", () => {
    expect(onTheRoad(37).silentFor).toBe(37);
  });

  it("leaves a truck alone while it sits at one of its own stops", () => {
    // Unloading takes longer than any of these thresholds, routinely.
    const loading = onTheRoad(50, AT_STOP_METRES - 1);
    expect(loading.stalled).toBe(false);
    expect(loading.reason).toBe("at a stop");
    // It still says how long, so a screen can show it without alarm.
    expect(loading.silentFor).toBe(50);
  });

  it("raises it once the truck is clear of the stop", () => {
    expect(onTheRoad(50, AT_STOP_METRES + 1).stalled).toBe(true);
  });

  it("only watches trips that are on the road", () => {
    for (const status of ["Assigned", "Accepted", "Completed", "Foul Trip", "Rejected"]) {
      const verdict = assessStall({ lastReportedAt: minutesAgo(90), status, metresToNearestStop: 9_000, now: NOW });
      expect(verdict.stalled).toBe(false);
      expect(verdict.reason).toBe("not on the road");
    }
  });

  it("does not call a trip that has never reported stalled", () => {
    // It may not have set off, or the app may never have been opened. Worth
    // knowing, but it is not this alarm.
    const verdict = assessStall({ lastReportedAt: null, status: "In Transit", metresToNearestStop: null, now: NOW });
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("never reported");
  });

  it("is not fooled by a position timestamped in the future", () => {
    const verdict = assessStall({
      lastReportedAt: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
      status: "In Transit",
      metresToNearestStop: 9_000,
      now: NOW,
    });
    expect(verdict.silentFor).toBe(0);
    expect(verdict.stalled).toBe(false);
  });

  it("raises it when the nearest stop is unknown rather than staying silent", () => {
    // A stop with no coordinates cannot vouch for the truck sitting at it.
    expect(onTheRoad(50, null).stalled).toBe(true);
  });
});

describe("a trip nobody closed", () => {
  it("stops being treated as a stalled truck after a day", () => {
    // Almost always a delivery that finished with nobody closing it. Chasing it
    // as an emergency is wrong, and it would otherwise sit in every check for
    // ever - as one trip in the live database did, for 45 hours.
    const verdict = onTheRoad(LEFT_OPEN_AFTER_MIN);
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("left open");
    expect(verdict.threshold).toBeNull();
  });

  it("still says how long, so the board can show it", () => {
    expect(onTheRoad(2_701).silentFor).toBe(2_701);
  });

  it("is still left alone while the truck sits at one of its stops", () => {
    expect(onTheRoad(3_000, AT_STOP_METRES - 1).reason).toBe("at a stop");
  });

  it("asks for the trip to be closed rather than raising an alarm", () => {
    const alert = leftOpenAlert("ORD-1 (Acme)", 2_701);
    expect(alert.body).toMatch(/close it/i);
    expect(alert.body).toContain("2 days");
    expect(alert.title).not.toMatch(/urgent|silent/i);
  });

  it("is a reminder once a day, not one notification that scrolls away", () => {
    const morning = new Date("2026-09-26T08:00:00.000Z");
    const evening = new Date("2026-09-26T20:00:00.000Z");
    const tomorrow = new Date("2026-09-27T08:00:00.000Z");

    expect(leftOpenDedupeKey("d1", morning)).toBe(leftOpenDedupeKey("d1", evening));
    expect(leftOpenDedupeKey("d1", morning)).not.toBe(leftOpenDedupeKey("d1", tomorrow));
  });
});

describe("saying how long in words", () => {
  it("counts minutes, then hours, then days", () => {
    expect(describeSilence(1)).toBe("1 minute");
    expect(describeSilence(46)).toBe("46 minutes");
    expect(describeSilence(60)).toBe("1 hour");
    expect(describeSilence(120)).toBe("2 hours");
    expect(describeSilence(1_407)).toBe("23 hours");
    expect(describeSilence(1_440)).toBe("1 day");
    expect(describeSilence(2_701)).toBe("2 days");
    expect(describeSilence(2_100)).toBe("1 day");
    expect(describeSilence(4_320)).toBe("3 days");
  });
});

describe("what each threshold is worth saying", () => {
  it("tells nobody at fifteen minutes", () => {
    const alert = stallAlert(15, "ORD-1 (Acme)", 15);
    expect(alert.notifyOffice).toBe(false);
    expect(alert.crew).toBeNull();
    expect(alert.severity).toBe("info");
  });

  it("asks the crew and tells the office at thirty", () => {
    const alert = stallAlert(30, "ORD-1 (Acme)", 31);
    expect(alert.notifyOffice).toBe(true);
    expect(alert.crew).not.toBeNull();
    expect(alert.severity).toBe("action");
  });

  it("names the real silence in the title, not the rung it landed on", () => {
    // The one alert this has ever sent in production was titled "Truck silent
    // for 45 minutes" over a body reporting 1,407 minutes.
    expect(stallAlert(45, "ORD-1 (Acme)", 1_407).office.title).toContain("23 hours");
    expect(stallAlert(360, "ORD-1 (Acme)", 800).office.title).toContain("13 hours");
    expect(stallAlert(45, "ORD-1 (Acme)", 46).office.title).toContain("46 minutes");
  });

  it("does not claim to know why the truck went quiet", () => {
    // A dead phone and a stopped truck send the same thing: nothing. The advice
    // used to be "call the driver, or report a foul trip", which is the answer
    // to only one of them.
    for (const threshold of STALL_THRESHOLDS_MIN) {
      if (threshold === 15) continue;
      const body = stallAlert(threshold, "ORD-1 (Acme)", threshold + 1).office.body;
      expect(body).toMatch(/lost contact|the two look the same/i);
    }
  });

  it("tells the office to call the driver before treating it as a breakdown", () => {
    const alert = stallAlert(45, "ORD-1 (Acme)", 46);
    expect(alert.severity).toBe("urgent");
    expect(alert.office.body).toMatch(/call the driver/i);
    expect(alert.office.body).toMatch(/restart/i);
  });

  it("mentions a foul trip only once the driver cannot be reached", () => {
    expect(stallAlert(45, "ORD-1 (Acme)", 46).office.body).not.toMatch(/foul trip/i);
    expect(stallAlert(120, "ORD-1 (Acme)", 121).office.body).toMatch(/foul trip/i);
  });

  it("writes to the crew in their own words, not the office's", () => {
    // The driver used to be told to "call the driver, or report a foul trip",
    // and to be informed that "the crew have been asked to confirm".
    for (const threshold of [30, 45, 120, 360] as const) {
      const crew = stallAlert(threshold, "ORD-1 (Acme)", threshold + 1).crew!;
      expect(crew.body).not.toMatch(/call the driver|report a foul trip|the crew have been/i);
      expect(crew.body).toMatch(/tell your coordinator/i);
      expect(crew.title).toMatch(/are you alright/i);
    }
  });
});

describe("saying a thing once", () => {
  it("is the same key for the same silence", () => {
    const reported = minutesAgo(40);
    expect(stallDedupeKey("d1", 30, reported)).toBe(stallDedupeKey("d1", 30, reported));
  });

  it("is a different key for each threshold", () => {
    const reported = minutesAgo(40);
    expect(stallDedupeKey("d1", 30, reported)).not.toBe(stallDedupeKey("d1", 45, reported));
  });

  it("is a different key when the truck has moved since and gone quiet again", () => {
    expect(stallDedupeKey("d1", 30, minutesAgo(40))).not.toBe(stallDedupeKey("d1", 30, minutesAgo(90)));
  });

  it("does not let the office's notification silence the crew's", () => {
    const reported = minutesAgo(40);
    expect(stallDedupeKey("d1", 30, reported, "office")).not.toBe(stallDedupeKey("d1", 30, reported, "crew"));
  });
});

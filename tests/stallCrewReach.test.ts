import { describe, expect, it } from "vitest";

import {
  crewUnreachedAlert,
  crewUnreachedDedupeKey,
  delayContinuingAlert,
  stallAlert,
  thresholdFor,
  whyCrewUnreached,
} from "@/app/lib/stallRules";
import { PUSH_CHANNELS } from "@/app/lib/pushChannels";

const landed = { recipients: 2, duplicate: false, push: { configured: true, devices: 2, sent: 1 } };

describe("whether the crew's alert reached a phone", () => {
  it("counts it as reached when Firebase took it for at least one phone", () => {
    expect(whyCrewUnreached(2, landed)).toBeNull();
  });

  it("names each way it can fail to land", () => {
    expect(whyCrewUnreached(0, null)).toBe("no crew");
    expect(whyCrewUnreached(2, { recipients: 0, duplicate: false, push: null })).toBe("not written");
    expect(whyCrewUnreached(2, { ...landed, push: { configured: false, devices: 0, sent: 0 } })).toBe("push off");
    expect(whyCrewUnreached(2, { ...landed, push: { configured: true, devices: 0, sent: 0 } })).toBe("no phone");
    expect(whyCrewUnreached(2, { ...landed, push: { configured: true, devices: 3, sent: 0 } })).toBe("refused");
  });

  it("does not judge an alert that was already sent on an earlier check", () => {
    expect(whyCrewUnreached(2, { recipients: 0, duplicate: true, push: null })).toBeNull();
  });
});

describe("telling the office the crew were not reached", () => {
  it("says why and asks them to call", () => {
    const alert = crewUnreachedAlert("ORD-1 (Acme)", 16, "no phone");
    expect(alert.body).toContain("ORD-1 (Acme)");
    expect(alert.body).toMatch(/16 minutes/);
    expect(alert.body).toMatch(/not signed in|none of the crew/i);
    expect(alert.body).toMatch(/call them/i);
  });

  it("is said once per silence, not at every rung", () => {
    expect(crewUnreachedDedupeKey("d1", "2026-10-06T01:00:00Z")).toBe(
      crewUnreachedDedupeKey("d1", "2026-10-06T01:00:00Z"),
    );
    expect(crewUnreachedDedupeKey("d1", "2026-10-06T01:00:00Z")).not.toBe(
      crewUnreachedDedupeKey("d1", "2026-10-06T03:00:00Z"),
    );
  });

  it("stops telling the office the crew have been asked when they were not", () => {
    expect(stallAlert(30, "ORD-1", 31).office.body).toMatch(/have been asked/i);
    const unreached = stallAlert(30, "ORD-1", 31, "unknown", { crewReached: false }).office.body;
    expect(unreached).not.toMatch(/have been asked/i);
    expect(unreached).toMatch(/could not be reached/i);

    expect(delayContinuingAlert("ORD-1", "traffic", 31).office.body).toMatch(/have been asked/i);
    expect(delayContinuingAlert("ORD-1", "traffic", 31, false).office.body).toMatch(/could not be reached/i);
  });
});

describe("the fifteen-minute question", () => {
  it("is a rung of its own", () => {
    expect(thresholdFor(14)).toBeNull();
    expect(thresholdFor(15)).toBe(15);
    expect(thresholdFor(44)).toBe(30);
  });

  it("goes to a channel other than the one created without vibration", () => {
    expect(PUSH_CHANNELS.alerts).not.toBe(PUSH_CHANNELS.general);
  });
});

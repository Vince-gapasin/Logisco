import { beforeEach, describe, expect, it, vi } from "vitest";

// What a reschedule says back about the new times.
//
// Moving a booking to today re-runs the drive check. Tight times, or times the
// map could not check, are saved - an edit has no confirmation step - and come
// back as a warning for the edit window to show. It used to ride inside "data",
// where nothing read it, so the coordinator was never told.

const ORDER = "44444444-4444-4444-8444-444444444444";

let outcome: Record<string, unknown>;
let refusal: Error | null;

vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/app/lib/auth", () => ({
  OFFICE_ROLES: ["Admin", "Coordinator"],
  authorize: () =>
    Promise.resolve({ auth: { employee: { employeeID: "e1", employeeName: "Office", role: "Admin" }, user: { id: "u1" } } }),
}));
vi.mock("@/services/audit/auditService", () => ({
  auditActor: () => ({}),
  recordAudit: () => Promise.resolve(),
}));
vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["Admin"],
  bookingCrew: () => Promise.resolve([]),
  crewOf: () => Promise.resolve([]),
  notify: () => Promise.resolve(),
}));
vi.mock("@/services/booking/bookingService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/booking/bookingService")>();
  return {
    ...real,
    updateBooking: () => (refusal ? Promise.reject(refusal) : Promise.resolve(outcome)),
  };
});

const { PATCH } = await import("@/app/api/bookings/[id]/route");
const { RescheduleNotPossible } = await import("@/services/booking/bookingService");

const reschedule = (deliverySchedule: string) =>
  PATCH(
    new Request(`http://test/api/bookings/${ORDER}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "update", deliverySchedule }),
    }),
    { params: Promise.resolve({ id: ORDER }) },
  );

const moved = (warning: string | null) => ({
  orderCode: "ORD-1",
  dispatchID: null,
  before: { deliverySchedule: "2099-01-02" },
  after: { deliverySchedule: "2099-01-01" },
  changed: ["deliverySchedule"],
  rescheduled: true,
  warning,
});

beforeEach(() => {
  refusal = null;
});

describe("a reschedule's warning", () => {
  it("comes back beside the data, where the edit window reads it", async () => {
    outcome = moved("These times leave the crew nothing to spare.");
    const res = await reschedule("2026-12-01");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warning).toBe("These times leave the crew nothing to spare.");
  });

  it("is null when there is nothing to say", async () => {
    outcome = moved(null);
    const body = await (await reschedule("2026-12-01")).json();
    expect(body.warning).toBeNull();
  });

  it("is not a refusal - a day the truck cannot make is still a 400 on the date", async () => {
    refusal = new RescheduleNotPossible("Valenzuela is 30 minutes away and it is 2 hours from the yard.");
    const res = await reschedule("2026-12-01");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.deliverySchedule).toEqual([refusal.message]);
    expect(body.warning).toBeUndefined();
  });
});

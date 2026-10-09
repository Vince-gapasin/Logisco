import { beforeEach, describe, expect, it, vi } from "vitest";

// Moving a booking to today asks before it saves.
//
// The drive check runs again when a booking is moved to today. Times with
// nothing to spare, or times nobody could check, used to be saved first and
// mentioned afterwards - when all the coordinator could do was read it. Now
// nothing is written: the route answers 409 with the question, in the shape a
// new booking's question takes, and the edit window sends it again kept.

const ORDER = "44444444-4444-4444-8444-444444444444";

let outcome: Record<string, unknown>;
let refusal: Error | null;
const received: Record<string, unknown>[] = [];

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
    updateBooking: (_id: string, dto: Record<string, unknown>) => {
      received.push(dto);
      return refusal ? Promise.reject(refusal) : Promise.resolve(outcome);
    },
  };
});

const { PATCH } = await import("@/app/api/bookings/[id]/route");
const { RescheduleNeedsConfirmation, RescheduleNotPossible } = await import("@/services/booking/bookingService");
const { addDays } = await import("@/app/lib/bookingRules");
const { todayInManila } = await import("@/app/lib/datetime");

// A month out, whenever this runs: a fixed date would fall into the past and
// be refused by the schema before the route got to say anything.
const NEXT_MONTH = addDays(todayInManila(), 30);

const send = (body: Record<string, unknown>) =>
  PATCH(
    new Request(`http://test/api/bookings/${ORDER}`, { method: "PATCH", body: JSON.stringify({ action: "update", ...body }) }),
    { params: Promise.resolve({ id: ORDER }) },
  );

beforeEach(() => {
  refusal = null;
  received.length = 0;
  outcome = {
    orderCode: "ORD-1",
    dispatchID: null,
    before: { deliverySchedule: "2099-01-02" },
    after: { deliverySchedule: NEXT_MONTH },
    changed: ["deliverySchedule"],
    rescheduled: true,
  };
});

describe("moving a booking to today", () => {
  it("answers with the question, saving nothing, when the times are tight or unchecked", async () => {
    refusal = new RescheduleNeedsConfirmation("This leaves 30 minutes for a 100 minute drive. It can be driven, with nothing to spare.");
    const res = await send({ deliverySchedule: NEXT_MONTH });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ message: refusal.message, needsConfirmation: "tightSchedule" });
  });

  it("passes the coordinator's choice to keep today through to the save", async () => {
    const res = await send({ deliverySchedule: NEXT_MONTH, acknowledgeTightSchedule: true });

    expect(res.status).toBe(200);
    expect(received[0]).toMatchObject({ deliverySchedule: NEXT_MONTH, acknowledgeTightSchedule: true });
  });

  it("does not count the choice alone as something to change", async () => {
    const res = await send({ acknowledgeTightSchedule: true });
    expect(res.status).toBe(400);
    expect(received).toHaveLength(0);
  });

  it("still refuses a day the truck cannot make, as a 400 on the date", async () => {
    refusal = new RescheduleNotPossible("Valenzuela is 30 minutes away and it is 2 hours from the yard.");
    const res = await send({ deliverySchedule: NEXT_MONTH });

    expect(res.status).toBe(400);
    expect((await res.json()).errors.deliverySchedule).toEqual([refusal.message]);
  });
});

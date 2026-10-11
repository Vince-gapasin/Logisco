import { beforeEach, describe, expect, it, vi } from "vitest";

// Closing a stop takes a signed receipt.
//
// The crew app asked for a photograph at every stop; the server did not, so a
// stop could still be closed on nothing, or on a picture of the road. Now the
// server asks too, and reads the photograph before anything is written: a
// refused photograph leaves the stop exactly as it was, so the crew can retake
// it and send the same request again.

const TRIP = "11111111-2222-3333-4444-555555555555";

type Verdict = { verdict: "passed" | "failed" | "unverified"; reasons: string[]; nameOnReceipt: string | null };
let verdict: Verdict;

const uploads: string[] = [];
const podRows: Record<string, unknown>[] = [];
const dispatchUpdates: Record<string, unknown>[] = [];
const unverifiedAnnouncements: string[] = [];

vi.mock("@/app/lib/auth", () => ({
  CREW_ROLES: ["driver", "helper"],
  authorize: async () => ({ auth: { employee: { employeeID: "emp-1", employeeName: "Ana" } }, response: null }),
}));

vi.mock("@/services/dispatch/dispatchService", () => ({
  isUuid: (v: unknown) => typeof v === "string" && v.length === 36,
  getCrewAssignment: async () => ({
    isDriver: true,
    dispatch: { status: "Arrived", current_step: 1, orderID: "order-1", dispatchNote: "", pod_url: null },
  }),
  crewReadinessFor: async () => new Map(),
  crewNotReadyReason: () => null,
  releaseDispatchResources: async () => {},
  TERMINAL_DISPATCH_STATUSES: ["Completed", "Cancelled"],
}));

vi.mock("@/services/storage/podValidation", () => ({
  validatePodImage: async () => verdict,
}));

vi.mock("@/services/storage/podService", () => ({
  POD_BUCKET: "delivery_proofs",
  signPodUrl: async (path: string) => `signed:${path}`,
}));

vi.mock("@/services/audit/auditService", () => ({ auditActor: () => ({}), recordAudit: async () => {} }));
vi.mock("@/services/fleet/routePlanService", () => ({ forgetDispatchRoute: () => {} }));
vi.mock("@/services/notifications/notify", () => ({
  notify: async () => 0,
  OFFICE: [],
  tripLabel: async () => "ORD-1",
}));
vi.mock("@/services/dispatch/crewUpdateService", () => ({
  announceUnverifiedProof: async (_d: string, stop: string) => {
    unverifiedAnnouncements.push(stop);
  },
}));

// Just enough of the Supabase query builder for this route.
vi.mock("@/app/lib/supabase", () => {
  const builder = (table: string) => {
    let pendingUpdate: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      update: (payload: Record<string, unknown>) => {
        pendingUpdate = payload;
        if (table === "DispatchOrder") dispatchUpdates.push(payload);
        return chain;
      },
      insert: async (row: Record<string, unknown>) => {
        if (table === "POD") podRows.push(row);
        return { error: null };
      },
      maybeSingle: async () => {
        if (table === "BranchStops" && !pendingUpdate) return { data: { branchID: 5, arrivedAt: null } };
        if (table === "DispatchOrder") return { data: { dispatchID: TRIP } };
        return { data: null };
      },
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    };
    return chain;
  };
  return {
    supabase: {
      from: builder,
      storage: {
        from: () => ({
          upload: async (name: string) => {
            uploads.push(name);
            return { error: null };
          },
        }),
      },
    },
  };
});

const { POST } = await import("@/app/api/crew/dispatches/status/route");

function request(fields: { photo?: boolean; receiverName?: string; branchID?: string }) {
  const form = new FormData();
  form.append("dispatchID", TRIP);
  form.append("status", "In Transit");
  form.append("current_step", "2");
  form.append("title", "Dropoff: Main Branch");
  if (fields.branchID !== undefined) form.append("branchID", fields.branchID);
  if (fields.receiverName !== undefined) form.append("receiverName", fields.receiverName);
  if (fields.photo) form.append("podImage", new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/crew/dispatches/status", { method: "POST", body: form });
}

beforeEach(() => {
  verdict = { verdict: "passed", reasons: [], nameOnReceipt: "Juan Dela Cruz" };
  uploads.length = 0;
  podRows.length = 0;
  dispatchUpdates.length = 0;
  unverifiedAnnouncements.length = 0;
});

describe("a stop without a receipt", () => {
  it("is refused when there is no photograph", async () => {
    const response = await POST(request({ branchID: "5", receiverName: "Juan" }));
    expect(response.status).toBe(400);
    expect(dispatchUpdates).toHaveLength(0);
  });

  it("is refused when there is no receiver name", async () => {
    const response = await POST(request({ branchID: "5", photo: true }));
    expect(response.status).toBe(400);
    expect(dispatchUpdates).toHaveLength(0);
  });
});

describe("a photograph the check refuses", () => {
  it("is sent back with the reasons, and nothing is written", async () => {
    verdict = { verdict: "failed", reasons: ["No signature found on the receipt."], nameOnReceipt: null };
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true }));

    expect(response.status).toBe(422);
    expect((await response.json()).reasons).toEqual(["No signature found on the receipt."]);
    expect(uploads).toHaveLength(0);
    expect(dispatchUpdates).toHaveLength(0);
    expect(podRows).toHaveLength(0);
  });
});

describe("a signed receipt", () => {
  it("closes the stop and records what the check read", async () => {
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true }));

    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(podRows[0]).toMatchObject({
      branchID: 5,
      validationStatus: "passed",
      validationNotes: null,
      nameOnReceipt: "Juan Dela Cruz",
      missingReason: null,
    });
    expect(unverifiedAnnouncements).toHaveLength(0);
  });
});

describe("a receipt nobody could check", () => {
  it("still closes the stop, and the office is asked to look", async () => {
    verdict = { verdict: "unverified", reasons: ["The receipt could not be checked automatically."], nameOnReceipt: null };
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true }));

    expect(response.status).toBe(200);
    expect(podRows[0]).toMatchObject({ validationStatus: "unverified" });
    expect(unverifiedAnnouncements).toEqual(["Main Branch"]);
  });
});

describe("a step that is not a stop", () => {
  it("needs no receipt, as before", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(podRows).toHaveLength(0);
  });
});

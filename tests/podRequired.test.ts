import { beforeEach, describe, expect, it, vi } from "vitest";

// Closing a stop takes a signed receipt.
//
// The crew app asked for a photograph at every stop; the server did not, so a
// stop could still be closed on nothing, or on a picture of the road. Now the
// server asks too, and reads the photograph before anything is written: a
// refused photograph leaves the stop exactly as it was, so the crew can retake
// it and send the same request again.
//
// What is checked about the scan itself - the place, the time, reuse - is in
// podScan.test.ts. This is the route doing something with the answer.

const TRIP = "11111111-2222-3333-4444-555555555555";

let fileAlreadyUsed = false;

const uploads: string[] = [];
const podRows: Record<string, unknown>[] = [];
const podPhotoRows: Record<string, unknown>[] = [];
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
    // The hashes a PODPhotos lookup asked about, answered as already used
    // when the test says so.
    let askedHashes: string[] = [];
    let inserted: Record<string, unknown> | Record<string, unknown>[] | null = null;
    const answer = () => {
      if (table === "PODPhotos" && askedHashes.length) {
        return { data: fileAlreadyUsed ? askedHashes.map((imageHash) => ({ imageHash })) : [], error: null };
      }
      if (table === "POD" && inserted) return { data: { podID: "pod-new" }, error: null };
      return { data: [], error: null };
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      gte: () => chain,
      not: () => chain,
      order: () => chain,
      in: (column: string, values: string[]) => {
        if (column === "imageHash") askedHashes = values;
        return chain;
      },
      limit: async () => ({ data: [] }),
      update: (payload: Record<string, unknown>) => {
        pendingUpdate = payload;
        if (table === "DispatchOrder") dispatchUpdates.push(payload);
        return chain;
      },
      insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        inserted = row;
        if (table === "POD") podRows.push(row as Record<string, unknown>);
        if (table === "PODPhotos") podPhotoRows.push(...(Array.isArray(row) ? row : [row]));
        return chain;
      },
      single: async () => answer(),
      maybeSingle: async () => {
        if (table === "BranchStops" && !pendingUpdate) {
          return { data: { branchID: 5, deliveryLat: 14.5995, deliverLong: 120.9842, arrivedAt: null } };
        }
        if (table === "DispatchOrder") return { data: { dispatchID: TRIP } };
        return { data: null };
      },
      then: (resolve: (v: unknown) => void) => resolve(answer()),
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
          remove: async () => ({ error: null }),
        }),
      },
    },
  };
});

const { POST } = await import("@/app/api/crew/dispatches/status/route");

function scan(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    method: "scanner",
    capturedAt: new Date().toISOString(),
    latitude: 14.5996,
    longitude: 120.9843,
    accuracy: 10,
    textWords: 30,
    signature: true,
    nameFound: true,
    dHash: "0123456789abcdef",
    docNumbers: ["0010293", "2026"],
    flags: [],
    ...overrides,
  });
}

function request(fields: {
  photo?: boolean;
  receiverName?: string;
  branchID?: string;
  scan?: string;
  /** Several photos, each with its own scan; the bytes tell them apart. */
  photos?: { bytes: number[]; scan?: string }[];
}) {
  const form = new FormData();
  form.append("dispatchID", TRIP);
  form.append("status", "In Transit");
  form.append("current_step", "2");
  form.append("title", "Dropoff: Main Branch");
  if (fields.branchID !== undefined) form.append("branchID", fields.branchID);
  if (fields.receiverName !== undefined) form.append("receiverName", fields.receiverName);
  if (fields.photo) form.append("podImage", new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" }));
  if (fields.scan) form.append("scan", fields.scan);
  for (const photo of fields.photos ?? []) {
    form.append("podImage", new File([new Uint8Array(photo.bytes)], "receipt.jpg", { type: "image/jpeg" }));
    form.append("scan", photo.scan ?? "");
  }
  return new Request("http://localhost/api/crew/dispatches/status", { method: "POST", body: form });
}

beforeEach(() => {
  fileAlreadyUsed = false;
  uploads.length = 0;
  podRows.length = 0;
  podPhotoRows.length = 0;
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

describe("a scan the server refuses", () => {
  it("is sent back with the reason, and nothing is written", async () => {
    const response = await POST(
      request({ branchID: "5", receiverName: "Juan", photo: true, scan: scan({ signature: false }) }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).reasons[0]).toMatch(/blank/);
    expect(uploads).toHaveLength(0);
    expect(dispatchUpdates).toHaveLength(0);
    expect(podRows).toHaveLength(0);
  });

  it("refuses a photo already used for another stop", async () => {
    fileAlreadyUsed = true;
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true, scan: scan() }));
    expect(response.status).toBe(422);
    expect(podRows).toHaveLength(0);
  });
});

describe("a signed receipt, scanned at the stop", () => {
  it("closes the stop and records where, when and how it was scanned", async () => {
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true, scan: scan() }));

    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(podRows[0]).toMatchObject({
      branchID: 5,
      validationStatus: "passed",
      validationNotes: null,
      scanMethod: "scanner",
      captureLat: 14.5996,
      captureLng: 120.9843,
      imageDHash: "0123456789abcdef",
      missingReason: null,
    });
    expect(podRows[0].imageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(unverifiedAnnouncements).toHaveLength(0);
  });
});

describe("a receipt the scan could not fully check", () => {
  it("still closes the stop, and the office is asked to look", async () => {
    const response = await POST(
      request({
        branchID: "5",
        receiverName: "Juan",
        photo: true,
        scan: scan({ flags: ["The receiver's name typed by the crew was not found on the receipt."] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(podRows[0]).toMatchObject({ validationStatus: "unverified" });
    expect(String(podRows[0].validationNotes)).toMatch(/name/);
    expect(unverifiedAnnouncements).toEqual(["Main Branch"]);
  });

  it("takes a photo from an app without the scanner, for review", async () => {
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photo: true }));
    expect(response.status).toBe(200);
    expect(podRows[0]).toMatchObject({ validationStatus: "unverified", scanMethod: "camera" });
  });
});

describe("a receipt of more than one photo", () => {
  it("checks, uploads and records every page, in order", async () => {
    const response = await POST(
      request({
        branchID: "5",
        receiverName: "Juan",
        photos: [
          { bytes: [1, 2, 3], scan: scan() },
          { bytes: [4, 5, 6], scan: scan({ dHash: "fedcba9876543210" }) },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(2);
    // The stop's row keeps photo 1, so everything that reads it is unchanged.
    expect(podRows).toHaveLength(1);
    expect(podRows[0]).toMatchObject({ proof: uploads[0], validationStatus: "passed", imageDHash: "0123456789abcdef" });
    expect(podPhotoRows).toEqual([
      expect.objectContaining({ podID: "pod-new", position: 1, path: uploads[0], validationStatus: "passed" }),
      expect.objectContaining({ podID: "pod-new", position: 2, path: uploads[1], imageDHash: "fedcba9876543210" }),
    ]);
  });

  it("refuses the stop when one page fails, says which, and writes nothing", async () => {
    const response = await POST(
      request({
        branchID: "5",
        receiverName: "Juan",
        photos: [
          { bytes: [1, 2, 3], scan: scan() },
          { bytes: [4, 5, 6], scan: scan({ signature: false }) },
        ],
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.photoIndex).toBe(1);
    expect(body.reasons[0]).toMatch(/^Photo 2: .*blank/);
    expect(uploads).toHaveLength(0);
    expect(podRows).toHaveLength(0);
    expect(dispatchUpdates).toHaveLength(0);
  });

  it("refuses the same photo added twice", async () => {
    const response = await POST(
      request({
        branchID: "5",
        receiverName: "Juan",
        photos: [
          { bytes: [1, 2, 3], scan: scan() },
          { bytes: [1, 2, 3], scan: scan() },
        ],
      }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).reasons[0]).toMatch(/added twice/);
    expect(uploads).toHaveLength(0);
  });

  it("puts the stop in front of the office when any page needs a look", async () => {
    const response = await POST(
      request({
        branchID: "5",
        receiverName: "Juan",
        photos: [
          { bytes: [1, 2, 3], scan: scan() },
          { bytes: [4, 5, 6], scan: scan({ flags: ["The receiver's name typed by the crew was not found on the receipt."] }) },
        ],
      }),
    );
    expect(response.status).toBe(200);
    expect(podRows[0]).toMatchObject({ validationStatus: "unverified" });
    expect(String(podRows[0].validationNotes)).toMatch(/^Photo 2: /);
    expect(podPhotoRows.map((row) => row.validationStatus)).toEqual(["passed", "unverified"]);
  });

  it("takes at most five", async () => {
    const photos = [1, 2, 3, 4, 5, 6].map((n) => ({ bytes: [n], scan: scan() }));
    const response = await POST(request({ branchID: "5", receiverName: "Juan", photos }));
    expect(response.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });
});

describe("a step that is not a stop", () => {
  it("needs no receipt, as before", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(podRows).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The photo-check switches.
//
// The office relaxes a check so a photo that fails it is accepted for review
// instead of refused. Reading the switch must never fail open: no table, no
// row, a bad value or an error all read as strict. Changing it is recorded and
// the office is told.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const audits: { action: string; before: unknown; after: unknown }[] = [];
vi.mock("@/services/audit/auditService", () => ({
  recordAudit: async (entry: { action: string; before: unknown; after: unknown }) => {
    audits.push(entry);
  },
  auditActor: () => ({ employeeID: "emp-1", name: "Ana" }),
}));

const notices: { title: string; roles?: string[] }[] = [];
vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["Admin", "Coordinator"],
  notify: async (input: { title: string; roles?: string[] }) => {
    notices.push(input);
    return 1;
  },
}));

let role = "Admin";
vi.mock("@/app/lib/auth", () => ({
  OFFICE_ROLES: ["Admin", "Coordinator"],
  authorize: async (_request: Request, roles?: string[]) =>
    roles && !roles.includes(role)
      ? { response: new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }) }
      : { auth: { employee: { employeeID: "emp-1", employeeName: "Ana", role } }, response: null },
}));

const { getPhotoChecks, setPhotoCheck } = await import("@/services/settings/photoCheckSettings");
const { PUT } = await import("@/app/api/settings/photo-checks/route");

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
  audits.length = 0;
  notices.length = 0;
  role = "Admin";
});

describe("reading the switches", () => {
  it("reads what is set", async () => {
    db.queue({ data: [{ key: "podReceiptCheck", value: "relaxed" }, { key: "repairPhotoCheck", value: "strict" }] });
    expect(await getPhotoChecks()).toEqual({ podReceiptCheck: "relaxed", repairPhotoCheck: "strict" });
  });

  it("reads strict when the table is not there yet", async () => {
    db.queue({ data: null, error: { message: 'relation "AppSettings" does not exist' } });
    expect(await getPhotoChecks()).toEqual({ podReceiptCheck: "strict", repairPhotoCheck: "strict" });
  });

  it("reads strict for a missing row or a value it does not know", async () => {
    db.queue({ data: [{ key: "podReceiptCheck", value: "off" }] });
    expect(await getPhotoChecks()).toEqual({ podReceiptCheck: "strict", repairPhotoCheck: "strict" });
  });
});

describe("changing a switch", () => {
  it("saves it, records who did it, and tells the office", async () => {
    db.queue({ data: [] }); // currently strict
    expect(await setPhotoCheck("podReceiptCheck", "relaxed", { employeeID: "emp-1", name: "Ana" })).toBe(true);

    const upsert = db.writes.find((write) => write.table === "AppSettings" && write.chain.includes("upsert"));
    expect(upsert?.payload).toMatchObject({ key: "podReceiptCheck", value: "relaxed", updatedBy: "emp-1" });
    expect(audits).toEqual([
      expect.objectContaining({ action: "SETTING_CHANGE", before: { podReceiptCheck: "strict" }, after: { podReceiptCheck: "relaxed" } }),
    ]);
    expect(notices).toEqual([expect.objectContaining({ title: expect.stringMatching(/relaxed/), roles: ["Admin", "Coordinator"] })]);
  });

  it("does nothing when it is already in that mode", async () => {
    db.queue({ data: [{ key: "podReceiptCheck", value: "relaxed" }] });
    expect(await setPhotoCheck("podReceiptCheck", "relaxed", null)).toBe(false);
    expect(db.writes).toHaveLength(0);
    expect(notices).toHaveLength(0);
  });
});

describe("the route", () => {
  const put = (body: unknown) =>
    PUT(new Request("http://localhost/api/settings/photo-checks", { method: "PUT", body: JSON.stringify(body) }));

  it("is refused to the crew and mechanics", async () => {
    for (const who of ["Driver", "Helper", "Mechanic"]) {
      role = who;
      expect((await put({ podReceiptCheck: "relaxed" })).status).toBe(403);
    }
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a mode it does not know, and an empty change", async () => {
    expect((await put({ podReceiptCheck: "off" })).status).toBe(400);
    expect((await put({})).status).toBe(400);
  });

  it("lets a coordinator change it", async () => {
    role = "Coordinator";
    db.queue({ data: [] }, { data: null }, { data: [{ key: "repairPhotoCheck", value: "relaxed" }] });
    const response = await put({ repairPhotoCheck: "relaxed" });
    expect(response.status).toBe(200);
    expect((await response.json()).data.repairPhotoCheck.mode).toBe("relaxed");
  });
});

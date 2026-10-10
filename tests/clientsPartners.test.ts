import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Clients & Partners: one active record per name, and partners held to the
// partner rules on the route the page actually saves through.
//
// Nothing stopped the same company being added twice. And the page saves
// partners through /api/subcontractors, which checked only a name, a contact
// person and the phone - so "qa@test" was saved as an email address.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
vi.mock("@/app/lib/auth", () => ({
  requireAuth: () => Promise.resolve({ employee: { employeeID: "e1", employeeName: "Office", role: "Admin" } }),
  requireRole: () => null,
}));

const { assertNameFree, nameKey, DuplicateNameError } = await import("@/services/client/uniqueName");
const { partnerFields, fromPartnerFields } = await import("@/app/api/subcontractors/partnerFields");
const { POST } = await import("@/app/api/subcontractors/route");
const { PATCH } = await import("@/app/api/subcontractors/[id]/route");
const { isValidEmail, EMAIL_RULE } = await import("@/app/lib/emailRule");

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("a name already in use", () => {
  it("is the same name whatever the case or spacing", () => {
    expect(nameKey("  Bayan   Burger ")).toBe(nameKey("bayan burger"));
  });

  it("is refused for a new client", async () => {
    db.queue({ data: [{ clientID: "c1", company: "Bayan Burger Food Group" }] });
    await expect(
      assertNameFree({ table: "Client", nameColumn: "company", idColumn: "clientID", name: "bayan burger  food group", label: "A client" }),
    ).rejects.toThrow('A client named "Bayan Burger Food Group" already exists.');
  });

  it("lets a record keep its own name when it is edited", async () => {
    db.queue({ data: [{ clientID: "c1", company: "Bayan Burger Food Group" }] });
    await expect(
      assertNameFree({ table: "Client", nameColumn: "company", idColumn: "clientID", name: "Bayan Burger Food Group", excludeId: "c1", label: "A client" }),
    ).resolves.toBeUndefined();
  });

  it("asks only about active records, so a removed client's name can be used again", async () => {
    db.queue({ data: [] });
    await assertNameFree({ table: "Client", nameColumn: "company", idColumn: "clientID", name: "Anything", label: "A client" });
    expect(db.calls[0].chain).toContain("eq");
  });
});

describe("an email address", () => {
  it("is held to the server's rule on the forms too", () => {
    // The browser accepts "qa@test"; the server never has.
    expect(isValidEmail("qa@test")).toBe(false);
    expect(isValidEmail("qa@test.com")).toBe(true);
    expect(EMAIL_RULE).toMatch(/name@company\.com/);
  });
});

describe("the partner routes the page saves through", () => {
  const partner = (over: Record<string, unknown> = {}) => ({
    companyName: "QA Haulers",
    contractType: "Regular",
    contactPerson: "QA Tester",
    contactNumber: "09171234567",
    emailAddress: "ops@qahaulers.com",
    businessAddress: "1 Test Street, Makati",
    ...over,
  });
  const post = (body: unknown) => POST(new Request("http://test/api/subcontractors", { method: "POST", body: JSON.stringify(body) }));
  const patch = (body: unknown) =>
    PATCH(new Request("http://test/api/subcontractors/s1", { method: "PATCH", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) });

  it("refuses an email the partner rules refuse, saving nothing", async () => {
    const res = await post(partner({ emailAddress: "qa@test" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.emailAddress).toEqual([EMAIL_RULE]);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a contract type that is not one of the three", async () => {
    const res = await post(partner({ contractType: "Forever" }));
    expect(res.status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a second active partner with the same name, as a 409", async () => {
    db.queue({ data: [{ subConID: "s9", companyName: "QA Haulers" }] });
    const res = await post(partner({ companyName: "qa haulers" }));
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('A partner named "QA Haulers" already exists.');
    expect(db.writes).toHaveLength(0);
  });

  it("saves a partner that keeps every rule, under the stored column names", async () => {
    db.queue({ data: [] }, { data: { subConID: "s1" } });
    const res = await post(partner());
    expect(res.status).toBe(201);
    expect(db.writes[0].payload).toEqual([
      expect.objectContaining({ companyName: "QA Haulers", contactName: "QA Tester", emailAddress: "ops@qahaulers.com", contractType: "Regular" }),
    ]);
  });

  it("checks an edit by the same rules", async () => {
    const res = await patch(partner({ emailAddress: "nope" }));
    expect(res.status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });

  it("translates between the page's names and the partner rules' names", () => {
    expect(partnerFields({ companyName: "X", contactPerson: "Y" })).toEqual({ name: "X", contactPerson: "Y" });
    expect(fromPartnerFields({ name: "X", contactPerson: "Y" })).toEqual({ companyName: "X", contactPerson: "Y" });
  });
});

describe("DuplicateNameError", () => {
  it("is what the routes recognise", () => {
    expect(new DuplicateNameError("x")).toBeInstanceOf(Error);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// What each office role may do with people's records.
//
// The coordinator runs deliveries. They need to see who works here, whether
// they are free and what their record says - so they can view the directory and
// every profile - but changing someone's personal record is the admin's. And
// the directory itself is the office's: a mechanic fills a dropdown from it,
// and was being handed every employee's home address and phone to do it.

let role = "Coordinator";
const updated: unknown[] = [];

vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/app/lib/supabaseAuth", () => ({ supabaseAuth: {} }));
vi.mock("@/app/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/app/lib/auth")>();
  return {
    ...real,
    requireAuth: () =>
      Promise.resolve({
        user: { id: "u1" },
        employee: { employeeID: "99999999-9999-4999-8999-999999999999", employeeName: "Office", role, isActive: true },
      }),
  };
});
vi.mock("@/services/audit/auditService", () => ({ auditActor: () => ({}), recordAudit: () => Promise.resolve() }));
vi.mock("@/services/notifications/notify", () => ({ notify: () => Promise.resolve(0), OFFICE: ["Admin", "Coordinator"] }));
vi.mock("@/services/employee/employeeService", () => ({
  getEmployees: () =>
    Promise.resolve({
      total: 1,
      employees: [
        {
          employeeID: "11111111-1111-4111-8111-111111111111",
          employeeName: "Juan Dela Cruz",
          role: "Driver",
          availability: "Available",
          isActive: true,
          address: "12 Mabini St, Lipa",
          contact: "09171234567",
          emailAddress: "juan@example.com",
          auth_id: "auth-1",
        },
      ],
    }),
  getEmployeeById: () => Promise.resolve({ employeeID: "11111111-1111-4111-8111-111111111111" }),
  updateEmployee: (...args: unknown[]) => {
    updated.push(args);
    return Promise.resolve({});
  },
  deleteEmployee: () => Promise.resolve({}),
  createEmployee: () => Promise.resolve({}),
}));
vi.mock("@/services/forecasting/forecastingService", () => ({ generateForecast: () => Promise.resolve({ ok: true }) }));

const list = await import("@/app/api/employees/route");
const one = await import("@/app/api/employees/[id]/route");
const forecast = await import("@/app/api/forecasting/data/route");

const EMPLOYEE = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: EMPLOYEE }) };

beforeEach(() => {
  updated.length = 0;
});

describe("a coordinator", () => {
  beforeEach(() => {
    role = "Coordinator";
  });

  it("sees the full directory", async () => {
    const res = await list.GET(new Request("http://test/api/employees"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data[0].contact).toBe("09171234567");
  });

  it("cannot change an employee's record", async () => {
    const res = await one.PATCH(
      new Request(`http://test/api/employees/${EMPLOYEE}`, { method: "PATCH", body: JSON.stringify({ address: "Elsewhere" }) }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(updated).toHaveLength(0);
  });

  it("cannot set someone On Leave or Unavailable - that is the admin's", async () => {
    for (const availability of ["On Leave", "Unavailable"]) {
      const res = await one.PATCH(
        new Request(`http://test/api/employees/${EMPLOYEE}`, { method: "PATCH", body: JSON.stringify({ availability }) }),
        ctx,
      );
      expect(res.status).toBe(403);
    }
    expect(updated).toHaveLength(0);
  });

  it("cannot delete one", async () => {
    const res = await one.DELETE(new Request(`http://test/api/employees/${EMPLOYEE}`, { method: "DELETE" }), ctx);
    expect(res.status).toBe(403);
  });

  it("can read the forecast", async () => {
    const res = await forecast.GET(new Request("http://test/api/forecasting/data"));
    expect(res.status).toBe(200);
  });
});

describe("a mechanic", () => {
  beforeEach(() => {
    role = "Mechanic";
  });

  it("gets names and roles from the directory, not addresses and phones", async () => {
    const res = await list.GET(new Request("http://test/api/employees?role=Mechanic"));
    const [person] = (await res.json()).data;
    expect(person).toEqual({
      employeeID: EMPLOYEE,
      employeeName: "Juan Dela Cruz",
      role: "Driver",
      availability: "Available",
      isActive: true,
    });
  });
});

describe("the crew", () => {
  it("cannot read the office's forecast", async () => {
    role = "Driver";
    const res = await forecast.GET(new Request("http://test/api/forecasting/data"));
    expect(res.status).toBe(403);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// What an employee record has to make sense of.
//
// The form checked only that boxes were filled and the server little more: a
// contact of "123", an emergency number of "call me", a birthdate in 2030 and
// a driver whose license expired in 2020 were all saved - and nothing else in
// the system looks at license expiry, so that driver could be put on a trip.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { checkEmployeeFields, LICENSE_EXPIRED_RULE, FUTURE_DATE_RULE, NOT_A_DATE_RULE, EXPERIENCE_RULE } = await import("@/app/lib/employeeRules");
const { createEmployeeSchema, updateEmployeeSchema } = await import("@/app/schemas/employee/employee.schema");
const { createEmployee, DuplicateEmailError } = await import("@/services/employee/employeeService");
const { PHONE_RULE } = await import("@/app/lib/bookingRules");
const { EMAIL_RULE } = await import("@/app/lib/emailRule");

const TODAY = "2026-10-10";
const check = (fields: Record<string, unknown>, creating = true) =>
  checkEmployeeFields(fields, { creating, today: TODAY }).map((issue) => ({ field: issue.field, message: issue.message, warning: Boolean(issue.warning) }));

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("an employee's fields", () => {
  it("need phone numbers that are phone numbers", () => {
    expect(check({ contact: "123" })).toEqual([{ field: "contact", message: PHONE_RULE, warning: false }]);
    expect(check({ emergencyContactNumber: "call me" })).toEqual([{ field: "emergencyContactNumber", message: PHONE_RULE, warning: false }]);
    expect(check({ contact: "+63 917 123 4567", emergencyContactNumber: "" })).toEqual([]);
  });

  it("need an email the server accepts", () => {
    expect(check({ emailAddress: "qa@test" })).toEqual([{ field: "emailAddress", message: EMAIL_RULE, warning: false }]);
  });

  it("need dates that exist, and a birthday or check-up that has happened", () => {
    expect(check({ birthdate: "2030-01-01" })).toEqual([{ field: "birthdate", message: FUTURE_DATE_RULE, warning: false }]);
    expect(check({ lastMedicalCheckup: "2026-11-01" })).toEqual([{ field: "lastMedicalCheckup", message: FUTURE_DATE_RULE, warning: false }]);
    expect(check({ dateEmployed: "2026-02-30" })).toEqual([{ field: "dateEmployed", message: NOT_A_DATE_RULE, warning: false }]);
    // A start date next week is a hire, not a mistake.
    expect(check({ dateEmployed: "2026-10-17" })).toEqual([]);
  });

  it("refuse a new driver whose license has expired", () => {
    expect(check({ role: "Driver", licenseExpirationDate: "2020-01-01" })).toEqual([
      { field: "licenseExpirationDate", message: LICENSE_EXPIRED_RULE, warning: false },
    ]);
    expect(check({ role: "Driver", licenseExpirationDate: TODAY })).toEqual([]);
    // A helper's license is not what puts them on the road.
    expect(check({ role: "Helper", licenseExpirationDate: "2020-01-01" })).toEqual([]);
  });

  it("only warn on an existing driver's expired license, so other changes can still be saved", () => {
    expect(check({ role: "Driver", licenseExpirationDate: "2020-01-01" }, false)).toEqual([
      { field: "licenseExpirationDate", message: LICENSE_EXPIRED_RULE, warning: true },
    ]);
  });

  it("take driving experience in whole years", () => {
    expect(check({ drivingExperience: "-1" })).toEqual([{ field: "drivingExperience", message: EXPERIENCE_RULE, warning: false }]);
    expect(check({ drivingExperience: "2.5" })).toHaveLength(1);
    expect(check({ drivingExperience: 5 })).toEqual([]);
  });
});

describe("the employee schemas", () => {
  const employee = (over: Record<string, unknown> = {}) => ({
    employeeID: "11111111-1111-4111-8111-111111111111",
    employeeName: "QA Tester",
    role: "Driver",
    availability: "Available",
    healthStatus: "Fit",
    address: "1 Test Street",
    contact: "0917 123 4567",
    emailAddress: "qa@tester.com",
    licenseExpirationDate: "2099-01-01",
    ...over,
  });

  it("refuse a new driver with an expired license on the server too", () => {
    const result = createEmployeeSchema.safeParse(employee({ licenseExpirationDate: "2020-01-01" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["licenseExpirationDate"]);
  });

  it("let an edit through with an expired license, which the form only warns about", () => {
    expect(updateEmployeeSchema.safeParse({ role: "Driver", licenseExpirationDate: "2020-01-01", address: "2 New St" }).success).toBe(true);
  });

  it("store phone numbers as 09XXXXXXXXX", () => {
    const result = createEmployeeSchema.safeParse(employee({ emergencyContactNumber: "+63 917 765 4321" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact).toBe("09171234567");
      expect(result.data.emergencyContactNumber).toBe("09177654321");
    }
  });

  it("refuse a contact that is not a phone number", () => {
    expect(createEmployeeSchema.safeParse(employee({ contact: "123" })).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ contact: "123" }).success).toBe(false);
  });
});

describe("an email another employee signs in with", () => {
  const dto = { employeeID: "id-1", employeeName: "QA", role: "Helper", availability: "Available", healthStatus: "Fit", address: "x", contact: "09171234567", emailAddress: "Juan_Cruz@Example.com" } as Parameters<typeof createEmployee>[0];

  it("is refused, whatever its case, before anything is saved", async () => {
    db.queue({ data: [{ employeeID: "e9", emailAddress: "juan_cruz@example.com" }] });
    await expect(createEmployee(dto)).rejects.toBeInstanceOf(DuplicateEmailError);
    expect(db.writes).toHaveLength(0);
  });

  it("is looked up with its wildcards escaped, so an underscore matches only an underscore", async () => {
    db.queue({ data: [{ employeeID: "e9", emailAddress: "juanXcruz@example.com" }] }, { data: { employeeID: "id-1" } });
    await createEmployee(dto);
    expect(db.writes).toHaveLength(1);
  });
});

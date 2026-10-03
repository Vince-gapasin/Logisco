import { describe, expect, it } from "vitest";

import { mapApiEmployee } from "@/app/admindashboard/employees/_components/helpers";
import type { ApiEmployee } from "@/app/admindashboard/employees/_components/types";

// A first name of more than one word stays a first name. It used to be split
// off employeeName at the first space, so "Vince Benedict" lost "Benedict" to
// the last name.

const employee = (fields: Partial<ApiEmployee>) =>
  ({ employeeID: "e1", employeeName: "", role: "Admin", availability: "Available", ...fields }) as ApiEmployee;

describe("an employee's name on the form", () => {
  it("keeps a two-word first name as typed", () => {
    const record = mapApiEmployee(
      employee({ employeeName: "Vince Benedict Gapasin", firstName: "Vince Benedict", middleName: "Rosilada", lastName: "Gapasin" }),
    );
    expect(record.firstName).toBe("Vince Benedict");
    expect(record.middleName).toBe("Rosilada");
    expect(record.lastName).toBe("Gapasin");
  });

  it("keeps a two-word last name as typed", () => {
    const record = mapApiEmployee(employee({ employeeName: "Maria Dela Cruz", firstName: "Maria", lastName: "Dela Cruz" }));
    expect(record.firstName).toBe("Maria");
    expect(record.lastName).toBe("Dela Cruz");
  });

  it("falls back to splitting the full name for a record saved before the names had columns", () => {
    const record = mapApiEmployee(employee({ employeeName: "Juan Cruz" }));
    expect(record.firstName).toBe("Juan");
    expect(record.lastName).toBe("Cruz");
  });
});

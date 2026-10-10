import { describe, expect, it } from "vitest";

import { assignableCrew, whyLicenseBlocks, whyNotAssignable } from "@/app/lib/crewEligibility";
import { todayInManila } from "@/app/lib/datetime";

// Whether somebody can actually be sent on a delivery.
//
// The booking screen offered anybody active with the right role, and the
// assignment checked the driver for the same two things and the helpers for
// nothing at all - any id that reached it became a helper. Neither asked
// whether the person could sign in.
//
// An employee record exists before the account does, so there is a window where
// a name is in the system and the person behind it cannot open the app.
// Assigning them looked like a normal assignment and produced a trip nobody on
// it could see: no notification they could read, no dispatch they could accept,
// and - since every assignment has to be accepted before the truck may leave -
// a delivery that could never start and said nothing about why.

const DRIVER = "Driver";
const HELPER = "Helper";

const ana = {
  employeeID: "1",
  employeeName: "Ana Reyes",
  role: DRIVER,
  isActive: true,
  activation_completed_at: "2026-09-01T02:00:00.000Z",
};

describe("who can be sent out", () => {
  it("lets through an active, activated person in the right role", () => {
    expect(whyNotAssignable(ana, DRIVER)).toBeNull();
  });

  it("refuses somebody who has never set up their login", () => {
    // The case that started this: a real employee, correctly entered, with no
    // way to open the app.
    const said = whyNotAssignable({ ...ana, activation_completed_at: null }, DRIVER);
    expect(said).toMatch(/Ana Reyes/);
    expect(said).toMatch(/cannot sign in/i);
    expect(said).toMatch(/activation link/i);
  });

  it("refuses somebody who has left", () => {
    expect(whyNotAssignable({ ...ana, isActive: false }, DRIVER)).toMatch(/no longer an active/i);
  });

  it("refuses a helper offered as a driver", () => {
    expect(whyNotAssignable({ ...ana, role: HELPER }, DRIVER)).toMatch(/is not a driver/i);
  });

  it("refuses an id that belongs to nobody", () => {
    // What the helper slots used to accept without looking.
    expect(whyNotAssignable(undefined, HELPER)).toMatch(/could not be found/i);
    expect(whyNotAssignable(null, HELPER)).toMatch(/could not be found/i);
  });

  it("names the person, because the coordinator has to go and fix it", () => {
    expect(whyNotAssignable({ ...ana, activation_completed_at: null }, DRIVER)).toMatch(/^Ana Reyes/);
    // And copes with a record that somehow has no name on it.
    expect(whyNotAssignable({ ...ana, employeeName: null, isActive: false }, DRIVER)).toMatch(
      /^That crew member/,
    );
  });
});

describe("the list the booking form offers", () => {
  const people = [
    ana,
    { ...ana, employeeID: "2", employeeName: "Ben", activation_completed_at: null },
    { ...ana, employeeID: "3", employeeName: "Cy", isActive: false },
    { ...ana, employeeID: "4", employeeName: "Dee", role: HELPER },
  ];

  it("offers only the ones the assignment would accept", () => {
    // One rule, both places, so the form cannot offer somebody the save then
    // refuses - which is the shape of most of the bugs in this system.
    expect(assignableCrew(people, DRIVER).map((person) => person.employeeName)).toEqual(["Ana Reyes"]);
  });

  it("picks the helpers out the same way", () => {
    expect(assignableCrew(people, HELPER).map((person) => person.employeeName)).toEqual(["Dee"]);
  });
});

describe("a driver whose license has run out", () => {
  // The employee form stops a new driver being saved with an expired license,
  // but only warns on an edit, and a good license runs out in its own time.
  // Nothing at assignment looked, so the driver could still be sent out.
  const TODAY = "2026-10-10";

  it("is refused, by name and with the date it expired", () => {
    const said = whyNotAssignable({ ...ana, licenseExpirationDate: "2026-10-09" }, DRIVER, TODAY);
    expect(said).toMatch(/^Ana Reyes's driver's license expired on/);
    expect(said).toMatch(/Oct 9, 2026/);
  });

  it("can still drive on the day it expires", () => {
    expect(whyNotAssignable({ ...ana, licenseExpirationDate: "2026-10-10" }, DRIVER, TODAY)).toBeNull();
    expect(whyNotAssignable({ ...ana, licenseExpirationDate: "2027-01-01" }, DRIVER, TODAY)).toBeNull();
  });

  it("reads a timestamp as its day", () => {
    expect(whyNotAssignable({ ...ana, licenseExpirationDate: "2026-10-09T00:00:00+00:00" }, DRIVER, TODAY)).toMatch(
      /expired/,
    );
  });

  it("is judged by the day in Manila, not on the server", () => {
    // 16:30 UTC on the 9th is half past midnight on the 10th in Manila, so a
    // license that ran out on the 9th has expired.
    expect(whyLicenseBlocks({ ...ana, licenseExpirationDate: "2026-10-09" }, todayInManila(new Date("2026-10-09T16:30:00Z")))).toMatch(
      /expired/,
    );
  });

  it("does not refuse a missing date - the form is what asks for one", () => {
    expect(whyNotAssignable({ ...ana, licenseExpirationDate: null }, DRIVER, TODAY)).toBeNull();
  });

  it("leaves helpers alone: their license is not what puts them on the road", () => {
    expect(whyNotAssignable({ ...ana, role: HELPER, licenseExpirationDate: "2020-01-01" }, HELPER, TODAY)).toBeNull();
  });

  it("is left out of the drivers the form offers", () => {
    const people = [ana, { ...ana, employeeID: "5", employeeName: "Eve", licenseExpirationDate: "2026-01-01" }];
    expect(assignableCrew(people, DRIVER, TODAY).map((person) => person.employeeName)).toEqual(["Ana Reyes"]);
  });
});

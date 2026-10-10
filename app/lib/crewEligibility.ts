// Whether somebody can actually be sent on a delivery.
//
// The booking screen offered anybody active with the right role, and the
// assignment checked the driver for the same two things and the helpers for
// nothing at all - any id that reached it became a helper.
//
// Neither asked the question that matters: can this person sign in? An employee
// record is created before the account is, so there is a window - sometimes a
// long one - where a name is in the system and the person behind it has no way
// to open the app. Assigning them used to look like a normal assignment. It
// produces a trip nobody on it can see: no notification they can read, no
// dispatch they can accept, and since every assignment has to be accepted
// before the truck may leave, a delivery that can never start and gives no
// reason for it.
//
// So the rule lives here, once, and both the list and the assignment use it.
//
// The same goes for a driver whose license has run out. The employee form stops
// a new driver being saved with one, but only warns on an edit, and a license
// that was fine when entered expires in the meantime - so this is the place
// that keeps them off the road. A helper's license is not checked: it is not
// what puts them on a trip.

import { formatDate, todayInManila } from "@/app/lib/datetime";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";

export interface CrewCandidate {
  // Every field is optional and nullable so a row read straight from the table
  // satisfies this without being reshaped first. The rule has to be applied
  // wherever crew are listed, and a type that only one caller can satisfy is a
  // rule that gets copied instead of reused.
  employeeID?: string | null;
  employeeName?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  /** Set when they finished setting up their login. Null means they cannot. */
  activation_completed_at?: string | null;
  /** YYYY-MM-DD, or a timestamp starting with it. Only judged for a driver. */
  licenseExpirationDate?: string | null;
}

/**
 * Why this driver's license keeps them off a trip, or null if it does not.
 * Expired means the expiry day is before today in Manila; a license that runs
 * out today is still good today. No date on file is not judged here - the
 * employee form is what asks for one.
 */
export function whyLicenseBlocks(
  candidate: CrewCandidate | null | undefined,
  today: string = todayInManila(),
): string | null {
  const expiry = candidate?.licenseExpirationDate?.trim().slice(0, 10);
  if (!expiry || expiry >= today) return null;

  const name = candidate?.employeeName?.trim() || "That driver";
  return (
    `${name}'s driver's license expired on ${formatDate(expiry)}. ` +
    `Record the renewed license on their employee record before assigning them.`
  );
}

/**
 * Why this person cannot be put on a trip, or null if they can.
 *
 * Worded for a coordinator looking at a booking form, not for a log: it names
 * the person and what has to happen before they can be used.
 */
export function whyNotAssignable(
  candidate: CrewCandidate | null | undefined,
  expectedRole: string,
  today: string = todayInManila(),
): string | null {
  if (!candidate) return "That crew member could not be found.";

  const name = candidate.employeeName?.trim() || "That crew member";

  if (candidate.isActive === false) {
    return `${name} is no longer an active employee.`;
  }

  if ((candidate.role ?? "").trim() !== expectedRole) {
    return `${name} is not a ${expectedRole.toLowerCase()}.`;
  }

  if (!candidate.activation_completed_at) {
    return (
      `${name} has not finished setting up their account, so they cannot sign in to see or ` +
      `accept a delivery. Send them an activation link first.`
    );
  }

  if (expectedRole === EMPLOYEE_ROLE.driver) {
    const licenseProblem = whyLicenseBlocks(candidate, today);
    if (licenseProblem) return licenseProblem;
  }

  return null;
}

/** The ones who can be sent out, for a list that should only offer those. */
export function assignableCrew<T extends CrewCandidate>(
  candidates: T[],
  role: string,
  today: string = todayInManila(),
): T[] {
  return candidates.filter((candidate) => whyNotAssignable(candidate, role, today) === null);
}

// What an employee record has to make sense of, checked the same way by the
// employee form and the server.
//
// The form asked only whether each box had something in it, and the server
// little more: a contact number of "123", an emergency number of "call me", a
// birthdate in 2030 and a driver whose license expired in 2020 were all saved.
// License expiry is the one that matters most - nothing else in the system
// looks at it, so a driver added with an expired license could be put on a
// trip the same day.

import { isRealDate, normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { todayInManila } from "@/app/lib/datetime";
import { EMAIL_RULE, isValidEmail } from "@/app/lib/emailRule";

export const LICENSE_EXPIRED_RULE = "This license has expired. Enter the renewed license's expiry date.";
export const FUTURE_DATE_RULE = "That date has not happened yet.";
export const NOT_A_DATE_RULE = "That date does not exist.";
export const EXPERIENCE_RULE = "Whole years, from 0 to 60.";
export const EMERGENCY_PHONE_RULE = PHONE_RULE;

export interface EmployeeFields {
  role?: string | null;
  contact?: string | null;
  emailAddress?: string | null;
  emergencyContactNumber?: string | null;
  birthdate?: string | null;
  dateEmployed?: string | null;
  licenseExpirationDate?: string | null;
  lastMedicalCheckup?: string | null;
  drivingExperience?: number | string | null;
}

export interface EmployeeIssue {
  field: keyof EmployeeFields;
  message: string;
  /** A warning is shown but does not stop the save. */
  warning?: boolean;
}

const filled = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== "";

/**
 * Everything wrong with an employee's fields. Only fields that are present are
 * judged, so a partial update is checked on what it changes. `creating` makes
 * an expired driver's license a refusal; on an edit it is a warning, so an
 * admin can still record what has happened - mark the driver unavailable -
 * before the renewal comes in.
 */
export function checkEmployeeFields(fields: EmployeeFields, options: { creating: boolean; today?: string }): EmployeeIssue[] {
  const today = options.today ?? todayInManila();
  const issues: EmployeeIssue[] = [];

  if (filled(fields.contact) && !normalizePhone(String(fields.contact))) {
    issues.push({ field: "contact", message: PHONE_RULE });
  }
  if (filled(fields.emergencyContactNumber) && !normalizePhone(String(fields.emergencyContactNumber))) {
    issues.push({ field: "emergencyContactNumber", message: EMERGENCY_PHONE_RULE });
  }
  if (filled(fields.emailAddress) && !isValidEmail(String(fields.emailAddress))) {
    issues.push({ field: "emailAddress", message: EMAIL_RULE });
  }

  for (const field of ["birthdate", "dateEmployed", "licenseExpirationDate", "lastMedicalCheckup"] as const) {
    const value = fields[field];
    if (!filled(value)) continue;
    const day = String(value).slice(0, 10);
    if (!isRealDate(day)) {
      issues.push({ field, message: NOT_A_DATE_RULE });
      continue;
    }
    // A birthday or a check-up cannot be tomorrow. A start date can - someone
    // hired to begin next week - so it is not judged against today.
    if ((field === "birthdate" || field === "lastMedicalCheckup") && day > today) {
      issues.push({ field, message: FUTURE_DATE_RULE });
    }
    if (field === "licenseExpirationDate" && fields.role === "Driver" && day < today) {
      issues.push({ field, message: LICENSE_EXPIRED_RULE, warning: !options.creating });
    }
  }

  if (filled(fields.drivingExperience)) {
    const years = Number(fields.drivingExperience);
    if (!Number.isInteger(years) || years < 0 || years > 60) issues.push({ field: "drivingExperience", message: EXPERIENCE_RULE });
  }

  return issues;
}

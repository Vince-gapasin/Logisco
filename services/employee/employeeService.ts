import { sendEmail } from "@/services/email/emailService";
import { supabase } from "@/app/lib/supabase";
// EMPLOYEE_LOGIN_ACCESS_V3

import { AVAILABILITY, isManualAvailability, MANUAL_AVAILABILITY } from "@/app/lib/enums";
import {
  getEmployeeAvailability,
  getEmployeeAvailabilityMap,
} from "@/services/employee/employeeAvailabilityService";

import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryDto,
} from "@/types/employee";

const TABLE = "Employee";
const ACTIVATION_COOLDOWN_MS = 15 * 60 * 1000;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function activationEmailMessage(employeeName: string | null, link: string) {
  const greeting = employeeName ? `Hello ${employeeName},` : "Hello,";
  const text = [
    greeting,
    "",
    "Your LOGISCO account is ready. Open the link below to set your password and activate your login:",
    link,
    "",
    "The link can be used once and expires after a short time. If it has expired, ask your administrator to resend it.",
    "",
    "Logisco",
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;line-height:1.55;max-width:560px">
  <h2 style="margin:0 0 12px">Activate your LOGISCO account</h2>
  <p>${escapeHtml(greeting)}</p>
  <p>Your LOGISCO account is ready. Set your password to activate your login.</p>
  <p style="margin:24px 0">
    <a href="${escapeHtml(link)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:bold">
      Activate account
    </a>
  </p>
  <p style="color:#475569;font-size:13px">The link can be used once and expires after a short time. If it has expired, ask your administrator to resend it.</p>
  <p style="color:#475569;font-size:13px">Logisco</p>
</div>`;

  return { subject: "Activate your LOGISCO account", text, html };
}

// Only return fields required by the directory table. The complete record is
// fetched by getEmployeeById when the user opens an employee.
const LIST_COLUMNS = [
  "employeeID",
  "employeeCode",
  "employeeName",
  "firstName",
  "middleName",
  "lastName",
  "suffix",
  "role",
  "availability",
  "address",
  "contact",
  "emailAddress",
  "isActive",
  "auth_id",
  "activation_sent_at",
  "activation_completed_at",
  // The booking form's fallback crew lists filter on it: an expired license
  // keeps a driver off a trip.
  "licenseExpirationDate",
].join(",");

export async function getEmployees(query: EmployeeQueryDto) {
  const {
    page,
    limit,
    search,
    role,
    availability: requestedAvailability,
    healthStatus,
    isActive,
    sortBy,
    sortOrder,
  } = query;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let dbQuery = supabase.from(TABLE).select(LIST_COLUMNS, {
    count: "exact",
  });

  if (search) {
    dbQuery = dbQuery.ilike("employeeName", `%${search}%`);
  }

  if (role) {
    dbQuery = dbQuery.eq("role", role);
  }

  // Only what an admin set can be filtered here; Booked and In Transit are
  // worked out per employee below and are not in the database to filter on.
  if (requestedAvailability && isManualAvailability(requestedAvailability)) {
    dbQuery = dbQuery.eq("availability", requestedAvailability);
  }

  if (healthStatus) {
    dbQuery = dbQuery.eq("healthStatus", healthStatus);
  }

  if (isActive !== undefined) {
    dbQuery = dbQuery.eq("isActive", isActive);
  }

  const { data, error, count } = await dbQuery
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(from, to);

  if (error) throw error;

  const employees = (data ?? []) as unknown as Employee[];
  const availabilityByEmployee = await getEmployeeAvailabilityMap(
    employees
      .filter((employee) => employee.isActive !== false)
      .map((employee) => employee.employeeID),
  );

  return {
    employees: employees.map((employee) => ({
      ...employee,
      availability:
        employee.isActive === false
          ? AVAILABILITY.available
          : availabilityByEmployee.get(employee.employeeID) ??
            AVAILABILITY.available,
    })),
    total: count ?? 0,
  };
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    availability:
      data.isActive === false
        ? AVAILABILITY.available
        : await getEmployeeAvailability(data.employeeID),
  } as Employee;
}

/** Refused because another employee already signs in with this email. */
export class DuplicateEmailError extends Error {}

/**
 * The email is what an employee signs in with, so two records cannot share it -
 * the second could never be activated. Nothing checked, and no database rule
 * stops it. Compared case-insensitively, against every employee: a deactivated
 * one still holds its login.
 */
async function assertEmailFree(email: string): Promise<void> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return;
  // ilike for case, with its wildcards escaped: "_" is common in addresses.
  const pattern = wanted.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase.from(TABLE).select("employeeID, emailAddress").ilike("emailAddress", pattern);
  if (error) throw new Error(`Could not check the email: ${error.message}`);
  if ((data ?? []).some((row) => String(row.emailAddress ?? "").trim().toLowerCase() === wanted)) {
    throw new DuplicateEmailError(`An employee with the email ${email.trim()} already exists.`);
  }
}

export async function createEmployee(
  employee: CreateEmployeeDto,
): Promise<Employee> {
  await assertEmailFree(String(employee.emailAddress ?? ""));
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...employee,
      availability: AVAILABILITY.available,
      isActive: true,
      auth_id: null,
      activation_sent_at: null,
      activation_completed_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create employee error:", error);
    throw error;
  }

  return data as Employee;
}

export async function activateEmployeeAccount(
  id: string,
): Promise<Employee> {
  const { data: employee, error: employeeError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (employeeError) throw employeeError;
  if (!employee) throw new Error("Employee not found");
  if (!employee.emailAddress) {
    throw new Error("Employee does not have an email address");
  }
  if (employee.activation_completed_at) {
    throw new Error("Login access has already been activated");
  }

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("APP_URL environment variable is missing");

  if (employee.activation_sent_at) {
    const sentAt = new Date(employee.activation_sent_at).getTime();
    if (Number.isFinite(sentAt)) {
      const elapsed = Date.now() - sentAt;
      if (elapsed < ACTIVATION_COOLDOWN_MS) {
        const remainingMinutes = Math.ceil(
          (ACTIVATION_COOLDOWN_MS - elapsed) / 60000,
        );
        throw new Error(
          `Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} before resending the activation email`,
        );
      }
    }
  }

  let authId: string;

  if (employee.auth_id) {
    // The Auth user already exists, so Supabase cannot send another invite.
    // A one-time sign-in link is generated instead and sent as an activation
    // email. "?activation=1" tells /set-password this is an activation, not a
    // password reset (both arrive as Supabase "recovery" links).
    const activationRedirect = `${appUrl}/set-password?activation=1`;

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: employee.emailAddress,
        options: { redirectTo: activationRedirect },
      });

    const actionLink = linkData?.properties?.action_link;
    const sentOurOwn =
      !linkError &&
      !!actionLink &&
      (await sendEmail({
        to: employee.emailAddress,
        ...activationEmailMessage(employee.employeeName ?? null, actionLink),
      }));

    if (!sentOurOwn) {
      // No SMTP configured (or it failed): fall back to Supabase's own email.
      // Its wording comes from the "Reset Password" template, but the link
      // still opens the activation page.
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(
        employee.emailAddress,
        { redirectTo: activationRedirect },
      );

      if (resendError) {
        console.error("Supabase activation resend error:", resendError);
        throw new Error(
          resendError.message || "Failed to resend activation email",
        );
      }
    }

    authId = employee.auth_id;
  } else {
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(employee.emailAddress, {
        data: {
          employeeName: employee.employeeName,
          role: employee.role,
          employeeID: employee.employeeID,
        },
        redirectTo: `${appUrl}/set-password`,
      });

    if (inviteError) {
      console.error("Supabase invitation error:", inviteError);
      throw new Error(
        inviteError.message || "Failed to send activation email",
      );
    }

    if (!inviteData.user) {
      throw new Error("Failed to create employee authentication account");
    }

    authId = inviteData.user.id;
  }

  const { data: updatedEmployee, error: updateError } = await supabase
    .from(TABLE)
    .update({
      auth_id: authId,
      activation_sent_at: new Date().toISOString(),
    })
    .eq("employeeID", id)
    .select()
    .single();

  if (updateError) {
    // Only roll back a newly-created Auth user. Never delete an existing user
    // when a resend timestamp update fails.
    if (!employee.auth_id) {
      const { error: rollbackError } =
        await supabase.auth.admin.deleteUser(authId);
      if (rollbackError) {
        console.error("Failed to roll back Auth user:", rollbackError);
      }
    }
    throw updateError;
  }

  return updatedEmployee as Employee;
}

export async function updateEmployee(
  id: string,
  employee: UpdateEmployeeDto,
): Promise<Employee | null> {
  // An admin sets Available, On Leave or Unavailable. Booked and In Transit
  // come from the employee's trips and are never stored.
  const { availability, ...rest } = employee as UpdateEmployeeDto & { availability?: unknown };
  if (availability !== undefined && !isManualAvailability(availability)) {
    throw new Error(`Availability must be one of: ${MANUAL_AVAILABILITY.join(", ")}.`);
  }
  const updates = availability === undefined ? rest : { ...rest, availability };

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("employeeID", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Employee | null;
}

export async function deleteEmployee(id: string): Promise<Employee | null> {
  const { data: existingEmployee, error: lookupError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("employeeID", id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existingEmployee) return null;

  // The record goes first, and the login only once it has.
  //
  // This used to remove the login first and the record second. An employee who
  // has driven, helped or repaired anything is still referenced by those trips
  // and logs, so the record refused to go - after their login already had. They
  // were left on the list with no way to sign in, and the delete reported as a
  // failure. Deleting the record first fails before anything is touched. The
  // record points at the login, not the other way round, so nothing stands in
  // the way of removing it first.
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("employeeID", id)
    .select()
    .maybeSingle();

  if (error) {
    // 23503: something still refers to this employee - their trips, their
    // maintenance logs. That history is the reason to keep the record.
    if ((error as { code?: string }).code === "23503") {
      throw new Error(
        "This employee has work on record (trips or maintenance logs), so they cannot be deleted. Disable them instead - they will not be able to sign in or be assigned.",
      );
    }
    throw error;
  }

  if (existingEmployee.auth_id) {
    const { error: authDeleteError } =
      await supabase.auth.admin.deleteUser(existingEmployee.auth_id);

    if (authDeleteError) {
      const authMessage = authDeleteError.message.toLowerCase();
      const authUserAlreadyMissing =
        authDeleteError.status === 404 || authMessage.includes("user not found");

      // The employee is gone, which is what was asked for. A login left behind
      // with no employee behind it cannot reach anything: every route looks the
      // employee up and refuses when there is none.
      if (!authUserAlreadyMissing) {
        console.error("Employee deleted, but their login could not be removed:", authDeleteError);
      }
    }
  }

  return data as Employee | null;
}

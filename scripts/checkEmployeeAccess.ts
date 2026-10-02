/**
 * Shows why an employee cannot log in, and who last changed their account.
 *
 * Run from the project root:
 *   npx tsx --env-file=.env scripts/checkEmployeeAccess.ts someone@example.com
 *
 * To turn the account back on (sets isActive = true, and records it in the
 * audit trail):
 *   npx tsx --env-file=.env scripts/checkEmployeeAccess.ts someone@example.com --enable
 */
import { supabase } from "../app/lib/supabase";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const enable = process.argv.includes("--enable");

  if (!email || !email.includes("@")) {
    console.log("Usage: npx tsx --env-file=.env scripts/checkEmployeeAccess.ts <email> [--enable]");
    return;
  }

  const { data: employee, error } = await supabase
    .from("Employee")
    .select("employeeID, employeeName, role, emailAddress, isActive, auth_id, activation_sent_at, activation_completed_at")
    .ilike("emailAddress", email)
    .maybeSingle();

  if (error) throw error;
  if (!employee) {
    console.log(`No employee has the email ${email}.`);
    return;
  }

  console.log("\n=== Employee ===");
  console.log(`Name:                 ${employee.employeeName}`);
  console.log(`Role:                 ${employee.role}`);
  console.log(`isActive:             ${employee.isActive}`);
  console.log(`Login linked:         ${employee.auth_id ? "yes" : "NO"}`);
  console.log(`Activation sent:      ${employee.activation_sent_at ?? "never"}`);
  console.log(`Activation completed: ${employee.activation_completed_at ?? "NO"}`);

  if (employee.auth_id) {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(employee.auth_id);
    console.log("\n=== Login account (Supabase Auth) ===");
    if (authError || !authUser?.user) {
      console.log("NOT FOUND - the login account is missing.");
    } else {
      console.log(`Email:        ${authUser.user.email}`);
      console.log(`Last sign-in: ${authUser.user.last_sign_in_at ?? "never"}`);
      console.log(`Banned until: ${(authUser.user as { banned_until?: string }).banned_until ?? "not banned"}`);
    }
  }

  const { data: history } = await supabase
    .from("AuditTrail")
    .select("action, oldData, newData, changedAt:timestamp")
    .eq("tableName", "Employee")
    .eq("recordID", String(employee.employeeID))
    .order("timestamp", { ascending: false })
    .limit(10);

  console.log("\n=== Recent changes to this employee (newest first) ===");
  if (!history?.length) {
    console.log("No recorded changes.");
  } else {
    for (const row of history) {
      const data = (row.newData ?? {}) as Record<string, unknown> & {
        by?: { name?: string | null; role?: string | null };
      };
      const { by, ...changes } = data;
      const changed = Object.entries(changes)
        .filter(([key]) => key === "isActive" || key === "activationEmailSentTo" || Object.keys(changes).length <= 4)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(", ");
      console.log(
        `${String(row.changedAt).slice(0, 19).replace("T", " ")}  ${row.action.padEnd(9)} by ${by?.name ?? "unknown"} (${by?.role ?? "?"})${changed ? `  ${changed}` : ""}`,
      );
    }
  }

  // Why login is refused, in the order the login route checks.
  console.log("\n=== Can this account log in? ===");
  if (!employee.auth_id) console.log("NO - no login account is linked. Send an activation email.");
  else if (employee.isActive === false) console.log("NO - the employee is marked inactive (Disabled).");
  else if (!employee.activation_completed_at) console.log("NO - activation was never completed.");
  else console.log("YES - if the password is right.");

  if (enable) {
    if (employee.isActive !== false) {
      console.log("\nAlready active - nothing changed.");
      return;
    }

    const { error: updateError } = await supabase
      .from("Employee")
      .update({ isActive: true })
      .eq("employeeID", employee.employeeID);
    if (updateError) throw updateError;

    await supabase.from("AuditTrail").insert({
      tableName: "Employee",
      recordID: String(employee.employeeID),
      action: "UPDATE",
      changedBy: null,
      oldData: { isActive: false },
      newData: { isActive: true, by: { employeeID: null, name: "scripts/checkEmployeeAccess.ts", role: null } },
    });

    console.log("\nDone - the employee is active again. Try logging in.");
  } else if (employee.isActive === false) {
    console.log("\nTo turn it back on, run the same command with --enable at the end.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

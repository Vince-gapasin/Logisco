// Who changed what, and when.
//
// The AuditTrail table has existed since the first migration and has never
// held a single row: nothing wrote to it. Dispatches get reassigned, trips
// get cancelled, trucks get pulled out of service and employees get
// deactivated, and afterwards there is no record of who did any of it -
// only the current value of the row.
//
// Writing the trail must never be able to fail the action it is recording.
// Every error here is logged and swallowed: a booking that was created is
// created, whether or not the audit row landed.

import { supabase } from "@/app/lib/supabase";

// AuditTrail.changedBy is a foreign key to auth.users, not to Employee, so
// the Supabase user id is what goes in it. The employee id and name are kept
// alongside in newData, because an employee row can be renamed or removed
// later and the trail should still say who acted.
export interface AuditActor {
  userID?: string | null;
  employeeID?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  /** The table the change was made to, e.g. "DispatchOrder". */
  table: string;
  /** Primary key of the changed row. Stored as text: keys vary by table. */
  recordID: string | number | null | undefined;
  /** What happened, in the app's own words: "ASSIGN", "CANCEL", "ACCEPT". */
  action: string;
  actor?: AuditActor | null;
  /** The row, or the part of it that matters, before and after. */
  before?: unknown;
  after?: unknown;
}

// Pulls the actor out of whatever authorize()/requireAuth() returned.
export function auditActor(auth: {
  user?: { id?: string | null } | null;
  employee?: { employeeID?: string | null; employeeName?: string | null; role?: string | null } | null;
} | null | undefined): AuditActor | null {
  if (!auth) return null;
  return {
    userID: auth.user?.id ?? null,
    employeeID: auth.employee?.employeeID ?? null,
    name: auth.employee?.employeeName ?? null,
    role: auth.employee?.role ?? null,
  };
}

function asJson(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return { value };
  return value as Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const after = asJson(entry.after);

    const { error } = await supabase.from("AuditTrail").insert({
      tableName: entry.table,
      recordID: entry.recordID === null || entry.recordID === undefined
        ? null
        : String(entry.recordID),
      action: entry.action,
      changedBy: entry.actor?.userID ?? null,
      oldData: asJson(entry.before),
      newData: entry.actor
        ? {
            ...(after ?? {}),
            by: {
              employeeID: entry.actor.employeeID ?? null,
              name: entry.actor.name ?? null,
              role: entry.actor.role ?? null,
            },
          }
        : after,
    });

    if (error) console.error(`[Audit] ${entry.action} on ${entry.table} not recorded:`, error.message);
  } catch (error) {
    console.error(`[Audit] ${entry.action} on ${entry.table} not recorded:`, error);
  }
}

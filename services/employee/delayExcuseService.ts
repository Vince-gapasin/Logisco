// Taking a late stop off the crew's record, with a reason.
//
// The system sees that a stop was late. It cannot see why. A client who kept
// the truck at the gate for an hour and a driver who set off late look
// identical in the data, and a punctuality figure that cannot tell them apart
// is one the crew will rightly refuse to accept.
//
// So a coordinator can put one stop aside. Three things make that safe to
// offer: the reason is required, who granted it is recorded, and the stop's own
// times are never touched - the delivery history still says exactly when the
// truck arrived. Only the crew's punctuality figure changes.
//
// This is the obvious thing to abuse, which is why every grant is audited and
// listed on the employee's own screen.

import { supabase } from "@/app/lib/supabase";

export class ExcuseError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ExcuseError";
  }
}

/** The reasons a late stop can be put aside. Mirrors the table's CHECK. */
export const EXCUSE_REASONS = {
  client_not_ready: "Client was not ready to receive",
  loading_delay: "Held up loading at the warehouse",
  truck_breakdown: "Truck broke down",
  weather: "Weather",
  road_closure: "Road closed or blocked",
  office_changed_plan: "We changed the plan (re-sequenced or added a stop)",
  other: "Other",
} as const;

export type ExcuseReason = keyof typeof EXCUSE_REASONS;

export function isExcuseReason(value: unknown): value is ExcuseReason {
  return typeof value === "string" && value in EXCUSE_REASONS;
}

export interface GrantedExcuse {
  branchID: number;
  reason: ExcuseReason;
  notes: string | null;
  excusedBy: string | null;
  excusedAt: string;
}

/**
 * Puts one stop aside.
 *
 * Granting it twice replaces the reason rather than failing: a coordinator who
 * picked the wrong one should be able to correct it.
 */
export async function excuseStopDelay(
  branchID: number,
  input: { reason: unknown; notes?: unknown },
  actor: { employeeID: string },
): Promise<GrantedExcuse> {
  if (!Number.isInteger(branchID)) throw new ExcuseError("Which stop is not clear.");
  if (!isExcuseReason(input.reason)) throw new ExcuseError("Choose a reason for the delay.");

  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 500) : "";

  // "Other" without a word of explanation explains nothing, and would become
  // the reason everybody picks.
  if (input.reason === "other" && notes.length === 0) {
    throw new ExcuseError("Say what happened when the reason is Other.");
  }

  const { data: stop, error: stopError } = await supabase
    .from("BranchStops")
    .select("branchID")
    .eq("branchID", branchID)
    .maybeSingle();

  if (stopError) throw new ExcuseError(`Could not read the stop: ${stopError.message}`, 500);
  if (!stop) throw new ExcuseError("Stop not found.", 404);

  const { data, error } = await supabase
    .from("StopDelayExcuse")
    .upsert(
      {
        branchID,
        reason: input.reason,
        notes: notes || null,
        excusedBy: actor.employeeID,
        excusedAt: new Date().toISOString(),
      },
      { onConflict: "branchID" },
    )
    .select("branchID, reason, notes, excusedBy, excusedAt")
    .single();

  if (error) throw new ExcuseError(`Could not excuse the delay: ${error.message}`, 500);

  return data as GrantedExcuse;
}

/** Puts the stop back on the record. */
export async function revokeStopDelayExcuse(branchID: number): Promise<void> {
  const { error } = await supabase.from("StopDelayExcuse").delete().eq("branchID", branchID);
  if (error) throw new ExcuseError(`Could not undo the excuse: ${error.message}`, 500);
}

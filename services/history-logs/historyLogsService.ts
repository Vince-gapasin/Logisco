import { supabase } from "@/app/lib/supabase";
import { selectAll } from "@/app/lib/selectAll";
import { mayWorkOnLog, mayWorkOnTruck, type RepairLog } from "@/app/lib/repairAccess";
import {
  checkRepairPhoto,
  parseRepairPhotoReport,
  photoHash,
  PHOTO_PHASES,
  type PhotoMeta,
} from "@/services/history-logs/repairPhotoCheck";

// A maintenance history log is one HistoryLogsM row plus child rows in
// LogMechanics, LogNotes and LogPhotos (one per phase). supabase-js has no
// transactions, so writes are ordered to never leave a log half-saved:
// creates roll back the parent on failure, and updates insert the new
// children before removing the old ones.

type LogBody = Record<string, unknown>;

const CHILD_TABLES = ["LogMechanics", "LogNotes", "LogPhotos"] as const;

// What a log's children look like coming back from the query: each row says
// which phase or role it belongs to, and the rest is read straight through.
interface PhaseRow {
  phase?: string | null;
  issue?: string | null;
  remarks?: string | null;
  findings?: string | null;
  partsUsed?: string | null;
  photoUrl?: string | null;
  caption?: string | null;
  checkStatus?: string | null;
  captureMethod?: string | null;
  checkLabels?: PhotoMeta["checkLabels"];
}
interface MechanicRow {
  role?: string | null;
  employeeID?: string | null;
  Employee?: { employeeName?: string | null } | null;
}
interface RawLog {
  id?: string;
  truckID?: string | null;
  date?: string | null;
  created_at?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
  /** The truck as it was when the log was written - all that is left once it is deleted. */
  plateNumber?: string | null;
  truckType?: string | null;
  Truck?: { plateNumber?: string | null; truckType?: string | null } | null;
  LogMechanics?: MechanicRow[] | null;
  LogNotes?: PhaseRow[] | null;
  LogPhotos?: PhaseRow[] | null;
  [key: string]: unknown;
}


function buildChildren(logID: string, body: LogBody) {
  const mechanics = [];
  if (body.primaryMechanicID) mechanics.push({ logID, employeeID: body.primaryMechanicID, role: "Primary" });
  if (body.additionalMechanicID) mechanics.push({ logID, employeeID: body.additionalMechanicID, role: "Additional" });

  const notes = [];
  if (body.preliminaryRemarks || body.driversReport) notes.push({ logID, phase: "Preliminary", issue: body.driversReport, remarks: body.preliminaryRemarks });
  if (body.progressRemarks || body.additionalIssue) notes.push({ logID, phase: "Progress", issue: body.additionalIssue, remarks: body.progressRemarks });
  if (body.remarks || body.issue) notes.push({ logID, phase: "Final", issue: body.issue, remarks: body.remarks });

  // A photo checked by checkLogPhotos carries what the check found; one
  // written without it (a log the server opens itself) has none.
  const photos = [];
  for (const { phase, photo } of PHOTO_PHASES) {
    if (!body[photo]) continue;
    const meta = body[`${photo}Meta`] as PhotoMeta | undefined;
    photos.push({ logID, phase, photoUrl: body[photo], ...(meta ?? {}) });
  }

  return { LogMechanics: mechanics, LogNotes: notes, LogPhotos: photos };
}

// `inserted` collects the ids of the rows written, table by table, so a
// failure part-way can take back the ones that did go in.
async function insertChildren(logID: string, body: LogBody, inserted: Partial<Record<string, string[]>> = {}) {
  const children: Record<(typeof CHILD_TABLES)[number], Record<string, unknown>[]> = buildChildren(logID, body);

  for (const table of CHILD_TABLES) {
    const rows = children[table];
    if (rows.length === 0) continue;

    const { data, error } = await supabase.from(table).insert(rows).select("id");
    if (error) throw new Error(`Failed to save ${table}: ${error.message}`);
    inserted[table] = ((data ?? []) as { id: string }[]).map((row) => row.id);
  }
}

export function validateHistoryLog(body: LogBody, isCreate: boolean): string | null {
  if (isCreate && !body.truckID) return "Truck is required";
  if (isCreate && !body.date) return "Date is required";
  if (body.date && Number.isNaN(Date.parse(String(body.date)))) return "Invalid date";
  return null;
}

/** A photo's check, as the screens show it. Null for a photo from before the check. */
function photoCheckOf(row: PhaseRow | undefined) {
  if (!row?.checkStatus) return null;
  return {
    status: row.checkStatus,
    method: row.captureMethod ?? null,
    topLabels: row.checkLabels?.topLabels ?? [],
    score: row.checkLabels?.score ?? null,
    notes: row.checkLabels?.notes ?? [],
  };
}

export async function getHistoryLogs() {
  // Paged: PostgREST stops at 1,000 rows without saying so, and the history
  // only grows.
  const rawLogs = await selectAll<RawLog>((from, to) =>
    supabase
      .from("HistoryLogsM")
      .select(
        // LogPhotos.photoUrl holds a base64 image: fetch only the phase here so
        // the list stays small, and load images through getLogPhotos on demand.
        "id,truckID,date,statusBefore,statusAfter,created_at,plateNumber,truckType,Truck(plateNumber,truckType),LogMechanics(role,employeeID,Employee(employeeName)),LogNotes(phase,issue,remarks),LogPhotos(phase,checkStatus,captureMethod,checkLabels)",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return rawLogs.map((log) => {
    const primaryMech = log.LogMechanics?.find((m: MechanicRow) => m.role === "Primary");
    const addMech = log.LogMechanics?.find((m: MechanicRow) => m.role === "Additional");

    const prelimNote = log.LogNotes?.find((n: PhaseRow) => n.phase === "Preliminary");
    const progNote = log.LogNotes?.find((n: PhaseRow) => n.phase === "Progress");
    const finalNote = log.LogNotes?.find((n: PhaseRow) => n.phase === "Final");

    const prelimPhoto = log.LogPhotos?.find((p: PhaseRow) => p.phase === "Preliminary");
    const progPhoto = log.LogPhotos?.find((p: PhaseRow) => p.phase === "Progress");
    const finalPhoto = log.LogPhotos?.find((p: PhaseRow) => p.phase === "Final");

    return {
      id: log.id,
      truckID: log.truckID,
      // The truck as it is now, or as it was if it has since been deleted.
      plateNumber: log.Truck?.plateNumber ?? log.plateNumber,
      truckType: log.Truck?.truckType ?? log.truckType,
      date: log.date,
      createdAt: log.created_at,
      statusBefore: log.statusBefore,
      statusAfter: log.statusAfter,
      primaryMechanicID: primaryMech?.employeeID,
      // Blank when nobody is on it yet, so each screen can say so its own way.
      mechanicName: primaryMech?.Employee?.employeeName || "",
      additionalMechanicID: addMech?.employeeID,
      additionalMechanic: addMech?.Employee?.employeeName || "",
      driversReport: prelimNote?.issue,
      preliminaryRemarks: prelimNote?.remarks,
      additionalIssue: progNote?.issue,
      progressRemarks: progNote?.remarks,
      issue: finalNote?.issue,
      remarks: finalNote?.remarks,

      // Image data is not included in the list; these say whether one exists.
      hasPreliminaryPhoto: Boolean(prelimPhoto),
      hasProgressPhoto: Boolean(progPhoto),
      hasFinalPhoto: Boolean(finalPhoto),
      // What the photo check found, per phase, for the office.
      preliminaryPhotoCheck: photoCheckOf(prelimPhoto),
      progressPhotoCheck: photoCheckOf(progPhoto),
      photoCheck: photoCheckOf(finalPhoto),
      preliminaryPhotoUrl: null,
      progressPhotoUrl: null,
      photoUrl: null,
    };
  });
}


// Image data for specific logs, keyed by log id then phase. Used when a log
// is opened for viewing or editing, so the list itself stays light.
export async function getLogPhotos(
  logIDs: string[],
): Promise<Record<string, Record<string, string>>> {
  const ids = [...new Set(logIDs.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("LogPhotos")
    .select("logID, phase, photoUrl")
    .in("logID", ids);

  if (error) throw new Error(`Failed to load photos: ${error.message}`);

  const byLog: Record<string, Record<string, string>> = {};
  for (const row of data ?? []) {
    if (!row.photoUrl) continue;
    byLog[row.logID] = byLog[row.logID] ?? {};
    byLog[row.logID][row.phase] = row.photoUrl;
  }

  return byLog;
}

/**
 * Checks the photos a log is being saved with, before anything is written, and
 * leaves on the body what each check found for buildChildren to store.
 *
 * `requirePhotos`: every phase the log fills must have a photo - a mechanic's
 * log. `logID`: the log being edited. Its own photos are not "already used",
 * and one sent back unchanged (the edit form sends what it loaded) is taken
 * out of the body, so the photo on file stays with what its check found.
 *
 * Null when the log may be saved; otherwise what to answer.
 */
export async function checkLogPhotos(
  body: LogBody,
  { requirePhotos, logID = null }: { requirePhotos: boolean; logID?: string | null },
): Promise<{ status: number; message: string } | null> {
  // What a check found is the server's to write, never the caller's.
  for (const { photo } of PHOTO_PHASES) delete body[`${photo}Meta`];

  const filled = (phase: (typeof PHOTO_PHASES)[number]) => phase.text.some((field) => body[field]);

  let onFile: { phase: string; photoUrl: string | null }[] = [];
  if (logID) {
    const { data, error } = await supabase.from("LogPhotos").select("phase, photoUrl").eq("logID", logID);
    if (error) throw new Error(`Failed to read the log's photos: ${error.message}`);
    onFile = (data ?? []) as typeof onFile;
  }

  const toCheck: (typeof PHOTO_PHASES)[number][] = [];
  for (const phase of PHOTO_PHASES) {
    const sent = typeof body[phase.photo] === "string" ? (body[phase.photo] as string) : "";
    const kept = onFile.find((row) => row.phase === phase.phase);
    if (sent && kept?.photoUrl === sent) {
      delete body[phase.photo];
      continue;
    }
    if (sent) toCheck.push(phase);
    // An edit keeps the phase's photo when none is sent; a log that never had
    // one (written before photos were required) is not made to get one now.
    else if (requirePhotos && !logID && filled(phase)) {
      return { status: 400, message: `A photo is required for the ${phase.label}.` };
    }
  }
  if (toCheck.length === 0) return null;

  const hashes = toCheck.map((phase) => photoHash(body[phase.photo] as string));
  let sameFileQuery = supabase.from("LogPhotos").select("imageHash").in("imageHash", hashes);
  let earlierQuery = supabase
    .from("LogPhotos")
    .select("imageDHash")
    .not("imageDHash", "is", null)
    .order("capturedAt", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (logID) {
    sameFileQuery = sameFileQuery.neq("logID", logID);
    earlierQuery = earlierQuery.neq("logID", logID);
  }
  const [sameFile, earlier] = await Promise.all([sameFileQuery, earlierQuery]);
  if (sameFile.error) throw new Error(`Failed to check the photo: ${sameFile.error.message}`);
  if (earlier.error) throw new Error(`Failed to check the photo: ${earlier.error.message}`);

  const usedHashes = new Set(((sameFile.data ?? []) as { imageHash: string }[]).map((row) => row.imageHash));
  const earlierHashes = ((earlier.data ?? []) as { imageDHash: string | null }[])
    .map((row) => row.imageDHash)
    .filter((hash): hash is string => Boolean(hash));

  const now = Date.now();
  for (const [i, phase] of toCheck.entries()) {
    const check = checkRepairPhoto({
      dataUrl: body[phase.photo] as string,
      report: parseRepairPhotoReport(body[phase.report]),
      now,
      sameFileUsed: usedHashes.has(hashes[i]),
      earlierHashes,
    });
    if (check.refusal) return { status: 422, message: check.refusal };
    body[`${phase.photo}Meta`] = check.meta;
  }
  return null;
}

export async function createHistoryLog(body: LogBody) {
  const { data: log, error } = await supabase
    .from("HistoryLogsM")
    .insert({
      truckID: body.truckID,
      date: body.date,
      statusBefore: body.statusBefore,
      statusAfter: body.statusAfter,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create log: ${error.message}`);

  try {
    await insertChildren(log.id, body);
  } catch (childError) {
    // Roll back so a log never exists without its mechanics/notes/photos.
    await deleteHistoryLog(log.id).catch((rollbackError) =>
      console.error("History log rollback failed:", rollbackError),
    );
    throw childError;
  }

  return { id: log.id };
}

export async function updateHistoryLog(id: string, body: LogBody) {
  const { data: updated, error } = await supabase
    .from("HistoryLogsM")
    .update({
      date: body.date,
      statusBefore: body.statusBefore,
      statusAfter: body.statusAfter,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to update log: ${error.message}`);
  if (!updated) throw new Error("Log not found");

  // Remember the current child rows, insert the replacements, then remove
  // the old ones - a failure part-way leaves the previous data intact.
  //
  // Photos are the exception: a phase's photo is replaced only when the body
  // brings a new one. The list a log is edited from carries no image data -
  // only whether one exists - so an edit saved before the images had loaded
  // sent every photo as empty, and replacing them wholesale deleted them all.
  // There is no way to remove a photo from the form, so a phase left empty
  // keeps what it had.
  const sentPhotoPhases = new Set<string>(buildChildren(id, body).LogPhotos.map((row) => row.phase));

  const oldIds: Record<string, string[]> = {};
  for (const table of CHILD_TABLES) {
    const { data, error: readError } = await supabase
      .from(table)
      .select(table === "LogPhotos" ? "id, phase" : "id")
      .eq("logID", id);
    if (readError) throw new Error(`Failed to read ${table}: ${readError.message}`);
    const rows = (data ?? []) as unknown as { id: string; phase?: string }[];
    oldIds[table] = rows
      .filter((row) => table !== "LogPhotos" || sentPhotoPhases.has(row.phase ?? ""))
      .map((row) => row.id);
  }

  // A failure part-way used to leave the replacements already written beside
  // the rows they were replacing, and the log then showed whichever came
  // back first. The ones written are taken back, so the log is as it was.
  const inserted: Partial<Record<string, string[]>> = {};
  try {
    await insertChildren(id, body, inserted);
  } catch (insertError) {
    for (const [table, ids] of Object.entries(inserted)) {
      if (!ids?.length) continue;
      const { error: undoError } = await supabase.from(table).delete().in("id", ids);
      if (undoError) console.error(`History log edit: could not take back ${table}:`, undoError.message);
    }
    throw insertError;
  }

  for (const table of CHILD_TABLES) {
    if (oldIds[table].length === 0) continue;
    const { error: deleteError } = await supabase.from(table).delete().in("id", oldIds[table]);
    if (deleteError) throw new Error(`Failed to clean up ${table}: ${deleteError.message}`);
  }

  return { id };
}

// A truck's logs as the repair-access rule reads them, oldest first.
async function repairLogsOf(truckID: string): Promise<RepairLog[]> {
  const rows = await selectAll<RawLog>((from, to) =>
    supabase
      .from("HistoryLogsM")
      .select("id,statusBefore,statusAfter,LogMechanics(role,employeeID)")
      .eq("truckID", truckID)
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
  );
  return rows.map((log) => ({
    id: String(log.id),
    statusBefore: log.statusBefore,
    statusAfter: log.statusAfter,
    primaryMechanicID: log.LogMechanics?.find((m) => m.role === "Primary")?.employeeID ?? null,
    additionalMechanicID: log.LogMechanics?.find((m) => m.role === "Additional")?.employeeID ?? null,
  }));
}

/** Whether this mechanic may change the truck - see mayWorkOnTruck. */
export async function mechanicMayWorkOnTruck(truckID: string, employeeID: string) {
  const { data: truck, error } = await supabase.from("Truck").select("truckStatus").eq("truckID", truckID).maybeSingle();
  if (error) throw new Error(`Failed to read the truck: ${error.message}`);
  // A truck that is not there is for the route to report, not refuse.
  if (!truck) return true;
  const logs = await repairLogsOf(truckID);
  return mayWorkOnTruck(truck.truckStatus, logs.at(-1) ?? null, employeeID);
}

/** Whether this mechanic may edit or delete the log - see mayWorkOnLog. */
export async function mechanicMayWorkOnLog(logID: string, employeeID: string) {
  const { data: log, error } = await supabase.from("HistoryLogsM").select("truckID").eq("id", logID).maybeSingle();
  if (error) throw new Error(`Failed to read the log: ${error.message}`);
  if (!log) return true;
  // A log whose truck is gone has no repair left to belong to anyone.
  if (!log.truckID) return true;
  return mayWorkOnLog(await repairLogsOf(log.truckID), logID, employeeID);
}

export async function deleteHistoryLog(id: string) {
  // Children first: their foreign keys reference HistoryLogsM.
  for (const table of CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq("logID", id);
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`);
  }

  const { error } = await supabase.from("HistoryLogsM").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete log: ${error.message}`);

  return true;
}

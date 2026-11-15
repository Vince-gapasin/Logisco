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

/** How many photos one phase of a log may carry. */
export const MAX_PHOTOS_PER_PHASE = 10;

/** A photo as the screens are given it: its row, its image, and what its check found. */
export interface LogPhotoView {
  id: string;
  url: string;
  check: ReturnType<typeof photoCheckOf>;
}

// A maintenance history log is one HistoryLogsM row plus child rows in
// LogMechanics, LogNotes and LogPhotos (up to MAX_PHOTOS_PER_PHASE per phase,
// in order). supabase-js has no
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
  position?: number | null;
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

  // Only the new photos checkLogPhotos passed, each with its place in its
  // phase and what its check found. A log the server opens itself has none.
  const photos = (Array.isArray(body.checkedPhotos) ? (body.checkedPhotos as CheckedPhoto[]) : []).map((photo) => ({
    logID,
    ...photo,
  }));

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

/** A new photo that passed checkLogPhotos, ready to be written. */
interface CheckedPhoto extends PhotoMeta {
  phase: string;
  photoUrl: string;
  position: number;
}

/** In each phase's order: position, then the order they were saved in. */
function byPosition<T extends { position?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.position ?? 1) - (b.position ?? 1));
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
        "id,truckID,date,statusBefore,statusAfter,created_at,plateNumber,truckType,Truck(plateNumber,truckType),LogMechanics(role,employeeID,Employee(employeeName)),LogNotes(phase,issue,remarks),LogPhotos(phase,position,checkStatus,captureMethod,checkLabels)",
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

    const photosOf = (phase: string) => byPosition((log.LogPhotos ?? []).filter((p: PhaseRow) => p.phase === phase));
    const prelimPhotos = photosOf("Preliminary");
    const progPhotos = photosOf("Progress");
    const finalPhotos = photosOf("Final");
    const prelimPhoto = prelimPhotos[0];
    const progPhoto = progPhotos[0];
    const finalPhoto = finalPhotos[0];

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
      preliminaryPhotoCount: prelimPhotos.length,
      progressPhotoCount: progPhotos.length,
      finalPhotoCount: finalPhotos.length,
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


// Image data for specific logs, keyed by log id then phase, each phase's
// photos in order. Used when a log is opened for viewing or editing, so the
// list itself stays light.
export async function getLogPhotos(
  logIDs: string[],
): Promise<Record<string, Record<string, LogPhotoView[]>>> {
  const ids = [...new Set(logIDs.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("LogPhotos")
    .select("id, logID, phase, position, photoUrl, checkStatus, captureMethod, checkLabels")
    .in("logID", ids);

  if (error) throw new Error(`Failed to load photos: ${error.message}`);

  const byLog: Record<string, Record<string, LogPhotoView[]>> = {};
  for (const row of byPosition((data ?? []) as (PhaseRow & { id: string; logID: string })[])) {
    if (!row.photoUrl || !row.phase) continue;
    byLog[row.logID] = byLog[row.logID] ?? {};
    byLog[row.logID][row.phase] = byLog[row.logID][row.phase] ?? [];
    byLog[row.logID][row.phase].push({ id: String(row.id), url: row.photoUrl, check: photoCheckOf(row) });
  }

  return byLog;
}

/** A new photo as the form sends it. */
interface SentPhoto {
  phase: (typeof PHOTO_PHASES)[number];
  dataUrl: string;
  report: unknown;
  /** The single photo field of a screen from before several were allowed. */
  legacy: boolean;
}

/**
 * Checks the photos a log is being saved with, before anything is written, and
 * leaves on the body what is to be written: `checkedPhotos`, the new photos
 * with what each check found and their place in their phase, and
 * `removedPhotoIDs`, only ids of this log's own photos.
 *
 * The form sends only what changed, so an edit's request carries its new
 * photos and nothing else:
 *   newPhotos        { [phase]: [{ dataUrl, report }] }, added after the ones on file
 *   removedPhotoIDs  [LogPhotos.id], photos the mechanic took off the log
 * A photo on file is never removed because a request left it out - the list a
 * log is edited from carries no image data, and an edit saved before the
 * images had loaded once deleted every photo on the log.
 *
 * A screen from before several photos sends one per phase in
 * `preliminaryPhotoUrl` / `progressPhotoUrl` / `photoUrl`; it is taken as a
 * new photo, unless it is one already on the log being sent back unchanged.
 *
 * `requirePhotos`: every phase the log fills must have a photo - a mechanic's
 * log. `logID`: the log being edited.
 *
 * Null when the log may be saved; otherwise what to answer.
 */
export async function checkLogPhotos(
  body: LogBody,
  { requirePhotos, logID = null }: { requirePhotos: boolean; logID?: string | null },
): Promise<{ status: number; message: string } | null> {
  // What a check found is the server's to write, never the caller's.
  delete body.checkedPhotos;
  for (const { photo } of PHOTO_PHASES) delete body[`${photo}Meta`];

  const filled = (phase: (typeof PHOTO_PHASES)[number]) => phase.text.some((field) => body[field]);

  // What the form sent, gathered and taken off the body.
  const sent: SentPhoto[] = [];
  const incoming = body.newPhotos && typeof body.newPhotos === "object" ? (body.newPhotos as Record<string, unknown>) : {};
  for (const phase of PHOTO_PHASES) {
    const list = incoming[phase.phase];
    if (Array.isArray(list)) {
      for (const item of list) {
        const dataUrl = item && typeof item === "object" ? (item as { dataUrl?: unknown }).dataUrl : null;
        if (typeof dataUrl === "string" && dataUrl) {
          sent.push({ phase, dataUrl, report: (item as { report?: unknown }).report, legacy: false });
        }
      }
    }
    const legacy = typeof body[phase.photo] === "string" ? (body[phase.photo] as string) : "";
    if (legacy) sent.push({ phase, dataUrl: legacy, report: body[phase.report], legacy: true });
    delete body[phase.photo];
    delete body[phase.report];
  }
  delete body.newPhotos;
  const askedToRemove = new Set(
    Array.isArray(body.removedPhotoIDs) ? body.removedPhotoIDs.filter((id): id is string => typeof id === "string") : [],
  );
  body.removedPhotoIDs = [];
  body.checkedPhotos = [];

  let onFile: { id: string; phase: string; position: number | null }[] = [];
  if (logID) {
    const { data, error } = await supabase.from("LogPhotos").select("id, phase, position").eq("logID", logID);
    if (error) throw new Error(`Failed to read the log's photos: ${error.message}`);
    onFile = ((data ?? []) as typeof onFile).map((row) => ({ ...row, id: String(row.id) }));

    // An older screen sends the photo it loaded back with every edit. That one
    // is already on the log and stays as its check found it.
    const legacySent = sent.filter((photo) => photo.legacy);
    if (legacySent.length > 0) {
      const { data: images, error: imageError } = await supabase
        .from("LogPhotos")
        .select("phase, photoUrl")
        .eq("logID", logID)
        .in("phase", legacySent.map((photo) => photo.phase.phase));
      if (imageError) throw new Error(`Failed to read the log's photos: ${imageError.message}`);
      const kept = new Set(((images ?? []) as { phase: string; photoUrl: string | null }[]).map((row) => `${row.phase}|${row.photoUrl}`));
      for (let i = sent.length - 1; i >= 0; i--) {
        if (sent[i].legacy && kept.has(`${sent[i].phase.phase}|${sent[i].dataUrl}`)) sent.splice(i, 1);
      }
    }
  }

  // Only this log's own photos can be taken off it.
  const removedIDs = onFile.filter((row) => askedToRemove.has(row.id)).map((row) => row.id);
  const removed = new Set(removedIDs);

  for (const phase of PHOTO_PHASES) {
    const had = onFile.filter((row) => row.phase === phase.phase);
    const kept = had.filter((row) => !removed.has(row.id)).length;
    const adding = sent.filter((photo) => photo.phase === phase).length;
    if (kept + adding > MAX_PHOTOS_PER_PHASE) {
      return { status: 400, message: `The ${phase.label} can have at most ${MAX_PHOTOS_PER_PHASE} photos.` };
    }
    if (requirePhotos && filled(phase)) {
      if (!logID && adding === 0) {
        return { status: 400, message: `A photo is required for the ${phase.label}.` };
      }
      // An edit may swap photos, not leave a phase that had them with none. A
      // log written before photos were required is not made to get one now.
      if (logID && had.length > 0 && kept + adding === 0) {
        return { status: 400, message: `Keep at least one photo on the ${phase.label}.` };
      }
    }
  }
  body.removedPhotoIDs = removedIDs;
  if (sent.length === 0) return null;

  const hashes = sent.map((photo) => photoHash(photo.dataUrl));
  if (new Set(hashes).size < hashes.length) {
    return { status: 422, message: "The same photo was added twice. Remove one of them." };
  }

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

  // New photos go after every one the phase has on file, removed ones
  // included: those are deleted only once the new rows are in.
  const nextPosition: Record<string, number> = {};
  for (const phase of PHOTO_PHASES) {
    nextPosition[phase.phase] =
      Math.max(0, ...onFile.filter((row) => row.phase === phase.phase).map((row) => row.position ?? 1)) + 1;
  }

  const now = Date.now();
  const checked: CheckedPhoto[] = [];
  for (const [i, photo] of sent.entries()) {
    const check = checkRepairPhoto({
      dataUrl: photo.dataUrl,
      report: parseRepairPhotoReport(photo.report),
      now,
      sameFileUsed: usedHashes.has(hashes[i]),
      earlierHashes,
    });
    if (check.refusal) {
      const several = sent.filter((other) => other.phase === photo.phase).length > 1;
      const nth = sent.filter((other, j) => other.phase === photo.phase && j <= i).length;
      return { status: 422, message: several ? `Photo ${nth} of the ${photo.phase.label}: ${check.refusal}` : check.refusal };
    }
    checked.push({
      phase: photo.phase.phase,
      photoUrl: photo.dataUrl,
      position: nextPosition[photo.phase.phase]++,
      ...check.meta,
    });
  }
  body.checkedPhotos = checked;
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
  // Photos are the exception: they are added and removed one by one, never
  // replaced wholesale. The list a log is edited from carries no image data -
  // only whether one exists - so an edit saved before the images had loaded
  // sent every photo as empty, and replacing them wholesale deleted them all.
  // The new ones are inserted; only the ones the mechanic removed, checked by
  // checkLogPhotos to be this log's, are deleted.
  const oldIds: Record<string, string[]> = {
    LogPhotos: Array.isArray(body.removedPhotoIDs)
      ? body.removedPhotoIDs.filter((photoID): photoID is string => typeof photoID === "string")
      : [],
  };
  for (const table of ["LogMechanics", "LogNotes"] as const) {
    const { data, error: readError } = await supabase.from(table).select("id").eq("logID", id);
    if (readError) throw new Error(`Failed to read ${table}: ${readError.message}`);
    oldIds[table] = ((data ?? []) as { id: string }[]).map((row) => row.id);
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
    const { error: deleteError } = await supabase.from(table).delete().in("id", oldIds[table]).eq("logID", id);
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

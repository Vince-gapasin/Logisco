import { supabase } from "@/app/lib/supabase";

// A maintenance history log is one HistoryLogsM row plus child rows in
// LogMechanics, LogNotes and LogPhotos (one per phase). supabase-js has no
// transactions, so writes are ordered to never leave a log half-saved:
// creates roll back the parent on failure, and updates insert the new
// children before removing the old ones.

type LogBody = Record<string, any>;

const CHILD_TABLES = ["LogMechanics", "LogNotes", "LogPhotos"] as const;

function buildChildren(logID: string, body: LogBody) {
  const mechanics = [];
  if (body.primaryMechanicID) mechanics.push({ logID, employeeID: body.primaryMechanicID, role: "Primary" });
  if (body.additionalMechanicID) mechanics.push({ logID, employeeID: body.additionalMechanicID, role: "Additional" });

  const notes = [];
  if (body.preliminaryRemarks || body.driversReport) notes.push({ logID, phase: "Preliminary", issue: body.driversReport, remarks: body.preliminaryRemarks });
  if (body.progressRemarks || body.additionalIssue) notes.push({ logID, phase: "Progress", issue: body.additionalIssue, remarks: body.progressRemarks });
  if (body.remarks || body.issue) notes.push({ logID, phase: "Final", issue: body.issue, remarks: body.remarks });

  const photos = [];
  if (body.preliminaryPhotoUrl) photos.push({ logID, phase: "Preliminary", photoUrl: body.preliminaryPhotoUrl });
  if (body.progressPhotoUrl) photos.push({ logID, phase: "Progress", photoUrl: body.progressPhotoUrl });
  if (body.photoUrl) photos.push({ logID, phase: "Final", photoUrl: body.photoUrl });

  return { LogMechanics: mechanics, LogNotes: notes, LogPhotos: photos };
}

async function insertChildren(logID: string, body: LogBody) {
  const children: Record<(typeof CHILD_TABLES)[number], Record<string, unknown>[]> = buildChildren(logID, body);

  for (const table of CHILD_TABLES) {
    const rows = children[table];
    if (rows.length === 0) continue;

    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new Error(`Failed to save ${table}: ${error.message}`);
  }
}

export function validateHistoryLog(body: LogBody, isCreate: boolean): string | null {
  if (isCreate && !body.truckID) return "Truck is required";
  if (isCreate && !body.date) return "Date is required";
  if (body.date && Number.isNaN(Date.parse(body.date))) return "Invalid date";
  return null;
}

export async function getHistoryLogs() {
  const { data: rawLogs, error } = await supabase
    .from("HistoryLogsM")
    .select(
      "id,truckID,date,statusBefore,statusAfter,created_at,Truck(plateNumber,truckType),LogMechanics(role,employeeID,Employee(employeeName)),LogNotes(phase,issue,remarks),LogPhotos(phase,photoUrl)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (rawLogs ?? []).map((log: any) => {
    const primaryMech = log.LogMechanics?.find((m: any) => m.role === "Primary");
    const addMech = log.LogMechanics?.find((m: any) => m.role === "Additional");

    const prelimNote = log.LogNotes?.find((n: any) => n.phase === "Preliminary");
    const progNote = log.LogNotes?.find((n: any) => n.phase === "Progress");
    const finalNote = log.LogNotes?.find((n: any) => n.phase === "Final");

    const prelimPhoto = log.LogPhotos?.find((p: any) => p.phase === "Preliminary");
    const progPhoto = log.LogPhotos?.find((p: any) => p.phase === "Progress");
    const finalPhoto = log.LogPhotos?.find((p: any) => p.phase === "Final");

    return {
      id: log.id,
      truckID: log.truckID,
      plateNumber: log.Truck?.plateNumber,
      truckType: log.Truck?.truckType,
      date: log.date,
      createdAt: log.created_at,
      statusBefore: log.statusBefore,
      statusAfter: log.statusAfter,
      primaryMechanicID: primaryMech?.employeeID,
      mechanicName: primaryMech?.Employee?.employeeName || "Unknown",
      additionalMechanicID: addMech?.employeeID,
      additionalMechanic: addMech?.Employee?.employeeName || "",
      driversReport: prelimNote?.issue,
      preliminaryRemarks: prelimNote?.remarks,
      preliminaryPhotoUrl: prelimPhoto?.photoUrl,
      additionalIssue: progNote?.issue,
      progressRemarks: progNote?.remarks,
      progressPhotoUrl: progPhoto?.photoUrl,
      issue: finalNote?.issue,
      remarks: finalNote?.remarks,
      photoUrl: finalPhoto?.photoUrl,
    };
  });
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
  const oldIds: Record<string, string[]> = {};
  for (const table of CHILD_TABLES) {
    const { data, error: readError } = await supabase.from(table).select("id").eq("logID", id);
    if (readError) throw new Error(`Failed to read ${table}: ${readError.message}`);
    oldIds[table] = (data ?? []).map((row: { id: string }) => row.id);
  }

  await insertChildren(id, body);

  for (const table of CHILD_TABLES) {
    if (oldIds[table].length === 0) continue;
    const { error: deleteError } = await supabase.from(table).delete().in("id", oldIds[table]);
    if (deleteError) throw new Error(`Failed to clean up ${table}: ${deleteError.message}`);
  }

  return { id };
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

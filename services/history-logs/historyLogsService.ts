const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY; 

const HEADERS = {
  apikey: SUPABASE_KEY!,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export async function getHistoryLogs() {
  // Safely grab the URL whether it's running on the server or client
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error("CRITICAL: Supabase URL environment variable is missing.");
  }

  // 1. MUST sort by created_at.desc natively in the database
  const query = `select=id,truckID,date,statusBefore,statusAfter,created_at,Truck(plateNumber,truckType),LogMechanics(role,employeeID,Employee(employeeName)),LogNotes(phase,issue,remarks),LogPhotos(phase,photoUrl)&order=created_at.desc`;
  const res = await fetch(`${baseUrl}/rest/v1/HistoryLogsM?${query}`, { headers: HEADERS });

  if (!res.ok) throw new Error(await res.text());
  const rawLogs = await res.json();

  return rawLogs.map((log: any) => {
    const primaryMech = log.LogMechanics?.find((m: any) => m.role === 'Primary');
    const addMech = log.LogMechanics?.find((m: any) => m.role === 'Additional');
    
    const prelimNote = log.LogNotes?.find((n: any) => n.phase === 'Preliminary');
    const progNote = log.LogNotes?.find((n: any) => n.phase === 'Progress');
    const finalNote = log.LogNotes?.find((n: any) => n.phase === 'Final');
    
    const prelimPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Preliminary');
    const progPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Progress');
    const finalPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Final');

    return {
      id: log.id,
      truckID: log.truckID,
      plateNumber: log.Truck?.plateNumber,
      truckType: log.Truck?.truckType,
      date: log.date,
      createdAt: log.created_at, // <-- CRITICAL FIX: Pass the exact millisecond timestamp to frontend!
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

export async function createHistoryLog(body: any) {
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("CRITICAL: Supabase URL environment variable is missing.");

  const logRes = await fetch(`${baseUrl}/rest/v1/HistoryLogsM`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ truckID: body.truckID, date: body.date, statusBefore: body.statusBefore, statusAfter: body.statusAfter })
  });
  if (!logRes.ok) throw new Error("Failed to create base log");
  const logData = await logRes.json();
  const logID = logData[0].id;

  const mechanics = [];
  if (body.primaryMechanicID) mechanics.push({ logID, employeeID: body.primaryMechanicID, role: 'Primary' });
  if (body.additionalMechanicID) mechanics.push({ logID, employeeID: body.additionalMechanicID, role: 'Additional' });
  if (mechanics.length > 0) await fetch(`${baseUrl}/rest/v1/LogMechanics`, { method: "POST", headers: HEADERS, body: JSON.stringify(mechanics) });

  const notes = [];
  if (body.preliminaryRemarks || body.driversReport) notes.push({ logID, phase: 'Preliminary', issue: body.driversReport, remarks: body.preliminaryRemarks });
  if (body.progressRemarks || body.additionalIssue) notes.push({ logID, phase: 'Progress', issue: body.additionalIssue, remarks: body.progressRemarks });
  if (body.remarks || body.issue) notes.push({ logID, phase: 'Final', issue: body.issue, remarks: body.remarks });
  if (notes.length > 0) await fetch(`${baseUrl}/rest/v1/LogNotes`, { method: "POST", headers: HEADERS, body: JSON.stringify(notes) });

  const photos = [];
  if (body.preliminaryPhotoUrl) photos.push({ logID, phase: 'Preliminary', photoUrl: body.preliminaryPhotoUrl });
  if (body.progressPhotoUrl) photos.push({ logID, phase: 'Progress', photoUrl: body.progressPhotoUrl });
  if (body.photoUrl) photos.push({ logID, phase: 'Final', photoUrl: body.photoUrl });
  if (photos.length > 0) await fetch(`${baseUrl}/rest/v1/LogPhotos`, { method: "POST", headers: HEADERS, body: JSON.stringify(photos) });

  return { id: logID };
}

export async function updateHistoryLog(id: string, body: any) {
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("CRITICAL: Supabase URL environment variable is missing.");

  await fetch(`${baseUrl}/rest/v1/HistoryLogsM?id=eq.${id}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ date: body.date, statusBefore: body.statusBefore, statusAfter: body.statusAfter })
  });

  await Promise.all([
    fetch(`${baseUrl}/rest/v1/LogMechanics?logID=eq.${id}`, { method: "DELETE", headers: HEADERS }),
    fetch(`${baseUrl}/rest/v1/LogNotes?logID=eq.${id}`, { method: "DELETE", headers: HEADERS }),
    fetch(`${baseUrl}/rest/v1/LogPhotos?logID=eq.${id}`, { method: "DELETE", headers: HEADERS }),
  ]);

  const mechanics = [];
  if (body.primaryMechanicID) mechanics.push({ logID: id, employeeID: body.primaryMechanicID, role: 'Primary' });
  if (body.additionalMechanicID) mechanics.push({ logID: id, employeeID: body.additionalMechanicID, role: 'Additional' });
  if (mechanics.length > 0) await fetch(`${baseUrl}/rest/v1/LogMechanics`, { method: "POST", headers: HEADERS, body: JSON.stringify(mechanics) });

  const notes = [];
  if (body.preliminaryRemarks || body.driversReport) notes.push({ logID: id, phase: 'Preliminary', issue: body.driversReport, remarks: body.preliminaryRemarks });
  if (body.progressRemarks || body.additionalIssue) notes.push({ logID: id, phase: 'Progress', issue: body.additionalIssue, remarks: body.progressRemarks });
  if (body.remarks || body.issue) notes.push({ logID: id, phase: 'Final', issue: body.issue, remarks: body.remarks });
  if (notes.length > 0) await fetch(`${baseUrl}/rest/v1/LogNotes`, { method: "POST", headers: HEADERS, body: JSON.stringify(notes) });

  const photos = [];
  if (body.preliminaryPhotoUrl) photos.push({ logID: id, phase: 'Preliminary', photoUrl: body.preliminaryPhotoUrl });
  if (body.progressPhotoUrl) photos.push({ logID: id, phase: 'Progress', photoUrl: body.progressPhotoUrl });
  if (body.photoUrl) photos.push({ logID: id, phase: 'Final', photoUrl: body.photoUrl });
  if (photos.length > 0) await fetch(`${baseUrl}/rest/v1/LogPhotos`, { method: "POST", headers: HEADERS, body: JSON.stringify(photos) });

  return { id };
}

export async function deleteHistoryLog(id: string) {
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("CRITICAL: Supabase URL environment variable is missing.");

  const res = await fetch(`${baseUrl}/rest/v1/HistoryLogsM?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return true;
}
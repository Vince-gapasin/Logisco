// An employee's files: certificates, medical results, licences.
//
// Kept the way proofs of delivery are (see podService.ts): the bucket is
// private, the table stores the object path, and a short-lived signed URL is
// minted only when an authorised request lists the files. A permanent public
// link to somebody's medical result is not something to hand out.

import { supabase } from "@/app/lib/supabase";

export const EMPLOYEE_ATTACHMENT_BUCKET = "employee_attachments";
const TABLE = "EmployeeAttachment";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// What the form offers. Anything else is refused here as well as by the
// bucket, so the message says which file and why.
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Long enough to open a profile and look through it.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface EmployeeAttachment {
  attachmentID: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  /** Null when signing failed: the row is still listed, just not openable. */
  url: string | null;
}

interface AttachmentRow {
  attachmentID: string;
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

/** Why this file cannot be stored, or null if it can. */
export function whyNotStorable(file: File): string | null {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return `${file.name} is not a PDF, JPG, PNG, WEBP or DOCX file.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 10 MB.`;
  return null;
}

export async function listEmployeeAttachments(employeeID: string): Promise<EmployeeAttachment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("attachmentID, path, fileName, fileType, fileSize, uploadedAt")
    .eq("employeeID", employeeID)
    .order("uploadedAt", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AttachmentRow[];
  if (rows.length === 0) return [];

  const signed = new Map<string, string>();
  const { data: urls, error: signError } = await supabase.storage
    .from(EMPLOYEE_ATTACHMENT_BUCKET)
    .createSignedUrls(rows.map((row) => row.path), SIGNED_URL_TTL_SECONDS);

  if (signError) {
    console.error("[Employee attachments] Failed to sign URLs:", signError.message);
  }
  for (const entry of urls ?? []) {
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }

  return rows.map(({ path, ...row }) => ({ ...row, url: signed.get(path) ?? null }));
}

/**
 * Stores one file against an employee. The object goes first and the row
 * second; if the row cannot be written the object is removed again, so the
 * bucket never fills with files nothing points at.
 */
export async function addEmployeeAttachment(
  employeeID: string,
  file: File,
  uploadedBy: string | null,
): Promise<void> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const path = `${employeeID}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(EMPLOYEE_ATTACHMENT_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type });

  if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);

  const { error: insertError } = await supabase.from(TABLE).insert({
    employeeID,
    path,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedBy,
  });

  if (insertError) {
    await supabase.storage.from(EMPLOYEE_ATTACHMENT_BUCKET).remove([path]);
    throw new Error(`Could not save ${file.name}: ${insertError.message}`);
  }
}

/** Removes one file. Returns false if it is not this employee's. */
export async function removeEmployeeAttachment(
  employeeID: string,
  attachmentID: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("attachmentID", attachmentID)
    .eq("employeeID", employeeID)
    .select("path")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  const { error: removeError } = await supabase.storage
    .from(EMPLOYEE_ATTACHMENT_BUCKET)
    .remove([data.path]);
  if (removeError) {
    // The row is gone, so nobody can reach the object any more; it is only
    // left taking up space.
    console.error("[Employee attachments] Failed to remove object:", removeError.message);
  }
  return true;
}

/**
 * Every file an employee has, for when the employee is deleted. The rows go
 * with the employee (ON DELETE CASCADE); the objects have to be removed here.
 */
export async function removeAllEmployeeAttachmentObjects(employeeID: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from(EMPLOYEE_ATTACHMENT_BUCKET)
    .list(employeeID, { limit: 1000 });

  if (error || !data?.length) return;

  const { error: removeError } = await supabase.storage
    .from(EMPLOYEE_ATTACHMENT_BUCKET)
    .remove(data.map((object) => `${employeeID}/${object.name}`));
  if (removeError) {
    console.error("[Employee attachments] Failed to remove objects:", removeError.message);
  }
}

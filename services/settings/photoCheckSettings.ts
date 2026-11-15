// Whether the photo checks refuse a photo, or only note what is wrong with it.
//
// Two switches, kept in "AppSettings" and changed by the office from the
// Photo checks page:
//
//   podReceiptCheck   the crew's proof-of-delivery receipt scan
//   repairPhotoCheck  the mechanic's maintenance photo check
//
//   strict   a photo that falls short is refused, as it always was
//   relaxed  every photo is accepted; what would have refused it is written on
//            it, and it is saved as "unverified" for the office to look at
//
// Anything that goes wrong reading them - no table yet, no row, the database
// unreachable - reads as strict. A hiccup must never quietly let every photo
// through; the worst it can do is refuse one the office meant to accept.

import { supabase } from "@/app/lib/supabase";
import { recordAudit, type AuditActor } from "@/services/audit/auditService";
import { notify, OFFICE } from "@/services/notifications/notify";

export type PhotoCheckMode = "strict" | "relaxed";

export const PHOTO_CHECK_KEYS = ["podReceiptCheck", "repairPhotoCheck"] as const;
export type PhotoCheckKey = (typeof PHOTO_CHECK_KEYS)[number];

export interface PhotoChecks {
  podReceiptCheck: PhotoCheckMode;
  repairPhotoCheck: PhotoCheckMode;
}

/** A switch as the Photo checks page shows it: its mode, and who last changed it. */
export interface PhotoCheckSetting {
  mode: PhotoCheckMode;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const STRICT: PhotoChecks = { podReceiptCheck: "strict", repairPhotoCheck: "strict" };

/** What each switch is called, for the notification and the audit trail. */
export const PHOTO_CHECK_LABEL: Record<PhotoCheckKey, string> = {
  podReceiptCheck: "Receipt scan (proof of delivery)",
  repairPhotoCheck: "Mechanic photos",
};

export function isPhotoCheckMode(value: unknown): value is PhotoCheckMode {
  return value === "strict" || value === "relaxed";
}

interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: string | null;
  Employee?: { employeeName?: string | null } | { employeeName?: string | null }[] | null;
}

async function readRows(): Promise<SettingRow[]> {
  const { data, error } = await supabase
    .from("AppSettings")
    .select("key, value, updatedAt, Employee ( employeeName )")
    .in("key", [...PHOTO_CHECK_KEYS]);
  if (error) throw new Error(error.message);
  return (data ?? []) as SettingRow[];
}

/** Both modes. Strict for any switch that cannot be read. Never throws. */
export async function getPhotoChecks(): Promise<PhotoChecks> {
  try {
    const rows = await readRows();
    const checks: PhotoChecks = { ...STRICT };
    for (const row of rows) {
      if ((PHOTO_CHECK_KEYS as readonly string[]).includes(row.key) && isPhotoCheckMode(row.value)) {
        checks[row.key as PhotoCheckKey] = row.value;
      }
    }
    return checks;
  } catch (error) {
    console.error("[Photo checks] Could not read the settings; treating both as strict:", error);
    return { ...STRICT };
  }
}

/** Both switches with who last changed each, for the Photo checks page. */
export async function getPhotoCheckSettings(): Promise<Record<PhotoCheckKey, PhotoCheckSetting>> {
  const fallback = (): PhotoCheckSetting => ({ mode: "strict", updatedAt: null, updatedByName: null });
  const settings: Record<PhotoCheckKey, PhotoCheckSetting> = {
    podReceiptCheck: fallback(),
    repairPhotoCheck: fallback(),
  };
  try {
    for (const row of await readRows()) {
      if (!(PHOTO_CHECK_KEYS as readonly string[]).includes(row.key) || !isPhotoCheckMode(row.value)) continue;
      const employee = Array.isArray(row.Employee) ? row.Employee[0] : row.Employee;
      settings[row.key as PhotoCheckKey] = {
        mode: row.value,
        updatedAt: row.updatedAt ?? null,
        updatedByName: employee?.employeeName ?? null,
      };
    }
  } catch (error) {
    console.error("[Photo checks] Could not read the settings; showing both as strict:", error);
  }
  return settings;
}

/**
 * Changes one switch, and says so: the audit trail records who and when, and
 * the office is told, so a relaxed check is never a surprise to the people
 * who will be reviewing what it lets through.
 *
 * Returns false when the switch was already in that mode.
 */
export async function setPhotoCheck(
  key: PhotoCheckKey,
  mode: PhotoCheckMode,
  actor: AuditActor | null,
): Promise<boolean> {
  const before = (await getPhotoChecks())[key];
  if (before === mode) return false;

  const { error } = await supabase.from("AppSettings").upsert(
    { key, value: mode, updatedBy: actor?.employeeID ?? null, updatedAt: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw new Error(`Could not change ${key}: ${error.message}`);

  await recordAudit({
    table: "AppSettings",
    recordID: key,
    action: "SETTING_CHANGE",
    actor,
    before: { [key]: before },
    after: { [key]: mode },
  });

  const label = PHOTO_CHECK_LABEL[key];
  await notify({
    event: "PHOTO_CHECK_CHANGED",
    title: mode === "relaxed" ? `${label}: relaxed` : `${label}: strict again`,
    body:
      mode === "relaxed"
        ? `${actor?.name ?? "Someone"} relaxed the ${label.toLowerCase()} check. Every photo is now accepted, and the ones that would have been refused are marked for review.`
        : `${actor?.name ?? "Someone"} set the ${label.toLowerCase()} check back to strict. Photos that fall short are refused again.`,
    severity: mode === "relaxed" ? "action" : "info",
    roles: OFFICE,
    entity: { table: "AppSettings", id: key },
    link: "/admindashboard/photo-checks",
    actor: { employeeID: actor?.employeeID ?? null, name: actor?.name ?? null },
  });

  return true;
}

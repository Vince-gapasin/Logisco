import { supabase } from "@/app/lib/supabase";

// One active record per name: clients and partners.
//
// Nothing stopped the same company being added twice - no check here, and no
// rule in the database - so a client could appear in the booking dropdowns
// twice, with its warehouses and branches split between the two, and its
// bookings filed under whichever one the coordinator happened to pick. Names
// are compared as people read them: case and extra spaces do not make a
// different company. A deactivated record does not block the name, so a
// client can be added again after it was removed.

export class DuplicateNameError extends Error {}

/** "  Bayan  Burger " and "bayan burger" are the same name. */
export function nameKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function assertNameFree(options: {
  table: "Client" | "SubContractor";
  nameColumn: "company" | "companyName";
  idColumn: "clientID" | "subConID";
  name: string | null | undefined;
  /** The record being edited, which may keep its own name. */
  excludeId?: string | null;
  /** "A client" or "A partner", for the message. */
  label: string;
}): Promise<void> {
  const wanted = nameKey(options.name);
  if (!wanted) return;

  const { data, error } = await supabase
    .from(options.table)
    .select(`${options.idColumn}, ${options.nameColumn}`)
    .eq("isActive", true);
  if (error) throw new Error(`Could not check the name: ${error.message}`);

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const clash = rows.find(
    (row) =>
      nameKey(String(row[options.nameColumn] ?? "")) === wanted &&
      String(row[options.idColumn]) !== String(options.excludeId ?? ""),
  );
  if (clash) {
    throw new DuplicateNameError(`${options.label} named "${String(clash[options.nameColumn])}" already exists.`);
  }
}

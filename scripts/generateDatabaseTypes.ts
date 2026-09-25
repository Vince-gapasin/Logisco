// Writes types/database.ts from the database itself.
//
// PostgREST publishes an OpenAPI description of every table it serves, which
// is the schema as it actually is rather than as anyone remembers it. The
// hand-written interfaces had already drifted - OrderItem called the key
// orderDetailID when the column is itemID, which failed only at runtime, on
// the one query that used it.
//
// Run: npx tsx --env-file=.env scripts/generateDatabaseTypes.ts

import { writeFileSync } from "node:fs";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const OUTPUT = "types/database.ts";

interface Column {
  format: string;
  description?: string;
  items?: { format?: string };
}
interface Table {
  properties?: Record<string, Column>;
  required?: string[];
}

// Postgres types as TypeScript sees them once JSON has been over the wire.
function toTypeScript(column: Column): string {
  const format = (column.format || "").toLowerCase();

  if (format === "array") return `${toTypeScript({ format: column.items?.format || "text" })}[]`;
  if (/^(bool)/.test(format)) return "boolean";
  if (/^(smallint|integer|bigint|numeric|real|double precision|money)/.test(format)) return "number";
  if (/^(json|jsonb)$/.test(format)) return "Json";
  // uuid, text, character varying, date, time, timestamp, bytea and the rest
  // all arrive as strings.
  return "string";
}

function propertyName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/openapi+json" },
  });
  if (!response.ok) throw new Error(`The database refused the schema request (${response.status}).`);

  const spec = (await response.json()) as { definitions?: Record<string, Table> };
  const tables = spec.definitions ?? {};
  const names = Object.keys(tables).sort();
  if (names.length === 0) throw new Error("No tables were described.");

  const lines: string[] = [
    "// Generated from the live database. Do not edit by hand.",
    "//",
    "// npx tsx --env-file=.env scripts/generateDatabaseTypes.ts",
    "//",
    "// One interface per table, describing a row as a select returns it. A",
    "// column is optional here when the database gives it a default or allows",
    "// null, so reading one means handling the absence - which is the honest",
    "// shape for anything that came out of a join.",
    "",
    "export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];",
    "",
  ];

  for (const name of names) {
    const table = tables[name];
    const columns = table.properties ?? {};
    const required = new Set(table.required ?? []);

    lines.push(`export interface ${name}Row {`);
    for (const [column, meta] of Object.entries(columns)) {
      const optional = required.has(column) ? "" : " | null";
      const note = (meta.description || "").split("\n").find((line) => line.trim() && !line.startsWith("Note:"));
      if (note) lines.push(`  /** ${note.trim()} */`);
      lines.push(`  ${propertyName(column)}: ${toTypeScript(meta)}${optional};`);
    }
    lines.push("}", "");
  }

  lines.push("export interface Database {");
  for (const name of names) lines.push(`  ${propertyName(name)}: ${name}Row;`);
  lines.push("}", "");

  writeFileSync(OUTPUT, lines.join("\n"), "utf8");
  console.log(`${OUTPUT}: ${names.length} tables, ${Object.values(tables).reduce((sum, t) => sum + Object.keys(t.properties ?? {}).length, 0)} columns`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

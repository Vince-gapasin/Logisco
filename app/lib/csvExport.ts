// Handing the browser a CSV a spreadsheet opens cleanly.
//
// Every value is quoted, so a comma in an address or a line break in a note
// stays inside its cell. And the file starts with a byte-order mark, without
// which Excel reads it as Latin-1 and a peso sign or an "ñ" comes out garbled.

export type CsvValue = string | number | null | undefined;

export function toCsv(rows: CsvValue[][]): string {
  return rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const url = URL.createObjectURL(
    new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

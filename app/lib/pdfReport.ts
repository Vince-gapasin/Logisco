// Building a printable report out of real text and tables.
//
// Not a screenshot of a screen. A screenshot carries the screen's own layout,
// its scrollbars and its colours, and the text in it cannot be searched,
// selected or read aloud - which is most of what a report is for once it has
// left the building. So the page is drawn: headings, rules, columns, and text
// placed by the millimetre.
//
// WHAT THIS HANDLES AND THE CALLER DOES NOT
//
// Running out of page. Every piece of content asks for room before it is drawn,
// and a table that does not fit carries its header on to the next page rather
// than leaving orphaned rows under nothing. A heading will not be left alone at
// the bottom of a page either.
//
// And the font. jsPDF's built-in faces are Latin-1, so a peso sign, an em dash
// or a curly quote comes out as mojibake or as nothing. Every string drawn goes
// through toPdfText first, which turns them into something the font has.

export interface Column {
  header: string;
  /** Millimetres. The caller's widths should add up to the content width. */
  width: number;
  align?: "left" | "right";
}

const INK: readonly [number, number, number] = [15, 23, 42];
const MUTED: readonly [number, number, number] = [100, 116, 139];
const LINE: readonly [number, number, number] = [226, 232, 240];
const HEADER_FILL: readonly [number, number, number] = [241, 245, 249];

/** What the built-in fonts can draw, from what people actually type. */
export function toPdfText(value: string): string {
  return value
    .replace(/₱/g, "PHP ")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, "");
}

/** A filename that sorts, and that a downloads folder can hold twice. */
export function toFileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ReportBuilder {
  /** A heading, with the room the thing after it needs so it is not orphaned. */
  section(title: string, subtitle?: string, keepWithNext?: number): void;
  /** A line of prose, wrapped to the content width. */
  paragraph(text: string, options?: { muted?: boolean }): void;
  /** Label-and-value pairs across the page, for a summary. */
  figures(pairs: { label: string; value: string }[]): void;
  /** A table that repeats its header on every page it runs on to. */
  table(columns: Column[], rows: string[][]): void;
  /** Numbers every page and hands the file to the browser. */
  save(filename: string): void;
}

export interface ReportOptions {
  title: string;
  /** What this is a report of: the filters, the period, who ran it. */
  meta: string[];
  orientation?: "portrait" | "landscape";
}

/**
 * Opens a report and returns the things that can be put in it.
 *
 * jsPDF is imported here rather than at the top of a page, so a screen that
 * never exports never pays for it.
 */
export async function startReport(options: ReportOptions): Promise<ReportBuilder> {
  const { jsPDF } = await import("jspdf");

  const orientation = options.orientation ?? "portrait";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;
  let y = margin;

  const setText = (
    color: readonly [number, number, number],
    size: number,
    style: "normal" | "bold" = "normal",
  ) => {
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.setFontSize(size);
    pdf.setFont("helvetica", style);
  };

  const ensureSpace = (height: number) => {
    if (y + height > bottomLimit) {
      pdf.addPage();
      y = margin;
    }
  };

  // The masthead, drawn once at the top of the first page.
  setText(INK, 16, "bold");
  pdf.text(toPdfText(options.title), margin, y);
  y += 7;

  for (const line of options.meta) {
    setText(MUTED, 8.5);
    pdf.text(toPdfText(line), margin, y);
    y += 4.2;
  }

  y += 1;
  pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
  pdf.line(margin, y, margin + contentWidth, y);
  y += 6;

  return {
    section(title, subtitle, keepWithNext = 20) {
      ensureSpace((subtitle ? 16 : 11) + keepWithNext);
      y += 3;
      setText(INK, 12, "bold");
      pdf.text(toPdfText(title), margin, y);
      y += 5;
      if (subtitle) {
        setText(MUTED, 8.5);
        pdf.text(toPdfText(subtitle), margin, y);
        y += 5;
      }
      y += 1;
    },

    paragraph(text, { muted = false } = {}) {
      setText(muted ? MUTED : INK, 9);
      const lines = pdf.splitTextToSize(toPdfText(text), contentWidth) as string[];
      ensureSpace(lines.length * 4.4);
      pdf.text(lines, margin, y);
      y += lines.length * 4.4 + 2;
    },

    figures(pairs) {
      if (pairs.length === 0) return;
      ensureSpace(16);

      const width = contentWidth / pairs.length;
      pairs.forEach((pair, index) => {
        const left = margin + index * width;
        setText(MUTED, 8);
        pdf.text(toPdfText(pair.label.toUpperCase()), left, y);
        setText(INK, 14, "bold");
        pdf.text(toPdfText(pair.value), left, y + 6.5);
      });

      y += 13;
    },

    table(columns, rows) {
      const headerHeight = 7;
      const rowHeight = 6.2;

      const drawHeader = () => {
        pdf.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
        pdf.rect(margin, y, contentWidth, headerHeight, "F");
        setText(INK, 8, "bold");

        let x = margin;
        for (const column of columns) {
          const right = column.align === "right";
          pdf.text(toPdfText(column.header), right ? x + column.width - 2 : x + 2, y + 4.8, {
            align: right ? "right" : "left",
          });
          x += column.width;
        }
        y += headerHeight;
      };

      ensureSpace(headerHeight + rowHeight * 2);
      drawHeader();

      for (const row of rows) {
        // A row that does not fit starts a new page under a fresh header,
        // rather than under nothing.
        if (y + rowHeight > bottomLimit) {
          pdf.addPage();
          y = margin;
          drawHeader();
        }

        setText(INK, 8);
        let x = margin;

        columns.forEach((column, index) => {
          const right = column.align === "right";
          // Cut to the column rather than running into the next one. The full
          // value is on the screen this came from.
          const [text] = pdf.splitTextToSize(
            toPdfText(row[index] ?? ""),
            column.width - 4,
          ) as string[];
          pdf.text(text ?? "", right ? x + column.width - 2 : x + 2, y + 4.3, {
            align: right ? "right" : "left",
          });
          x += column.width;
        });

        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
        y += rowHeight;
      }

      y += 4;
    },

    save(filename) {
      // Numbered at the end, when how many there are is finally known.
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        setText(MUTED, 8);
        pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 10, {
          align: "right",
        });
      }

      pdf.save(filename);
    },
  };
}

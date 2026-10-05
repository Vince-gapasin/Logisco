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
const LABEL_FILL: readonly [number, number, number] = [248, 250, 252];

type Rgb = readonly [number, number, number];

/** A status badge's colours, by what the status means rather than its exact words. */
function badgeTone(status: string): { fill: Rgb; text: Rgb } {
  const s = status.toLowerCase();
  if (/(deliver|complete|done|accepted|returned)/.test(s)) return { fill: [220, 252, 231], text: [21, 128, 61] };
  if (/(foul|cancel|declin|reject|fail)/.test(s)) return { fill: [254, 226, 226], text: [185, 28, 28] };
  if (/(transit|route|arrived)/.test(s)) return { fill: [219, 234, 254], text: [29, 78, 216] };
  if (/(pending|unassigned|waiting)/.test(s)) return { fill: [254, 243, 199], text: [180, 83, 9] };
  return { fill: [241, 245, 249], text: [51, 65, 85] };
}

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

export interface DetailItem {
  label: string;
  value: string;
  /** Takes the whole row, for a value too long to share one: an address, a note. */
  wide?: boolean;
}

export interface ReportBuilder {
  /** A heading, with the room the thing after it needs so it is not orphaned. */
  section(title: string, subtitle?: string, keepWithNext?: number): void;
  /**
   * A boxed group of labelled values under a shaded title bar, like a form:
   * the label beside its value on a ruled row, so the eye can run down
   * either. A status, when given, is a coloured badge at the right of the bar.
   */
  panel(title: string, items: DetailItem[], options?: { columns?: 1 | 2; status?: string }): void;
  /** A line of prose, wrapped to the content width. */
  paragraph(text: string, options?: { muted?: boolean }): void;
  /** Label-and-value pairs across the page, for a summary. */
  figures(pairs: { label: string; value: string }[]): void;
  /** A table that repeats its header on every page it runs on to. Cells wrap. */
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

    panel(title, items, { columns = 2, status } = {}) {
      const barHeight = 8;
      const labelWidth = columns === 2 ? 30 : 38;
      const columnWidth = contentWidth / columns;
      const lineHeight = 4;
      const padTop = 4.8;
      const padBottom = 2.4;

      // A row at a time: a row is as tall as its tallest value, and a wide
      // item (an address, a remark) has the row to itself.
      const rows: DetailItem[][] = [];
      let current: DetailItem[] = [];
      for (const item of items) {
        if (item.wide && columns > 1) {
          if (current.length) rows.push(current);
          rows.push([item]);
          current = [];
          continue;
        }
        current.push(item);
        if (current.length === columns) {
          rows.push(current);
          current = [];
        }
      }
      if (current.length) rows.push(current);

      setText(INK, 9);
      const measured = rows.map((row) => {
        const wide = row.length === 1 && row[0].wide;
        const cells = row.map(
          (item) =>
            pdf.splitTextToSize(
              toPdfText(item.value || "-"),
              (wide ? contentWidth : columnWidth) - labelWidth - 5,
            ) as string[],
        );
        setText(MUTED, 7.5, "bold");
        const labels = row.map(
          (item) => pdf.splitTextToSize(toPdfText(item.label.toUpperCase()), labelWidth - 4) as string[],
        );
        setText(INK, 9);
        const lines = Math.max(...cells.map((c) => c.length), ...labels.map((l) => l.length));
        const height = padTop + (lines - 1) * lineHeight + padBottom;
        return { row, wide, cells, labels, height };
      });

      const drawBar = (continued: boolean) => {
        pdf.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.rect(margin, y, contentWidth, barHeight, "FD");
        setText(INK, 9.5, "bold");
        pdf.text(toPdfText(continued ? `${title} (continued)` : title), margin + 3, y + 5.5);

        if (status && !continued) {
          const label = toPdfText(status).toUpperCase();
          const tone = badgeTone(status);
          setText(tone.text, 7, "bold");
          const width = pdf.getTextWidth(label) + 5;
          const left = margin + contentWidth - 3 - width;
          pdf.setFillColor(tone.fill[0], tone.fill[1], tone.fill[2]);
          pdf.roundedRect(left, y + 1.6, width, 4.8, 2.4, 2.4, "F");
          pdf.text(label, left + 2.5, y + 4.95);
        }
        y += barHeight;
      };

      // The bar and its first row stay together.
      ensureSpace(barHeight + (measured[0]?.height ?? 0) + 2);
      drawBar(false);

      for (const { row, cells, labels, height } of measured) {
        if (y + height > bottomLimit) {
          pdf.addPage();
          y = margin;
          drawBar(true);
        }

        row.forEach((item, index) => {
          const left = margin + index * columnWidth;

          // The label in a shaded cell of its own, so the values line up in a
          // column a reader can run down without reading the labels again.
          pdf.setFillColor(LABEL_FILL[0], LABEL_FILL[1], LABEL_FILL[2]);
          pdf.rect(left, y, labelWidth, height, "F");
          setText(MUTED, 7.5, "bold");
          pdf.text(labels[index], left + 2.5, y + padTop - 0.2, { lineHeightFactor: lineHeight / (7.5 * 0.3528) });

          setText(INK, 9);
          pdf.text(cells[index], left + labelWidth + 2.5, y + padTop, { lineHeightFactor: lineHeight / (9 * 0.3528) });

          pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
          pdf.line(left + labelWidth, y, left + labelWidth, y + height);
          if (index > 0) pdf.line(left, y, left, y + height);
        });

        // Each row draws its own box, so a panel that runs on to the next page
        // is closed at the bottom of one and reopened at the top of the other.
        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.rect(margin, y, contentWidth, height, "S");
        y += height;
      }

      y += 5;
    },

    figures(pairs) {
      if (pairs.length === 0) return;
      const height = 17;
      ensureSpace(height + 4);

      // In a box of their own: the headline of the report, set apart from
      // the detail under it.
      pdf.setFillColor(LABEL_FILL[0], LABEL_FILL[1], LABEL_FILL[2]);
      pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
      pdf.roundedRect(margin, y, contentWidth, height, 2, 2, "FD");

      const width = contentWidth / pairs.length;
      pairs.forEach((pair, index) => {
        const left = margin + index * width + 4;
        if (index > 0) pdf.line(margin + index * width, y + 3, margin + index * width, y + height - 3);
        setText(MUTED, 7.5, "bold");
        pdf.text(toPdfText(pair.label.toUpperCase()), left, y + 6);
        setText(INK, 13, "bold");
        pdf.text(toPdfText(pair.value), left, y + 12.8);
      });

      y += height + 6;
    },

    table(columns, rows) {
      const headerHeight = 7;
      const rowHeight = 6.2;
      const lineHeight = 3.5;

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
        // Wrapped within its column rather than cut at the edge of it: a cut
        // value read as a different one ("Successfully" for "Successfully
        // Delivered"), and a reader of the paper has no screen to check.
        setText(INK, 8);
        const cells = columns.map(
          (column, index) =>
            pdf.splitTextToSize(toPdfText(row[index] ?? ""), column.width - 4) as string[],
        );
        const height = rowHeight + (Math.max(1, ...cells.map((lines) => lines.length)) - 1) * lineHeight;

        // A row that does not fit starts a new page under a fresh header,
        // rather than under nothing.
        if (y + height > bottomLimit) {
          pdf.addPage();
          y = margin;
          drawHeader();
          setText(INK, 8);
        }

        let x = margin;
        columns.forEach((column, index) => {
          const right = column.align === "right";
          pdf.text(cells[index], right ? x + column.width - 2 : x + 2, y + 4.3, {
            align: right ? "right" : "left",
          });
          x += column.width;
        });

        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.line(margin, y + height, margin + contentWidth, y + height);
        y += height;
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

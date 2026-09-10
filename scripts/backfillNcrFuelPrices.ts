import { loadEnvConfig } from "@next/env";
import { extractText, getDocumentProxy } from "unpdf";

loadEnvConfig(process.cwd());

const DOE_NCR_PUMP_PRICE_PAGE =
  "https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/ncr-pump-prices";

type PumpPriceRecord = {
  effectiveDate: string;
  pricePerLiter: number;
  sourceUrl: string;
};

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"');
}

function getYearArgument() {
  const year = Number(process.argv[2]);
  const currentYear = new Date().getUTCFullYear();

  if (!Number.isInteger(year) || year < 2022 || year > currentYear) {
    throw new Error(`Provide a year between 2022 and ${currentYear}.`);
  }

  return year;
}

function findPdfUrlsForYear(html: string, year: number) {
  const urls = Array.from(
    html.matchAll(/href=["']([^"']+)["']/gi),
  )
    .map((match) => decodeHtml(match[1]))
    .filter((href) => {
      const decoded = decodeURIComponent(href).toLowerCase();

      return (
          decoded.includes(String(year)) &&
          (decoded.includes("ncr") || decoded.includes("monitor")) &&
          (decoded.includes("pdf") || decoded.includes("document"))
        );
    })
    .map((href) => new URL(href, DOE_NCR_PUMP_PRICE_PAGE).toString());

  return [...new Set(urls)];
}

async function extractPdfText(pdfUrl: string) {
  const response = await fetch(pdfUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`PDF download failed with status ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });

  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}

function toIsoDate(month: string, day: string, year: string) {
  const parsed = new Date(`${month} ${day}, ${year} UTC`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid monitoring date: ${month} ${day}, ${year}.`);
  }

  return parsed.toISOString().slice(0, 10);
}

function extractDateFromUrl(url: string, year: number) {
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  const decodedUrl = decodeURIComponent(url).toLowerCase();

  const match = decodedUrl.match(
    new RegExp(
      `petro[_-]ncr[_-]${year}[_-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_-](\\d{1,2})`,
      "i",
    ),
  );

  if (!match) {
    throw new Error("Date was not found in either the PDF or its URL.");
  }

  const month = months[match[1].toLowerCase()];
  const day = Number(match[2]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("The DOE URL contained an invalid date.");
  }

  return date.toISOString().slice(0, 10);
}

function extractEffectiveDate(
  text: string,
  sourceUrl: string,
  year: number,
) {
  const normalized = text.replace(/\s+/g, " ");

  const monthFirst = normalized.match(
    /(?:for\s+the\s+week\s+of|week\s+of|date\s+of\s+monitoring:?|as\s+of)\s+([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(?:[A-Za-z]+\s+)?\d{1,2})?,?\s+(\d{4})/i,
  );

  if (monthFirst) {
    return toIsoDate(monthFirst[1], monthFirst[2], monthFirst[3]);
  }

  const dayFirst = normalized.match(
    /(?:date\s+of\s+monitoring:?|as\s+of)\s+(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/i,
  );

  if (dayFirst) {
    return toIsoDate(dayFirst[2], dayFirst[1], dayFirst[3]);
  }

  return extractDateFromUrl(sourceUrl, year);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function extractRepresentativeDieselPrice(text: string) {
  const commonPrices: number[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!/^DIESEL\s/i.test(line) || /^DIESEL\s+PLUS/i.test(line)) {
      continue;
    }

    // Rows ending in #N/A do not contain a DOE common-price value.
    if (/#N\/A\s*$/i.test(line)) {
      continue;
    }

    const values = line.match(/\d+(?:\.\d{1,2})?/g)?.map(Number) ?? [];
    const commonPrice = values.at(-1);

    if (
      commonPrice !== undefined &&
      Number.isFinite(commonPrice) &&
      commonPrice >= 20 &&
      commonPrice <= 200
    ) {
      commonPrices.push(commonPrice);
    }
  }

  if (commonPrices.length < 3) {
    throw new Error(
      `Only ${commonPrices.length} valid Diesel common prices were found.`,
    );
  }

  // Median is less sensitive to one unusual station or extraction outlier.
  return Number(median(commonPrices).toFixed(2));
}

async function main() {
  const year = getYearArgument();
  const { supabase } = await import("../app/lib/supabase");
  console.log(`Loading DOE NCR pump-price archive for ${year}...`);

  const pageResponse = await fetch(DOE_NCR_PUMP_PRICE_PAGE, {
    cache: "no-store",
  });

  if (!pageResponse.ok) {
    throw new Error(`DOE archive returned status ${pageResponse.status}.`);
  }

  const html = await pageResponse.text();
  const pdfUrls = findPdfUrlsForYear(html, year);

  if (pdfUrls.length === 0) {
    throw new Error(`No NCR pump-price PDF URLs were found for ${year}.`);
  }

  console.log(`Found ${pdfUrls.length} candidate PDFs.`);

  const extracted: PumpPriceRecord[] = [];
  const skipped: Array<{ url: string; reason: string }> = [];

  for (let index = 0; index < pdfUrls.length; index++) {
    const sourceUrl = pdfUrls[index];

    try {
      console.log(`[${index + 1}/${pdfUrls.length}] Processing PDF...`);
      const text = await extractPdfText(sourceUrl);
      const effectiveDate = extractEffectiveDate(
        text,
        sourceUrl,
        year,
      );

      if (!effectiveDate.startsWith(String(year))) {
        continue;
      }

      extracted.push({
        effectiveDate,
        pricePerLiter: extractRepresentativeDieselPrice(text),
        sourceUrl,
      });
    } catch (error) {
      skipped.push({
        url: sourceUrl,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const records = Array.from(
    new Map(extracted.map((record) => [record.effectiveDate, record])).values(),
  ).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  if (records.length === 0) {
    throw new Error(`No valid ${year} pump-price records were extracted.`);
  }

  const { data: previousRecord, error: previousError } = await supabase
    .from("FuelPriceHistory")
    .select("pricePerLiter")
    .eq("fuelType", "Diesel")
    .eq("region", "NCR")
    .lt("effectiveDate", records[0].effectiveDate)
    .not("pricePerLiter", "is", null)
    .order("effectiveDate", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    throw previousError;
  }

  let previousPrice: number | null = previousRecord?.pricePerLiter
    ? Number(previousRecord.pricePerLiter)
    : null;

  const retrievedAt = new Date().toISOString();
  const rows = records.map((record) => {
    const weeklyAdjustment =
      previousPrice === null
        ? null
        : Number((record.pricePerLiter - previousPrice).toFixed(2));

    previousPrice = record.pricePerLiter;

    return {
      effectiveDate: record.effectiveDate,
      fuelType: "Diesel",
      region: "NCR",
      pricePerLiter: record.pricePerLiter,
      weeklyAdjustment,
      source: "DOE Philippines - NCR Pump Prices",
      sourceUrl: record.sourceUrl,
      retrievedAt,
    };
  });

  const { data, error } = await supabase
    .from("FuelPriceHistory")
    .upsert(rows, { onConflict: "effectiveDate,fuelType,region" })
    .select("effectiveDate,pricePerLiter,weeklyAdjustment");

  if (error) {
    throw error;
  }

  console.log({
    year,
    candidates: pdfUrls.length,
    saved: data?.length ?? 0,
    skipped: skipped.length,
    earliestDate: rows[0]?.effectiveDate,
    latestDate: rows.at(-1)?.effectiveDate,
  });

  if (skipped.length > 0) {
    console.log("Skipped PDFs:", skipped);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});

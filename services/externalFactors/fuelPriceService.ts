import { extractText, getDocumentProxy } from "unpdf";
import { supabase } from "@/app/lib/supabase";

const DOE_NCR_PUMP_PRICE_PAGE =
  "https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/ncr-pump-prices";

const REGION = "NCR";
const SOURCE = "DOE Philippines - NCR Pump Prices";

/*
  Every product DOE lists in the NCR price monitoring PDFs.

  `keyword` is how the row starts in the PDF text. Longer keywords are
  checked first, so a "DIESEL PLUS" row is never counted as regular "DIESEL".

  `id` is the existing FuelType ID where one is known. Products without an ID
  are still saved (fuelTypeID left out); if the database requires an ID for
  them, that product is reported as failed without blocking the others.
*/
const FUEL_PRODUCTS: Array<{
  keyword: string;
  name: string;
  id?: string;
}> = [
  { keyword: "RON 100", name: "Gasoline RON 100" },
  {
    keyword: "RON 97",
    name: "Gasoline RON 97",
    id: "107e3e3d-dff2-45a2-b7cf-3d75281884e6",
  },
  {
    keyword: "RON 95",
    name: "Gasoline RON 95",
    id: "210d7ed1-43bf-4af1-b35f-29761e554d78",
  },
  {
    keyword: "RON 91",
    name: "Gasoline RON 91",
    id: "4a057f04-8c68-4283-8edf-31fa37766b58",
  },
  { keyword: "DIESEL PLUS", name: "Diesel Plus" },
  {
    keyword: "DIESEL",
    name: "Diesel",
    id: "1b124761-487b-4680-a786-877ca03ec539",
  },
  { keyword: "KEROSENE", name: "Kerosene" },
  // Auto LPG is not part of DOE's NCR liquid fuels monitoring report (LPG is
  // published separately), so it is not read from these PDFs.
];

// Longest keyword first so "DIESEL PLUS" wins over "DIESEL", etc.
const PRODUCTS_BY_KEYWORD_LENGTH = [...FUEL_PRODUCTS].sort(
  (a, b) => b.keyword.length - a.keyword.length,
);

const MONTHS: Record<string, number> = {
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

type ExtractedPrice = {
  fuelType: string;
  fuelTypeID?: string;
  pricePerUnit: number;
};

export type FuelWeekResult = {
  sourceUrl: string;
  effectiveDate: string | null;
  savedFuelTypes: string[];
  missingFuelTypes: string[];
  failedFuelTypes: Array<{ fuelType: string; reason: string }>;
  /** Prices read from the PDF (filled in for dry runs and saved weeks). */
  prices?: Array<{ fuelType: string; pricePerUnit: number }>;
  error?: string;
};

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"');
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/*
  PDF links on the DOE page, in page order (newest first), without
  duplicates. The page lists one PDF per week.
*/
function findPdfUrls(html: string) {
  const urls = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => decodeHtml(match[1]))
    .map((href) => new URL(href, DOE_NCR_PUMP_PRICE_PAGE).toString())
    .filter((url) => {
      const decoded = decodeURIComponent(url).toLowerCase();
      // 2026: cloudfront ".pdf" files; 2017-2025: prod-cms document links,
      // which often have no ".pdf" in the name (e.g. petro_ncr_2022-dec-03).
      // Price-adjustment notices are not weekly price sheets.
      if (decoded.includes("priceadj")) return false;
      return (
        decoded.includes(".pdf") ||
        decoded.includes("prod-cms.doe.gov.ph/documents/")
      );
    });

  return [...new Set(urls)];
}

async function fetchDoePage() {
  const response = await fetch(DOE_NCR_PUMP_PRICE_PAGE, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to access DOE NCR page (status ${response.status}).`,
    );
  }

  return response.text();
}

// Retries a download up to 3 times; DOE's server occasionally drops requests.
async function extractPdfText(pdfUrl: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await downloadPdfText(pdfUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        message.includes("fetch failed") ||
        message.includes("aborted") ||
        /status 5\d\d/.test(message);
      if (!isNetworkError || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
}

async function downloadPdfText(pdfUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(pdfUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/pdf,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`DOE PDF download failed (status ${response.status}).`);
    }

    const buffer = await response.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });

    return Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } finally {
    clearTimeout(timeout);
  }
}

/*
  DOE names its files in many ways. These all give the first day of the week:
    ncr-price-monitoring-08182026-pdf              -> 2026-08-18
    NCR Price Monitoring 09222026.pdf              -> 2026-09-22
    NCR Price Monitoring Sep 1-7 2026.pdf          -> 2026-09-01
    NCR Price Monitoring 15-21 September 2026.pdf  -> 2026-09-15
    ... for 25 to 31 August 2026.pdf               -> 2026-08-25
    ...-for-june-30-july-6-2026-pdf                -> 2026-06-30
    petro-ncr-2024-jan-02...                       -> 2024-01-02
*/
export function parseDateFromUrl(url: string) {
  const text = decodeURIComponent(url)
    .toLowerCase()
    .replace(/[-_+%]/g, " ")
    .replace(/\s+/g, " ");
  const monthPattern =
    "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";

  // 2024 jan 02 / 2017 february28 / 2025 jan 28 feb 3
  let match = text.match(new RegExp(`(20\\d{2}) ${monthPattern} ?(\\d{1,2})\\b`));
  if (match) {
    return toIsoDate(Number(match[1]), MONTHS[match[2]], Number(match[3]));
  }

  // Sep 1 7 2026 / june 30 july 6 2026
  match = text.match(
    new RegExp(`\\b${monthPattern} (\\d{1,2})\\b[^/]*?\\b(20\\d{2})\\b`),
  );
  if (match) {
    return toIsoDate(Number(match[3]), MONTHS[match[1]], Number(match[2]));
  }

  // 15 21 September 2026 / 25 to 31 August 2026
  match = text.match(
    new RegExp(`\\b(\\d{1,2}) (?:to )?\\d{1,2} ${monthPattern} (20\\d{2})\\b`),
  );
  if (match) {
    return toIsoDate(Number(match[3]), MONTHS[match[2]], Number(match[1]));
  }

  // 08182026 / 03102026n (MMDDYYYY, sometimes with a letter after it)
  match = text.match(/\b(\d{2})(\d{2})(20\d{2})(?!\d)/);
  if (match) {
    return toIsoDate(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  // 2022-10-27 (YYYY-MM-DD)
  match = text.match(/\b(20\d{2}) (\d{1,2}) (\d{1,2})\b/);
  if (match) {
    return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // 07-01-2025 (MM-DD-YYYY)
  match = text.match(/\b(\d{1,2}) (\d{1,2}) (20\d{2})\b/);
  if (match) {
    return toIsoDate(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  return null;
}

function parseDateFromText(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(
    /(?:for the week of|week of|date of monitoring:?|monitoring date:?|as of)\s+([A-Za-z]+)\s+(\d{1,2})\b.*?(20\d{2})/i,
  );

  if (!match) return null;

  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  return month
    ? toIsoDate(Number(match[3]), month, Number(match[2]))
    : null;
}

function getEffectiveDate(text: string, sourceUrl: string) {
  const date = parseDateFromUrl(sourceUrl) ?? parseDateFromText(text);

  if (!date) {
    throw new Error("Unable to determine the DOE monitoring week.");
  }

  return date;
}

/*
  Each city row in the DOE PDF looks like:

    DIESEL  <brand low> <brand high> ...  <overall low> - <overall high>  <common price | #N/A>

  The "common price" is #N/A in many cities (most RON 100, RON 97 and
  Kerosene rows), so it cannot be relied on. Instead every brand price in
  every NCR city row is collected, and the product's price for the week is
  the median of those. This works the same way for every fuel type, every
  week, so week-to-week changes are comparable.
*/
function readBrandPrices(line: string) {
  const isPrice = (value: number) => value >= 20 && value <= 200;

  // With a dash: brand prices are everything before "<low> - <high>".
  const rangeMatch = line.match(/(\d+\.\d{2})\s+-\s+\d+\.\d{2}/);
  if (rangeMatch && rangeMatch.index !== undefined) {
    return (line.slice(0, rangeMatch.index).match(/\d+\.\d{2}/g) ?? [])
      .map(Number)
      .filter(isPrice);
  }

  // Without a dash (e.g. "KEROSENE 130.30 130.30 130.30 130.30 #N/A"):
  // drop the overall low/high, and the common price when there is one.
  const numbers = (line.match(/\d+\.\d{2}/g) ?? []).map(Number);
  const trailing = /#N\/A\s*$/.test(line) ? 2 : 3;
  return numbers.slice(0, Math.max(0, numbers.length - trailing)).filter(isPrice);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function extractFuelPrices(text: string): ExtractedPrice[] {
  const pricesByProduct = new Map<string, number[]>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().toUpperCase().replace(/\s+/g, " ");
    if (!line) continue;

    const product = PRODUCTS_BY_KEYWORD_LENGTH.find(
      (candidate) =>
        line === candidate.keyword || line.startsWith(`${candidate.keyword} `),
    );
    if (!product) continue;

    const brandPrices = readBrandPrices(line.slice(product.keyword.length));
    if (brandPrices.length === 0) continue;

    const prices = pricesByProduct.get(product.name) ?? [];
    prices.push(...brandPrices);
    pricesByProduct.set(product.name, prices);
  }

  return FUEL_PRODUCTS.filter((product) => pricesByProduct.has(product.name)).map(
    (product) => ({
      fuelType: product.name,
      fuelTypeID: product.id,
      pricePerUnit: Number(median(pricesByProduct.get(product.name)!).toFixed(2)),
    }),
  );
}

async function getPreviousPrice(fuelType: string, effectiveDate: string) {
  const { data, error } = await supabase
    .from("FuelPriceHistory")
    .select("pricePerUnit")
    .eq("fuelType", fuelType)
    .eq("region", REGION)
    .lt("effectiveDate", effectiveDate)
    .order("effectiveDate", { ascending: false })
    .limit(1);

  if (error) throw error;

  const price = data?.[0]?.pricePerUnit;
  return typeof price === "number" ? price : null;
}

/*
  Saves one week. Each fuel type is saved on its own so one failure (for
  example a product the database does not know yet) never blocks the rest.
  weeklyAdjustment is the change from that fuel type's previous week.
*/
async function saveFuelWeek(
  effectiveDate: string,
  sourceUrl: string,
  prices: ExtractedPrice[],
): Promise<Omit<FuelWeekResult, "sourceUrl" | "effectiveDate">> {
  const savedFuelTypes: string[] = [];
  const failedFuelTypes: FuelWeekResult["failedFuelTypes"] = [];

  for (const price of prices) {
    try {
      const previousPrice = await getPreviousPrice(price.fuelType, effectiveDate);

      const record: Record<string, unknown> = {
        effectiveDate,
        fuelType: price.fuelType,
        region: REGION,
        pricePerUnit: price.pricePerUnit,
        weeklyAdjustment:
          previousPrice === null
            ? null
            : Number((price.pricePerUnit - previousPrice).toFixed(2)),
        source: SOURCE,
        sourceUrl,
        retrievedAt: new Date().toISOString(),
      };

      if (price.fuelTypeID) record.fuelTypeID = price.fuelTypeID;

      const { error } = await supabase
        .from("FuelPriceHistory")
        .upsert(record, { onConflict: "effectiveDate,fuelType,region" });

      if (error) throw error;

      savedFuelTypes.push(price.fuelType);
    } catch (error) {
      failedFuelTypes.push({
        fuelType: price.fuelType,
        reason:
          error instanceof Error
            ? error.message
            : typeof error === "object" && error && "message" in error
              ? String((error as { message: unknown }).message)
              : "Unknown error",
      });
    }
  }

  const found = new Set(prices.map((price) => price.fuelType));

  return {
    savedFuelTypes,
    missingFuelTypes: FUEL_PRODUCTS.map((product) => product.name).filter(
      (name) => !found.has(name),
    ),
    failedFuelTypes,
  };
}

async function syncPdf(
  pdfUrl: string,
  options: { dryRun?: boolean } = {},
): Promise<FuelWeekResult> {
  try {
    const text = await extractPdfText(pdfUrl);
    const effectiveDate = getEffectiveDate(text, pdfUrl);
    const prices = extractFuelPrices(text);

    if (prices.length === 0) {
      throw new Error("No fuel prices were found in the PDF.");
    }

    const readPrices = prices.map(({ fuelType, pricePerUnit }) => ({
      fuelType,
      pricePerUnit,
    }));

    if (options.dryRun) {
      const found = new Set(prices.map((price) => price.fuelType));
      return {
        sourceUrl: pdfUrl,
        effectiveDate,
        savedFuelTypes: [],
        missingFuelTypes: FUEL_PRODUCTS.map((product) => product.name).filter(
          (name) => !found.has(name),
        ),
        failedFuelTypes: [],
        prices: readPrices,
      };
    }

    return {
      sourceUrl: pdfUrl,
      effectiveDate,
      prices: readPrices,
      ...(await saveFuelWeek(effectiveDate, pdfUrl, prices)),
    };
  } catch (error) {
    return {
      sourceUrl: pdfUrl,
      effectiveDate: parseDateFromUrl(pdfUrl),
      savedFuelTypes: [],
      missingFuelTypes: [],
      failedFuelTypes: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/*
  Syncs the newest `weeks` DOE price sheets. Re-saving a week that is already
  stored just updates it, so running this regularly also fills in any week a
  previous run missed.
*/
export async function syncRecentFuelPrices(weeks = 4) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) {
    throw new Error("Weeks must be between 1 and 12.");
  }

  // The DOE page lists newest first. Save oldest first so each week's
  // weeklyAdjustment is measured against the week just before it.
  const pdfUrls = findPdfUrls(await fetchDoePage()).slice(0, weeks).reverse();

  if (pdfUrls.length === 0) {
    throw new Error("No DOE NCR price PDFs were found on the DOE page.");
  }

  const results: FuelWeekResult[] = [];
  for (const pdfUrl of pdfUrls) {
    results.push(await syncPdf(pdfUrl));
  }

  if (results.every((result) => result.savedFuelTypes.length === 0)) {
    throw new Error(
      `No DOE fuel prices could be saved: ${results
        .map((result) => `${result.effectiveDate ?? result.sourceUrl}: ${result.error ?? result.failedFuelTypes.map((f) => `${f.fuelType} (${f.reason})`).join(", ")}`)
        .join("; ")}`,
    );
  }

  return {
    weeksChecked: results.length,
    weeksSaved: results.filter((result) => result.savedFuelTypes.length > 0).length,
    latestEffectiveDate:
      results
        .map((result) => result.effectiveDate)
        .filter((date): date is string => date !== null)
        .sort()
        .at(-1) ?? null,
    results,
  };
}

/*
  Kept for the existing "sync" endpoint: syncs the newest DOE week.
*/
export async function synchronizeLatestFuelPrice() {
  const result = await syncRecentFuelPrices(1);
  const latest = result.results[0];

  return {
    alreadySynchronized: false,
    effectiveDate: latest.effectiveDate,
    records: latest,
  };
}

/*
  Reads every DOE NCR price sheet from `fromDate` onward (the DOE page keeps
  every week back to 2017) and saves all fuel types, oldest week first.

  dryRun: download and read the PDFs but save nothing, to check the results.
  fuelTypes: only save these fuel types (default: all).
*/
export async function backfillFuelPricesSince(
  fromDate: string,
  options: {
    dryRun?: boolean;
    fuelTypes?: string[];
    onProgress?: (done: number, total: number, result: FuelWeekResult) => void;
  } = {},
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new Error("fromDate must be in YYYY-MM-DD format.");
  }

  const links = findPdfUrls(await fetchDoePage()).map((url) => ({
    url,
    date: parseDateFromUrl(url),
  }));

  const undated = links.filter((link) => link.date === null).map((link) => link.url);

  // One sheet per week, oldest first, so weekly adjustments chain correctly.
  const seenDates = new Set<string>();
  const weeks = links
    .filter((link): link is { url: string; date: string } => link.date !== null)
    .filter((link) => link.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((link) => {
      if (seenDates.has(link.date)) return false;
      seenDates.add(link.date);
      return true;
    });

  const results: FuelWeekResult[] = [];

  for (const [index, week] of weeks.entries()) {
    let result: FuelWeekResult;

    if (options.fuelTypes && !options.dryRun) {
      // Read the sheet, then save only the requested fuel types.
      const read = await syncPdf(week.url, { dryRun: true });
      if (read.error || !read.effectiveDate || !read.prices) {
        result = read;
      } else {
        const wanted = FUEL_PRODUCTS.filter(
          (product) =>
            options.fuelTypes!.includes(product.name) &&
            read.prices!.some((price) => price.fuelType === product.name),
        ).map((product) => ({
          fuelType: product.name,
          fuelTypeID: product.id,
          pricePerUnit: read.prices!.find((price) => price.fuelType === product.name)!
            .pricePerUnit,
        }));
        result = {
          ...read,
          ...(await saveFuelWeek(read.effectiveDate, week.url, wanted)),
          missingFuelTypes: read.missingFuelTypes,
        };
      }
    } else {
      result = await syncPdf(week.url, { dryRun: options.dryRun });
    }

    results.push(result);
    options.onProgress?.(index + 1, weeks.length, result);
  }

  return {
    fromDate,
    dryRun: Boolean(options.dryRun),
    sheetsFound: weeks.length,
    sheetsRead: results.filter((result) => !result.error).length,
    undatedLinks: undated,
    results,
  };
}

/*
  Kept for the existing "backfill" endpoint (Admin/Coordinator only).
*/
export async function backfillFuelPriceHistory(months = 24) {
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error("Backfill months must be between 1 and 120.");
  }

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);

  const result = await backfillFuelPricesSince(cutoff.toISOString().slice(0, 10));

  return {
    requestedMonths: months,
    pdfsFound: result.sheetsFound,
    successfulPdfs: result.results.filter((week) => week.savedFuelTypes.length > 0)
      .length,
    failedPdfs: result.results
      .filter((week) => week.savedFuelTypes.length === 0)
      .map((week) => ({
        url: week.sourceUrl,
        reason:
          week.error ??
          week.failedFuelTypes
            .map((failure) => `${failure.fuelType}: ${failure.reason}`)
            .join("; "),
      })),
    recordsSaved: result.results.reduce(
      (sum, week) => sum + week.savedFuelTypes.length,
      0,
    ),
  };
}

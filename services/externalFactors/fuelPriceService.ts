import { extractText, getDocumentProxy } from "unpdf";
import { supabase } from "@/app/lib/supabase";

const DOE_ADJUSTMENT_PAGE =
  "https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/price-adjustments";

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"');
}

function findLatestPdfUrl(html: string) {
  const links = Array.from(
    html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi),
  ).map((match) => decodeHtml(match[1]));

  const adjustmentPdf = links.find((url) =>
    decodeURIComponent(url)
      .toLowerCase()
      .includes("price adjustment"),
  );

  if (!adjustmentPdf) {
    throw new Error("Latest DOE adjustment PDF was not found.");
  }

  return new URL(adjustmentPdf, DOE_ADJUSTMENT_PAGE).toString();
}

async function extractPdfText(pdfUrl: string) {
  const response = await fetch(pdfUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download DOE PDF: ${response.status}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  const result = await extractText(pdf, {
    mergePages: true,
  });

  return Array.isArray(result.text)
    ? result.text.join("\n")
    : result.text;
}

function extractEffectiveDate(text: string) {
  const match = text.match(
    /for the week\s+([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(?:[A-Za-z]+\s+)?\d{1,2},\s*(\d{4})/i,
  );

  if (!match) {
    throw new Error(
      "Could not determine the fuel adjustment effective date.",
    );
  }

  const [, month, day, year] = match;
  const parsed = new Date(`${month} ${day}, ${year} UTC`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("DOE PDF contained an invalid effective date.");
  }

  return parsed.toISOString().split("T")[0];
}

function extractAverageDieselAdjustment(text: string) {
  const lines = text.split(/\r?\n/);
  const adjustments: number[] = [];

  /*
   * DOE rows normally contain:
   * Company | gasoline adjustment | diesel adjustment | kerosene adjustment
   */
  for (const line of lines) {
    const values = line.match(/-?\d+\.\d{2}/g);

    if (!values || values.length < 2) {
      continue;
    }

    /*
     * Ignore lines that appear to contain times rather than
     * product adjustments.
     */
    const hasCompanyName = /^[\s]*[A-Za-z][A-Za-z\s.&-]+/.test(line);

    if (!hasCompanyName) {
      continue;
    }

    const gasoline = Number(values[0]);
    const diesel = Number(values[1]);

    if (
      Number.isFinite(gasoline) &&
      Number.isFinite(diesel) &&
      Math.abs(gasoline) <= 20 &&
      Math.abs(diesel) <= 20
    ) {
      adjustments.push(diesel);
    }
  }

  if (adjustments.length < 2) {
    throw new Error(
      "Could not reliably extract diesel adjustments from the DOE PDF.",
    );
  }

  const average =
    adjustments.reduce((total, value) => total + value, 0) /
    adjustments.length;

  return Number(average.toFixed(2));
}

export async function synchronizeLatestFuelPrice() {
  const pageResponse = await fetch(DOE_ADJUSTMENT_PAGE, {
    cache: "no-store",
  });

  if (!pageResponse.ok) {
    throw new Error(
      `Failed to access DOE page: ${pageResponse.status}`,
    );
  }

  const html = await pageResponse.text();
  const pdfUrl = findLatestPdfUrl(html);
  const pdfText = await extractPdfText(pdfUrl);

  const effectiveDate = extractEffectiveDate(pdfText);
  const weeklyAdjustment =
    extractAverageDieselAdjustment(pdfText);

  const { data: existing, error: existingError } = await supabase
    .from("FuelPriceHistory")
    .select("*")
    .eq("effectiveDate", effectiveDate)
    .eq("fuelType", "Diesel")
    .eq("region", "NCR")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.pricePerLiter !== null) {
    return {
      alreadySynchronized: true,
      record: existing,
    };
  }

  const { data: previous, error: previousError } = await supabase
    .from("FuelPriceHistory")
    .select("pricePerLiter")
    .eq("fuelType", "Diesel")
    .eq("region", "NCR")
    .lt("effectiveDate", effectiveDate)
    .not("pricePerLiter", "is", null)
    .order("effectiveDate", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    throw previousError;
  }

  if (!previous?.pricePerLiter) {
    throw new Error(
      "No previous diesel price is available. Add a baseline price first.",
    );
  }

  const pricePerLiter = Number(
    (
      Number(previous.pricePerLiter) + weeklyAdjustment
    ).toFixed(2),
  );

  if (pricePerLiter < 20 || pricePerLiter > 200) {
    throw new Error(
      `Calculated diesel price ${pricePerLiter} failed validation.`,
    );
  }

  const record = {
    effectiveDate,
    fuelType: "Diesel",
    region: "NCR",
    pricePerLiter,
    weeklyAdjustment,
    source: "DOE Philippines",
    sourceUrl: pdfUrl,
    retrievedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("FuelPriceHistory")
    .upsert(record, {
      onConflict: "effectiveDate,fuelType,region",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    alreadySynchronized: false,
    record: data,
  };
}

type ParsedFuelAdjustment = {
  effectiveDate: string;
  weeklyAdjustment: number;
  sourceUrl: string;
};

function findAllAdjustmentPdfUrls(html: string): string[] {
  const links = Array.from(
    html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi),
  )
    .map((match) => decodeHtml(match[1]))
    .filter((url) => {
      try {
        return decodeURIComponent(url)
          .toLowerCase()
          .includes("price adjustment");
      } catch {
        return false;
      }
    })
    .map((url) => new URL(url, DOE_ADJUSTMENT_PAGE).toString());

  return [...new Set(links)];
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

export async function backfillFuelPriceHistory(months = 24) {
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    throw new Error("Backfill months must be between 1 and 60.");
  }

  const { data: baseline, error: baselineError } = await supabase
    .from("FuelPriceHistory")
    .select("*")
    .eq("fuelType", "Diesel")
    .eq("region", "NCR")
    .not("pricePerLiter", "is", null)
    .order("effectiveDate", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (baselineError) {
    throw baselineError;
  }

  if (!baseline?.pricePerLiter || !baseline?.effectiveDate) {
    throw new Error(
      "A baseline diesel price is required before running the backfill.",
    );
  }

  const pageResponse = await fetch(DOE_ADJUSTMENT_PAGE, {
    cache: "no-store",
  });

  if (!pageResponse.ok) {
    throw new Error(
      `Failed to access DOE page: ${pageResponse.status}`,
    );
  }

  const html = await pageResponse.text();
  const pdfUrls = findAllAdjustmentPdfUrls(html);

  if (pdfUrls.length === 0) {
    throw new Error("No historical DOE adjustment PDFs were found.");
  }

  const parsedAdjustments: ParsedFuelAdjustment[] = [];
  const skipped: Array<{ sourceUrl: string; reason: string }> = [];

  /*
   * Process sequentially to avoid sending too many simultaneous
   * requests to the DOE website.
   */
  for (const pdfUrl of pdfUrls) {
    try {
      const text = await extractPdfText(pdfUrl);

      parsedAdjustments.push({
        effectiveDate: extractEffectiveDate(text),
        weeklyAdjustment: extractAverageDieselAdjustment(text),
        sourceUrl: pdfUrl,
      });
    } catch (error) {
      skipped.push({
        sourceUrl: pdfUrl,
        reason:
          error instanceof Error
            ? error.message
            : "Unable to process PDF.",
      });
    }
  }

  const uniqueAdjustments = Array.from(
    new Map(
      parsedAdjustments.map((item) => [
        item.effectiveDate,
        item,
      ]),
    ).values(),
  );

  const baselineDate = new Date(
    `${baseline.effectiveDate}T00:00:00Z`,
  );
  const minimumDate = subtractMonths(baselineDate, months);

  const applicableAdjustments = uniqueAdjustments
    .filter((item) => {
      const date = new Date(`${item.effectiveDate}T00:00:00Z`);

      return date <= baselineDate && date >= minimumDate;
    })
    .sort(
      (a, b) =>
        new Date(b.effectiveDate).getTime() -
        new Date(a.effectiveDate).getTime(),
    );

  const baselineIndex = applicableAdjustments.findIndex(
    (item) => item.effectiveDate === baseline.effectiveDate,
  );

  if (baselineIndex === -1) {
    throw new Error(
      `The DOE adjustment PDF for baseline ${baseline.effectiveDate} was not found.`,
    );
  }

  const orderedAdjustments =
    applicableAdjustments.slice(baselineIndex);

  if (orderedAdjustments.length < 2) {
    throw new Error(
      "Not enough historical DOE adjustments were found for backfilling.",
    );
  }

  let calculatedPrice = Number(baseline.pricePerLiter);
  const records = [];

  for (let index = 0; index < orderedAdjustments.length; index++) {
    const current = orderedAdjustments[index];

    if (index > 0) {
      const newerAdjustment =
        orderedAdjustments[index - 1].weeklyAdjustment;

      calculatedPrice = Number(
        (calculatedPrice - newerAdjustment).toFixed(2),
      );
    }

    if (calculatedPrice < 20 || calculatedPrice > 200) {
      throw new Error(
        `Calculated price ${calculatedPrice} for ${current.effectiveDate} failed validation.`,
      );
    }

    records.push({
      effectiveDate: current.effectiveDate,
      fuelType: "Diesel",
      region: "NCR",
      pricePerLiter: calculatedPrice,
      weeklyAdjustment: current.weeklyAdjustment,
      source: "DOE Philippines",
      sourceUrl: current.sourceUrl,
      retrievedAt: new Date().toISOString(),
    });
  }

  const { data, error } = await supabase
    .from("FuelPriceHistory")
    .upsert(records, {
      onConflict: "effectiveDate,fuelType,region",
    })
    .select();

  if (error) {
    throw error;
  }

  return {
    baselineDate: baseline.effectiveDate,
    baselinePrice: Number(baseline.pricePerLiter),
    requestedMonths: months,
    pdfsFound: pdfUrls.length,
    pdfsProcessed: parsedAdjustments.length,
    recordsSaved: data?.length ?? 0,
    earliestDate:
      records[records.length - 1]?.effectiveDate ?? null,
    latestDate: records[0]?.effectiveDate ?? null,
    skipped,
    records: data ?? [],
  };
}
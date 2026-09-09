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
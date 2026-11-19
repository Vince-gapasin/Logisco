// The products on a stop: what is loaded at a pickup, what is dropped at a
// delivery. Shared by the booking form, the server that saves them and every
// screen that shows them, so all of them agree on what a line is.

export const STOCK_UNITS = ["pcs", "boxes", "trays", "packs", "crates", "bags", "kg"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const DEFAULT_UNIT: StockUnit = "pcs";

/** The most lines one stop may carry, and the longest product name. */
export const MAX_ITEMS_PER_STOP = 50;
export const MAX_PRODUCT_NAME = 120;
export const MAX_ITEM_QUANTITY = 1_000_000;

export interface StopItem {
  productName: string;
  quantity: number;
  unit: StockUnit;
}

export function isStockUnit(value: unknown): value is StockUnit {
  return typeof value === "string" && (STOCK_UNITS as readonly string[]).includes(value);
}

/** Collapses spacing so "  Ube   buns " and "Ube buns" are one product. */
export function cleanProductName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** The same product and unit, written any way: what a total adds up by. */
export function itemKey(item: Pick<StopItem, "productName" | "unit">): string {
  return `${cleanProductName(item.productName).toLowerCase()}|${item.unit}`;
}

/** "Buns 50 trays". A count of one piece reads "Cake 1 pc". */
export function describeItem(item: StopItem): string {
  const unit = item.unit === "pcs" && item.quantity === 1 ? "pc" : item.unit;
  return `${cleanProductName(item.productName)} ${item.quantity.toLocaleString("en-US")} ${unit}`;
}

/** "Buns 50 trays, Cake 20 boxes". Empty when there are none. */
export function describeItems(items: readonly StopItem[]): string {
  return items.map(describeItem).join(", ");
}

/** How many units change hands at the stop: the stop's quantity column. */
export function totalUnits(items: readonly Pick<StopItem, "quantity">[]): number {
  return items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

/** Every product across the stops, added up by name and unit, in first-seen order. */
export function productTotals(stops: readonly (readonly StopItem[])[]): StopItem[] {
  const totals = new Map<string, StopItem>();
  for (const items of stops) {
    for (const item of items) {
      const key = itemKey(item);
      const seen = totals.get(key);
      if (seen) seen.quantity += item.quantity;
      else totals.set(key, { productName: cleanProductName(item.productName), quantity: item.quantity, unit: item.unit });
    }
  }
  return [...totals.values()];
}

export interface LoadBalanceRow {
  productName: string;
  unit: StockUnit;
  loaded: number;
  dropped: number;
}

/**
 * What the pickups load against what the deliveries drop, product by product.
 * A row whose two numbers differ is worth a second look before the booking is
 * saved - it is not refused, since a partial load or stock already on the
 * truck is real.
 */
export function loadBalance(
  pickups: readonly (readonly StopItem[])[],
  deliveries: readonly (readonly StopItem[])[],
): LoadBalanceRow[] {
  const rows = new Map<string, LoadBalanceRow>();
  const add = (items: readonly StopItem[], side: "loaded" | "dropped") => {
    for (const item of items) {
      const key = itemKey(item);
      const row =
        rows.get(key) ??
        rows.set(key, { productName: cleanProductName(item.productName), unit: item.unit, loaded: 0, dropped: 0 }).get(key)!;
      row[side] += item.quantity;
    }
  };
  pickups.forEach((items) => add(items, "loaded"));
  deliveries.forEach((items) => add(items, "dropped"));
  return [...rows.values()];
}

/**
 * The booking's cargo as OrderDetails rows, one per product: what is delivered
 * across every stop, or what is collected when nothing is listed on the drops.
 * The screens and reports that predate products per stop read these.
 */
export function orderDetailsFromStops(
  pickups: readonly (readonly StopItem[])[],
  deliveries: readonly (readonly StopItem[])[],
): { productName: string; productType: string; quantity: number; weightPerItem: number }[] {
  const dropped = productTotals(deliveries);
  const source = dropped.length > 0 ? dropped : productTotals(pickups);
  // OrderDetails has no unit column; the unit rides in productType, which was
  // only ever "General".
  return source.map((item) => ({
    productName: item.productName,
    productType: item.unit,
    quantity: item.quantity,
    weightPerItem: 0,
  }));
}

/** StopItems rows as they come back embedded under a stop, in the office's order. */
export function readStopItems(
  rows: readonly { productName?: string | null; quantity?: number | null; unit?: string | null; position?: number | null }[] | null | undefined,
): StopItem[] {
  return [...(rows ?? [])]
    .filter((row) => row && row.productName && Number(row.quantity) > 0)
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map((row) => ({
      productName: cleanProductName(String(row.productName)),
      quantity: Number(row.quantity),
      unit: isStockUnit(row.unit) ? row.unit : DEFAULT_UNIT,
    }));
}

/** The StopItems columns to embed under a stop in a select. */
export const STOP_ITEMS_EMBED = "StopItems ( productName, quantity, unit, position )";

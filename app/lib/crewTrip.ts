// What a crew member is shown about a trip, read from the booking as it was made.

// The priority the office set when booking, which the booking form writes into
// Order.notes as "Priority: <level>". Every trip used to read "Standard".
export function readPriority(notes: string | null): string {
  const match = /Priority:\s*([^\n]+)/i.exec(notes || "");
  const value = match ? match[1].trim() : "";
  return value && value !== "undefined" ? value : "";
}

/** "Canned Sardines ×120, Noodles ×80" - what is actually on the truck. */
export function describeItems(items: { productName?: string | null; quantity?: number | null }[]): string {
  return items
    .filter((item) => item.productName)
    .map((item) => (item.quantity ? `${item.productName} ×${item.quantity}` : `${item.productName}`))
    .join(", ");
}

export function totalQuantity(items: { quantity?: number | null }[]): string {
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return total > 0 ? `${total.toLocaleString()} item${total === 1 ? "" : "s"}` : "";
}

export const quantityOf = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "";
};

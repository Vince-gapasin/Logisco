import { supabase } from "@/app/lib/supabase";
import { cleanProductName, DEFAULT_UNIT, isStockUnit, type StockUnit } from "@/app/lib/stopItems";

export interface ProductSuggestion {
  productName: string;
  /** The unit it was last booked in, offered as the default. */
  unit: StockUnit;
}

const MAX_SUGGESTIONS = 100;

/**
 * Products this client has booked before, most recent first, each once: what
 * the booking form offers as the office types a product name. Read from the
 * products on earlier stops, then from the one-line cargo of bookings made
 * before products were listed per stop.
 */
export async function getClientProductSuggestions(clientID: string): Promise<ProductSuggestion[]> {
  const [onStops, onOrders] = await Promise.all([
    supabase
      .from("StopItems")
      .select("productName, unit, createdAt, Order!inner ( clientID )")
      .eq("Order.clientID", clientID)
      .order("createdAt", { ascending: false })
      .limit(500),
    supabase
      .from("OrderDetails")
      .select("productName, Order!inner ( clientID, createdAt )")
      .eq("Order.clientID", clientID)
      .limit(300),
  ]);

  if (onStops.error) throw new Error(`Product suggestions failed: ${onStops.error.message}`);

  const seen = new Map<string, ProductSuggestion>();
  const add = (name: unknown, unit: unknown) => {
    if (typeof name !== "string") return;
    const productName = cleanProductName(name);
    // The one-line cargo of older bookings is often a sentence ("50 boxes of
    // tile"), or several names joined; only short, single names are useful.
    if (!productName || productName.length > 60 || productName.includes(",")) return;
    const key = productName.toLowerCase();
    if (seen.has(key) || seen.size >= MAX_SUGGESTIONS) return;
    seen.set(key, { productName, unit: isStockUnit(unit) ? unit : DEFAULT_UNIT });
  };

  for (const row of onStops.data ?? []) add(row.productName, row.unit);
  // Older bookings are a fallback only, so a failure there is not worth
  // refusing the suggestions that did load.
  for (const row of onOrders.data ?? []) add(row.productName, null);

  return [...seen.values()];
}

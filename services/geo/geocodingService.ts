// Turns a delivery address into coordinates so stops can be plotted on the
// live map and the customer tracking page. Uses the Mapbox Geocoding API with
// the token the map already uses.
//
// Geocoding is best-effort: a failure must never block a booking, so callers
// fall back to the 0/0 placeholder that BranchStops has always used.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const REQUEST_TIMEOUT_MS = 5000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address?.trim();
  if (!query || !MAPBOX_TOKEN) return null;

  const url =
    `${GEOCODE_URL}?q=${encodeURIComponent(query)}` +
    `&country=ph&limit=1&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      console.error(`Geocoding failed for "${query}": HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    const coordinates = result?.features?.[0]?.geometry?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch (error) {
    console.error(`Geocoding error for "${query}":`, error);
    return null;
  }
}

// Geocodes several addresses, looking each distinct address up only once.
export async function geocodeAddresses(addresses: string[]): Promise<Map<string, Coordinates>> {
  const unique = [...new Set(addresses.map((a) => a?.trim()).filter(Boolean))] as string[];
  const results = new Map<string, Coordinates>();

  const resolved = await Promise.all(unique.map((address) => geocodeAddress(address)));

  unique.forEach((address, index) => {
    const coordinates = resolved[index];
    if (coordinates) results.set(address, coordinates);
  });

  return results;
}

// Turns a delivery address into coordinates so stops can be plotted on the
// live map and the customer tracking page. Uses the Mapbox Geocoding API with
// the token the map already uses.
//
// Geocoding is best-effort: a failure must never block a booking, so callers
// fall back to the 0/0 placeholder that BranchStops has always used.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;

// Said once, at startup, rather than swallowed on every call. Without this a
// missing token is invisible: bookings are saved with the 0/0 placeholder and
// nothing anywhere says why the stops will not plot.
if (!MAPBOX_TOKEN) {
  console.warn(
    "[geocoding] NEXT_PUBLIC_MAPBOX_TOKEN is not set. Stop addresses will not " +
      "be resolved to coordinates and will be saved as 0/0, so they will not " +
      "appear on any map.",
  );
}
const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const REQUEST_TIMEOUT_MS = 5000;

export interface Coordinates {
  latitude: number;
  longitude: number;
  /** What Mapbox believed the address to be; useful for spotting bad matches. */
  matchedAddress?: string;
}

// Results are biased towards Metro Manila. Without it, Mapbox resolved
// "Bonifacio Global City, Taguig City" to a point in Aurora province.
const PROXIMITY_LONGITUDE = 121.05;
const PROXIMITY_LATITUDE = 14.55;

// Compares town names ignoring accents, punctuation and a trailing "City":
// Mapbox returns "Las Piñas" where an address usually reads "Las Pinas",
// and "Makati" where the address says "Makati City".
function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\bcity\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentionsPlace(address: string, place: string): boolean {
  const normalizedPlace = normalizePlace(place);
  if (!normalizedPlace) return true;

  return normalizePlace(address).includes(normalizedPlace);
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address?.trim();
  if (!query || !MAPBOX_TOKEN) return null;

  const url =
    `${GEOCODE_URL}?q=${encodeURIComponent(query)}` +
    `&country=ph&limit=1` +
    `&proximity=${PROXIMITY_LONGITUDE},${PROXIMITY_LATITUDE}` +
    `&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      console.error(`Geocoding failed for "${query}": HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    const feature = result?.features?.[0];
    const coordinates = feature?.geometry?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    // Vague addresses match confidently but wrongly: "Bonifacio Global City,
    // Taguig City" resolves to a street called Bonifacio in Manila. If the town
    // Mapbox matched is not named in the address we asked for, the result is a
    // different place and is refused. A missing pin beats a pin 10 km away.
    const matchedPlace: string | undefined = feature?.properties?.context?.place?.name;
    if (matchedPlace && !mentionsPlace(query, matchedPlace)) {
      console.warn(
        `Geocoding rejected for "${query}": matched ${feature?.properties?.full_address ?? matchedPlace}`,
      );
      return null;
    }

    return {
      latitude,
      longitude,
      matchedAddress: feature?.properties?.full_address ?? feature?.properties?.name,
    };
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

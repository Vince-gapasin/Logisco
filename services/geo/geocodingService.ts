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

// Administrative areas: a town, a district, a barangay. Asking for these and
// nothing else is how an address that names only a city gets the city, rather
// than whichever road Mapbox liked the look of.
const PLACE_TYPES = "place,locality,district,neighborhood";

interface GeocodeMatch {
  latitude: number;
  longitude: number;
  label: string;
  /** What Mapbox matched: "street", "address", "place" and so on. */
  featureType: string;
  /** The town it sits in, when it named one. */
  place?: string;
  /** The street or place's own name. */
  name?: string;
}

async function askMapbox(query: string, types?: string): Promise<GeocodeMatch | null> {
  const url =
    `${GEOCODE_URL}?q=${encodeURIComponent(query)}` +
    `&country=ph&limit=1` +
    `&proximity=${PROXIMITY_LONGITUDE},${PROXIMITY_LATITUDE}` +
    (types ? `&types=${types}` : "") +
    `&access_token=${MAPBOX_TOKEN}`;

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

  return {
    latitude,
    longitude,
    label: feature?.properties?.full_address ?? feature?.properties?.name ?? query,
    featureType: feature?.properties?.feature_type ?? "",
    place: feature?.properties?.context?.place?.name,
    name: feature?.properties?.name,
  };
}

/**
 * Why a match is refused.
 *
 * Two ways a confident answer is the wrong place:
 *
 * The town is not the one asked for. "Bonifacio Global City, Taguig City"
 * resolved to a street called Bonifacio in Manila.
 *
 * Or the answer is more precise than the question. Every bare "<somewhere>
 * City, Metro Manila" matched a slip road called Skyway Bangkal in Makati -
 * refused for the other cities because the town was wrong, and accepted for
 * Makati, where it put a hundred and fifty pickups on a motorway ramp a mile
 * and a half from the city. A street is only believable when the address asked
 * for that street by name.
 */
function whyRefused(query: string, match: GeocodeMatch): string | null {
  if (match.place && !mentionsPlace(query, match.place)) {
    return `matched ${match.label}, which is in ${match.place}`;
  }

  const isPrecise = match.featureType === "street" || match.featureType === "address";
  if (isPrecise && match.name && !mentionsPlace(query, match.name)) {
    return `matched ${match.label}, a ${match.featureType} the address does not name`;
  }

  return null;
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address?.trim();
  if (!query || !MAPBOX_TOKEN) return null;

  try {
    const precise = await askMapbox(query);
    if (precise) {
      const refused = whyRefused(query, precise);
      if (!refused) {
        return { latitude: precise.latitude, longitude: precise.longitude, matchedAddress: precise.label };
      }

      // Ask again for the town itself. An address that names only a city has
      // no street to find, and the centre of the right city beats a road in
      // the wrong one.
      const place = await askMapbox(query, PLACE_TYPES);
      if (place && !whyRefused(query, place)) {
        return { latitude: place.latitude, longitude: place.longitude, matchedAddress: place.label };
      }

      console.warn(`Geocoding rejected for "${query}": ${refused}`);
      return null;
    }

    return null;
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

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
}

const geocodeCache = new Map<string, GeocodedLocation>();

/**
 * Geocode an address string to lat/lng using Mapbox Geocoding API.
 * Results are cached in-memory to prevent redundant API calls.
 */
export async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  if (!address || !MAPBOX_TOKEN) return null;

  const cached = geocodeCache.get(address);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.features?.length) return null;

    const [lng, lat] = data.features[0].center;
    const result: GeocodedLocation = { latitude: lat, longitude: lng };
    geocodeCache.set(address, result);
    return result;
  } catch {
    return null;
  }
}

const GEO_SIM_STORAGE_KEY = "chicago-travel-geo-sim";

export type GeoCoordinates = {
  lat: number;
  lng: number;
};

function parseCoordinate(value: string | null): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Optional simulated coordinates for testing arrival detection without
 * traveling. Sources (first match wins):
 * 1. URL search params `simulateLat` + `simulateLng`
 * 2. localStorage key `chicago-travel-geo-sim` as JSON `{ "lat": n, "lng": n }`
 *    (skipped when `includeStored` is false — e.g. Descubrir uses trip center instead)
 */
export function getSimulatedCoordinates(options?: {
  includeStored?: boolean;
}): GeoCoordinates | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromUrl = getUrlSimulatedCoordinates();
  if (fromUrl) {
    return fromUrl;
  }

  if (options?.includeStored === false) {
    return null;
  }

  const raw = window.localStorage.getItem(GEO_SIM_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    const lat = typeof parsed.lat === "number" ? parsed.lat : null;
    const lng = typeof parsed.lng === "number" ? parsed.lng : null;
    if (lat != null && lng != null) {
      return { lat, lng };
    }
  } catch {
    return null;
  }

  return null;
}

export function getUrlSimulatedCoordinates(): GeoCoordinates | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const paramLat = parseCoordinate(params.get("simulateLat"));
  const paramLng = parseCoordinate(params.get("simulateLng"));
  if (paramLat != null && paramLng != null) {
    return { lat: paramLat, lng: paramLng };
  }

  return null;
}

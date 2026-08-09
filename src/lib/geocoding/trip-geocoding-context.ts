export type TripGeocodingContext = {
  center_lat: number | null;
  center_lng: number | null;
  search_radius_km: number;
  base_location: string | null;
};

export const DEFAULT_SEARCH_RADIUS_KM = 20;

export const TRIP_GEOCODING_SELECT =
  "center_lat, center_lng, search_radius_km, base_location";

export function normalizeTripGeocodingContext(
  row:
    | Partial<{
        center_lat: number | null;
        center_lng: number | null;
        search_radius_km: number | null;
        base_location: string | null;
      }>
    | null
    | undefined,
): TripGeocodingContext {
  const centerLat = normalizeCoordinate(row?.center_lat);
  const centerLng = normalizeCoordinate(row?.center_lng);
  const hasCenter = centerLat != null && centerLng != null;

  return {
    center_lat: hasCenter ? centerLat : null,
    center_lng: hasCenter ? centerLng : null,
    search_radius_km: normalizeSearchRadiusKm(row?.search_radius_km),
    base_location: row?.base_location?.trim() || null,
  };
}

export function hasTripGeocodingCenter(
  context: TripGeocodingContext,
): context is TripGeocodingContext & {
  center_lat: number;
  center_lng: number;
} {
  return context.center_lat != null && context.center_lng != null;
}

/** Nominatim viewbox: left,top,right,bottom (min lon, max lat, max lon, min lat). */
export function buildNominatimViewbox(context: TripGeocodingContext): string | null {
  if (!hasTripGeocodingCenter(context)) {
    return null;
  }

  const { center_lat: lat, center_lng: lng, search_radius_km: radiusKm } = context;
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const left = lng - lngDelta;
  const right = lng + lngDelta;
  const top = lat + latDelta;
  const bottom = lat - latDelta;

  return `${left},${top},${right},${bottom}`;
}

function normalizeCoordinate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeSearchRadiusKm(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_SEARCH_RADIUS_KM;
  }

  return Math.round(value);
}

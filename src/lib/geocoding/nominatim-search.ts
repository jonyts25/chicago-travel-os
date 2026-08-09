import {
  buildNominatimViewbox,
  normalizeTripGeocodingContext,
  type TripGeocodingContext,
} from "@/lib/geocoding/trip-geocoding-context";
import { getNominatimUserAgent } from "@/lib/geocoding/nominatim";

export type NominatimPlaceSearchResult = {
  resultId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_SEARCH_LIMIT = 8;

type NominatimSearchApiResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  osm_type?: string;
  osm_id?: number | string;
  type?: string;
};

export async function searchPlacesWithNominatim(
  query: string,
  context: TripGeocodingContext = normalizeTripGeocodingContext(null),
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<NominatimPlaceSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 10))));
  url.searchParams.set("addressdetails", "1");

  const viewbox = buildNominatimViewbox(context);
  if (viewbox) {
    url.searchParams.set("viewbox", viewbox);
    url.searchParams.set("bounded", "1");
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": getNominatimUserAgent(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const results = (await response.json()) as NominatimSearchApiResult[];
    const mapped: NominatimPlaceSearchResult[] = [];

    for (const result of results) {
      const parsed = mapSearchResult(result);
      if (parsed) {
        mapped.push(parsed);
      }
    }

    return mapped;
  } catch {
    return [];
  }
}

function mapSearchResult(
  result: NominatimSearchApiResult,
): NominatimPlaceSearchResult | null {
  const lat = Number(result.lat);
  const lng = Number(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const address = result.display_name?.trim();
  if (!address) {
    return null;
  }

  const name = result.name?.trim() || address.split(",")[0]?.trim() || address;
  const resultId = buildResultId(result, lat, lng, name);

  return {
    resultId,
    name,
    address,
    lat,
    lng,
  };
}

function buildResultId(
  result: NominatimSearchApiResult,
  lat: number,
  lng: number,
  name: string,
): string {
  if (result.osm_type && result.osm_id != null) {
    return `${result.osm_type}:${result.osm_id}`;
  }

  return `${name}:${lat.toFixed(6)},${lng.toFixed(6)}`;
}

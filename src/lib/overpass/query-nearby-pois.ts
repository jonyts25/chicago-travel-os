import { getNominatimUserAgent } from "@/lib/geocoding/nominatim";
import { getDistanceMeters } from "@/lib/hoy/geo-distance";
import { inferOsmFiltersFromQuery, type OsmTagFilter } from "@/lib/overpass/infer-osm-filters";

export type OverpassPoi = {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  distanceMeters: number;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
] as const;

const DEFAULT_RADIUS_METERS = 1200;
const MAX_POIS = 45;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES_PER_ENDPOINT = 2;
const RETRY_BACKOFF_MS = [1_000, 2_000];
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OverpassAttemptResult =
  | { ok: true; data: OverpassResponse }
  | { ok: false; retryable: boolean; message: string };

export async function queryNearbyPois(input: {
  lat: number;
  lng: number;
  query: string;
  radiusMeters?: number;
}): Promise<{ pois: OverpassPoi[]; error: string | null }> {
  const radiusMeters = input.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const filters = inferOsmFiltersFromQuery(input.query);
  const overpassQuery = buildOverpassQuery(input.lat, input.lng, radiusMeters, filters);

  let lastError = "No se pudo consultar Overpass.";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_ENDPOINT; attempt++) {
      if (attempt > 0) {
        await delay(RETRY_BACKOFF_MS[attempt - 1] ?? 2_000);
      }

      const result = await queryOverpassEndpoint(endpoint, overpassQuery);

      if (result.ok) {
        const pois = parseOverpassElements(
          result.data.elements ?? [],
          input.lat,
          input.lng,
          radiusMeters,
        );

        if (pois.length === 0) {
          return {
            pois: [],
            error: "No encontramos lugares cercanos en OpenStreetMap para esta búsqueda.",
          };
        }

        return { pois, error: null };
      }

      lastError = result.message;

      if (!result.retryable) {
        break;
      }
    }
  }

  return {
    pois: [],
    error: `${lastError} Intenta de nuevo en unos segundos — suele ser temporal del servidor público de OpenStreetMap.`,
  };
}

async function queryOverpassEndpoint(
  endpoint: string,
  overpassQuery: string,
): Promise<OverpassAttemptResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": getNominatimUserAgent(),
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const retryable = RETRYABLE_STATUS_CODES.has(response.status);
      return {
        ok: false,
        retryable,
        message: `Overpass respondió con ${response.status}.`,
      };
    }

    const data = (await response.json()) as OverpassResponse;
    return { ok: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al consultar Overpass.";
    const retryable =
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        message.toLowerCase().includes("timeout"));

    return {
      ok: false,
      retryable,
      message,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildOverpassQuery(
  lat: number,
  lng: number,
  radiusMeters: number,
  filters: OsmTagFilter[],
): string {
  const clauses = filters.flatMap((filter) => [
    `node["${filter.key}"="${filter.value}"](around:${radiusMeters},${lat},${lng});`,
    `way["${filter.key}"="${filter.value}"](around:${radiusMeters},${lat},${lng});`,
  ]);

  return `[out:json][timeout:25];
(
  ${clauses.join("\n  ")}
);
out center ${MAX_POIS};`;
}

function parseOverpassElements(
  elements: OverpassElement[],
  originLat: number,
  originLng: number,
  maxDistanceMeters: number,
): OverpassPoi[] {
  const seen = new Map<string, OverpassPoi>();

  for (const element of elements) {
    const name = element.tags?.name?.trim();
    if (!name) {
      continue;
    }

    const coords = resolveElementCoordinates(element);
    if (!coords) {
      continue;
    }

    const distanceMeters = Math.round(
      getDistanceMeters(originLat, originLng, coords.lat, coords.lng),
    );

    if (distanceMeters > maxDistanceMeters) {
      continue;
    }

    const osmId = `${element.type}/${element.id}`;
    const category = mapTagsToCategory(element.tags ?? {});
    const normalizedName = name.toLowerCase();

    const existing = seen.get(normalizedName);
    if (existing && existing.distanceMeters <= distanceMeters) {
      continue;
    }

    seen.set(normalizedName, {
      osmId,
      name,
      lat: coords.lat,
      lng: coords.lng,
      category,
      distanceMeters,
    });
  }

  return Array.from(seen.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function resolveElementCoordinates(
  element: OverpassElement,
): { lat: number; lng: number } | null {
  if (element.type === "node" && element.lat != null && element.lon != null) {
    return { lat: element.lat, lng: element.lon };
  }

  if (element.center?.lat != null && element.center?.lon != null) {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return null;
}

function mapTagsToCategory(tags: Record<string, string>): string {
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const shop = tags.shop;

  if (amenity === "restaurant" || amenity === "fast_food" || amenity === "food_court") {
    return "Restaurante";
  }
  if (amenity === "cafe") {
    return "Café";
  }
  if (amenity === "bar" || amenity === "pub") {
    return "Bar";
  }
  if (tourism === "museum" || amenity === "arts_centre") {
    return "Museo";
  }
  if (tourism === "attraction" || tags.historic === "monument") {
    return "Atracción";
  }
  if (leisure === "park" || leisure === "garden") {
    return "Parque";
  }
  if (shop === "mall" || shop === "department_store" || amenity === "marketplace") {
    return "Compras";
  }
  if (amenity === "ice_cream" || shop === "bakery") {
    return "Postres";
  }

  return "Otro";
}

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

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_METERS = 1200;
const MAX_POIS = 45;

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

export async function queryNearbyPois(input: {
  lat: number;
  lng: number;
  query: string;
  radiusMeters?: number;
}): Promise<{ pois: OverpassPoi[]; error: string | null }> {
  const radiusMeters = input.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const filters = inferOsmFiltersFromQuery(input.query);
  const overpassQuery = buildOverpassQuery(input.lat, input.lng, radiusMeters, filters);

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": getNominatimUserAgent(),
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      return {
        pois: [],
        error: `Overpass API respondió con ${response.status}.`,
      };
    }

    const data = (await response.json()) as OverpassResponse;
    const pois = parseOverpassElements(data.elements ?? [], input.lat, input.lng, radiusMeters);

    if (pois.length === 0) {
      return {
        pois: [],
        error: "No encontramos lugares cercanos en OpenStreetMap para esta búsqueda.",
      };
    }

    return { pois, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al consultar Overpass.";
    return { pois: [], error: message };
  }
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

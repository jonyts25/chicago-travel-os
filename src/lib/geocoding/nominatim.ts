import { hasCoordinates } from "@/lib/places/schema";
import {
  buildNominatimViewbox,
  normalizeTripGeocodingContext,
  type TripGeocodingContext,
} from "@/lib/geocoding/trip-geocoding-context";

export type GeocodeResult = {
  lat: number | null;
  lng: number | null;
  address: string | null;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_DELAY_MS = 1000;

const GENERIC_CHAIN_HINTS = [
  "target",
  "marshalls",
  "marshall",
  "t.j. maxx",
  "tj maxx",
  "walmart",
  "costco",
  "best buy",
  "cvs",
  "walgreens",
  "starbucks",
  "mcdonald",
  "chipotle",
  "trader joe",
  "whole foods",
];

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

export function getNominatimUserAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT ??
    "ChicagoTravelOS/1.0 (contact@chicago-travel-os.app)"
  );
}

export function buildGeocodeQueries(
  placeName: string,
  context: TripGeocodingContext = normalizeTripGeocodingContext(null),
): [string, string] {
  const name = placeName.trim();
  const locationSuffix = context.base_location?.trim();

  if (isLikelyGenericChain(name)) {
    if (locationSuffix) {
      return [`${name}, ${locationSuffix}`, name];
    }

    return [name, name];
  }

  if (name.split(/\s+/).length <= 3) {
    if (locationSuffix) {
      return [`${name}, ${locationSuffix}`, name];
    }

    return [name, name];
  }

  if (locationSuffix) {
    return [`${name}, ${locationSuffix}`, name];
  }

  return [name, name];
}

export async function geocodePlaceWithRetries(
  placeName: string,
  context: TripGeocodingContext = normalizeTripGeocodingContext(null),
): Promise<GeocodeResult> {
  const [firstQuery, secondQuery] = buildGeocodeQueries(placeName, context);

  const firstAttempt = await searchNominatim(firstQuery, context);
  if (hasCoordinates(firstAttempt)) {
    return firstAttempt;
  }

  if (firstQuery === secondQuery) {
    return { lat: null, lng: null, address: null };
  }

  await delay(NOMINATIM_DELAY_MS);

  const secondAttempt = await searchNominatim(secondQuery, context);
  if (hasCoordinates(secondAttempt)) {
    return secondAttempt;
  }

  return { lat: null, lng: null, address: null };
}

async function searchNominatim(
  query: string,
  context: TripGeocodingContext,
): Promise<GeocodeResult> {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
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
      return { lat: null, lng: null, address: null };
    }

    const results = (await response.json()) as NominatimResult[];
    const first = results[0];

    if (!first?.lat || !first.lon) {
      return { lat: null, lng: null, address: null };
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { lat: null, lng: null, address: null };
    }

    return {
      lat,
      lng,
      address: first.display_name ?? null,
    };
  } catch {
    return { lat: null, lng: null, address: null };
  }
}

function isLikelyGenericChain(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).length;

  if (GENERIC_CHAIN_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  return wordCount <= 3 && normalized.length <= 24;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export { NOMINATIM_DELAY_MS };

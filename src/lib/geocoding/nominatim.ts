import { hasCoordinates } from "@/lib/places/schema";

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

export function buildGeocodeQueries(placeName: string): [string, string] {
  const name = placeName.trim();

  if (isLikelyGenericChain(name)) {
    // Generic chains: city context first, then broader Illinois or name-only.
    return [`${name}, Chicago, IL`, `${name}, Chicago, Illinois, USA`];
  }

  // Landmarks: city first, then state-wide or name-only for short titles.
  if (name.split(/\s+/).length <= 3) {
    return [`${name}, Chicago, IL`, name];
  }

  return [`${name}, Chicago, IL`, `${name}, Illinois, USA`];
}

export async function geocodePlaceWithRetries(
  placeName: string,
): Promise<GeocodeResult> {
  const [firstQuery, secondQuery] = buildGeocodeQueries(placeName);

  const firstAttempt = await searchNominatim(firstQuery);
  if (hasCoordinates(firstAttempt)) {
    return firstAttempt;
  }

  await delay(NOMINATIM_DELAY_MS);

  const secondAttempt = await searchNominatim(secondQuery);
  if (hasCoordinates(secondAttempt)) {
    return secondAttempt;
  }

  return { lat: null, lng: null, address: null };
}

async function searchNominatim(query: string): Promise<GeocodeResult> {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

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

/** @deprecated Use geocodePlaceWithRetries */
export async function geocodePlaceInChicago(
  placeName: string,
): Promise<GeocodeResult> {
  return geocodePlaceWithRetries(placeName);
}

export { NOMINATIM_DELAY_MS };

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_DELAY_MS = 1000;

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

export type GeocodeResult = {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
};

export function getNominatimUserAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT ??
    "ChicagoTravelOS/1.0 (contact@chicago-travel-os.app)"
  );
}

export async function geocodePlaceInChicago(
  placeName: string,
): Promise<GeocodeResult> {
  const query = `${placeName}, Chicago, IL`;
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
      return { latitude: null, longitude: null, address: null };
    }

    const results = (await response.json()) as NominatimResult[];
    const first = results[0];

    if (!first?.lat || !first.lon) {
      return { latitude: null, longitude: null, address: null };
    }

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { latitude: null, longitude: null, address: null };
    }

    return {
      latitude,
      longitude,
      address: first.display_name ?? null,
    };
  } catch {
    return { latitude: null, longitude: null, address: null };
  }
}

export async function geocodePlacesSequentially(
  places: { name: string }[],
): Promise<GeocodeResult[]> {
  const results: GeocodeResult[] = [];

  for (const place of places) {
    const geocoded = await geocodePlaceInChicago(place.name);
    results.push(geocoded);
    await delay(NOMINATIM_DELAY_MS);
  }

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

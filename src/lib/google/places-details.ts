export type ResolvedPlaceDetails = {
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
};

type PlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    formatted_address?: string;
    types?: string[];
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
};

const PLACE_DETAILS_FIELDS = "geometry,formatted_address,types";

export function isGoogleFeatureId(value: string): boolean {
  return /^0x[a-fA-F0-9]+:0x[a-fA-F0-9]+$/.test(value);
}

export async function resolvePlaceByFeatureId(
  googlePlaceId: string,
): Promise<ResolvedPlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY no está configurada. Agrégala en Railway o .env.local.",
    );
  }

  const params = new URLSearchParams({
    key: apiKey,
    fields: PLACE_DETAILS_FIELDS,
  });

  if (isGoogleFeatureId(googlePlaceId)) {
    params.set("ftid", googlePlaceId);
  } else if (googlePlaceId.startsWith("cid:")) {
    params.set("cid", googlePlaceId.slice(4));
  } else {
    return null;
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as PlaceDetailsResponse;
  if (data.status !== "OK" || !data.result?.geometry?.location) {
    return null;
  }

  const latitude = data.result.geometry.location.lat;
  const longitude = data.result.geometry.location.lng;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    latitude,
    longitude,
    address: data.result.formatted_address ?? null,
    category: pickPrimaryCategory(data.result.types),
  };
}

function pickPrimaryCategory(types: string[] | undefined): string | null {
  if (!types?.length) {
    return null;
  }

  const ignored = new Set([
    "point_of_interest",
    "establishment",
    "geocode",
    "political",
  ]);

  const primary = types.find((type) => !ignored.has(type));
  return primary ?? types[0] ?? null;
}

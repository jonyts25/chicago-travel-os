import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { resolvePlaceByFeatureId } from "@/lib/google/places-details";
import {
  parseGoogleMapsExport,
  partitionPlacesByDuplicates,
} from "@/lib/importers/google-maps";
import type { ImportPlacesResult, ParsedGooglePlace } from "@/lib/importers/types";
import { createClient } from "@/lib/supabase/server";

type PlaceRow = {
  id: string;
  google_place_id: string | null;
};

const PLACES_API_DELAY_MS = 50;

export async function importGoogleMapsPlaces(
  fileContent: string,
  filename?: string,
): Promise<ImportPlacesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: ["Debes iniciar sesión para importar lugares."],
    };
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: [
        "Falta GOOGLE_PLACES_API_KEY. Habilita Places API en Google Cloud y agrega la key en Railway.",
      ],
    };
  }

  const parsed = parseGoogleMapsExport(fileContent, filename);
  if (parsed.length === 0) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: ["No se encontraron lugares válidos en el archivo."],
    };
  }

  const withoutFeatureId = parsed.filter((place) => !place.google_place_id);
  const withFeatureId = parsed.filter(
    (place): place is ParsedGooglePlace & { google_place_id: string } =>
      Boolean(place.google_place_id),
  );

  const { data: existingRows, error: fetchError } = await supabase
    .from("places")
    .select("id, google_place_id")
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (fetchError) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: withoutFeatureId.length,
      errors: [`Error al leer lugares existentes: ${fetchError.message}`],
    };
  }

  const { toInsert, duplicates } = partitionPlacesByDuplicates(
    withFeatureId,
    (existingRows ?? []) as PlaceRow[],
  );

  const enrichedPlaces: ParsedGooglePlace[] = [];
  let skippedResolution = 0;
  const resolutionErrors: string[] = [];

  for (const place of toInsert) {
    const featureId = place.google_place_id;
    if (!featureId) {
      skippedResolution += 1;
      continue;
    }

    try {
      const resolved = await resolvePlaceByFeatureId(featureId);

      if (!resolved) {
        skippedResolution += 1;
        resolutionErrors.push(
          `No se pudo resolver coordenadas para "${place.name}" (${place.google_place_id}).`,
        );
        await delay(PLACES_API_DELAY_MS);
        continue;
      }

      enrichedPlaces.push({
        ...place,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        address: resolved.address,
        category: resolved.category,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido en Places API.";
      return {
        imported: 0,
        duplicates: duplicates.length,
        skipped: withoutFeatureId.length + skippedResolution,
        errors: [message],
      };
    }

    await delay(PLACES_API_DELAY_MS);
  }

  if (enrichedPlaces.length === 0) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      skipped: withoutFeatureId.length + skippedResolution,
      errors:
        resolutionErrors.length > 0
          ? resolutionErrors.slice(0, 5)
          : ["No hubo lugares nuevos para importar."],
    };
  }

  const rowsToInsert = enrichedPlaces.map((place) => ({
    trip_id: CHICAGO_TRIP_ID,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    google_place_id: place.google_place_id,
    maps_url: place.maps_url,
    notes: place.notes,
    category: place.category,
    status: PLACE_STATUS_UNPLANNED,
  }));

  const { error: insertError } = await supabase.from("places").insert(rowsToInsert);

  if (insertError) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      skipped: withoutFeatureId.length + skippedResolution,
      errors: [`Error al insertar lugares: ${insertError.message}`],
    };
  }

  const errors = [
    ...resolutionErrors.slice(0, 3),
    ...(withoutFeatureId.length > 0
      ? [
          `${withoutFeatureId.length} fila(s) omitida(s) sin identificador !1s en la URL.`,
        ]
      : []),
  ];

  return {
    imported: enrichedPlaces.length,
    duplicates: duplicates.length,
    skipped: withoutFeatureId.length + skippedResolution,
    errors,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

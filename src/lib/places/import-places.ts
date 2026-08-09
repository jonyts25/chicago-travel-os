import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { applyAIEnrichment, enrichPlacesWithAI } from "@/lib/ai/enrich-places";
import { geocodePlaceInChicago } from "@/lib/geocoding/nominatim";
import {
  parseGoogleMapsExport,
  partitionPlacesByDuplicates,
} from "@/lib/importers/google-maps";
import type { ImportPlacesResult, ParsedGooglePlace } from "@/lib/importers/types";
import type { PlaceInsert } from "@/lib/places/schema";
import { hasCoordinates } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";

type ExistingPlaceRow = {
  id: string;
  google_place_id: string | null;
};

const NOMINATIM_DELAY_MS = 1000;

export async function importGoogleMapsPlaces(
  fileContent: string,
  filename?: string,
): Promise<ImportPlacesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return emptyResult(["Debes iniciar sesión para importar lugares."]);
  }

  const parsed = parseGoogleMapsExport(fileContent, filename);
  if (parsed.length === 0) {
    return emptyResult(["No se encontraron lugares válidos en el archivo."]);
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
      ...emptyResult([`Error al leer lugares existentes: ${fetchError.message}`]),
      skippedNoId: withoutFeatureId.length,
    };
  }

  const { toInsert, duplicates } = partitionPlacesByDuplicates(
    withFeatureId,
    (existingRows ?? []) as ExistingPlaceRow[],
  );

  if (toInsert.length === 0) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      withoutCoordinates: 0,
      withoutAiCategory: 0,
      skippedNoId: withoutFeatureId.length,
      errors: [],
    };
  }

  const { places: geocodedPlaces, withoutCoordinates } =
    await geocodeParsedPlaces(toInsert);

  let withoutAiCategory = 0;
  const aiEnrichment = await enrichPlacesWithAI(
    geocodedPlaces.map((place) => ({ name: place.name })),
  );

  for (const place of geocodedPlaces) {
    const enrichment = aiEnrichment.get(place.name);
    const { withoutCategory } = applyAIEnrichment(place, enrichment);
    if (withoutCategory) {
      withoutAiCategory += 1;
    }
  }

  const rowsToInsert: PlaceInsert[] = geocodedPlaces.map((place) => ({
    trip_id: CHICAGO_TRIP_ID,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    google_place_id: place.google_place_id,
    maps_url: place.maps_url,
    notes: place.notes,
    category: place.category,
    duration_minutes: place.duration_minutes,
    status: PLACE_STATUS_UNPLANNED,
  }));

  const { error: insertError } = await supabase.from("places").insert(rowsToInsert);

  if (insertError) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      withoutCoordinates,
      withoutAiCategory,
      skippedNoId: withoutFeatureId.length,
      errors: [`Error al insertar lugares: ${insertError.message}`],
    };
  }

  const errors: string[] = [];
  if (withoutFeatureId.length > 0) {
    errors.push(
      `${withoutFeatureId.length} fila(s) omitida(s) sin identificador !1s en la URL.`,
    );
  }

  return {
    imported: geocodedPlaces.length,
    duplicates: duplicates.length,
    withoutCoordinates,
    withoutAiCategory,
    skippedNoId: withoutFeatureId.length,
    errors,
  };
}

export async function runImportPipelineDryRun(
  fileContent: string,
  filename?: string,
  existingIds: string[] = [],
): Promise<ImportPlacesResult> {
  const parsed = parseGoogleMapsExport(fileContent, filename);
  const withoutFeatureId = parsed.filter((place) => !place.google_place_id);
  const withFeatureId = parsed.filter(
    (place): place is ParsedGooglePlace & { google_place_id: string } =>
      Boolean(place.google_place_id),
  );

  const existing = existingIds.map((google_place_id, index) => ({
    id: String(index),
    google_place_id,
  }));

  const { toInsert, duplicates } = partitionPlacesByDuplicates(
    withFeatureId,
    existing,
  );

  if (toInsert.length === 0) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      withoutCoordinates: 0,
      withoutAiCategory: 0,
      skippedNoId: withoutFeatureId.length,
      errors: [],
    };
  }

  const { places: geocodedPlaces, withoutCoordinates } =
    await geocodeParsedPlaces(toInsert);

  let withoutAiCategory = 0;
  const aiEnrichment = await enrichPlacesWithAI(
    geocodedPlaces.map((place) => ({ name: place.name })),
  );

  for (const place of geocodedPlaces) {
    const enrichment = aiEnrichment.get(place.name);
    const { withoutCategory } = applyAIEnrichment(place, enrichment);
    if (withoutCategory) {
      withoutAiCategory += 1;
    }
  }

  return {
    imported: geocodedPlaces.length,
    duplicates: duplicates.length,
    withoutCoordinates,
    withoutAiCategory,
    skippedNoId: withoutFeatureId.length,
    errors: [],
  };
}

async function geocodeParsedPlaces(places: ParsedGooglePlace[]): Promise<{
  places: ParsedGooglePlace[];
  withoutCoordinates: number;
}> {
  const geocodedPlaces: ParsedGooglePlace[] = [];
  let withoutCoordinates = 0;

  for (const place of places) {
    const geocoded = await geocodePlaceInChicago(place.name);

    if (!hasCoordinates(geocoded)) {
      withoutCoordinates += 1;
    }

    geocodedPlaces.push({
      ...place,
      lat: geocoded.lat,
      lng: geocoded.lng,
      address: geocoded.address ?? place.address,
    });

    await delay(NOMINATIM_DELAY_MS);
  }

  return { places: geocodedPlaces, withoutCoordinates };
}

function emptyResult(errors: string[]): ImportPlacesResult {
  return {
    imported: 0,
    duplicates: 0,
    withoutCoordinates: 0,
    withoutAiCategory: 0,
    skippedNoId: 0,
    errors,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

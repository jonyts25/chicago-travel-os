import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { applyAIEnrichment, enrichPlacesWithAI } from "@/lib/ai/enrich-places";
import {
  geocodePlaceWithRetries,
  NOMINATIM_DELAY_MS,
} from "@/lib/geocoding/nominatim";
import {
  parseGoogleMapsExport,
  partitionPlacesForImport,
  type PlaceToUpdate,
} from "@/lib/importers/google-maps";
import type { ImportPlacesResult, ParsedGooglePlace } from "@/lib/importers/types";
import type { PlaceInsert } from "@/lib/places/schema";
import { hasCoordinates } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";

type ExistingPlaceRow = {
  id: string;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  category: string | null;
};

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
    .select("id, google_place_id, lat, lng, address, category")
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (fetchError) {
    return {
      ...emptyResult([`Error al leer lugares existentes: ${fetchError.message}`]),
      skippedNoId: withoutFeatureId.length,
    };
  }

  const { toInsert, toUpdate } = partitionPlacesForImport(
    withFeatureId,
    (existingRows ?? []) as ExistingPlaceRow[],
  );

  if (toInsert.length === 0 && toUpdate.length === 0) {
    return {
      imported: 0,
      updated: 0,
      withoutCoordinates: 0,
      withoutAiCategory: 0,
      skippedNoId: withoutFeatureId.length,
      errors: [],
    };
  }

  const summaryErrors: string[] = [];
  const existingById = new Map(
    ((existingRows ?? []) as ExistingPlaceRow[]).map((row) => [row.id, row]),
  );

  const insertResult = await processAndInsertPlaces(toInsert);
  summaryErrors.push(...insertResult.errors);

  const updateResult = await processAndUpdatePlaces(
    supabase,
    toUpdate,
    existingById,
  );
  summaryErrors.push(...updateResult.errors);

  if (withoutFeatureId.length > 0) {
    summaryErrors.push(
      `${withoutFeatureId.length} fila(s) omitida(s) sin identificador !1s en la URL.`,
    );
  }

  return {
    imported: insertResult.count,
    updated: updateResult.count,
    withoutCoordinates:
      insertResult.withoutCoordinates + updateResult.withoutCoordinates,
    withoutAiCategory:
      insertResult.withoutAiCategory + updateResult.withoutAiCategory,
    skippedNoId: withoutFeatureId.length,
    errors: summaryErrors,
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
    lat: null,
    lng: null,
    address: null,
    category: null,
  }));

  const { toInsert, toUpdate } = partitionPlacesForImport(withFeatureId, existing);

  if (toInsert.length === 0 && toUpdate.length === 0) {
    return {
      imported: 0,
      updated: 0,
      withoutCoordinates: 0,
      withoutAiCategory: 0,
      skippedNoId: withoutFeatureId.length,
      errors: [],
    };
  }

  const insertResult = await processParsedPlaces(toInsert);
  const updateResult = await processParsedPlaces(
    toUpdate,
    new Map(existing.map((row) => [row.id, row])),
  );

  return {
    imported: insertResult.count,
    updated: updateResult.count,
    withoutCoordinates:
      insertResult.withoutCoordinates + updateResult.withoutCoordinates,
    withoutAiCategory:
      insertResult.withoutAiCategory + updateResult.withoutAiCategory,
    skippedNoId: withoutFeatureId.length,
    errors: [...insertResult.errors, ...updateResult.errors],
  };
}

async function processAndInsertPlaces(
  places: ParsedGooglePlace[],
): Promise<ProcessBatchResult> {
  if (places.length === 0) {
    return emptyProcessResult();
  }

  const supabase = await createClient();
  const processed = await processParsedPlaces(places);

  if (processed.places.length === 0) {
    return processed;
  }

  const rowsToInsert: PlaceInsert[] = processed.places.map((place) => ({
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
      ...processed,
      count: 0,
      errors: [`Error al insertar lugares: ${insertError.message}`, ...processed.errors],
    };
  }

  return { ...processed, count: processed.places.length };
}

async function processAndUpdatePlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  places: PlaceToUpdate[],
  existingById: Map<string, ExistingPlaceRow>,
): Promise<ProcessBatchResult> {
  if (places.length === 0) {
    return emptyProcessResult();
  }

  const processed = await processParsedPlaces(places, existingById);
  let updatedCount = 0;
  const errors = [...processed.errors];

  for (const place of processed.places) {
    const existingId = place.existingId;
    if (!existingId) {
      continue;
    }

    const payload: Record<string, unknown> = {
      name: place.name,
      maps_url: place.maps_url,
      notes: place.notes,
    };

    if (place.category) {
      payload.category = place.category;
      payload.duration_minutes = place.duration_minutes;
    }

    if (hasCoordinates(place)) {
      payload.lat = place.lat;
      payload.lng = place.lng;
      payload.address = place.address;
    }

    const { error } = await supabase
      .from("places")
      .update(payload)
      .eq("id", existingId)
      .eq("trip_id", CHICAGO_TRIP_ID);

    if (error) {
      errors.push(`Error al actualizar "${place.name}": ${error.message}`);
      continue;
    }

    updatedCount += 1;
  }

  return {
    places: processed.places,
    count: updatedCount,
    withoutCoordinates: processed.withoutCoordinates,
    withoutAiCategory: processed.withoutAiCategory,
    errors,
  };
}

type ProcessedPlace = ParsedGooglePlace & { existingId?: string };

type ProcessBatchResult = {
  places: ProcessedPlace[];
  count: number;
  withoutCoordinates: number;
  withoutAiCategory: number;
  errors: string[];
};

async function processParsedPlaces(
  places: (ParsedGooglePlace | PlaceToUpdate)[],
  existingById: Map<string, ExistingPlaceRow> = new Map(),
): Promise<ProcessBatchResult> {
  if (places.length === 0) {
    return emptyProcessResult();
  }

  const geocodedPlaces: ProcessedPlace[] = [];
  let withoutCoordinates = 0;

  for (const place of places) {
    const existingId = "existingId" in place ? place.existingId : undefined;
    const existing = existingId ? existingById.get(existingId) : undefined;

    let lat = existing?.lat ?? place.lat;
    let lng = existing?.lng ?? place.lng;
    let address = existing?.address ?? place.address;

    if (!hasCoordinates({ lat, lng })) {
      const geocoded = await geocodePlaceWithRetries(place.name);

      if (hasCoordinates(geocoded)) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        address = geocoded.address ?? address;
      } else {
        withoutCoordinates += 1;
      }

      await delay(NOMINATIM_DELAY_MS);
    }

    geocodedPlaces.push({
      ...place,
      existingId,
      lat,
      lng,
      address,
    });
  }

  let withoutAiCategory = 0;
  const { enrichments, errors: aiErrors } = await enrichPlacesWithAI(
    geocodedPlaces.map((place) => ({ name: place.name })),
  );

  for (const place of geocodedPlaces) {
    const enrichment = enrichments.get(place.name);
    const { withoutCategory } = applyAIEnrichment(place, enrichment);
    if (withoutCategory) {
      withoutAiCategory += 1;
    }
  }

  return {
    places: geocodedPlaces,
    count: geocodedPlaces.length,
    withoutCoordinates,
    withoutAiCategory,
    errors: aiErrors,
  };
}

function emptyProcessResult(): ProcessBatchResult {
  return {
    places: [],
    count: 0,
    withoutCoordinates: 0,
    withoutAiCategory: 0,
    errors: [],
  };
}

function emptyResult(errors: string[]): ImportPlacesResult {
  return {
    imported: 0,
    updated: 0,
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

import {
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { applyAIEnrichment, enrichPlacesWithAI } from "@/lib/ai/enrich-places";
import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import {
  geocodePlaceWithRetries,
  NOMINATIM_DELAY_MS,
} from "@/lib/geocoding/nominatim";
import type { TripGeocodingContext } from "@/lib/geocoding/trip-geocoding-context";
import {
  normalizeTripGeocodingContext,
} from "@/lib/geocoding/trip-geocoding-context";
import {
  parseGoogleMapsExport,
  parsePlaceFromMapsUrl,
  partitionPlacesForImport,
  type PlaceToUpdate,
} from "@/lib/importers/google-maps";
import type {
  AddPlaceResult,
  ImportPlacesResult,
  ParsedGooglePlace,
} from "@/lib/importers/types";
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
  tripId: string,
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
    .eq("trip_id", tripId);

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
  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);

  const insertResult = await processAndInsertPlaces(tripId, toInsert, geocodingContext);
  summaryErrors.push(...insertResult.errors);

  const updateResult = await processAndUpdatePlaces(
    supabase,
    tripId,
    toUpdate,
    existingById,
    geocodingContext,
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

export async function addPlaceFromMapsUrl(
  tripId: string,
  mapsUrl: string,
  manualName?: string,
): Promise<AddPlaceResult> {
  const emptyResult = (): AddPlaceResult => ({
    ok: false,
    action: "none",
    name: "",
    category: null,
    hasCoordinates: false,
    needsManualName: false,
    errors: [],
  });

  const parsed = parsePlaceFromMapsUrl(mapsUrl, manualName);
  if (!parsed.ok) {
    return {
      ...emptyResult(),
      needsManualName: parsed.needsManualName ?? false,
      errors: [parsed.error],
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ...emptyResult(),
      errors: ["Debes iniciar sesión para agregar lugares."],
    };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("places")
    .select("id, google_place_id, lat, lng, address, category")
    .eq("trip_id", tripId)
    .eq("google_place_id", parsed.place.google_place_id)
    .maybeSingle();

  if (fetchError) {
    return {
      ...emptyResult(),
      errors: [fetchError.message],
    };
  }

  const existingRow = existing as ExistingPlaceRow | null;
  const existingById = existingRow
    ? new Map<string, ExistingPlaceRow>([[existingRow.id, existingRow]])
    : new Map<string, ExistingPlaceRow>();

  const inputPlaces: (ParsedGooglePlace | PlaceToUpdate)[] = existingRow
    ? [{ ...parsed.place, existingId: existingRow.id }]
    : [parsed.place];

  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);
  const processed = await processParsedPlaces(
    inputPlaces,
    existingById,
    geocodingContext,
  );
  const saved = processed.places[0];
  const errors = [...processed.errors];

  if (!saved) {
    return {
      ...emptyResult(),
      errors: ["No se pudo procesar el lugar.", ...errors],
    };
  }

  if (existingRow) {
    const existingId = saved.existingId;
    if (!existingId) {
      return {
        ...emptyResult(),
        name: saved.name,
        errors: ["Error interno al actualizar el lugar."],
      };
    }

    const { error } = await supabase
      .from("places")
      .update(buildPlaceUpdatePayload(saved))
      .eq("id", existingId)
      .eq("trip_id", tripId);

    if (error) {
      return {
        ...emptyResult(),
        name: saved.name,
        errors: [error.message, ...errors],
      };
    }

    return {
      ok: true,
      action: "updated",
      name: saved.name,
      category: saved.category,
      hasCoordinates: hasCoordinates(saved),
      needsManualName: false,
      errors,
    };
  }

  const { error: insertError } = await supabase
    .from("places")
    .insert(buildPlaceInsertRow(tripId, saved));

  if (insertError) {
    return {
      ...emptyResult(),
      name: saved.name,
      errors: [insertError.message, ...errors],
    };
  }

  return {
    ok: true,
    action: "created",
    name: saved.name,
    category: saved.category,
    hasCoordinates: hasCoordinates(saved),
    needsManualName: false,
    errors,
  };
}

export type AddPlacesFromNamesResult = {
  ok: boolean;
  added: string[];
  skippedDuplicate: string[];
  failedGeocode: string[];
  errors: string[];
};

export async function addPlacesFromNames(
  tripId: string,
  places: { name: string; notes?: string | null }[],
): Promise<AddPlacesFromNamesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      added: [],
      skippedDuplicate: [],
      failedGeocode: [],
      errors: ["Debes iniciar sesión para agregar lugares."],
    };
  }

  const trimmedPlaces = places
    .map((place) => ({
      name: place.name.trim(),
      notes: place.notes?.trim() || null,
    }))
    .filter((place) => place.name.length > 0);

  if (trimmedPlaces.length === 0) {
    return {
      ok: false,
      added: [],
      skippedDuplicate: [],
      failedGeocode: [],
      errors: ["No hay lugares seleccionados."],
    };
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("places")
    .select("name")
    .eq("trip_id", tripId);

  if (fetchError) {
    return {
      ok: false,
      added: [],
      skippedDuplicate: [],
      failedGeocode: [],
      errors: [fetchError.message],
    };
  }

  const existingNames = new Set(
    (existingRows ?? []).map((row) => normalizePlaceName(row.name)),
  );

  const added: string[] = [];
  const skippedDuplicate: string[] = [];
  const failedGeocode: string[] = [];
  const errors: string[] = [];
  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);

  for (const place of trimmedPlaces) {
    const normalized = normalizePlaceName(place.name);
    if (existingNames.has(normalized)) {
      skippedDuplicate.push(place.name);
      continue;
    }

    const parsed: ParsedGooglePlace = {
      name: place.name,
      lat: null,
      lng: null,
      address: null,
      google_place_id: null,
      maps_url: null,
      notes: place.notes,
      category: null,
      duration_minutes: null,
    };

    const processed = await processParsedPlaces([parsed], new Map(), geocodingContext);
    errors.push(...processed.errors);

    const saved = processed.places[0];
    if (!saved || !hasCoordinates(saved)) {
      failedGeocode.push(place.name);
      continue;
    }

    const { error: insertError } = await supabase
      .from("places")
      .insert(buildPlaceInsertRow(tripId, saved));

    if (insertError) {
      errors.push(`No se pudo agregar "${place.name}": ${insertError.message}`);
      continue;
    }

    added.push(saved.name);
    existingNames.add(normalizePlaceName(saved.name));
  }

  return {
    ok: added.length > 0,
    added,
    skippedDuplicate,
    failedGeocode,
    errors,
  };
}

function normalizePlaceName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function runImportPipelineDryRun(
  fileContent: string,
  filename?: string,
  existingIds: string[] = [],
  geocodingContext: TripGeocodingContext = normalizeTripGeocodingContext(null),
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

  const insertResult = await processParsedPlaces(toInsert, new Map(), geocodingContext);
  const updateResult = await processParsedPlaces(
    toUpdate,
    new Map(existing.map((row) => [row.id, row])),
    geocodingContext,
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
  tripId: string,
  places: ParsedGooglePlace[],
  geocodingContext: TripGeocodingContext,
): Promise<ProcessBatchResult> {
  if (places.length === 0) {
    return emptyProcessResult();
  }

  const supabase = await createClient();
  const processed = await processParsedPlaces(places, new Map(), geocodingContext);

  if (processed.places.length === 0) {
    return processed;
  }

  const rowsToInsert: PlaceInsert[] = processed.places.map((place) =>
    buildPlaceInsertRow(tripId, place),
  );

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
  tripId: string,
  places: PlaceToUpdate[],
  existingById: Map<string, ExistingPlaceRow>,
  geocodingContext: TripGeocodingContext,
): Promise<ProcessBatchResult> {
  if (places.length === 0) {
    return emptyProcessResult();
  }

  const processed = await processParsedPlaces(
    places,
    existingById,
    geocodingContext,
  );
  let updatedCount = 0;
  const errors = [...processed.errors];

  for (const place of processed.places) {
    const existingId = place.existingId;
    if (!existingId) {
      continue;
    }

    const payload = buildPlaceUpdatePayload(place);

    const { error } = await supabase
      .from("places")
      .update(payload)
      .eq("id", existingId)
      .eq("trip_id", tripId);

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
  geocodingContext: TripGeocodingContext = normalizeTripGeocodingContext(null),
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
      const geocoded = await geocodePlaceWithRetries(place.name, geocodingContext);

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

function buildPlaceInsertRow(tripId: string, place: ProcessedPlace): PlaceInsert {
  return {
    trip_id: tripId,
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
  };
}

function buildPlaceUpdatePayload(place: ProcessedPlace): Record<string, unknown> {
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

  return payload;
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

import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import {
  parseGoogleMapsExport,
  partitionPlacesByDuplicates,
} from "@/lib/importers/google-maps";
import type { ImportPlacesResult } from "@/lib/importers/types";
import { createClient } from "@/lib/supabase/server";

type PlaceRow = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
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
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: ["Debes iniciar sesión para importar lugares."],
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

  const { data: existingRows, error: fetchError } = await supabase
    .from("places")
    .select("id, name, latitude, longitude, google_place_id")
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (fetchError) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: [`Error al leer lugares existentes: ${fetchError.message}`],
    };
  }

  const { toInsert, duplicates } = partitionPlacesByDuplicates(
    parsed,
    (existingRows ?? []) as PlaceRow[],
  );

  if (toInsert.length === 0) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      skipped: 0,
      errors: [],
    };
  }

  const rowsToInsert = toInsert.map((place) => ({
    trip_id: CHICAGO_TRIP_ID,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    google_place_id: place.google_place_id,
    google_maps_url: place.maps_url,
    status: PLACE_STATUS_UNPLANNED,
  }));

  const { error: insertError } = await supabase.from("places").insert(rowsToInsert);

  if (insertError) {
    return {
      imported: 0,
      duplicates: duplicates.length,
      skipped: 0,
      errors: [`Error al insertar lugares: ${insertError.message}`],
    };
  }

  return {
    imported: toInsert.length,
    duplicates: duplicates.length,
    skipped: 0,
    errors: [],
  };
}

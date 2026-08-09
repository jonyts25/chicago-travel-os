"use server";

import { importGoogleMapsPlaces } from "@/lib/places/import-places";
import { regeocodeMissingPlaces } from "@/lib/places/regeocode-missing-places";
import type { ImportPlacesResult } from "@/lib/importers/types";
import type { RegeocodeMissingPlacesResult } from "@/lib/places/regeocode-missing-places";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const EMPTY_RESULT: ImportPlacesResult = {
  imported: 0,
  updated: 0,
  withoutCoordinates: 0,
  withoutAiCategory: 0,
  skippedNoId: 0,
  errors: [],
};

export async function importPlacesAction(
  formData: FormData,
): Promise<ImportPlacesResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      ...EMPTY_RESULT,
      errors: ["Selecciona un archivo CSV válido."],
    };
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ...EMPTY_RESULT,
      errors: ["El archivo supera el límite de 10 MB."],
    };
  }

  const content = await file.text();
  return importGoogleMapsPlaces(content, file.name);
}

export async function regeocodeMissingPlacesAction(): Promise<RegeocodeMissingPlacesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      total: 0,
      resolved: 0,
      failed: [],
      errors: ["Debes iniciar sesión."],
    };
  }

  try {
    const result = await regeocodeMissingPlaces(supabase);

    if (result.resolved > 0) {
      revalidatePath("/import");
      revalidatePath("/planificar");
      revalidatePath("/map");
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al geocodificar.";
    return {
      ok: false,
      total: 0,
      resolved: 0,
      failed: [],
      errors: [message],
    };
  }
}

"use server";

import { importGoogleMapsPlaces } from "@/lib/places/import-places";
import type { ImportPlacesResult } from "@/lib/importers/types";

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

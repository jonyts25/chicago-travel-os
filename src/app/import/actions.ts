"use server";

import { importGoogleMapsPlaces } from "@/lib/places/import-places";
import type { ImportPlacesResult } from "@/lib/importers/types";

export async function importPlacesAction(
  formData: FormData,
): Promise<ImportPlacesResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: ["Selecciona un archivo CSV o JSON válido."],
    };
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: ["El archivo supera el límite de 10 MB."],
    };
  }

  const content = await file.text();
  return importGoogleMapsPlaces(content, file.name);
}

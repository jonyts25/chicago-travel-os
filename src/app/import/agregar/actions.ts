"use server";

import { addPlaceFromMapsUrl } from "@/lib/places/import-places";
import type { AddPlaceResult } from "@/lib/importers/types";

const EMPTY_RESULT: AddPlaceResult = {
  ok: false,
  action: "none",
  name: "",
  category: null,
  hasCoordinates: false,
  needsManualName: false,
  errors: [],
};

export async function addPlaceAction(
  formData: FormData,
): Promise<AddPlaceResult> {
  const mapsUrl = String(formData.get("mapsUrl") ?? "").trim();
  const manualName = String(formData.get("manualName") ?? "").trim();

  if (!mapsUrl) {
    return {
      ...EMPTY_RESULT,
      errors: ["Pega un enlace de Google Maps."],
    };
  }

  return addPlaceFromMapsUrl(mapsUrl, manualName || undefined);
}

"use server";

import { addPlaceFromMapsUrl } from "@/lib/places/import-places";
import { parsePlaceCreationMeta } from "@/lib/places/place-classification";
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
  tripId: string,
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

  const classification = parsePlaceCreationMeta({
    priority: String(formData.get("priority") ?? ""),
    interest: String(formData.get("interest") ?? ""),
  });

  if (!classification.ok) {
    return {
      ...EMPTY_RESULT,
      errors: [classification.error],
    };
  }

  return addPlaceFromMapsUrl(
    tripId,
    mapsUrl,
    manualName || undefined,
    classification.meta,
  );
}

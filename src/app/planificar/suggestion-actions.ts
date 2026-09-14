"use server";

import { generatePlaceSuggestions, type PlaceSuggestion } from "@/lib/ai/suggest-places";
import { addPlacesFromNames } from "@/lib/places/import-places";
import { parsePlaceCreationMeta } from "@/lib/places/place-classification";
import { loadSuggestionContext } from "@/lib/users/load-suggestion-context";
import { buildSuggestionLocationParts } from "@/lib/users/suggestion-location";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

export async function suggestPlacesAction(tripId: string): Promise<
  | {
      ok: true;
      suggestions: PlaceSuggestion[];
      contextSummary: {
        locationLabel: "zona" | "hotel/base";
        locationValue: string;
        travelerCount: number;
        existingPlaceCount: number;
      };
    }
  | { ok: false; error: string }
> {
  const { context, error } = await loadSuggestionContext(tripId);

  if (error || !context) {
    return { ok: false, error: error ?? "No se pudo cargar el contexto." };
  }

  const { suggestions, error: aiError } = await generatePlaceSuggestions(context);

  if (aiError) {
    return { ok: false, error: aiError };
  }

  const location = buildSuggestionLocationParts(context);

  return {
    ok: true,
    suggestions,
    contextSummary: {
      locationLabel: location.summaryLabel,
      locationValue: location.summaryValue,
      travelerCount: context.travelers.length,
      existingPlaceCount: context.existingPlaceNames.length,
    },
  };
}

export async function addSelectedPlaceSuggestionsAction(
  tripId: string,
  selections: PlaceSuggestion[],
  options?: { priority?: string; interest?: string },
): Promise<
  | {
      ok: true;
      added: string[];
      skippedDuplicate: string[];
      failedGeocode: string[];
      errors: string[];
    }
  | { ok: false; error: string }
> {
  if (selections.length === 0) {
    return { ok: false, error: "Selecciona al menos un lugar." };
  }

  const classification = parsePlaceCreationMeta({
    priority: options?.priority,
    interest: options?.interest,
  });

  if (!classification.ok) {
    return { ok: false, error: classification.error };
  }

  const result = await addPlacesFromNames(
    tripId,
    selections.map((selection) => ({
      name: selection.name,
      notes: selection.reason ? `Sugerencia IA: ${selection.reason}` : null,
    })),
    classification.meta,
  );

  if (result.added.length > 0) {
    for (const path of revalidateTripPaths(tripId)) {
      revalidatePath(path);
    }
  }

  if (
    result.added.length === 0 &&
    result.failedGeocode.length === 0 &&
    result.skippedDuplicate.length === 0
  ) {
    return {
      ok: false,
      error: result.errors[0] ?? "No se pudo agregar ningún lugar.",
    };
  }

  return {
    ok: true,
    added: result.added,
    skippedDuplicate: result.skippedDuplicate,
    failedGeocode: result.failedGeocode,
    errors: result.errors,
  };
}

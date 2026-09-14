import type { PlaceInterest, PlacePriority } from "@/lib/places/place-detail";

export type PlaceCreationMeta = {
  priority: PlacePriority;
  interest: PlaceInterest;
};

const PRIORITY_VALUES: PlacePriority[] = ["must", "high", "medium", "if_time"];
const INTEREST_VALUES: PlaceInterest[] = ["jonathan", "wife", "both"];

export function isPlacePriority(value: string | null | undefined): value is PlacePriority {
  return PRIORITY_VALUES.includes(value as PlacePriority);
}

export function isPlaceInterest(value: string | null | undefined): value is PlaceInterest {
  return INTEREST_VALUES.includes(value as PlaceInterest);
}

export function parsePlaceCreationMeta(input: {
  priority?: string | null;
  interest?: string | null;
}): { ok: true; meta: PlaceCreationMeta } | { ok: false; error: string } {
  const priority = input.priority?.trim() ?? "";
  const interest = input.interest?.trim() ?? "";

  if (!isPlacePriority(priority)) {
    return {
      ok: false,
      error: "Selecciona una prioridad para el lugar.",
    };
  }

  if (!isPlaceInterest(interest)) {
    return {
      ok: false,
      error: "Selecciona para quién es el lugar (Jonathan, Mercedes o Ambos).",
    };
  }

  return {
    ok: true,
    meta: { priority, interest },
  };
}

export function parsePlaceClassificationUpdate(input: {
  priority?: string | null;
  interest?: string | null;
}): { ok: true; priority: PlacePriority; interest: PlaceInterest } | { ok: false; error: string } {
  const parsed = parsePlaceCreationMeta(input);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    priority: parsed.meta.priority,
    interest: parsed.meta.interest,
  };
}

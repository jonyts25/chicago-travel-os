export type PlaceCategory =
  | "Museo"
  | "Restaurante"
  | "Compras"
  | "Atracción"
  | "Café"
  | "Otro";

export const CATEGORY_DURATION_MINUTES: Record<PlaceCategory, number> = {
  Museo: 120,
  Restaurante: 60,
  Compras: 30,
  Atracción: 90,
  Café: 30,
  Otro: 60,
};

/** Parsed row before insert; field names align with `places` columns. */
export type ParsedGooglePlace = {
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  google_place_id: string | null;
  maps_url: string | null;
  notes: string | null;
  category: PlaceCategory | null;
  duration_minutes: number | null;
};

export type ExistingPlace = {
  id: string;
  google_place_id: string | null;
};

export type ImportPlacesResult = {
  imported: number;
  duplicates: number;
  withoutCoordinates: number;
  withoutAiCategory: number;
  skippedNoId: number;
  errors: string[];
};

export type AIPlaceEnrichment = {
  originalName: string;
  cleanName: string;
  category: PlaceCategory | null;
};

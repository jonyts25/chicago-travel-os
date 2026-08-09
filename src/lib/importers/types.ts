export type ParsedGooglePlace = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  google_place_id: string | null;
  maps_url: string | null;
  notes: string | null;
  category: string | null;
};

export type ExistingPlace = {
  id: string;
  google_place_id: string | null;
};

export type ImportPlacesResult = {
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
};

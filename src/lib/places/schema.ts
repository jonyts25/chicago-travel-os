/**
 * Column names match the Supabase `places` table exactly.
 */
export type Place = {
  id: string;
  trip_id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  google_place_id: string | null;
  maps_url: string | null;
  priority: number | null;
  interest: string | null;
  status: string;
  duration_minutes: number | null;
  opening_hours: string | null;
  notes: string | null;
  reservation_required: boolean | null;
  created_at: string;
};

export type PlaceInsert = Pick<
  Place,
  | "trip_id"
  | "name"
  | "category"
  | "lat"
  | "lng"
  | "address"
  | "google_place_id"
  | "maps_url"
  | "status"
  | "duration_minutes"
  | "notes"
>;

export type PlaceMapMarker = Pick<
  Place,
  "id" | "name" | "lat" | "lng" | "category" | "status" | "address"
> & {
  lat: number;
  lng: number;
};

export function hasCoordinates(
  place: Pick<Place, "lat" | "lng">,
): place is Pick<Place, "lat" | "lng"> & { lat: number; lng: number } {
  return place.lat != null && place.lng != null;
}

import {
  isPlaceInterest,
  isPlacePriority,
} from "@/lib/places/place-classification";
import type { PlaceInterest, PlacePriority } from "@/lib/places/place-detail";
import { createClient } from "@/lib/supabase/server";

export type PlaceClassificationRow = {
  id: string;
  name: string;
  category: string | null;
  priority: PlacePriority | null;
  interest: PlaceInterest | null;
};

export async function loadPlacesClassificationData(
  tripId: string,
): Promise<{ data: PlaceClassificationRow[] | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("places")
    .select("id, name, category, priority, interest")
    .eq("trip_id", tripId)
    .order("name", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  const rows: PlaceClassificationRow[] = (data ?? []).map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    priority: isPlacePriority(place.priority) ? place.priority : null,
    interest: isPlaceInterest(place.interest) ? place.interest : null,
  }));

  return { data: rows, error: null };
}

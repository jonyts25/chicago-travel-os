import type { SuggestionContext, TripTravelerPreferences, UserProfile } from "@/lib/users/schema";
import { normalizeTripType } from "@/lib/trips/types";
import { createClient } from "@/lib/supabase/server";

type TripMemberRow = {
  user_id: string;
  users:
    | UserProfile
    | UserProfile[]
    | null;
};

function pickUserProfile(value: TripMemberRow["users"]): UserProfile | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildTravelerLabel(
  _profile: UserProfile | null,
  userId: string,
  currentUserId: string,
  index: number,
): string {
  if (userId === currentUserId) {
    return "Tus preferencias";
  }

  return index === 1 ? "Otro viajero" : `Viajero ${index + 1}`;
}

export async function loadSuggestionContext(tripId: string): Promise<{
  context: SuggestionContext | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, error: "Debes iniciar sesión." };
  }

  const [{ data: trip, error: tripError }, { data: members, error: membersError }, { data: places, error: placesError }] =
    await Promise.all([
      supabase
        .from("trips")
        .select("name, trip_type, base_location, center_lat, center_lng")
        .eq("id", tripId)
        .maybeSingle(),
      supabase
        .from("trip_members")
        .select("user_id, users ( id, preferences )")
        .eq("trip_id", tripId),
      supabase.from("places").select("name").eq("trip_id", tripId),
    ]);

  if (tripError) {
    return { context: null, error: tripError.message };
  }

  if (membersError) {
    return { context: null, error: membersError.message };
  }

  if (placesError) {
    return { context: null, error: placesError.message };
  }

  const travelers: TripTravelerPreferences[] = ((members ?? []) as TripMemberRow[]).map(
    (member, index) => {
      const profile = pickUserProfile(member.users);
      return {
        userId: member.user_id,
        label: buildTravelerLabel(profile, member.user_id, user.id, index),
        preferences: profile?.preferences ?? null,
        isCurrentUser: member.user_id === user.id,
      };
    },
  );

  if (travelers.length === 0) {
    travelers.push({
      userId: user.id,
      label: "Tus preferencias",
      preferences: null,
      isCurrentUser: true,
    });
  }

  return {
    context: {
      tripType: normalizeTripType(trip?.trip_type),
      tripName: trip?.name?.trim() || "Viaje",
      baseLocation: trip?.base_location?.trim() || null,
      centerLat:
        trip?.center_lat != null && Number.isFinite(trip.center_lat)
          ? trip.center_lat
          : null,
      centerLng:
        trip?.center_lng != null && Number.isFinite(trip.center_lng)
          ? trip.center_lng
          : null,
      travelers,
      existingPlaceNames: (places ?? []).map((place) => place.name),
    },
    error: null,
  };
}

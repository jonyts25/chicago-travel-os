import { TRIP_DAY_COUNT } from "@/lib/constants";
import { interpretMutationResult } from "@/lib/supabase/mutation-result";
import {
  TRIP_TYPE_ONGOING,
  TRIP_TYPE_SCHEDULED,
  type TripType,
} from "@/lib/trips/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateTripInput = {
  name: string;
  tripType: TripType;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
};

export async function createTripForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTripInput,
): Promise<{ ok: true; tripId: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "El nombre del viaje es obligatorio." };
  }

  if (input.tripType === TRIP_TYPE_SCHEDULED && !input.startDate) {
    return { ok: false, error: "Los viajes programados necesitan fecha de inicio." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      name,
      trip_type: input.tripType,
      start_date: input.tripType === TRIP_TYPE_SCHEDULED ? input.startDate : null,
      end_date: input.tripType === TRIP_TYPE_SCHEDULED ? input.endDate : null,
      base_location: input.city?.trim() || null,
      timezone: input.timezone.trim() || "America/Chicago",
    })
    .select("id")
    .single();

  const tripMutation = interpretMutationResult(trip, tripError, {
    table: "trips",
    action: "insert",
    permissionHint: "Necesitas permiso INSERT en trips para crear viajes.",
  });

  if (!tripMutation.ok) {
    return tripMutation;
  }

  const { error: memberError } = await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: userId,
  });

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  if (input.tripType === TRIP_TYPE_SCHEDULED) {
    const dayRows = Array.from({ length: TRIP_DAY_COUNT }, (_, index) => ({
      trip_id: trip.id,
      day_number: index + 1,
      date: null,
    }));

    const { error: daysError } = await supabase.from("itinerary_days").insert(dayRows);
    if (daysError) {
      return { ok: false, error: daysError.message };
    }
  }

  return { ok: true, tripId: trip.id };
}

export function normalizeCreateTripType(value: FormDataEntryValue | null): TripType {
  return value === TRIP_TYPE_ONGOING ? TRIP_TYPE_ONGOING : TRIP_TYPE_SCHEDULED;
}

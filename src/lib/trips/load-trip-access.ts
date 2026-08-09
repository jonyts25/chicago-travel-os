import { assertTripMember } from "@/lib/supabase/mutation-result";
import { tripDefaultPath } from "@/lib/trips/trip-paths";
import {
  isScheduledTrip,
  normalizeTripType,
  TRIP_TYPE_ONGOING,
  TRIP_TYPE_SCHEDULED,
  type TripContext,
  type TripSummary,
  type TripType,
} from "@/lib/trips/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TRIP_ACCESS_SELECT = "id, name, trip_type, start_date, end_date, timezone, base_location";

export async function loadTripContext(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<{ ok: true; trip: TripContext } | { ok: false; error: string }> {
  const membership = await assertTripMember(supabase, userId, tripId);
  if (!membership.ok) {
    return membership;
  }

  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_ACCESS_SELECT)
    .eq("id", tripId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Viaje no encontrado." };
  }

  return {
    ok: true,
    trip: {
      id: data.id,
      name: data.name,
      trip_type: normalizeTripType(data.trip_type),
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      timezone: data.timezone ?? "America/Chicago",
      city: data.base_location?.trim() || null,
    },
  };
}

export async function loadUserTrips(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; trips: TripSummary[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("trips ( id, name, trip_type, start_date, end_date, timezone )")
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const trips: TripSummary[] = [];

  for (const row of data ?? []) {
    const trip = normalizeTripJoin(row.trips);
    if (trip) {
      trips.push(trip);
    }
  }

  trips.sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { ok: true, trips };
}

function normalizeTripJoin(
  value: TripSummary | TripSummary[] | null | undefined,
): TripSummary | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.id || !row.name) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    trip_type: normalizeTripType(row.trip_type),
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    timezone: row.timezone ?? "America/Chicago",
  };
}

export async function requireScheduledTrip(tripId: string): Promise<TripContext> {
  const trip = await loadTripContextForRoute(tripId);
  if (!isScheduledTrip(trip.trip_type)) {
    redirect(tripDefaultPath(tripId, trip.trip_type));
  }
  return trip;
}

export async function requireOngoingTrip(tripId: string): Promise<TripContext> {
  const trip = await loadTripContextForRoute(tripId);
  if (trip.trip_type !== TRIP_TYPE_ONGOING) {
    redirect(tripDefaultPath(tripId, trip.trip_type));
  }
  return trip;
}

async function loadTripContextForRoute(tripId: string): Promise<TripContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(tripDefaultPath(tripId, TRIP_TYPE_SCHEDULED))}`);
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    redirect("/");
  }

  return tripResult.trip;
}

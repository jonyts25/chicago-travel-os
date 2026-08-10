"use server";

import { assertTripMember } from "@/lib/supabase/mutation-result";
import {
  normalizeTicketResearchSources,
  researchPlaceTickets,
  type PlaceTicketResearchRecord,
} from "@/lib/places/place-ticket-research";
import { createClient } from "@/lib/supabase/server";
import { loadTripContext } from "@/lib/trips/load-trip-access";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

const TABLE_NAME = "place_ticket_research";

type TicketResearchRow = {
  id: string;
  place_id: string;
  summary: string;
  sources: unknown;
  web_search_count: number;
  searched_at: string;
};

function mapRow(row: TicketResearchRow): PlaceTicketResearchRecord {
  return {
    id: row.id,
    placeId: row.place_id,
    summary: row.summary,
    sources: normalizeTicketResearchSources(row.sources),
    webSearchCount: row.web_search_count,
    searchedAt: row.searched_at,
  };
}

function isMissingTableError(message: string): boolean {
  return (
    message.includes("place_ticket_research") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  );
}

async function verifyPlaceInTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  placeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("places")
    .select("id")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Lugar no encontrado en este viaje." };
  }

  return { ok: true };
}

export async function getPlaceTicketResearchAction(
  tripId: string,
  placeId: string,
): Promise<
  | { ok: true; research: PlaceTicketResearchRecord | null; tripTimezone: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return { ok: false, error: membership.error };
  }

  const placeCheck = await verifyPlaceInTrip(supabase, tripId, placeId);
  if (!placeCheck.ok) {
    return placeCheck;
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    return { ok: false, error: tripResult.error };
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id, place_id, summary, sources, web_search_count, searched_at")
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        ok: false,
        error:
          "La tabla place_ticket_research aún no existe en Supabase. Créala con el diseño indicado en la documentación del feature.",
      };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    research: data ? mapRow(data as TicketResearchRow) : null,
    tripTimezone: tripResult.trip.timezone,
  };
}

export async function investigatePlaceTicketsAction(
  tripId: string,
  placeId: string,
): Promise<
  | { ok: true; research: PlaceTicketResearchRecord; tripTimezone: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return { ok: false, error: membership.error };
  }

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("id, name, category, address, trip_id")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (placeError) {
    return { ok: false, error: placeError.message };
  }

  if (!place) {
    return { ok: false, error: "Lugar no encontrado en este viaje." };
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    return { ok: false, error: tripResult.error };
  }

  const researchResult = await researchPlaceTickets({
    placeName: place.name,
    placeCategory: place.category,
    placeAddress: place.address,
    tripName: tripResult.trip.name,
    tripCity: tripResult.trip.city ?? tripResult.trip.name,
  });

  if (!researchResult.ok) {
    return { ok: false, error: researchResult.error };
  }

  const searchedAt = new Date().toISOString();
  const payload = {
    place_id: placeId,
    summary: researchResult.summary,
    sources: researchResult.sources,
    web_search_count: researchResult.webSearchCount,
    searched_at: searchedAt,
    updated_at: searchedAt,
  };

  const { data: existing } = await supabase
    .from(TABLE_NAME)
    .select("id")
    .eq("place_id", placeId)
    .maybeSingle();

  const writeResult = existing?.id
    ? await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .select("id, place_id, summary, sources, web_search_count, searched_at")
        .single()
    : await supabase
        .from(TABLE_NAME)
        .insert(payload)
        .select("id, place_id, summary, sources, web_search_count, searched_at")
        .single();

  if (writeResult.error) {
    if (isMissingTableError(writeResult.error.message)) {
      return {
        ok: false,
        error:
          "La tabla place_ticket_research aún no existe en Supabase. Créala con el diseño indicado en la documentación del feature.",
      };
    }
    return { ok: false, error: writeResult.error.message };
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }

  return {
    ok: true,
    research: mapRow(writeResult.data as TicketResearchRow),
    tripTimezone: tripResult.trip.timezone,
  };
}

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

const RESEARCH_SELECT =
  "id, place_id, summary, sources, researched_at, requested_by";

type TicketResearchRow = {
  id: string;
  place_id: string;
  summary: string;
  sources: unknown;
  researched_at: string;
  requested_by: string | null;
};

function mapRow(
  row: TicketResearchRow,
  webSearchCount?: number,
): PlaceTicketResearchRecord {
  return {
    id: row.id,
    placeId: row.place_id,
    summary: row.summary,
    sources: normalizeTicketResearchSources(row.sources),
    researchedAt: row.researched_at,
    requestedBy: row.requested_by,
    webSearchCount,
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
    .select(RESEARCH_SELECT)
    .eq("place_id", placeId)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        ok: false,
        error: "La tabla place_ticket_research no está disponible en Supabase.",
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

  const researchedAt = new Date().toISOString();
  const payload = {
    place_id: placeId,
    summary: researchResult.summary,
    sources: researchResult.sources,
    researched_at: researchedAt,
    requested_by: user.id,
  };

  const { data: existing } = await supabase
    .from(TABLE_NAME)
    .select("id")
    .eq("place_id", placeId)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const writeResult = existing?.id
    ? await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .select(RESEARCH_SELECT)
        .single()
    : await supabase.from(TABLE_NAME).insert(payload).select(RESEARCH_SELECT).single();

  if (writeResult.error) {
    if (isMissingTableError(writeResult.error.message)) {
      return {
        ok: false,
        error: "La tabla place_ticket_research no está disponible en Supabase.",
      };
    }
    return { ok: false, error: writeResult.error.message };
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }

  return {
    ok: true,
    research: mapRow(writeResult.data as TicketResearchRow, researchResult.webSearchCount),
    tripTimezone: tripResult.trip.timezone,
  };
}

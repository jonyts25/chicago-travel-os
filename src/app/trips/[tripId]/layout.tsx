import { TripHeader } from "@/components/layout/trip-header";
import { TripNavigationProvider } from "@/components/layout/trip-navigation-context";
import { loadTripContext } from "@/lib/trips/load-trip-access";
import { tripDefaultPath, tripPaths } from "@/lib/trips/trip-paths";
import { isScheduledTrip } from "@/lib/trips/types";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(tripPaths(tripId).dashboard)}`);
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    redirect("/");
  }

  return (
    <TripNavigationProvider
      value={{
        tripId: tripResult.trip.id,
        tripName: tripResult.trip.name,
        tripType: tripResult.trip.trip_type,
      }}
    >
      <TripHeader />
      {children}
    </TripNavigationProvider>
  );
}

export async function assertScheduledTripRoute(tripId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(tripPaths(tripId).dashboard)}`);
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    redirect("/");
  }

  if (!isScheduledTrip(tripResult.trip.trip_type)) {
    redirect(tripDefaultPath(tripId, tripResult.trip.trip_type));
  }
}

import { CreateTripForm } from "@/components/home/create-trip-form";
import { TripList } from "@/components/home/trip-list";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadUserTrips } from "@/lib/trips/load-trip-access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;

  if (!user) {
    redirect("/login?next=/");
  }

  const tripsResult = await loadUserTrips(supabase, user.id);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        eyebrow="Travel OS"
        title="Tus viajes"
        subtitle="Elige un viaje o crea uno nuevo. Cada viaje tiene sus lugares, mapa e importación."
      />

      {tripsResult.ok ? <TripList trips={tripsResult.trips} /> : null}

      <div className="mt-6">
        <CreateTripForm initialError={params.error ?? null} />
      </div>
    </PageContainer>
  );
}

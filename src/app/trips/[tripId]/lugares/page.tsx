import { UnplannedPlacesBoard } from "@/components/planificar/unplanned-places-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlacesPoolData } from "@/lib/places/load-places-pool-data";
import { requireOngoingTrip } from "@/lib/trips/load-trip-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OngoingLugaresPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await requireOngoingTrip(tripId);
  const { data, error } = await loadPlacesPoolData(tripId, false);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={trip.name}
        title="Lugares"
        subtitle="Busca, importa y organiza los lugares de tu ciudad base."
      />

      {error ? (
        <ErrorMessage message="No pudimos cargar los lugares." technicalDetails={error} />
      ) : data ? (
        <UnplannedPlacesBoard
          tripId={tripId}
          mode="ongoing"
          days={data.days}
          unplannedPlaces={data.unplannedPlaces}
          unlocatedPlaces={data.unlocatedPlaces}
        />
      ) : (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
    </PageContainer>
  );
}

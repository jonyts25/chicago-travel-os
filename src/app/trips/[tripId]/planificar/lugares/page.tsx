import { UnplannedPlacesBoard } from "@/components/planificar/unplanned-places-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlanningBoardData } from "@/lib/itinerary/load-planning-data";
import { requireScheduledTrip } from "@/lib/trips/load-trip-access";

export const dynamic = "force-dynamic";

export default async function PlanificarLugaresPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  await requireScheduledTrip(tripId);
  const { data, error } = await loadPlanningBoardData(tripId);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Planificación"
        title="Lugares del viaje"
        subtitle="Busca nuevos lugares, revisa la bandeja sin planear y reconcilia los que no tienen coordenadas."
      />

      {error ? (
        <ErrorMessage message="No pudimos cargar los lugares." technicalDetails={error} />
      ) : data ? (
        <UnplannedPlacesBoard
          tripId={tripId}
          mode="scheduled"
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

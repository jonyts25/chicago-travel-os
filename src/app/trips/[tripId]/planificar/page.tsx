import { PlanningBoard } from "@/components/planificar/planning-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlanningBoardData } from "@/lib/itinerary/load-planning-data";
import { requireScheduledTrip } from "@/lib/trips/load-trip-access";

export const dynamic = "force-dynamic";

export default async function PlanificarPage({
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
        title="Itinerario de 4 días"
        subtitle="Organiza el itinerario de 4 días, regenera días y revisa horarios."
      />

      {error ? (
        <ErrorMessage message="No pudimos cargar el itinerario." technicalDetails={error} />
      ) : data ? (
        <PlanningBoard
          tripId={tripId}
          days={data.days}
          tripSettings={data.tripSettings}
          tripAnchorDate={data.tripAnchorDate}
          tripAnchorSource={data.tripAnchorSource}
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

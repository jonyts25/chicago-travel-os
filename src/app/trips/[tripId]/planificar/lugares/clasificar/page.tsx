import { PlaceBulkClassifyBoard } from "@/components/planificar/place-bulk-classify-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlacesClassificationData } from "@/lib/places/load-places-classification-data";
import { requireScheduledTrip } from "@/lib/trips/load-trip-access";

export const dynamic = "force-dynamic";

export default async function PlanificarLugaresClasificarPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  await requireScheduledTrip(tripId);
  const { data, error } = await loadPlacesClassificationData(tripId);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Planificación"
        title="Prioridad e interés"
        subtitle="Revisa y reclasifica todos los lugares del viaje de un jalón."
      />

      {error ? (
        <ErrorMessage message="No pudimos cargar los lugares." technicalDetails={error} />
      ) : data ? (
        <PlaceBulkClassifyBoard tripId={tripId} places={data} />
      ) : (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
    </PageContainer>
  );
}

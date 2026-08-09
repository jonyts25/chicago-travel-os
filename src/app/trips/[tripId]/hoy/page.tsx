import { TodayView } from "@/components/hoy/today-view";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadTodayPageContext } from "@/lib/hoy/load-today-data";
import { requireScheduledTrip } from "@/lib/trips/load-trip-access";

export const dynamic = "force-dynamic";

export default async function HoyPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  await requireScheduledTrip(tripId);
  const { context, error } = await loadTodayPageContext(tripId);

  return (
    <PageContainer className="max-w-lg">
      <PageHeader
        eyebrow="Hoy"
        title="En el viaje"
        subtitle="Próximo bloque, navegación y acciones rápidas para usar de pie."
      />

      {error || !context ? (
        <ErrorMessage
          message="No pudimos cargar el modo de hoy."
          technicalDetails={error ?? "Contexto no disponible."}
        />
      ) : (
        <TodayView tripId={tripId} context={context} />
      )}
    </PageContainer>
  );
}

import { PlanningBoard } from "@/components/planificar/planning-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlanningBoardData } from "@/lib/itinerary/load-planning-data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlanificarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/planificar");
  }

  const { data, error } = await loadPlanningBoardData();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Planificación"
        title="Itinerario de 4 días"
        subtitle="Organiza lugares, genera el optimizador y revisa sugerencias de IA."
      />

      {error ? (
        <ErrorMessage message="No pudimos cargar el itinerario." technicalDetails={error} />
      ) : data ? (
        <PlanningBoard
          days={data.days}
          unplannedPlaces={data.unplannedPlaces}
          unlocatedPlaces={data.unlocatedPlaces}
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

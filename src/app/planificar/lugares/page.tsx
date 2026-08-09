import { UnplannedPlacesBoard } from "@/components/planificar/unplanned-places-board";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadPlanningBoardData } from "@/lib/itinerary/load-planning-data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlanificarLugaresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/planificar/lugares");
  }

  const { data, error } = await loadPlanningBoardData();

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

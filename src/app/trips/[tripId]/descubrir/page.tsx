import { DiscoverView } from "@/components/discover/discover-view";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { loadTripContext } from "@/lib/trips/load-trip-access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { tripPaths } from "@/lib/trips/trip-paths";

export const dynamic = "force-dynamic";

export default async function DescubrirPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(tripPaths(tripId).descubrir)}`);
  }

  const tripResult = await loadTripContext(supabase, tripId, user.id);
  if (!tripResult.ok) {
    redirect("/");
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={tripResult.trip.name}
        title="Descubrir"
        subtitle="Sugerencias con IA basadas en dónde estás ahora y lo que os gusta."
      />
      <DiscoverView tripId={tripId} />
    </PageContainer>
  );
}

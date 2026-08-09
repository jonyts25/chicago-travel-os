import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { TripInfoSummary } from "@/components/trips/trip-info-summary";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { TRIP_TRAVEL_SELECT, normalizeTripTravelSettings } from "@/lib/trips/travel-info";
import { typography } from "@/lib/ui/styles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select(TRIP_TRAVEL_SELECT)
    .eq("id", CHICAGO_TRIP_ID)
    .maybeSingle();

  const tripSettings = normalizeTripTravelSettings(trip);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Resumen"
        title="Chicago Travel OS"
        subtitle="Accesos rápidos del viaje. Usa la barra inferior para moverte entre secciones."
      />

      <TripInfoSummary settings={tripSettings} />

      <Card className="mt-6" title="Sesión activa">
        <p className={typography.secondary}>
          Conectado como <span className="font-medium text-slate-200">{user.email}</span>
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </Card>

      <Link
        href="/hoy"
        className="mt-6 block rounded-2xl border border-slate-800 bg-slate-950/80 p-6 transition hover:border-blue-500/40"
      >
        <p className={typography.eyebrow}>En el viaje</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Abrir modo Hoy</h2>
        <p className={typography.secondary}>Próximo bloque, navegación y acciones rápidas.</p>
      </Link>
    </PageContainer>
  );
}

import Link from "next/link";
import { LateCheckinToggle } from "@/components/dashboard/late-checkin-toggle";
import { PushNotificationsPanel } from "@/components/dashboard/push-notifications-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { TripInfoSummary } from "@/components/trips/trip-info-summary";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { TRIP_TRAVEL_SELECT, normalizeTripTravelSettings } from "@/lib/trips/travel-info";
import { typography } from "@/lib/ui/styles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await params;
  if (!tripId) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/trips/${tripId}/dashboard`);
  }

  const { data: trip } = await supabase
    .from("trips")
    .select(`${TRIP_TRAVEL_SELECT}, late_checkin_confirmed`)
    .eq("id", tripId)
    .maybeSingle();

  const tripSettings = normalizeTripTravelSettings(trip);
  const lateCheckinConfirmed = Boolean(trip?.late_checkin_confirmed);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Resumen"
        title="Chicago Travel OS"
        subtitle="Accesos rápidos del viaje. Usa la barra inferior para moverte entre secciones."
      />

      <TripInfoSummary settings={tripSettings} />

      <LateCheckinToggle
        tripId={tripId}
        initialConfirmed={lateCheckinConfirmed}
        hotelCheckin={tripSettings.hotel_checkin}
      />

      <PushNotificationsPanel vapidPublicKey={vapidPublicKey} />

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

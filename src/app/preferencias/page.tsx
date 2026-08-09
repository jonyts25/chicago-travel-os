import { PreferencesForm } from "@/components/preferencias/preferences-form";
import { TripSettingsForm } from "@/components/preferencias/trip-settings-form";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { TRIP_TRAVEL_SELECT, normalizeTripTravelSettings } from "@/lib/trips/travel-info";
import { typography } from "@/lib/ui/styles";
import { getUserPreferencesAction } from "@/app/preferencias/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage({
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
    redirect(`/login?next=/trips/${tripId}/preferencias`);
  }

  const preferencesResult = await getUserPreferencesAction();
  const { data: trip } = await supabase
    .from("trips")
    .select(TRIP_TRAVEL_SELECT)
    .eq("id", tripId)
    .maybeSingle();

  const tripSettings = normalizeTripTravelSettings(trip);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        eyebrow="Ajustes"
        title="Preferencias del viaje"
        subtitle="Datos del viaje, preferencias personales y sesión."
      />

      <TripSettingsForm tripId={tripId} initialSettings={tripSettings} />

      <Card className="mt-6" title="Sesión">
        <p className={typography.secondary}>
          Conectado como <span className="text-slate-200">{user.email}</span>
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </Card>

      {!preferencesResult.ok ? (
        <div className="mt-6">
          <ErrorMessage
            message="No pudimos cargar tus preferencias."
            technicalDetails={preferencesResult.error}
          />
        </div>
      ) : (
        <div className="mt-6">
          <PreferencesForm
            initialPreferences={preferencesResult.preferences ?? ""}
            userEmail={user.email ?? ""}
          />
        </div>
      )}
    </PageContainer>
  );
}

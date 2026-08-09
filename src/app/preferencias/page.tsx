import { PreferencesForm } from "@/components/preferencias/preferences-form";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { typography } from "@/lib/ui/styles";
import { getUserPreferencesAction } from "@/app/preferencias/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/preferencias");
  }

  const preferencesResult = await getUserPreferencesAction();
  const { data: trip } = await supabase
    .from("trips")
    .select("base_location")
    .eq("id", CHICAGO_TRIP_ID)
    .maybeSingle();

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        eyebrow="Ajustes"
        title="Preferencias del viaje"
        subtitle="Cada viajero edita las suyas con su cuenta. La IA las usa para sugerir lugares."
      />

      <Card title="Hotel / base del viaje">
        <p className={typography.body}>
          {trip?.base_location?.trim() || "Aún no hay base configurada en el trip."}
        </p>
        <p className={typography.muted}>
          Configurable en Supabase (`trips.base_location`).
        </p>
      </Card>

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

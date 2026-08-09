import { AddPlaceForm } from "@/components/add-place-form";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { typography } from "@/lib/ui/styles";
import { resolveMapsUrlFromShareParams } from "@/lib/importers/google-maps";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AgregarPageProps = {
  searchParams: Promise<{
    url?: string;
    text?: string;
    title?: string;
  }>;
};

export default async function AgregarLugarPage({
  params,
  searchParams,
}: AgregarPageProps & {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/trips/${tripId}/import/agregar`);
  }

  const routeSearchParams = await searchParams;
  const initialMapsUrl = resolveMapsUrlFromShareParams(routeSearchParams);
  const sharedFromAndroid = Boolean(initialMapsUrl);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Importar"
        title="Enlace de Google Maps"
        subtitle="Pega un enlace con CID !1s0x…:0x… para geocodificar y guardar como sin planear."
      />

      <Card>
        {sharedFromAndroid ? (
          <p className={`${typography.body} mb-4 rounded-xl border border-blue-500/30 bg-blue-950/30 px-3 py-2 text-blue-100`}>
            Enlace recibido desde Compartir — revisa y confirma abajo.
          </p>
        ) : null}
        <AddPlaceForm tripId={tripId} initialMapsUrl={initialMapsUrl} />
      </Card>
    </PageContainer>
  );
}

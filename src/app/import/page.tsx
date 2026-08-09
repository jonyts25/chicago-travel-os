import Link from "next/link";
import { ImportPlacesForm } from "@/components/import-places-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/import");
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Importación"
        title="Lugares de Google Maps"
        subtitle="CSV de Takeout, geocoding con Nominatim y enriquecimiento opcional con IA."
      />

      <Card
        title="Importar CSV"
        subtitle='Sube el export Saved con columnas Título, Nota, URL, Etiquetas, Comentario.'
      >
        <ImportPlacesForm />
      </Card>

      <Card
        className="mt-6"
        title="Agregar un lugar"
        subtitle="Pega un enlace de Google Maps sin resubir el CSV. En Android: Compartir → Chicago Travel."
      >
        <Link href="/import/agregar">
          <Button>Agregar lugar</Button>
        </Link>
      </Card>
    </PageContainer>
  );
}

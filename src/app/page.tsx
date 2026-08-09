import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { typography } from "@/lib/ui/styles";

export default function HomePage() {
  return (
    <PageContainer className="flex items-center justify-center py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <p className={typography.eyebrow}>PWA privada</p>
          <h1 className={typography.pageTitle}>Chicago Travel OS</h1>
          <p className={typography.pageSubtitle}>
            Planificador de viaje para 2 usuarios. Instálala en tu teléfono y gestiona el
            itinerario de 4 días en Chicago.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login">
            <Button className="min-w-40">Entrar</Button>
          </Link>
          <Link href="/hoy">
            <Button variant="secondary" className="min-w-40">
              Modo hoy
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

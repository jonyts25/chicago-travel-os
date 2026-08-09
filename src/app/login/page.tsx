import { LoginForm } from "@/components/login-form";
import { PageContainer } from "@/components/ui/page-container";
import { Card } from "@/components/ui/card";
import { typography } from "@/lib/ui/styles";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next ?? "/";

  return (
    <PageContainer className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <div className="mb-6 space-y-2 text-center">
          <p className={typography.eyebrow}>Chicago Travel OS</p>
          <h1 className={typography.pageTitle}>Iniciar sesión</h1>
          <p className={typography.pageSubtitle}>Acceso privado con email y contraseña.</p>
        </div>
        <LoginForm nextPath={nextPath} />
      </Card>
    </PageContainer>
  );
}

import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next ?? "/dashboard";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-xl">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Chicago Travel OS
          </p>
          <h1 className="text-2xl font-semibold text-white">Iniciar sesión</h1>
          <p className="text-sm text-slate-400">
            Acceso privado con magic link por email.
          </p>
        </div>

        <LoginForm nextPath={nextPath} authError={params.error} />
      </div>
    </div>
  );
}

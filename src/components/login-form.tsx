"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return "Email o contraseña incorrectos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirma tu email antes de entrar.";
  }

  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(mapAuthError(error.message));
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none ring-blue-500 placeholder:text-slate-500 focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white outline-none ring-blue-500 placeholder:text-slate-500 focus:ring-2"
        />
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Entrando..." : "Entrar"}
      </button>

      {errorMessage ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

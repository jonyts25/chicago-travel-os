"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrlForClient } from "@/lib/site-url";

type LoginFormProps = {
  nextPath: string;
  authError?: string;
};

export function LoginForm({ nextPath, authError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const supabase = createClient();
    const redirectTo = `${getSiteUrlForClient()}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Revisa tu correo y abre el enlace mágico para entrar.");
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

      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Enviando..." : "Enviar magic link"}
      </button>

      {authError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          No se pudo completar el inicio de sesión. Intenta de nuevo.
        </p>
      ) : null}

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status === "error"
              ? "border border-red-500/40 bg-red-950/40 text-red-200"
              : "border border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

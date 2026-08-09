"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { inputs } from "@/lib/ui/styles";
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
  const [technicalError, setTechnicalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setTechnicalError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setTechnicalError(error.message);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className={inputs.label}>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          className={inputs.base}
        />
      </label>

      <label className={inputs.label}>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className={inputs.base}
        />
      </label>

      <Button type="submit" loading={status === "loading"} className="w-full">
        Entrar
      </Button>

      {status === "error" ? (
        <ErrorMessage
          message="No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo."
          technicalDetails={technicalError}
        />
      ) : null}
    </form>
  );
}

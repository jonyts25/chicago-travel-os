"use client";

import { FormEvent, useState, useTransition } from "react";
import { updateUserPreferencesAction } from "@/app/preferencias/actions";

type PreferencesFormProps = {
  initialPreferences: string;
  userEmail: string;
};

export function PreferencesForm({
  initialPreferences,
  userEmail,
}: PreferencesFormProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await updateUserPreferencesAction(preferences);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Preferencias guardadas.");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="preferences" className="text-lg font-medium text-white">
          Preferencias de {userEmail}
        </label>
        <p className="text-sm text-slate-400">
          Ejemplo: me gusta la comida picante, museos de arte, evitar lugares muy turísticos.
        </p>
        <textarea
          id="preferences"
          value={preferences}
          onChange={(event) => setPreferences(event.target.value)}
          rows={8}
          placeholder="Escribe libremente qué te gusta, qué evitas, ritmo del viaje, etc."
          className="mt-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar preferencias"}
      </button>
    </form>
  );
}

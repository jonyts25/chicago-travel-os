"use client";

import { FormEvent, useState, useTransition } from "react";
import { updateUserPreferencesAction } from "@/app/preferencias/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import { inputs, typography } from "@/lib/ui/styles";

type PreferencesFormProps = {
  initialPreferences: string;
  userEmail: string;
};

export function PreferencesForm({
  initialPreferences,
  userEmail,
}: PreferencesFormProps) {
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTechnicalError(null);

    startTransition(async () => {
      const result = await updateUserPreferencesAction(preferences);
      if (!result.ok) {
        setTechnicalError(result.error);
        return;
      }

      showToast("Preferencias guardadas");
    });
  }

  return (
    <Card title={`Preferencias de ${userEmail}`} subtitle="Texto libre sobre gustos, ritmo y cosas a evitar.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="preferences" className={inputs.label}>
          Tus gustos
          <textarea
            id="preferences"
            value={preferences}
            onChange={(event) => setPreferences(event.target.value)}
            rows={8}
            placeholder="Ej. comida picante, museos de arte, evitar lugares muy turísticos."
            className={inputs.base}
          />
        </label>

        {technicalError ? (
          <ErrorMessage
            message="No pudimos guardar tus preferencias."
            technicalDetails={technicalError}
          />
        ) : null}

        <Button type="submit" loading={isPending}>
          Guardar preferencias
        </Button>
      </form>
    </Card>
  );
}

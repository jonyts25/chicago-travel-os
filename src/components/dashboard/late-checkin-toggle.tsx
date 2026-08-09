"use client";

import { useState, useTransition } from "react";
import { updateLateCheckinConfirmedAction } from "@/app/dashboard/actions";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import { cn, typography } from "@/lib/ui/styles";

type LateCheckinToggleProps = {
  initialConfirmed: boolean;
  hotelCheckin: string | null;
};

export function LateCheckinToggle({
  initialConfirmed,
  hotelCheckin,
}: LateCheckinToggleProps) {
  const { showToast } = useToast();
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const nextValue = !confirmed;
    setTechnicalError(null);
    setConfirmed(nextValue);

    startTransition(async () => {
      const result = await updateLateCheckinConfirmedAction(nextValue);
      if (!result.ok) {
        setConfirmed(confirmed);
        setTechnicalError(result.error);
        return;
      }

      showToast(
        nextValue
          ? "Late check-in marcado como confirmado"
          : "Late check-in pendiente de confirmar",
      );
    });
  }

  return (
    <Card
      className="mt-6"
      title="Late check-in del hotel"
      subtitle={
        hotelCheckin
          ? "Marca cuando hayas confirmado con el hotel. Mientras esté pendiente, el cron puede enviarte recordatorios push."
          : "Captura la fecha de check-in en Ajustes para habilitar los recordatorios automáticos."
      }
      tone={confirmed ? "success" : "warning"}
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={isPending}
          onChange={handleToggle}
          className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/40"
        />
        <span>
          <span className={cn(typography.body, "font-medium text-white")}>
            Late check-in confirmado
          </span>
          <span className={cn(typography.secondary, "mt-1 block")}>
            Estado actual:{" "}
            <span className={confirmed ? "text-emerald-300" : "text-amber-300"}>
              {confirmed ? "Confirmado" : "Pendiente"}
            </span>
          </span>
        </span>
      </label>

      {technicalError ? (
        <ErrorMessage
          className="mt-4"
          message="No se pudo actualizar el estado."
          technicalDetails={technicalError}
        />
      ) : null}
    </Card>
  );
}

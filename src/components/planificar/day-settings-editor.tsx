"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateItineraryDaySettingsAction } from "@/app/planificar/actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatDayEndMinutes,
  formatDayEndSourceLabel,
  fromTimeInputValue,
  resolveFocusCategory,
  toTimeInputValue,
} from "@/lib/itinerary/day-constraints";
import type { PlanningDay } from "@/lib/itinerary/schema";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type DaySettingsEditorProps = {
  tripId: string;
  day: PlanningDay;
  disabled?: boolean;
};

export function DaySettingsEditor({ tripId, day, disabled = false }: DaySettingsEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [focus, setFocus] = useState(day.focus ?? "");
  const [dayEndOverride, setDayEndOverride] = useState(
    toTimeInputValue(day.day_end_override),
  );
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setFocus(day.focus ?? "");
    setDayEndOverride(toTimeInputValue(day.day_end_override));
  }, [day.id, day.focus, day.day_end_override]);

  const focusCategory = resolveFocusCategory(focus.trim() || null);
  const effectiveEndMinutes = day.day_end_minutes;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTechnicalError(null);

    startTransition(async () => {
      const result = await updateItineraryDaySettingsAction(
        tripId,
        day.id,
        focus.trim() || null,
        fromTimeInputValue(dayEndOverride),
      );

      if (!result.ok) {
        setTechnicalError(result.error ?? "No se pudo guardar.");
        return;
      }

      showToast(`Día ${day.day_number} actualizado`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(surfaces.inset, "mt-4 flex flex-col gap-4 p-4")}
    >
      <div>
        <p className={typography.sectionTitle}>Enfoque del día</p>
        <p className={typography.secondary}>
          Escribe una categoría (ej. compras) o una etiqueta libre. Si coincide con una
          categoría, el optimizador prioriza esos lugares ese día.
        </p>
      </div>

      <label htmlFor={`focus-${day.id}`} className={inputs.label}>
        Focus
        <input
          id={`focus-${day.id}`}
          type="text"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder='Ej. compras, museos, "medio día - salida"'
          className={inputs.base}
          disabled={disabled || isPending}
        />
      </label>

      {focus.trim() ? (
        <p className={typography.muted}>
          {focusCategory
            ? `Categoría detectada: ${focusCategory} (prioridad en el optimizador).`
            : "Etiqueta informativa — no coincide con una categoría conocida."}
        </p>
      ) : null}

      <label htmlFor={`day-end-${day.id}`} className={inputs.label}>
        Hora límite manual (opcional)
        <input
          id={`day-end-${day.id}`}
          type="time"
          value={dayEndOverride}
          onChange={(event) => setDayEndOverride(event.target.value)}
          className={inputs.base}
          disabled={disabled || isPending}
        />
      </label>

      <p className={typography.muted}>
        Efectiva ahora: {formatDayEndMinutes(effectiveEndMinutes)} (
        {formatDayEndSourceLabel(day.day_end_source)}). Deja vacío para usar vuelo o 22:00.
      </p>

      {technicalError ? (
        <ErrorMessage
          message="No pudimos guardar la configuración del día."
          technicalDetails={technicalError}
        />
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled} loading={isPending}>
          Guardar día
        </Button>
      </div>
    </form>
  );
}

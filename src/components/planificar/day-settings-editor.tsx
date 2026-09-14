"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateItineraryDaySettingsAction } from "@/app/planificar/actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatDayEndMinutes,
  formatDayEndSourceLabel,
  formatFocusCategoryHint,
  fromTimeInputValue,
  resolveFocusCategory,
  toTimeInputValue,
} from "@/lib/itinerary/day-constraints";
import type { PlanningDay } from "@/lib/itinerary/schema";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type DaySettingsEditorProps = {
  tripId: string;
  day: PlanningDay;
  tripPlaceCategories: string[];
  disabled?: boolean;
};

export function DaySettingsEditor({
  tripId,
  day,
  tripPlaceCategories,
  disabled = false,
}: DaySettingsEditorProps) {
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

  const categoryOptions = useMemo(() => {
    const values = new Set(tripPlaceCategories);
    if (day.focus_category) {
      values.add(day.focus_category);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [day.focus_category, tripPlaceCategories]);

  const focusCategory = resolveFocusCategory(focus.trim() || null, tripPlaceCategories);
  const focusHint = formatFocusCategoryHint(focus.trim() || null, tripPlaceCategories);
  const effectiveEndMinutes = day.day_end_minutes;
  const isDirty =
    focus !== (day.focus ?? "") ||
    dayEndOverride !== toTimeInputValue(day.day_end_override);

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

      showToast(
        result.warning
          ? `Día ${day.day_number} guardado (${result.warning})`
          : `Día ${day.day_number} actualizado`,
      );
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
          Elige una categoría real del viaje o escribe una variante (ej. museos → Museo).
          El optimizador prioriza esos lugares al generar o regenerar este día.
        </p>
      </div>

      <label htmlFor={`focus-${day.id}`} className={inputs.label}>
        Focus
        <input
          id={`focus-${day.id}`}
          type="text"
          list={`focus-categories-${day.id}`}
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="Ej. Museo, museos, Restaurante"
          className={inputs.base}
          disabled={disabled || isPending}
        />
      </label>

      <datalist id={`focus-categories-${day.id}`}>
        {categoryOptions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {categoryOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              disabled={disabled || isPending}
              onClick={() => setFocus(category)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                focus === category
                  ? "border-blue-400 bg-blue-500/20 text-blue-100"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {focus.trim() ? (
        <p className={cn(typography.muted, focusCategory ? "text-emerald-300/90" : "")}>
          {focusHint}
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

      <div className="flex items-center justify-between gap-3">
        {isDirty ? (
          <p className={cn(typography.muted, "text-amber-200/90")}>
            Cambios sin guardar — pulsa Guardar día para persistir el focus.
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={disabled || !isDirty} loading={isPending}>
          Guardar día
        </Button>
      </div>
    </form>
  );
}

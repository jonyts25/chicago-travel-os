"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignPlaceToDayAction,
  generateItineraryAction,
  moveItineraryItemAction,
  regenerateDayItineraryAction,
  removePlaceFromDayAction,
} from "@/app/planificar/actions";
import { PlaceDetailModal } from "@/components/planificar/place-detail-modal";
import { PlaceSuggestionsPanel } from "@/components/planificar/place-suggestions-panel";
import type { PlanningBoardData, PlanningDay } from "@/lib/itinerary/schema";
import type { OptimizerSummary } from "@/lib/itinerary/optimizer/types";
import { formatScheduleTime } from "@/lib/itinerary/schedule-day";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";

type PlanningBoardProps = PlanningBoardData;

export function PlanningBoard({
  days,
  unplannedPlaces,
  unlocatedPlaces,
}: PlanningBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeDayNumber, setActiveDayNumber] = useState(days[0]?.day_number ?? 1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [optimizerSummary, setOptimizerSummary] = useState<OptimizerSummary | null>(
    null,
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const place of unplannedPlaces) {
      if (place.category) {
        values.add(place.category);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [unplannedPlaces]);

  const filteredUnplanned = useMemo(() => {
    if (categoryFilter === "all") {
      return unplannedPlaces;
    }
    return unplannedPlaces.filter((place) => place.category === categoryFilter);
  }, [categoryFilter, unplannedPlaces]);

  const activeDay = days.find((day) => day.day_number === activeDayNumber) ?? days[0];

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      router.refresh();
    });
  }

  function runOptimizer(action: () => Promise<OptimizerSummary>) {
    setActionError(null);
    setOptimizerSummary(null);
    startTransition(async () => {
      const result = await action();
      setOptimizerSummary(result);
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo generar el itinerario.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PlaceDetailModal
        placeId={selectedPlaceId}
        days={days.map((day) => ({ id: day.id, day_number: day.day_number }))}
        onClose={() => setSelectedPlaceId(null)}
      />

      {actionError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Optimizador</h2>
            <p className="mt-1 text-sm text-slate-400">
              Distribuye lugares sin planear con coordenadas entre los 4 días (~8 h
              activas/día + 20 min de traslado entre paradas).
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runOptimizer(() => generateItineraryAction())}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Generando..." : "Generar itinerario"}
          </button>
        </div>

        {optimizerSummary ? (
          <OptimizerSummaryPanel summary={optimizerSummary} />
        ) : null}
      </section>

      <PlaceSuggestionsPanel />

      {unlocatedPlaces.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
          <h2 className="text-lg font-medium text-amber-100">
            No se pudieron ubicar ({unlocatedPlaces.length})
          </h2>
          <p className="mt-1 text-sm text-amber-100/80">
            Lugares sin coordenadas — quedan fuera del optimizador. Agrégalos manualmente
            o corrige sus coordenadas.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {unlocatedPlaces.map((place) => (
              <li
                key={place.id}
                className="rounded-lg border border-amber-500/20 bg-slate-950/40 px-3 py-2 text-sm text-amber-50"
              >
                <PlaceOpenButton
                  name={place.name}
                  onOpen={() => setSelectedPlaceId(place.id)}
                />
                <span className="text-amber-100/70">
                  {" "}
                  · {formatCategory(place.category)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Sin planear</h2>
            <p className="mt-1 text-sm text-slate-400">
              {unplannedPlaces.length} lugar(es) con coordenadas disponibles
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Categoría
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredUnplanned.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No hay lugares sin planear
            {categoryFilter !== "all" ? " en esta categoría" : ""}.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {filteredUnplanned.map((place) => (
              <UnplannedPlaceCard
                key={place.id}
                place={place}
                days={days}
                disabled={isPending}
                onOpen={() => setSelectedPlaceId(place.id)}
                onAssign={(dayId) =>
                  runAction(() => assignPlaceToDayAction(place.id, dayId))
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <h2 className="text-lg font-medium text-white">Itinerario por día</h2>

        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Días del viaje"
        >
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={activeDay?.id === day.id}
              onClick={() => setActiveDayNumber(day.day_number)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeDay?.id === day.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
            >
              Día {day.day_number}
              <span className="ml-2 text-xs opacity-80">({day.items.length})</span>
            </button>
          ))}
        </div>

        {activeDay ? (
          <DayPlanPanel
            day={activeDay}
            disabled={isPending}
            onOpenPlace={(placeId) => setSelectedPlaceId(placeId)}
            onMoveUp={(itemId) =>
              runAction(() => moveItineraryItemAction(itemId, "up"))
            }
            onMoveDown={(itemId) =>
              runAction(() => moveItineraryItemAction(itemId, "down"))
            }
            onRemove={(itemId) =>
              runAction(() => removePlaceFromDayAction(itemId))
            }
            onRegenerateDay={() =>
              runOptimizer(() => regenerateDayItineraryAction(activeDay.id))
            }
          />
        ) : null}
      </section>
    </div>
  );
}

function OptimizerSummaryPanel({ summary }: { summary: OptimizerSummary }) {
  const totalAssigned = summary.assignedByDay.reduce(
    (sum, day) => sum + day.count,
    0,
  );

  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        summary.ok
          ? "border-emerald-500/30 bg-emerald-950/20"
          : "border-red-500/30 bg-red-950/20"
      }`}
    >
      <h3
        className={`text-sm font-semibold ${
          summary.ok ? "text-emerald-100" : "text-red-100"
        }`}
      >
        {summary.ok ? "Itinerario generado" : "Error al generar"}
      </h3>

      {summary.ok ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Asignados en total</dt>
            <dd className="font-medium text-white">{totalAssigned}</dd>
          </div>
          {summary.assignedByDay.map((day) => (
            <div key={day.dayNumber}>
              <dt className="text-slate-400">Día {day.dayNumber}</dt>
              <dd className="font-medium text-white">{day.count} lugar(es)</dd>
            </div>
          ))}
          <div>
            <dt className="text-slate-400">Sin asignar (tiempo)</dt>
            <dd className="font-medium text-white">{summary.unassignedDueToTime}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Sin coordenadas</dt>
            <dd className="font-medium text-white">{summary.withoutCoordinates}</dd>
          </div>
        </dl>
      ) : null}

      {summary.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {summary.warnings.map((warning) => (
            <li key={warning} className="text-sm text-amber-100">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PlaceOpenButton({
  name,
  onOpen,
}: {
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="font-medium text-left text-white underline decoration-blue-500/50 underline-offset-2 hover:text-blue-200"
    >
      {name}
    </button>
  );
}

function UnplannedPlaceCard({
  place,
  days,
  disabled,
  onOpen,
  onAssign,
}: {
  place: PlanningBoardData["unplannedPlaces"][number];
  days: PlanningDay[];
  disabled: boolean;
  onOpen: () => void;
  onAssign: (dayId: string) => void;
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? "");

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PlaceOpenButton name={place.name} onOpen={onOpen} />
          <p className="mt-1 text-sm text-slate-400">
            {formatCategory(place.category)} · {formatDurationMinutes(place.duration_minutes)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[220px]">
          <select
            value={selectedDayId}
            onChange={(event) => setSelectedDayId(event.target.value)}
            disabled={disabled || days.length === 0}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                Día {day.day_number}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled || !selectedDayId}
            onClick={() => onAssign(selectedDayId)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Agregar al día
          </button>
        </div>
      </div>
    </li>
  );
}

function DayPlanPanel({
  day,
  disabled,
  onOpenPlace,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRegenerateDay,
}: {
  day: PlanningDay;
  disabled: boolean;
  onOpenPlace: (placeId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onRegenerateDay: () => void;
}) {
  const totalMinutes = day.items.reduce(
    (sum, item) => sum + (item.place.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Día {day.day_number}
          {day.date ? ` · ${day.date}` : ""} · Duración estimada:{" "}
          {formatDurationMinutes(totalMinutes)}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={onRegenerateDay}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Regenerar solo este día
        </button>
      </div>

      {day.items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aún no hay lugares asignados a este día.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {day.items.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    #{index + 1}
                    {item.is_fixed ? " · Fijado" : ""}
                  </p>
                  <p className="mt-1 font-medium text-white">
                    {item.start_time ? (
                      <span className="text-blue-300">
                        {formatScheduleTime(item.start_time)}
                        {" — "}
                      </span>
                    ) : null}
                    <PlaceOpenButton
                      name={item.place.name}
                      onOpen={() => onOpenPlace(item.place.id)}
                    />
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatCategory(item.place.category)} ·{" "}
                    {formatDurationMinutes(item.place.duration_minutes)}
                    {item.end_time
                      ? ` · hasta ${formatScheduleTime(item.end_time)}`
                      : ""}
                  </p>
                </div>

                {item.is_fixed ? (
                  <p className="text-xs text-slate-500">
                    Fijado — puedes editar el detalle, no reordenar
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => onMoveUp(item.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      disabled={disabled || index === day.items.length - 1}
                      onClick={() => onMoveDown(item.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Bajar
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(item.id)}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignPlaceToDayAction,
  moveItineraryItemAction,
  removePlaceFromDayAction,
} from "@/app/planificar/actions";
import type { PlanningBoardData, PlanningDay } from "@/lib/itinerary/schema";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";

type PlanningBoardProps = PlanningBoardData;

export function PlanningBoard({ days, unplannedPlaces }: PlanningBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeDayNumber, setActiveDayNumber] = useState(days[0]?.day_number ?? 1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Sin planear</h2>
            <p className="mt-1 text-sm text-slate-400">
              {unplannedPlaces.length} lugar(es) disponibles
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
            onMoveUp={(itemId) =>
              runAction(() => moveItineraryItemAction(itemId, "up"))
            }
            onMoveDown={(itemId) =>
              runAction(() => moveItineraryItemAction(itemId, "down"))
            }
            onRemove={(itemId) =>
              runAction(() => removePlaceFromDayAction(itemId))
            }
          />
        ) : null}
      </section>
    </div>
  );
}

function UnplannedPlaceCard({
  place,
  days,
  disabled,
  onAssign,
}: {
  place: PlanningBoardData["unplannedPlaces"][number];
  days: PlanningDay[];
  disabled: boolean;
  onAssign: (dayId: string) => void;
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? "");

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-white">{place.name}</p>
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
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  day: PlanningDay;
  disabled: boolean;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const totalMinutes = day.items.reduce(
    (sum, item) => sum + (item.place.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="mt-4">
      <p className="text-sm text-slate-400">
        Día {day.day_number}
        {day.date ? ` · ${day.date}` : ""} · Duración estimada:{" "}
        {formatDurationMinutes(totalMinutes)}
      </p>

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
                  </p>
                  <p className="mt-1 font-medium text-white">{item.place.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatCategory(item.place.category)} ·{" "}
                    {formatDurationMinutes(item.place.duration_minutes)}
                  </p>
                </div>

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
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

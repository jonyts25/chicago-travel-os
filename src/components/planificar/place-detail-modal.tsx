"use client";

import { FormEvent, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  deletePlaceAction,
  getPlaceDetailAction,
  retryPlaceGeocodingAction,
  updatePlaceAction,
} from "@/app/planificar/place-actions";
import { PlaceDocumentsSection } from "@/components/planificar/place-documents-section";
import {
  PLACE_CATEGORIES,
  PLACE_INTERESTS,
  PLACE_PRIORITIES,
  type PlaceDetail,
} from "@/lib/places/place-detail";
import {
  formatCoordinates,
  timeInputToDbValue,
  toTimeInputValue,
} from "@/lib/places/place-format";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";

type PlaceDetailModalProps = {
  placeId: string | null;
  days: { id: string; day_number: number }[];
  onClose: () => void;
};

export function PlaceDetailModal({ placeId, days, onClose }: PlaceDetailModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [interest, setInterest] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [reservationRequired, setReservationRequired] = useState(false);
  const [reservationStartTime, setReservationStartTime] = useState("");
  const [assignToDayId, setAssignToDayId] = useState("");

  useEffect(() => {
    if (!placeId) {
      setPlace(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowDeleteConfirm(false);

    getPlaceDetailAction(placeId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setPlace(null);
        setLoading(false);
        return;
      }

      hydrateForm(result.place);
      setPlace(result.place);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  function hydrateForm(detail: PlaceDetail) {
    setName(detail.name);
    setCategory(detail.category ?? "");
    setPriority(detail.priority ?? "medium");
    setInterest(detail.interest ?? "both");
    setDurationMinutes(
      detail.duration_minutes != null ? String(detail.duration_minutes) : "",
    );
    setNotes(detail.notes ?? "");
    setOpeningHours(detail.opening_hours ?? "");
    setReservationRequired(detail.reservation_required);
    setReservationStartTime(toTimeInputValue(detail.itinerary?.startTime));
    setAssignToDayId(detail.itinerary?.itineraryDayId ?? days[0]?.id ?? "");
  }

  function handleClose() {
    if (isPending) {
      return;
    }
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placeId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const parsedDuration = durationMinutes.trim()
        ? Number(durationMinutes)
        : null;

      if (parsedDuration != null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
        setError("La duración debe ser un número positivo.");
        return;
      }

      if (reservationRequired) {
        const dbTime = timeInputToDbValue(reservationStartTime);
        if (!dbTime) {
          setError("Indica una hora válida (HH:MM).");
          return;
        }
      }

      const result = await updatePlaceAction({
        placeId,
        name,
        category: category || null,
        priority: priority || null,
        interest: interest || null,
        duration_minutes: parsedDuration,
        notes,
        reservation_required: reservationRequired,
        opening_hours: openingHours,
        reservation_start_time: reservationRequired
          ? timeInputToDbValue(reservationStartTime)
          : null,
        assign_to_day_id:
          reservationRequired && place?.status === "unplanned"
            ? assignToDayId || null
            : null,
      });

      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar.");
        return;
      }

      const refreshed = await getPlaceDetailAction(placeId);
      if (refreshed.ok) {
        hydrateForm(refreshed.place);
        setPlace(refreshed.place);
      }

      router.refresh();
    });
  }

  function handleRetryGeocoding() {
    if (!placeId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await retryPlaceGeocodingAction(placeId);
      if (!result.ok) {
        setError(result.error ?? "No se pudo geocodificar.");
        return;
      }

      const refreshed = await getPlaceDetailAction(placeId);
      if (refreshed.ok) {
        hydrateForm(refreshed.place);
        setPlace(refreshed.place);
      }

      router.refresh();
    });
  }

  function handleDelete() {
    if (!placeId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deletePlaceAction(placeId);
      if (!result.ok) {
        setError(result.error ?? "No se pudo eliminar.");
        return;
      }

      router.refresh();
      onClose();
    });
  }

  if (!placeId) {
    return null;
  }

  const isUnplanned = place?.status === "unplanned";
  const hasCoordinates = place?.lat != null && place?.lng != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-detail-title"
      onClick={handleClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-400">
              Detalle del lugar
            </p>
            <h2 id="place-detail-title" className="mt-1 text-lg font-semibold text-white">
              {loading ? "Cargando..." : place?.name ?? "Lugar"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900"
          >
            Cerrar
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-400">Cargando datos...</p>
        ) : place ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
            <Field label="Nombre">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className={inputClassName}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Categoría">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Sin categoría</option>
                  {PLACE_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Prioridad">
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className={inputClassName}
                >
                  {PLACE_PRIORITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Interés">
                <select
                  value={interest}
                  onChange={(event) => setInterest(event.target.value)}
                  className={inputClassName}
                >
                  {PLACE_INTERESTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Duración (min)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  placeholder="60"
                  className={inputClassName}
                />
              </Field>
            </div>

            <Field label="Horario (texto libre)">
              <input
                value={openingHours}
                onChange={(event) => setOpeningHours(event.target.value)}
                placeholder='Ej. "9:00-18:00" o "Cerrado los lunes"'
                className={inputClassName}
              />
            </Field>

            <Field label="Notas">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className={inputClassName}
              />
            </Field>

            <PlaceDocumentsSection placeId={place.id} />

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={reservationRequired}
                  onChange={(event) => setReservationRequired(event.target.checked)}
                  className="rounded border-slate-600"
                />
                Requiere reserva con hora fija
              </label>

              {reservationRequired ? (
                <div className="mt-4 flex flex-col gap-3">
                  <Field label="Hora de reserva">
                    <input
                      type="time"
                      value={reservationStartTime}
                      onChange={(event) => setReservationStartTime(event.target.value)}
                      required
                      className={inputClassName}
                    />
                  </Field>

                  {isUnplanned ? (
                    <Field label="Asignar al día">
                      <select
                        value={assignToDayId}
                        onChange={(event) => setAssignToDayId(event.target.value)}
                        required
                        className={inputClassName}
                      >
                        {days.map((day) => (
                          <option key={day.id} value={day.id}>
                            Día {day.day_number}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        Este lugar está sin planear — elige el día antes de fijar la
                        reserva.
                      </p>
                    </Field>
                  ) : place.itinerary ? (
                    <p className="text-sm text-slate-400">
                      Día de la reserva:{" "}
                      <span className="font-medium text-slate-200">
                        Día {place.itinerary.dayNumber}
                      </span>
                      {place.itinerary.startTime
                        ? ` · hora guardada: ${toTimeInputValue(place.itinerary.startTime)}`
                        : ""}
                      {place.itinerary.isFixed ? " · fijado en el itinerario" : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-sm font-medium text-slate-200">Coordenadas</h3>
              {hasCoordinates ? (
                <div className="mt-2 space-y-1 text-sm text-slate-400">
                  <p>{formatCoordinates(place.lat, place.lng)}</p>
                  {place.address ? <p>{place.address}</p> : null}
                  <p className="text-xs text-slate-500">Solo lectura</p>
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-amber-200">
                    Sin coordenadas — no aparece en el mapa ni en el optimizador.
                  </p>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleRetryGeocoding}
                    className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/40 disabled:opacity-60"
                  >
                    Reintentar geocoding
                  </button>
                </div>
              )}
            </section>

            {error ? (
              <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-between">
              <div>
                {showDeleteConfirm ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <p className="text-sm text-red-200">¿Eliminar este lugar?</p>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleDelete}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-60"
                  >
                    Eliminar lugar
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            {place.duration_minutes != null ? (
              <p className="text-xs text-slate-500">
                Duración actual en lista: {formatDurationMinutes(place.duration_minutes)} ·{" "}
                {formatCategory(place.category)}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="px-5 py-8 text-sm text-red-200">{error ?? "No se pudo cargar."}</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}

const inputClassName =
  "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

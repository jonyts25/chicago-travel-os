"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getPlaceVisitForUserAction,
  savePlaceVisitAction,
} from "@/app/planificar/place-visit-actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { PlaceVisit } from "@/lib/places/place-visits";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type PlaceVisitSectionProps = {
  tripId: string;
  placeId: string;
  disabled?: boolean;
};

export function PlaceVisitSection({ tripId, placeId, disabled }: PlaceVisitSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<PlaceVisit | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPlaceVisitForUserAction(tripId, placeId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setVisit(result.visit);
      if (result.visit) {
        setRating(result.visit.rating);
        setNotes(result.visit.notes ?? "");
        setExpanded(true);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tripId, placeId]);

  function handleOpenForm() {
    setExpanded(true);
    if (visit) {
      setRating(visit.rating);
      setNotes(visit.notes ?? "");
    }
  }

  function handleSave() {
    if (rating < 1 || rating > 5) {
      setError("Elige una calificación de 1 a 5 estrellas.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await savePlaceVisitAction(tripId, placeId, { rating, notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setVisit(result.visit);
      setExpanded(true);
      showToast(visit ? "Visita actualizada." : "Visita registrada.");
      router.refresh();
    });
  }

  return (
    <section className={cn(surfaces.inset, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={typography.body}>Marcar visita</h3>
          {visit && !expanded ? (
            <p className={cn(typography.secondary, "mt-1")}>
              {visit.rating}★ · {visit.notes?.trim() || "Sin notas"}
            </p>
          ) : (
            <p className={cn(typography.muted, "mt-1")}>
              Registra si ya fueron y cómo les pareció.
            </p>
          )}
        </div>

        {!expanded ? (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || loading || isPending}
            onClick={handleOpenForm}
          >
            {visit ? "Editar visita" : "Ya fuimos"}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className={cn(typography.muted, "mt-3")}>Cargando visita...</p>
      ) : expanded ? (
        <div className="mt-4 flex flex-col gap-4">
          <StarRating value={rating} onChange={setRating} disabled={disabled || isPending} />

          <label className={inputs.label}>
            Notas
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Qué les gustó, qué pedir, etc."
              className={inputs.base}
              disabled={disabled || isPending}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={disabled || isPending}
              loading={isPending}
              onClick={handleSave}
            >
              {visit ? "Guardar visita" : "Registrar visita"}
            </Button>
            {visit ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => setExpanded(false)}
              >
                Cerrar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          className="mt-3"
          message="No se pudo guardar la visita."
          technicalDetails={error}
        />
      ) : null}
    </section>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className={cn(inputs.label, "mb-2")}>Calificación</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              "rounded px-2 py-1 text-xl transition",
              value >= star ? "text-amber-400" : "text-slate-600 hover:text-slate-400",
              disabled && "opacity-50",
            )}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

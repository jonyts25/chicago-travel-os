"use client";

import { FormEvent, useState } from "react";
import { createTripAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { TRIP_TYPE_ONGOING, TRIP_TYPE_SCHEDULED, type TripType } from "@/lib/trips/types";
import { cn, inputs, typography } from "@/lib/ui/styles";

export function CreateTripForm({ initialError }: { initialError?: string | null }) {
  const [tripType, setTripType] = useState<TripType>(TRIP_TYPE_SCHEDULED);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    await createTripAction(formData);
  }

  return (
    <Card title="Crear viaje nuevo" subtitle="Programado con fechas e itinerario, o uso continuo sin calendario.">
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className={inputs.label}>
          Nombre
          <input name="name" required className={inputs.base} placeholder="Ej. Chicago 2026" />
        </label>

        <fieldset className="space-y-2">
          <legend className={inputs.label}>Tipo de viaje</legend>
          <label className={cn(typography.body, "flex items-center gap-2")}>
            <input
              type="radio"
              name="trip_type"
              value={TRIP_TYPE_SCHEDULED}
              checked={tripType === TRIP_TYPE_SCHEDULED}
              onChange={() => setTripType(TRIP_TYPE_SCHEDULED)}
            />
            Programado (fechas fijas, Hoy / Planificar)
          </label>
          <label className={cn(typography.body, "flex items-center gap-2")}>
            <input
              type="radio"
              name="trip_type"
              value={TRIP_TYPE_ONGOING}
              checked={tripType === TRIP_TYPE_ONGOING}
              onChange={() => setTripType(TRIP_TYPE_ONGOING)}
            />
            Uso continuo (sin fechas, solo lugares)
          </label>
        </fieldset>

        <label className={inputs.label}>
          Ciudad / base
          <input name="city" className={inputs.base} placeholder="Ej. Chicago, IL" />
        </label>

        <label className={inputs.label}>
          Zona horaria
          <input
            name="timezone"
            defaultValue="America/Chicago"
            className={inputs.base}
            placeholder="America/Chicago"
          />
        </label>

        {tripType === TRIP_TYPE_SCHEDULED ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={inputs.label}>
              Fecha inicio
              <input type="date" name="start_date" required className={inputs.base} />
            </label>
            <label className={inputs.label}>
              Fecha fin
              <input type="date" name="end_date" className={inputs.base} />
            </label>
          </div>
        ) : null}

        {error ? (
          <ErrorMessage message="No se pudo crear el viaje." technicalDetails={error} />
        ) : null}

        <Button type="submit">Crear viaje</Button>
      </form>
    </Card>
  );
}

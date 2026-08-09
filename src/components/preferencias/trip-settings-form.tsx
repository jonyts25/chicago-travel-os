"use client";

import { FormEvent, useState, useTransition } from "react";
import { updateTripSettingsAction } from "@/app/preferencias/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/itinerary/day-constraints";
import type { TripPlanningSettings } from "@/lib/itinerary/schema";
import { inputs, typography } from "@/lib/ui/styles";

type TripSettingsFormProps = {
  initialSettings: TripPlanningSettings;
};

export function TripSettingsForm({ initialSettings }: TripSettingsFormProps) {
  const { showToast } = useToast();
  const [flightDeparture, setFlightDeparture] = useState(
    toDatetimeLocalValue(initialSettings.flight_departure),
  );
  const [airportTransferMinutes, setAirportTransferMinutes] = useState(
    String(initialSettings.airport_transfer_minutes),
  );
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTechnicalError(null);

    const transferMinutes = Number.parseInt(airportTransferMinutes, 10);
    if (!Number.isFinite(transferMinutes) || transferMinutes < 0) {
      setTechnicalError("Los minutos de traslado al aeropuerto deben ser un número válido.");
      return;
    }

    startTransition(async () => {
      const result = await updateTripSettingsAction(
        fromDatetimeLocalValue(flightDeparture),
        transferMinutes,
      );

      if (!result.ok) {
        setTechnicalError(result.error);
        return;
      }

      showToast("Datos del viaje guardados");
    });
  }

  return (
    <Card
      title="Datos del viaje"
      subtitle="Vuelo de regreso y margen al aeropuerto. El optimizador acorta automáticamente el último día (o el día con la misma fecha del vuelo)."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="flight-departure" className={inputs.label}>
          Vuelo de regreso
          <input
            id="flight-departure"
            type="datetime-local"
            value={flightDeparture}
            onChange={(event) => setFlightDeparture(event.target.value)}
            className={inputs.base}
          />
        </label>
        <p className={typography.muted}>
          Deja vacío si aún no tienes el vuelo. Si no hay fechas en los días, se aplica al día 4.
        </p>

        <label htmlFor="airport-transfer-minutes" className={inputs.label}>
          Minutos al aeropuerto + margen
          <input
            id="airport-transfer-minutes"
            type="number"
            min={0}
            step={5}
            value={airportTransferMinutes}
            onChange={(event) => setAirportTransferMinutes(event.target.value)}
            className={inputs.base}
          />
        </label>
        <p className={typography.muted}>
          Hora límite del día del vuelo = salida del vuelo − estos minutos (salvo override manual).
        </p>

        {technicalError ? (
          <ErrorMessage
            message="No pudimos guardar los datos del viaje."
            technicalDetails={technicalError}
          />
        ) : null}

        <Button type="submit" loading={isPending}>
          Guardar datos del viaje
        </Button>
      </form>
    </Card>
  );
}

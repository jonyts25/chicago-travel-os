"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  extractTravelConfirmationAction,
  updateTripSettingsAction,
} from "@/app/preferencias/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/itinerary/day-constraints";
import type { TripPlanningSettings } from "@/lib/itinerary/schema";
import type { ExtractedTravelConfirmation } from "@/lib/trips/travel-info";
import { fromDateInputValue, toDateInputValue } from "@/lib/trips/trip-calendar";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type TripSettingsFormProps = {
  initialSettings: TripPlanningSettings;
};

type FormState = TripPlanningSettings;

function toFormState(settings: TripPlanningSettings): FormState {
  return { ...settings };
}

export function TripSettingsForm({ initialSettings }: TripSettingsFormProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(() => toFormState(initialSettings));
  const [confirmationText, setConfirmationText] = useState("");
  const [extractSummary, setExtractSummary] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isExtracting, startExtract] = useTransition();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyExtractedData(data: ExtractedTravelConfirmation) {
    setForm((current) => ({
      ...current,
      flight_arrival: data.flight_arrival ?? current.flight_arrival,
      flight_departure: data.flight_departure ?? current.flight_departure,
      flight_outbound_number:
        data.flight_outbound_number ?? current.flight_outbound_number,
      flight_return_number: data.flight_return_number ?? current.flight_return_number,
      hotel_checkin: data.hotel_checkin ?? current.hotel_checkin,
      hotel_checkout: data.hotel_checkout ?? current.hotel_checkout,
      base_location: data.base_location ?? current.base_location,
    }));
    setExtractSummary(data.summary);
  }

  function handleExtract() {
    setTechnicalError(null);
    setExtractSummary(null);

    startExtract(async () => {
      const result = await extractTravelConfirmationAction(confirmationText);
      if (!result.ok) {
        setTechnicalError(result.error);
        return;
      }

      applyExtractedData(result.data);
      showToast("Datos extraídos — revisa los campos antes de guardar");
    });
  }

  function readDatetimeField(formData: FormData, name: string): string | null {
    const raw = formData.get(name);
    if (typeof raw !== "string") {
      return null;
    }

    return fromDatetimeLocalValue(raw);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTechnicalError(null);

    const formData = new FormData(event.currentTarget);
    const transferMinutes = Number.parseInt(
      String(formData.get("airport_transfer_minutes") ?? form.airport_transfer_minutes),
      10,
    );
    if (!Number.isFinite(transferMinutes) || transferMinutes < 0) {
      setTechnicalError("Los minutos de traslado al aeropuerto deben ser un número válido.");
      return;
    }

    const startDateRaw = formData.get("start_date");
    const start_date =
      typeof startDateRaw === "string"
        ? fromDateInputValue(startDateRaw)
        : form.start_date;

    startSave(async () => {
      const result = await updateTripSettingsAction({
        start_date,
        flight_arrival: readDatetimeField(formData, "flight_arrival"),
        flight_departure: readDatetimeField(formData, "flight_departure"),
        flight_outbound_number:
          String(formData.get("flight_outbound_number") ?? "").trim() || null,
        flight_return_number:
          String(formData.get("flight_return_number") ?? "").trim() || null,
        hotel_checkin: readDatetimeField(formData, "hotel_checkin"),
        hotel_checkout: readDatetimeField(formData, "hotel_checkout"),
        base_location: String(formData.get("base_location") ?? "").trim() || null,
        airport_transfer_minutes: transferMinutes,
      });

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
      subtitle="Vuelos, hotel y margen al aeropuerto. Puedes capturar a mano o pegar una confirmación para que la IA proponga valores (siempre revisa antes de guardar)."
    >
      <div className={cn(surfaces.inset, "mb-6 flex flex-col gap-4 p-4")}>
        <div>
          <p className={typography.sectionTitle}>Extracción asistida por IA</p>
          <p className={typography.secondary}>
            Pega el texto de un correo de confirmación de vuelo u hotel. Los campos del
            formulario se rellenarán para que los revises — no se guardan automáticamente.
          </p>
        </div>

        <label htmlFor="confirmation-text" className={inputs.label}>
          Texto de confirmación
          <textarea
            id="confirmation-text"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            rows={6}
            placeholder={"Ej.\nYour flight UA 456 arrives in Chicago (ORD) on Aug 10, 2026 at 2:35 PM..."}
            className={inputs.base}
          />
        </label>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={isExtracting || !confirmationText.trim()}
            loading={isExtracting}
            onClick={handleExtract}
          >
            Extraer datos
          </Button>
        </div>

        {extractSummary ? (
          <p className={cn(typography.body, "text-blue-200")}>{extractSummary}</p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <h3 className={typography.sectionTitle}>Calendario</h3>

          <label htmlFor="trip-start-date" className={inputs.label}>
            Fecha de inicio del viaje (Día 1)
            <input
              id="trip-start-date"
              name="start_date"
              type="date"
              value={toDateInputValue(form.start_date)}
              onChange={(event) =>
                updateField("start_date", fromDateInputValue(event.target.value))
              }
              className={inputs.base}
            />
          </label>
          <p className={typography.muted}>
            Define el calendario de los 4 días en /planificar. Si está vacío, se usa check-in o
            llegada del vuelo como respaldo.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className={typography.sectionTitle}>Vuelos</h3>

          <label htmlFor="flight-arrival" className={inputs.label}>
            Llegada a Chicago (ida)
            <input
              id="flight-arrival"
              name="flight_arrival"
              type="datetime-local"
              value={toDatetimeLocalValue(form.flight_arrival)}
              onChange={(event) =>
                updateField("flight_arrival", fromDatetimeLocalValue(event.target.value))
              }
              className={inputs.base}
            />
          </label>

          <label htmlFor="flight-outbound-number" className={inputs.label}>
            Número de vuelo de ida
            <input
              id="flight-outbound-number"
              name="flight_outbound_number"
              type="text"
              value={form.flight_outbound_number ?? ""}
              onChange={(event) => updateField("flight_outbound_number", event.target.value)}
              placeholder="Ej. UA 456"
              className={inputs.base}
            />
          </label>

          <label htmlFor="flight-departure" className={inputs.label}>
            Salida de Chicago (vuelta)
            <input
              id="flight-departure"
              name="flight_departure"
              type="datetime-local"
              value={toDatetimeLocalValue(form.flight_departure)}
              onChange={(event) =>
                updateField("flight_departure", fromDatetimeLocalValue(event.target.value))
              }
              className={inputs.base}
            />
          </label>

          <label htmlFor="flight-return-number" className={inputs.label}>
            Número de vuelo de regreso
            <input
              id="flight-return-number"
              name="flight_return_number"
              type="text"
              value={form.flight_return_number ?? ""}
              onChange={(event) => updateField("flight_return_number", event.target.value)}
              placeholder="Ej. UA 789"
              className={inputs.base}
            />
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className={typography.sectionTitle}>Hotel</h3>

          <label htmlFor="hotel-checkin" className={inputs.label}>
            Check-in
            <input
              id="hotel-checkin"
              name="hotel_checkin"
              type="datetime-local"
              value={toDatetimeLocalValue(form.hotel_checkin)}
              onChange={(event) =>
                updateField("hotel_checkin", fromDatetimeLocalValue(event.target.value))
              }
              className={inputs.base}
            />
          </label>

          <label htmlFor="hotel-checkout" className={inputs.label}>
            Check-out
            <input
              id="hotel-checkout"
              name="hotel_checkout"
              type="datetime-local"
              value={toDatetimeLocalValue(form.hotel_checkout)}
              onChange={(event) =>
                updateField("hotel_checkout", fromDatetimeLocalValue(event.target.value))
              }
              className={inputs.base}
            />
          </label>

          <label htmlFor="base-location" className={inputs.label}>
            Dirección del hotel / base
            <input
              id="base-location"
              name="base_location"
              type="text"
              value={form.base_location ?? ""}
              onChange={(event) => updateField("base_location", event.target.value)}
              placeholder="Ej. 71 E Wacker Dr, Chicago, IL"
              className={inputs.base}
            />
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className={typography.sectionTitle}>Optimizador</h3>

          <label htmlFor="airport-transfer-minutes" className={inputs.label}>
            Minutos al aeropuerto + margen
            <input
              id="airport-transfer-minutes"
              name="airport_transfer_minutes"
              type="number"
              min={0}
              step={5}
              value={form.airport_transfer_minutes}
              onChange={(event) =>
                updateField("airport_transfer_minutes", Number.parseInt(event.target.value, 10) || 0)
              }
              className={inputs.base}
            />
          </label>
          <p className={typography.muted}>
            Hora límite del día del vuelo = salida − estos minutos. Día 1 usa llegada + 2 h como
            inicio si capturas el vuelo de ida.
          </p>
        </section>

        {technicalError ? (
          <ErrorMessage
            message="No se pudieron guardar los datos del viaje."
            technicalDetails={technicalError}
          />
        ) : null}

        <Button type="submit" loading={isSaving}>
          Guardar datos del viaje
        </Button>
      </form>
    </Card>
  );
}

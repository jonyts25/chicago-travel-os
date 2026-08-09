import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  formatTripDateTime,
  formatTripTimeFromIso,
  hasAnyTripTravelInfo,
  type TripTravelSettings,
} from "@/lib/trips/travel-info";
import { typography } from "@/lib/ui/styles";

type TripInfoSummaryProps = {
  settings: TripTravelSettings;
  showEditLink?: boolean;
  compact?: boolean;
};

export function TripInfoSummary({
  settings,
  showEditLink = true,
  compact = false,
}: TripInfoSummaryProps) {
  if (!hasAnyTripTravelInfo(settings)) {
    return (
      <Card title="Datos del viaje">
        <p className={typography.secondary}>
          Aún no hay vuelos ni hotel capturados.
        </p>
        {showEditLink ? (
          <Link href="/preferencias" className={`${typography.body} mt-3 inline-block text-blue-400 underline`}>
            Capturar en Ajustes
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card title="Datos del viaje">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {settings.flight_arrival ? (
          <InfoRow
            label="Llegada (ida)"
            value={formatFlightLine(
              settings.flight_outbound_number,
              settings.flight_arrival,
              settings.timezone,
              compact,
            )}
          />
        ) : null}

        {settings.flight_departure ? (
          <InfoRow
            label="Salida (vuelta)"
            value={formatFlightLine(
              settings.flight_return_number,
              settings.flight_departure,
              settings.timezone,
              compact,
            )}
          />
        ) : null}

        {settings.hotel_checkin ? (
          <InfoRow
            label="Check-in hotel"
            value={formatTripDateTime(settings.hotel_checkin, settings.timezone) ?? "—"}
          />
        ) : null}

        {settings.hotel_checkout ? (
          <InfoRow
            label="Check-out hotel"
            value={formatTripDateTime(settings.hotel_checkout, settings.timezone) ?? "—"}
          />
        ) : null}

        {settings.base_location ? (
          <InfoRow
            label="Hotel / base"
            value={settings.base_location}
            className="sm:col-span-2"
          />
        ) : null}
      </dl>

      {showEditLink ? (
        <Link href="/preferencias" className={`${typography.muted} mt-4 inline-block underline`}>
          Editar en Ajustes
        </Link>
      ) : null}
    </Card>
  );
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className={typography.secondary}>{label}</dt>
      <dd className={`${typography.body} mt-1 font-medium text-white`}>{value}</dd>
    </div>
  );
}

function formatFlightLine(
  flightNumber: string | null,
  iso: string,
  timezone: string,
  compact: boolean,
): string {
  const time = compact
    ? formatTripTimeFromIso(iso, timezone)
    : formatTripDateTime(iso, timezone);
  const number = flightNumber?.trim();

  if (number && time) {
    return `Vuelo ${number} · ${time}`;
  }

  return time ?? "—";
}

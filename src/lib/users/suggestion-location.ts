import {
  TRIP_TYPE_ONGOING,
  type TripType,
} from "@/lib/trips/types";
import type { SuggestionContext } from "@/lib/users/schema";

export type SuggestionLocationParts = {
  destination: string;
  promptLocationLine: string;
  summaryLabel: "zona" | "hotel/base";
  summaryValue: string;
};

function formatCenterCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function buildSuggestionLocationParts(
  context: SuggestionContext,
): SuggestionLocationParts {
  const tripLabel = context.tripName.trim() || "el viaje activo";
  const hasCenter =
    context.centerLat != null &&
    context.centerLng != null &&
    Number.isFinite(context.centerLat) &&
    Number.isFinite(context.centerLng);

  if (context.tripType === TRIP_TYPE_ONGOING) {
    const destination = context.baseLocation?.trim() || tripLabel;
    const centerText = hasCenter
      ? formatCenterCoordinates(context.centerLat!, context.centerLng!)
      : null;

    return {
      destination,
      promptLocationLine: centerText
        ? `Zona de referencia (donde vivimos): ${destination} · centro ~${centerText}`
        : `Zona de referencia (donde vivimos): ${destination}`,
      summaryLabel: "zona",
      summaryValue: centerText
        ? `${destination} (centro ${centerText})`
        : destination,
    };
  }

  const destination = context.baseLocation?.trim() || tripLabel;

  return {
    destination,
    promptLocationLine: `Hotel / base del viaje: ${context.baseLocation || "(no indicado todavía)"}`,
    summaryLabel: "hotel/base",
    summaryValue: context.baseLocation?.trim() || "sin indicar",
  };
}

export function isOngoingSuggestionContext(tripType: TripType): boolean {
  return tripType === TRIP_TYPE_ONGOING;
}

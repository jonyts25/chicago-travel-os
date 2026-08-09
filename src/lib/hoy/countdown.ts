import { formatScheduleTime, parseTimeToMinutes } from "@/lib/itinerary/schedule-day";

export function getCountdownLabel(startTime: string | null, now: Date = new Date()): string {
  if (!startTime) {
    return "Sin hora estimada";
  }

  const targetMinutes = parseTimeToMinutes(startTime);
  if (targetMinutes == null) {
    return formatScheduleTime(startTime);
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = targetMinutes - nowMinutes;

  if (diffMinutes <= 0 && diffMinutes >= -15) {
    return "Ahora";
  }

  if (diffMinutes < -15) {
    return `Pasó hace ${Math.abs(diffMinutes)} min`;
  }

  if (diffMinutes <= 60) {
    return `En ${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes > 0 ? `En ${hours} h ${minutes} min` : `En ${hours} h`;
}

export function buildMapsNavigationUrl(place: {
  name: string;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
}): string {
  if (place.maps_url?.trim()) {
    return place.maps_url.trim();
  }

  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Chicago, IL`)}`;
}

export function buildAlternativesMapUrl(place: {
  lat: number | null;
  lng: number | null;
}): string {
  if (place.lat != null && place.lng != null) {
    return `/map?pool=unplanned&nearLat=${place.lat}&nearLng=${place.lng}`;
  }

  return "/map?pool=unplanned";
}

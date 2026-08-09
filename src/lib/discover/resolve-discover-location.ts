import {
  hasTripGeocodingCenter,
  type TripGeocodingContext,
} from "@/lib/geocoding/trip-geocoding-context";
import { getDistanceMeters } from "@/lib/hoy/geo-distance";

export type DiscoverLocationSource = "device" | "trip_center";

export function resolveDiscoverSearchCoordinates(
  input: { lat: number; lng: number },
  tripGeo: TripGeocodingContext,
): { lat: number; lng: number; source: DiscoverLocationSource } {
  if (!hasTripGeocodingCenter(tripGeo)) {
    return { lat: input.lat, lng: input.lng, source: "device" };
  }

  const distanceMeters = getDistanceMeters(
    input.lat,
    input.lng,
    tripGeo.center_lat,
    tripGeo.center_lng,
  );

  const maxDistanceMeters = Math.max(100_000, tripGeo.search_radius_km * 1000 * 3);

  if (distanceMeters > maxDistanceMeters) {
    return {
      lat: tripGeo.center_lat,
      lng: tripGeo.center_lng,
      source: "trip_center",
    };
  }

  return { lat: input.lat, lng: input.lng, source: "device" };
}

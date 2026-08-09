"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARRIVAL_RADIUS_METERS,
  getDistanceMeters,
  isWithinRadiusMeters,
} from "@/lib/hoy/geo-distance";
import { getSimulatedCoordinates, type GeoCoordinates } from "@/lib/hoy/geo-simulation";

export type GeolocationPermissionState =
  | "unsupported"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

type UseArrivalGeolocationOptions = {
  targetLat: number | null;
  targetLng: number | null;
  enabled?: boolean;
  radiusMeters?: number;
};

type UseArrivalGeolocationResult = {
  permission: GeolocationPermissionState;
  position: GeoCoordinates | null;
  distanceMeters: number | null;
  isNearby: boolean;
  isSimulated: boolean;
  errorMessage: string | null;
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 20_000,
};

export function useArrivalGeolocation({
  targetLat,
  targetLng,
  enabled = true,
  radiusMeters = ARRIVAL_RADIUS_METERS,
}: UseArrivalGeolocationOptions): UseArrivalGeolocationResult {
  const [permission, setPermission] = useState<GeolocationPermissionState>("requesting");
  const [position, setPosition] = useState<GeoCoordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const hasTarget = targetLat != null && targetLng != null;
  const shouldTrack = enabled && hasTarget;

  useEffect(() => {
    if (!shouldTrack) {
      setPermission("unavailable");
      setPosition(null);
      setErrorMessage(null);
      setIsSimulated(false);
      return;
    }

    const simulated = getSimulatedCoordinates();
    if (simulated) {
      setIsSimulated(true);
      setPermission("granted");
      setPosition(simulated);
      setErrorMessage(null);
      return;
    }

    setIsSimulated(false);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      setPosition(null);
      setErrorMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    setPermission("requesting");
    setErrorMessage(null);

    const handlePosition = (coords: GeolocationCoordinates) => {
      setPermission("granted");
      setPosition({ lat: coords.latitude, lng: coords.longitude });
      setErrorMessage(null);
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setPermission("denied");
        setPosition(null);
        setErrorMessage(null);
        return;
      }

      setPermission("granted");
      setErrorMessage(
        error.code === error.TIMEOUT
          ? "No se pudo obtener ubicación a tiempo."
          : "No se pudo leer tu ubicación.",
      );
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (result) => handlePosition(result.coords),
      handleError,
      WATCH_OPTIONS,
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [shouldTrack, targetLat, targetLng]);

  const distanceMeters =
    position && targetLat != null && targetLng != null
      ? Math.round(getDistanceMeters(position.lat, position.lng, targetLat, targetLng))
      : null;

  const isNearby =
    position != null &&
    targetLat != null &&
    targetLng != null &&
    isWithinRadiusMeters(position.lat, position.lng, targetLat, targetLng, radiusMeters);

  return {
    permission,
    position,
    distanceMeters,
    isNearby,
    isSimulated,
    errorMessage,
  };
}

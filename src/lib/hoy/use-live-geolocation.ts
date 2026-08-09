"use client";

import { useEffect, useRef, useState } from "react";
import { getSimulatedCoordinates, type GeoCoordinates } from "@/lib/hoy/geo-simulation";

export type GeolocationPermissionState =
  | "unsupported"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

type UseLiveGeolocationOptions = {
  enabled?: boolean;
};

type UseLiveGeolocationResult = {
  permission: GeolocationPermissionState;
  position: GeoCoordinates | null;
  isSimulated: boolean;
  errorMessage: string | null;
  requestPermission: () => void;
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 20_000,
};

export function useLiveGeolocation({
  enabled = true,
}: UseLiveGeolocationOptions = {}): UseLiveGeolocationResult {
  const [permission, setPermission] = useState<GeolocationPermissionState>("requesting");
  const [position, setPosition] = useState<GeoCoordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [watchRequested, setWatchRequested] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  function requestPermission() {
    setWatchRequested(true);
  }

  useEffect(() => {
    if (!enabled) {
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
      setWatchRequested(true);
      return;
    }

    setIsSimulated(false);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      setPosition(null);
      setErrorMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    if (!watchRequested) {
      setPermission("requesting");
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
  }, [enabled, watchRequested]);

  return {
    permission,
    position,
    isSimulated,
    errorMessage,
    requestPermission,
  };
}

export function formatDistanceMeters(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters} m`;
  }

  const km = distanceMeters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSimulatedCoordinates,
  getUrlSimulatedCoordinates,
  type GeoCoordinates,
} from "@/lib/hoy/geo-simulation";

export type GeolocationPermissionState =
  | "unsupported"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

export type LocationSource = "live" | "simulated" | "trip_center";

type UseLiveGeolocationOptions = {
  enabled?: boolean;
  /** Trip center used when live geolocation is unavailable or denied. */
  fallbackCenter?: GeoCoordinates | null;
  /** When false, ignore global localStorage geo sim (prevents Chicago coords leaking across trips). */
  includeStoredSimulation?: boolean;
};

type UseLiveGeolocationResult = {
  permission: GeolocationPermissionState;
  position: GeoCoordinates | null;
  locationSource: LocationSource | null;
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
  fallbackCenter = null,
  includeStoredSimulation = true,
}: UseLiveGeolocationOptions = {}): UseLiveGeolocationResult {
  const [permission, setPermission] = useState<GeolocationPermissionState>("requesting");
  const [position, setPosition] = useState<GeoCoordinates | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [watchRequested, setWatchRequested] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const gotLivePositionRef = useRef(false);

  function applyFallbackCenter() {
    if (!fallbackCenter) {
      return false;
    }

    setPosition(fallbackCenter);
    setLocationSource("trip_center");
    setIsSimulated(false);
    setPermission("granted");
    setErrorMessage(null);
    return true;
  }

  function requestPermission() {
    setWatchRequested(true);
  }

  useEffect(() => {
    if (!enabled) {
      setPermission("unavailable");
      setPosition(null);
      setLocationSource(null);
      setErrorMessage(null);
      setIsSimulated(false);
      return;
    }

    const urlSimulated = getUrlSimulatedCoordinates();
    if (urlSimulated) {
      setIsSimulated(true);
      setPermission("granted");
      setPosition(urlSimulated);
      setLocationSource("simulated");
      setErrorMessage(null);
      setWatchRequested(true);
      return;
    }

    const storedSimulated = getSimulatedCoordinates({ includeStored: includeStoredSimulation });
    if (storedSimulated) {
      setIsSimulated(true);
      setPermission("granted");
      setPosition(storedSimulated);
      setLocationSource("simulated");
      setErrorMessage(null);
      setWatchRequested(true);
      return;
    }

    setIsSimulated(false);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      if (!applyFallbackCenter()) {
        setPosition(null);
        setLocationSource(null);
        setErrorMessage("Tu navegador no soporta geolocalización.");
      }
      return;
    }

    if (!watchRequested) {
      setPermission("requesting");
      return;
    }

    setPermission("requesting");
    setErrorMessage(null);
    gotLivePositionRef.current = false;

    const handlePosition = (coords: GeolocationCoordinates) => {
      gotLivePositionRef.current = true;
      setPermission("granted");
      setPosition({ lat: coords.latitude, lng: coords.longitude });
      setLocationSource("live");
      setErrorMessage(null);
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        if (applyFallbackCenter()) {
          return;
        }

        setPermission("denied");
        setPosition(null);
        setLocationSource(null);
        setErrorMessage(null);
        return;
      }

      if (applyFallbackCenter()) {
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

    const fallbackTimer = window.setTimeout(() => {
      if (!gotLivePositionRef.current) {
        applyFallbackCenter();
      }
    }, 5_000);

    return () => {
      window.clearTimeout(fallbackTimer);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, watchRequested, fallbackCenter, includeStoredSimulation]);

  return {
    permission,
    position,
    locationSource,
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

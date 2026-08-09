"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TripType } from "@/lib/trips/types";

export type TripNavigationContextValue = {
  tripId: string;
  tripName: string;
  tripType: TripType;
};

const TripNavigationContext = createContext<TripNavigationContextValue | null>(null);

export function TripNavigationProvider({
  value,
  children,
}: {
  value: TripNavigationContextValue;
  children: ReactNode;
}) {
  return (
    <TripNavigationContext.Provider value={value}>{children}</TripNavigationContext.Provider>
  );
}

export function useTripNavigation(): TripNavigationContextValue {
  const value = useContext(TripNavigationContext);
  if (!value) {
    throw new Error("useTripNavigation must be used within TripNavigationProvider");
  }
  return value;
}

export function useOptionalTripNavigation(): TripNavigationContextValue | null {
  return useContext(TripNavigationContext);
}

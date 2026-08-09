"use client";

import Link from "next/link";
import { useTripNavigation } from "@/components/layout/trip-navigation-context";
import { cn, typography } from "@/lib/ui/styles";

export function TripHeader() {
  const { tripName } = useTripNavigation();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
        <Link
          href="/"
          className={cn(
            typography.body,
            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-slate-100 transition hover:bg-slate-900",
          )}
        >
          <span aria-hidden>📍</span>
          <span className="font-medium">{tripName}</span>
          <span className={cn(typography.muted, "text-xs")}>Cambiar viaje</span>
        </Link>
      </div>
    </header>
  );
}

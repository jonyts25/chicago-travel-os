"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import type { PlaceMapMarker } from "@/lib/places/schema";

const TripMap = dynamic(
  () => import("@/components/map/trip-map").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">Cargando mapa…</p>
      </div>
    ),
  },
);

type TripMapLoaderProps = {
  places: PlaceMapMarker[];
  initialCenter?: [number, number];
  initialZoom?: number;
};

export function TripMapLoader({ places, initialCenter, initialZoom }: TripMapLoaderProps) {
  return <TripMap places={places} initialCenter={initialCenter} initialZoom={initialZoom} />;
}

"use client";

import dynamic from "next/dynamic";
import type { PlaceMapMarker } from "@/lib/places/schema";

const TripMap = dynamic(
  () => import("@/components/map/trip-map").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80">
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

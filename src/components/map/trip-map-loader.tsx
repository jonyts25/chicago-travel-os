"use client";

import dynamic from "next/dynamic";
import type { MapPlace } from "@/lib/places/types";

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
  places: MapPlace[];
};

export function TripMapLoader({ places }: TripMapLoaderProps) {
  return <TripMap places={places} />;
}

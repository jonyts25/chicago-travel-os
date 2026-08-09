"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { PlaceMapMarker } from "@/lib/places/schema";

const CHICAGO_CENTER: [number, number] = [41.8781, -87.6298];
const DEFAULT_ZOOM = 12;

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const placeMarkerIcon = L.divIcon({
  className: "trip-map-marker",
  html: '<span class="trip-map-marker-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

type TripMapProps = {
  places: PlaceMapMarker[];
  initialCenter?: [number, number];
  initialZoom?: number;
};

export function TripMap({ places, initialCenter, initialZoom }: TripMapProps) {
  const mapCenter = initialCenter ?? CHICAGO_CENTER;
  const mapZoom = initialZoom ?? DEFAULT_ZOOM;

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
      style={{ minHeight: "420px" }}
    >
      <TileLayer attribution={OSM_ATTRIBUTION} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitMapToPlaces places={places} initialCenter={initialCenter} initialZoom={initialZoom} />
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]} icon={placeMarkerIcon}>
          <Popup>
            <div className="space-y-1 text-sm text-slate-900">
              <p className="font-semibold">{place.name}</p>
              {place.category ? (
                <p className="text-slate-600">{place.category}</p>
              ) : null}
              {place.address ? (
                <p className="text-xs text-slate-500">{place.address}</p>
              ) : null}
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {place.status}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function FitMapToPlaces({
  places,
  initialCenter,
  initialZoom,
}: {
  places: PlaceMapMarker[];
  initialCenter?: [number, number];
  initialZoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (initialCenter) {
      map.setView(initialCenter, initialZoom ?? 14);
      return;
    }

    if (places.length === 0) {
      map.setView(CHICAGO_CENTER, DEFAULT_ZOOM);
      return;
    }

    if (places.length === 1) {
      map.setView([places[0].lat, places[0].lng], 14);
      return;
    }

    const bounds = L.latLngBounds(
      places.map((place) => [place.lat, place.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, places, initialCenter, initialZoom]);

  return null;
}

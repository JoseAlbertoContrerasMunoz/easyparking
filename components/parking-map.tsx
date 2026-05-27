"use client";

import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  parkingSizeLabels,
  parkingStatusLabels,
  type ParkingLot,
  type ParkingStatus,
} from "@/lib/parking";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ParkingMapProps = {
  center: Coordinates;
  userLocation: Coordinates | null;
  selectedLocation: Coordinates | null;
  parkingLots: ParkingLot[];
  onPickLocation: (coords: Coordinates) => void;
};

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `
      <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:${color};box-shadow:0 0 0 6px color-mix(in srgb, ${color} 18%, transparent);border:2px solid white"></span>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapInteraction({ onPickLocation }: { onPickLocation: (coords: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onPickLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });

  return null;
}

function MapFollow({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.latitude, center.longitude], Math.max(map.getZoom(), 14), {
      animate: true,
    });
  }, [center.latitude, center.longitude, map]);

  return null;
}

function parkingStatusColor(status: ParkingStatus) {
  switch (status) {
    case "empty":
      return "#047857";
    case "half_full":
      return "#d97706";
    case "full":
      return "#e11d48";
  }
}

export function ParkingMap({
  center,
  userLocation,
  selectedLocation,
  parkingLots,
  onPickLocation,
}: ParkingMapProps) {
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={14} scrollWheelZoom className="h-full min-h-[420px]">
      <MapFollow center={center} />
      <MapInteraction onPickLocation={onPickLocation} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation ? (
        <>
          <CircleMarker
            center={[userLocation.latitude, userLocation.longitude]}
            radius={16}
            pathOptions={{ color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.16 }}
          />
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createMarkerIcon("#0f766e")}
          >
            <Popup>Tu ubicación actual</Popup>
          </Marker>
        </>
      ) : null}

      {selectedLocation ? (
        <Marker
          position={[selectedLocation.latitude, selectedLocation.longitude]}
          icon={createMarkerIcon("#f59e0b")}
        >
          <Popup>Punto seleccionado para crear un estacionamiento</Popup>
        </Marker>
      ) : null}

      {parkingLots.map((lot) => (
        <Marker
          key={lot.id}
          position={[lot.latitude, lot.longitude]}
          icon={createMarkerIcon(parkingStatusColor(lot.status))}
        >
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{lot.name}</div>
              <div className="text-sm text-slate-600">{lot.address}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {parkingSizeLabels[lot.size]} · {parkingStatusLabels[lot.status]}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
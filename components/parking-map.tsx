"use client";

import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  formatMoney,
  formatNullableNumber,
  parkingSizeLabels,
  parkingReportLabels,
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
  parkingLots: ParkingLot[];
  isPickingLocation: boolean;
  focusTarget: Coordinates | null;
  focusVersion: number;
  onPickLocation: (coords: Coordinates) => void;
};

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `
      <span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};box-shadow:0 0 0 7px color-mix(in srgb, ${color} 20%, transparent),0 12px 28px rgba(15,23,42,.25);border:3px solid white"></span>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function MapInteraction({
  isPickingLocation,
  onPickLocation,
}: {
  isPickingLocation: boolean;
  onPickLocation: (coords: Coordinates) => void;
}) {
  const map = useMapEvents({
    click(event) {
      if (!isPickingLocation) {
        return;
      }

      map.panTo(event.latlng, { animate: true });
    },
    moveend() {
      if (!isPickingLocation) {
        return;
      }

      const center = map.getCenter();
      onPickLocation({ latitude: center.lat, longitude: center.lng });
    },
  });

  useEffect(() => {
    if (!isPickingLocation) {
      return;
    }

    const center = map.getCenter();
    onPickLocation({ latitude: center.lat, longitude: center.lng });
  }, [isPickingLocation, map, onPickLocation]);

  return null;
}

function MapFocus({
  focusTarget,
  focusVersion,
}: {
  focusTarget: Coordinates | null;
  focusVersion: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget || focusVersion === 0) {
      return;
    }

    map.flyTo([focusTarget.latitude, focusTarget.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.7,
    });
  }, [focusTarget, focusVersion, map]);

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
  parkingLots,
  isPickingLocation,
  focusTarget,
  focusVersion,
  onPickLocation,
}: ParkingMapProps) {
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={14} scrollWheelZoom className="h-full min-h-[420px]">
      <MapFocus focusTarget={focusTarget} focusVersion={focusVersion} />
      <MapInteraction isPickingLocation={isPickingLocation} onPickLocation={onPickLocation} />
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
              <div className="text-xs text-slate-500">
                {lot.zoneName ? `Sector ${lot.zoneName} · ` : ""}
                {formatMoney(lot.pricePerHour)} · {formatNullableNumber(lot.estimatedWaitMinutes, " min espera")}
              </div>
              {lot.lastReportType ? (
                <div className="text-xs font-medium text-slate-700">
                  Último reporte: {parkingReportLabels[lot.lastReportType]}
                </div>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

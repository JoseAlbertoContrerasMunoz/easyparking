export type ParkingSize = "small" | "medium" | "large";
export type ParkingStatus = "empty" | "half_full" | "full";

export type ParkingLot = {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  size: ParkingSize;
  status: ParkingStatus;
  updatedAt: string;
  distanceLabel?: string;
};

export type ParkingLotRow = {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  size: ParkingSize;
  current_status: ParkingStatus;
  last_report_at: string | null;
  created_at: string;
  updated_at: string;
};

export const parkingSizeLabels: Record<ParkingSize, string> = {
  small: "Chico",
  medium: "Mediano",
  large: "Grande",
};

export const parkingStatusLabels: Record<ParkingStatus, string> = {
  empty: "Vacío",
  half_full: "Medio lleno",
  full: "Muy lleno",
};

export const parkingStatusTone: Record<ParkingStatus, string> = {
  empty: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  half_full: "bg-amber-100 text-amber-900 ring-amber-200",
  full: "bg-rose-100 text-rose-900 ring-rose-200",
};

export const parkingSizeTone: Record<ParkingSize, string> = {
  small: "bg-slate-100 text-slate-900 ring-slate-200",
  medium: "bg-cyan-100 text-cyan-900 ring-cyan-200",
  large: "bg-violet-100 text-violet-900 ring-violet-200",
};

export function toParkingLot(row: ParkingLotRow): ParkingLot {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    size: row.size,
    status: row.current_status,
    updatedAt: row.last_report_at ?? row.updated_at,
  };
}

export function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
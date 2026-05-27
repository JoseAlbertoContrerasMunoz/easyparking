export type ParkingSize = "small" | "medium" | "large";
export type ParkingStatus = "empty" | "half_full" | "full";
export type ParkingReportType = "left_spot" | "spots_available" | "few_spots" | "long_line" | "closed";

export type UserReputation = {
  points: number;
  reportsCount: number;
  reputationLabel: string;
};

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
  lastReportAt: string | null;
  lastReportType: ParkingReportType | null;
  zoneName: string | null;
  pricePerHour: number | null;
  hoursText: string | null;
  isCovered: boolean | null;
  hasCameras: boolean | null;
  hasGuard: boolean | null;
  is24Hours: boolean | null;
  securityScore: number | null;
  rating: number | null;
  walkingLandmark: string | null;
  walkingMinutes: number | null;
  peakHoursText: string | null;
  bestTimeText: string | null;
  estimatedWaitMinutes: number | null;
  reportsCount: number;
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
  last_report_type: ParkingReportType | null;
  zone_name: string | null;
  price_per_hour: number | string | null;
  hours_text: string | null;
  is_covered: boolean | null;
  has_cameras: boolean | null;
  has_guard: boolean | null;
  is_24_hours: boolean | null;
  security_score: number | null;
  rating: number | string | null;
  walking_landmark: string | null;
  walking_minutes: number | null;
  peak_hours_text: string | null;
  best_time_text: string | null;
  estimated_wait_minutes: number | null;
  reports_count: number | null;
  created_at: string;
  updated_at: string;
};

export const parkingSizeLabels: Record<ParkingSize, string> = {
  small: "Chico",
  medium: "Mediano",
  large: "Grande",
};

export const parkingStatusLabels: Record<ParkingStatus, string> = {
  empty: "Alta probabilidad",
  half_full: "Pocos lugares",
  full: "Saturado ahorita",
};

export const parkingStatusTone: Record<ParkingStatus, string> = {
  empty: "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-300/30",
  half_full: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-100 dark:ring-amber-300/30",
  full: "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-300/30",
};

export const parkingSizeTone: Record<ParkingSize, string> = {
  small: "bg-slate-100 text-slate-900 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-100 dark:ring-slate-300/20",
  medium: "bg-cyan-100 text-cyan-900 ring-cyan-200 dark:bg-cyan-400/15 dark:text-cyan-100 dark:ring-cyan-300/30",
  large: "bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-400/15 dark:text-violet-100 dark:ring-violet-300/30",
};

export const parkingReportLabels: Record<ParkingReportType, string> = {
  left_spot: "Acabo de salir",
  spots_available: "Sí hay lugares",
  few_spots: "Quedan pocos",
  long_line: "Fila larga",
  closed: "Cerrado",
};

export const parkingReportStatus: Record<ParkingReportType, ParkingStatus> = {
  left_spot: "empty",
  spots_available: "empty",
  few_spots: "half_full",
  long_line: "full",
  closed: "full",
};

export function toParkingLot(row: ParkingLotRow): ParkingLot {
  const lastReportAt = row.last_report_at ?? null;

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    size: row.size,
    status: row.current_status,
    updatedAt: lastReportAt ?? row.updated_at,
    lastReportAt,
    lastReportType: row.last_report_type,
    zoneName: cleanOptionalText(row.zone_name),
    pricePerHour: toNullableNumber(row.price_per_hour),
    hoursText: cleanOptionalText(row.hours_text),
    isCovered: row.is_covered,
    hasCameras: row.has_cameras,
    hasGuard: row.has_guard,
    is24Hours: row.is_24_hours,
    securityScore: row.security_score,
    rating: toNullableNumber(row.rating),
    walkingLandmark: cleanOptionalText(row.walking_landmark),
    walkingMinutes: row.walking_minutes,
    peakHoursText: cleanOptionalText(row.peak_hours_text),
    bestTimeText: cleanOptionalText(row.best_time_text),
    estimatedWaitMinutes: row.estimated_wait_minutes,
    reportsCount: Number(row.reports_count ?? 0),
  };
}

export function normalizeStreetName(value: string | null | undefined) {
  const withoutPrefix = (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\b(calle|callejon|av|avenida|blvd|boulevard|calz|calzada|priv|privada|prol|prolongacion)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutPrefix.length < 3) {
    return null;
  }

  return toTitleCase(withoutPrefix);
}

export function getSectorName(road: string | null | undefined) {
  return normalizeStreetName(road);
}

export function formatMoney(value: number | null) {
  if (value === null) {
    return "Sin dato";
  }

  return `$${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}/h`;
}

export function formatNullableNumber(value: number | null, suffix = "") {
  return value === null ? "Sin dato" : `${value}${suffix}`;
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

export function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Sin reportes";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (diffMinutes < 1) {
    return "Ahora";
  }

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `Hace ${diffHours} h`;
}

export function getParkingPrediction(lot: ParkingLot) {
  if (!lot.reportsCount && !lot.estimatedWaitMinutes) {
    return "Aún sin historial suficiente";
  }

  if (lot.status === "full" && lot.estimatedWaitMinutes !== null && lot.estimatedWaitMinutes >= 18) {
    return "No se recomienda venir ahorita";
  }

  if (lot.status === "full") {
    return lot.estimatedWaitMinutes === null
      ? "Saturado según el último reporte"
      : `En aprox. ${lot.estimatedWaitMinutes} min suele liberarse espacio`;
  }

  if (lot.status === "half_full") {
    return "Movimiento rápido, conviene llegar pronto";
  }

  return "Buen momento para estacionarse";
}

function cleanOptionalText(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function toNullableNumber(value: number | string | null) {
  if (value === null) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("es-MX") + part.slice(1))
    .join(" ");
}

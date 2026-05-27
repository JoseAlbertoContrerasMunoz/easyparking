"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatMoney,
  formatNullableNumber,
  formatRelativeTime,
  getParkingPrediction,
  getSectorName,
  parkingReportLabels,
  parkingReportStatus,
  parkingSizeLabels,
  parkingSizeTone,
  parkingStatusLabels,
  parkingStatusTone,
  toParkingLot,
  type ParkingLot,
  type ParkingLotRow,
  type ParkingReportType,
  type ParkingSize,
  type ParkingStatus,
  type UserReputation,
} from "@/lib/parking";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type FilterMode = "all" | "cheap" | "near" | "covered" | "open" | "secure";
type SelectedSector = "Todos" | string;

type ParkingDetails = {
  name: string;
  pricePerHour: string;
  hoursText: string;
  isCovered: boolean;
  hasCameras: boolean;
  hasGuard: boolean;
  is24Hours: boolean;
  securityScore: string;
  rating: string;
  estimatedWaitMinutes: string;
  peakHoursText: string;
  bestTimeText: string;
};

type GeocodedAddress = {
  displayName: string | null;
  address: string | null;
  road: string | null;
  neighbourhood: string | null;
  city: string | null;
};

type EasyParkingAppProps = {
  currentUserId: string;
  currentUserEmail: string;
  currentUserReputation: UserReputation;
  initialParkingLots: ParkingLot[];
};

const ParkingMap = dynamic(() => import("./parking-map").then((module) => module.ParkingMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted)]">
      Cargando mapa...
    </div>
  ),
});

const parkingLotSelect =
  "id, owner_id, name, address, latitude, longitude, size, current_status, last_report_at, last_report_type, zone_name, price_per_hour, hours_text, is_covered, has_cameras, has_guard, is_24_hours, security_score, rating, walking_landmark, walking_minutes, peak_hours_text, best_time_text, estimated_wait_minutes, reports_count, created_at, updated_at";

const defaultCenter: Coordinates = {
  latitude: 28.6353,
  longitude: -106.0889,
};

const quickReports: ParkingReportType[] = [
  "left_spot",
  "spots_available",
  "few_spots",
  "long_line",
  "closed",
];

const filterLabels: Record<FilterMode, string> = {
  all: "Todos",
  cheap: "Más barato",
  near: "Más cercano",
  covered: "Techado",
  open: "Abierto 24 hrs",
  secure: "Más seguro",
};

const reportWaitMinutes: Record<ParkingReportType, number> = {
  left_spot: 3,
  spots_available: 5,
  few_spots: 10,
  long_line: 18,
  closed: 30,
};

const initialDetails: ParkingDetails = {
  name: "",
  pricePerHour: "",
  hoursText: "",
  isCovered: false,
  hasCameras: false,
  hasGuard: false,
  is24Hours: false,
  securityScore: "",
  rating: "",
  estimatedWaitMinutes: "",
  peakHoursText: "",
  bestTimeText: "",
};

export function EasyParkingApp({
  currentUserId,
  currentUserEmail,
  currentUserReputation,
  initialParkingLots,
}: EasyParkingAppProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [mapFocus, setMapFocus] = useState<{ coords: Coordinates; version: number } | null>(null);
  const [isCreatingParking, setIsCreatingParking] = useState(false);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>(initialParkingLots);
  const [parkingSize, setParkingSize] = useState<ParkingSize>("medium");
  const [details, setDetails] = useState<ParkingDetails>(initialDetails);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedSector, setSelectedSector] = useState<SelectedSector>("Todos");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [reputation, setReputation] = useState<UserReputation>(currentUserReputation);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const supportsGeolocation = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "geolocation" in navigator,
    () => false,
  );

  const center = userLocation ?? defaultCenter;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);

    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (!supportsGeolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserLocation(coords);
      },
      () => {
        setFeedbackMessage("No pudimos obtener tu ubicación. Puedes mover el mapa manualmente.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [supportsGeolocation]);

  useEffect(() => {
    const channel = supabase
      .channel("parking-lots-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parking_lots" },
        (payload) => {
          setParkingLots((current) => {
            if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string } | null)?.id;
              return deletedId ? current.filter((lot) => lot.id !== deletedId) : current;
            }

            const lot = toParkingLot(payload.new as ParkingLotRow);
            const exists = current.some((item) => item.id === lot.id);

            if (exists) {
              return current.map((item) => (item.id === lot.id ? lot : item));
            }

            return [lot, ...current];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const enrichedLots = useMemo(() => {
    return parkingLots.map((lot) => ({
      ...lot,
      distanceLabel: getWalkingDistanceLabel(lot, userLocation),
      dynamicWalkingMinutes: getWalkingMinutes(lot, userLocation),
    }));
  }, [parkingLots, userLocation]);

  const sectorSummaries = useMemo(() => {
    const groups = new Map<string, ParkingLot[]>();

    for (const lot of parkingLots) {
      if (!lot.zoneName) {
        continue;
      }

      groups.set(lot.zoneName, [...(groups.get(lot.zoneName) ?? []), lot]);
    }

    return [...groups.entries()]
      .filter(([, lots]) => lots.length > 1)
      .map(([sector, lots]) => {
        const waitValues = lots
          .map((lot) => lot.estimatedWaitMinutes)
          .filter((value): value is number => value !== null);

        return {
          sector,
          status: getGroupStatus(lots),
          count: lots.length,
          averageWait: waitValues.length
            ? Math.round(waitValues.reduce((total, value) => total + value, 0) / waitValues.length)
            : null,
        };
      })
      .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector, "es-MX"));
  }, [parkingLots]);

  const visibleLots = useMemo(() => {
    const lotsBySector =
      selectedSector === "Todos"
        ? enrichedLots
        : enrichedLots.filter((lot) => lot.zoneName === selectedSector);

    const filteredLots = lotsBySector.filter((lot) => {
      if (filterMode === "covered") return lot.isCovered === true;
      if (filterMode === "open") return lot.is24Hours === true;
      if (filterMode === "secure") return (lot.securityScore ?? 0) >= 4;
      return true;
    });

    return [...filteredLots].sort((a, b) => {
      if (filterMode === "cheap") return sortNullableNumber(a.pricePerHour, b.pricePerHour);
      if (filterMode === "near") return a.dynamicWalkingMinutes - b.dynamicWalkingMinutes;
      if (filterMode === "secure") return (b.securityScore ?? 0) - (a.securityScore ?? 0);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [enrichedLots, filterMode, selectedSector]);

  const totals = useMemo(() => {
    const empty = parkingLots.filter((lot) => lot.status === "empty").length;
    const halfFull = parkingLots.filter((lot) => lot.status === "half_full").length;
    const full = parkingLots.filter((lot) => lot.status === "full").length;
    const waitValues = parkingLots
      .map((lot) => lot.estimatedWaitMinutes)
      .filter((value): value is number => value !== null);
    const averageWait = waitValues.length
      ? `${Math.round(waitValues.reduce((total, value) => total + value, 0) / waitValues.length)} min`
      : "Sin dato";

    return {
      total: parkingLots.length,
      empty,
      halfFull,
      full,
      averageWait,
    };
  }, [parkingLots]);

  async function resolveAddress(coords: Coordinates) {
    const response = await fetch(`/api/geocode/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);

    if (!response.ok) {
      throw new Error("No se pudo resolver la dirección.");
    }

    return (await response.json()) as GeocodedAddress;
  }

  async function handleCreateParking() {
    const coords = selectedLocation;

    if (!isCreatingParking || !coords) {
      setFeedbackMessage("Primero activa Crear estacionamiento y centra el pin en el mapa.");
      return;
    }

    setIsResolvingLocation(true);
    setFeedbackMessage(null);

    try {
      const geocoded = await resolveAddress(coords);
      const fullAddress = geocoded.address ?? geocoded.displayName ?? "Dirección pendiente";
      const sectorName = getSectorName(geocoded.road);
      const parkingName = details.name.trim() || getFallbackParkingName(geocoded);
      const { error, data } = await supabase
        .from("parking_lots")
        .insert({
          owner_id: currentUserId,
          name: parkingName,
          address: fullAddress,
          latitude: coords.latitude,
          longitude: coords.longitude,
          size: parkingSize,
          zone_name: sectorName,
          price_per_hour: toOptionalNumber(details.pricePerHour),
          hours_text: toOptionalText(details.hoursText),
          is_covered: details.isCovered,
          has_cameras: details.hasCameras,
          has_guard: details.hasGuard,
          is_24_hours: details.is24Hours,
          security_score: toOptionalNumber(details.securityScore),
          rating: toOptionalNumber(details.rating),
          walking_landmark: null,
          walking_minutes: null,
          peak_hours_text: toOptionalText(details.peakHoursText),
          best_time_text: toOptionalText(details.bestTimeText),
          estimated_wait_minutes: toOptionalNumber(details.estimatedWaitMinutes),
        })
        .select(parkingLotSelect)
        .single();

      if (error || !data) {
        throw error ?? new Error("No se pudo crear el estacionamiento.");
      }

      const newLot = toParkingLot(data as ParkingLotRow);
      setParkingLots((current) => [newLot, ...current]);
      setDetails(initialDetails);
      setIsCreatingParking(false);
      setSelectedLocation(null);

      if (newLot.zoneName && parkingLots.some((lot) => lot.zoneName === newLot.zoneName)) {
        setSelectedSector(newLot.zoneName);
      }

      setFeedbackMessage(
        sectorName
          ? `Estacionamiento creado. Se agrupará por sector cuando haya más lugares en ${sectorName}.`
          : "Estacionamiento creado sin sector porque el geocoding no devolvió una calle clara.",
      );
      router.refresh();
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "No se pudo crear el estacionamiento en la BD.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function reportParking(lot: ParkingLot, reportType: ParkingReportType) {
    setFeedbackMessage(null);

    const { error } = await supabase.from("parking_lot_reports").insert({
      parking_lot_id: lot.id,
      reporter_id: currentUserId,
      status: parkingReportStatus[reportType],
      report_type: reportType,
      wait_minutes: reportWaitMinutes[reportType],
    });

    if (error) {
      setFeedbackMessage("No se pudo guardar el reporte en la BD.");
      return;
    }

    setReputation((current) => {
      const points = current.points + 10;
      return {
        points,
        reportsCount: current.reportsCount + 1,
        reputationLabel: points >= 150 ? "Top colaborador" : points >= 60 ? "Usuario confiable" : "Nuevo colaborador",
      };
    });
    setFeedbackMessage(`Reporte guardado: ${parkingReportLabels[reportType]}.`);
    router.refresh();
  }

  function startCreatingParking() {
    setIsCreatingParking(true);
    setFeedbackMessage(null);
  }

  function focusMap(coords: Coordinates) {
    setMapFocus((current) => ({
      coords,
      version: (current?.version ?? 0) + 1,
    }));
  }

  function cancelCreatingParking() {
    setIsCreatingParking(false);
    setSelectedLocation(null);
    setFeedbackMessage(null);
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4">
        <header className="easy-parking-panel rounded-[28px] px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
            <div className="max-w-4xl space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--accent-strong)]">
                Easy Parking
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {currentUserEmail}
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Mapa vivo de estacionamientos del centro.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  Consulta disponibilidad, reporta actividad real y agrupa estacionamientos por calles detectadas.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
                <MetricCard label="Total" value={totals.total} />
                <MetricCard label="Disponibles" value={totals.empty} tone="emerald" />
                <MetricCard label="Pocos" value={totals.halfFull} tone="amber" />
                <MetricCard label="Espera" value={totals.averageWait} tone="rose" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkMode((value) => !value)}
                  className="easy-parking-focus inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--card-strong)]"
                >
                  {isDarkMode ? "Modo claro" : "Modo oscuro"}
                </button>
                <a
                  href="/auth/signout"
                  className="easy-parking-focus inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--card-strong)]"
                >
                  Cerrar sesión
                </a>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="easy-parking-panel rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Sectores detectados</h2>
                <p className="text-sm text-[var(--muted)]">
                  Solo aparecen cuando hay dos o más estacionamientos en la misma calle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSector("Todos")}
                className="easy-parking-focus shrink-0 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--card-strong)]"
              >
                Todos
              </button>
            </div>

            {sectorSummaries.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sectorSummaries.map((summary) => (
                  <button
                    key={summary.sector}
                    type="button"
                    onClick={() => setSelectedSector(summary.sector)}
                    className={`easy-parking-focus rounded-2xl border px-4 py-3 text-left transition ${
                      selectedSector === summary.sector
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Sector {summary.sector}</span>
                      <StatusDot status={summary.status} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {summary.count} lugares · {summary.averageWait === null ? "sin espera" : `${summary.averageWait} min`}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
                Aún no hay calles repetidas. Los estacionamientos se muestran de forma individual.
              </div>
            )}
          </div>

          <div className="easy-parking-panel rounded-[28px] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Reputación</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{reputation.reputationLabel}</div>
                <div className="text-sm text-[var(--muted)]">{reputation.reportsCount} reportes enviados</div>
              </div>
              <div className="rounded-2xl bg-[var(--foreground)] px-4 py-3 text-right text-[var(--background)]">
                <div className="text-2xl font-semibold leading-none">{reputation.points}</div>
                <div className="text-xs opacity-75">puntos</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
          <div className="easy-parking-panel flex min-h-[760px] flex-col overflow-hidden rounded-[28px] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Mapa principal</h2>
                <p className="text-sm text-[var(--muted)]">
                  Navega libremente por el mapa. Activa crear estacionamiento cuando quieras fijar un punto.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!userLocation) {
                      setFeedbackMessage("Todavía no tenemos tu ubicación. Puedes moverte manualmente en el mapa.");
                      return;
                    }

                    focusMap(userLocation);
                  }}
                  className="easy-parking-focus rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--card-strong)]"
                >
                  Usar mi ubicación
                </button>
                <button
                  type="button"
                  onClick={isCreatingParking ? cancelCreatingParking : startCreatingParking}
                  className={`easy-parking-focus rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isCreatingParking
                      ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-100"
                      : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                  }`}
                >
                  {isCreatingParking ? "Cancelar creación" : "Crear estacionamiento"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSector("Todos")}
                  className="easy-parking-focus rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--card-strong)]"
                >
                  Ver todos
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-[24px]">
              <ParkingMap
                center={center}
                userLocation={userLocation}
                parkingLots={visibleLots}
                isPickingLocation={isCreatingParking}
                focusTarget={mapFocus?.coords ?? null}
                focusVersion={mapFocus?.version ?? 0}
                onPickLocation={setSelectedLocation}
              />
              {isCreatingParking ? (
                <>
                  <div className="pointer-events-none absolute inset-0 z-[520] flex items-center justify-center">
                    <div className="-mt-9 flex flex-col items-center">
                      <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-rose-600 text-white shadow-2xl">
                        <span className="h-3 w-3 rounded-full bg-white" />
                      </div>
                      <div className="h-8 w-1 rounded-full bg-rose-600 shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-1/2 z-[530] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-black/10 bg-white/95 px-4 py-3 text-center text-xs font-semibold text-slate-800 shadow-lg backdrop-blur">
                    El estacionamiento se guardará en el centro del pin.
                  </div>
                </>
              ) : null}
              <div className="absolute left-3 top-3 z-[530] flex flex-wrap gap-2 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-xs font-medium text-slate-800 shadow-lg backdrop-blur">
                <LegendDot color="bg-emerald-600" label="Disponible" />
                <LegendDot color="bg-amber-500" label="Medio" />
                <LegendDot color="bg-rose-600" label="Lleno" />
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Nuevo estacionamiento</p>
                  <h3 className="text-base font-semibold text-balance">
                    {isCreatingParking
                      ? "Centra el pin en el mapa y captura solo datos reales."
                      : "Activa crear estacionamiento para mostrar el pin y guardar un punto."}
                  </h3>
                </div>

                <button
                  type="button"
                  disabled={isResolvingLocation}
                  onClick={isCreatingParking ? handleCreateParking : startCreatingParking}
                  className="easy-parking-focus rounded-2xl bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolvingLocation ? "Creando..." : isCreatingParking ? "Añadir estacionamiento" : "Crear estacionamiento"}
                </button>
              </div>

              {isCreatingParking ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <TextInput
                  label="Nombre"
                  value={details.name}
                  placeholder="Ej. Estacionamiento Hidalgo"
                  onChange={(value) => setDetails((current) => ({ ...current, name: value }))}
                />
                <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]">
                  Tamaño
                  <select
                    value={parkingSize}
                    onChange={(event) => setParkingSize(event.target.value as ParkingSize)}
                    className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm"
                  >
                    <option value="small">Chico</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </label>
                <TextInput
                  label="Precio por hora"
                  value={details.pricePerHour}
                  inputMode="decimal"
                  placeholder="Ej. 20"
                  onChange={(value) => setDetails((current) => ({ ...current, pricePerHour: value }))}
                />
                <TextInput
                  label="Horario"
                  value={details.hoursText}
                  placeholder="Ej. 8:00 AM - 9:00 PM"
                  onChange={(value) => setDetails((current) => ({ ...current, hoursText: value }))}
                />
                <TextInput
                  label="Seguridad 1-5"
                  value={details.securityScore}
                  inputMode="decimal"
                  placeholder="Sin dato"
                  onChange={(value) => setDetails((current) => ({ ...current, securityScore: value }))}
                />
                <TextInput
                  label="Calificación 1-5"
                  value={details.rating}
                  inputMode="decimal"
                  placeholder="Sin dato"
                  onChange={(value) => setDetails((current) => ({ ...current, rating: value }))}
                />
                <TextInput
                  label="Espera estimada"
                  value={details.estimatedWaitMinutes}
                  inputMode="numeric"
                  placeholder="Minutos"
                  onChange={(value) => setDetails((current) => ({ ...current, estimatedWaitMinutes: value }))}
                />
                <TextInput
                  label="Horario pico"
                  value={details.peakHoursText}
                  placeholder="Ej. 1 PM - 4 PM"
                  onChange={(value) => setDetails((current) => ({ ...current, peakHoursText: value }))}
                />
                <TextInput
                  label="Mejor horario"
                  value={details.bestTimeText}
                  placeholder="Ej. antes de 11 AM"
                  onChange={(value) => setDetails((current) => ({ ...current, bestTimeText: value }))}
                />
                </div>
              ) : null}

              {isCreatingParking ? (
                <div className="mt-4 flex flex-wrap gap-2">
                <CheckboxPill
                  label="Techado"
                  checked={details.isCovered}
                  onChange={(checked) => setDetails((current) => ({ ...current, isCovered: checked }))}
                />
                <CheckboxPill
                  label="Cámaras"
                  checked={details.hasCameras}
                  onChange={(checked) => setDetails((current) => ({ ...current, hasCameras: checked }))}
                />
                <CheckboxPill
                  label="Guardia"
                  checked={details.hasGuard}
                  onChange={(checked) => setDetails((current) => ({ ...current, hasGuard: checked }))}
                />
                <CheckboxPill
                  label="Abierto 24 hrs"
                  checked={details.is24Hours}
                  onChange={(checked) => setDetails((current) => ({ ...current, is24Hours: checked }))}
                />
                </div>
              ) : null}
            </div>

            {!supportsGeolocation ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Tu navegador no expone geolocalización.
              </p>
            ) : null}

            {feedbackMessage ? (
              <p className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)]">
                {feedbackMessage}
              </p>
            ) : null}
          </div>

          <aside className="easy-parking-panel flex min-h-[760px] flex-col rounded-[28px] p-4 sm:p-5">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Estacionamientos</h2>
                <p className="text-sm text-[var(--muted)]">
                  Reportes colaborativos, predicción y datos reales capturados por usuarios.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(filterLabels) as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMode(mode)}
                    className={`easy-parking-focus rounded-full px-3 py-2 text-xs font-semibold transition ${
                      filterMode === mode
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {filterLabels[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 overflow-y-auto pr-1">
              {visibleLots.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
                  No hay estacionamientos con estos filtros. Crea uno desde el mapa o cambia el filtro.
                </div>
              ) : null}

              {visibleLots.map((lot) => (
                <ParkingLotCard
                  key={lot.id}
                  lot={lot}
                  groupedSector={Boolean(lot.zoneName && sectorSummaries.some((summary) => summary.sector === lot.zoneName))}
                  onReport={reportParking}
                />
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ParkingLotCard({
  lot,
  groupedSector,
  onReport,
}: {
  lot: ParkingLot & { dynamicWalkingMinutes?: number };
  groupedSector: boolean;
  onReport: (lot: ParkingLot, reportType: ParkingReportType) => void;
}) {
  return (
    <article className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{lot.name}</h3>
            {groupedSector && lot.zoneName ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Sector {lot.zoneName}
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{lot.address}</p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${parkingStatusTone[lot.status]}`}>
          {parkingStatusLabels[lot.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <InfoTile label="Precio" value={formatMoney(lot.pricePerHour)} />
        <InfoTile label="Distancia" value={lot.distanceLabel ?? "Activa ubicación"} />
        <InfoTile label="Espera" value={formatNullableNumber(lot.estimatedWaitMinutes, " min")} />
        <InfoTile label="Rating" value={lot.rating === null ? "Sin dato" : `${lot.rating.toFixed(1)}/5`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        <span className={`inline-flex rounded-full px-3 py-1 ring-1 ${parkingSizeTone[lot.size]}`}>
          {parkingSizeLabels[lot.size]}
        </span>
        <FeatureBadge active={lot.isCovered} label="Techado" />
        <FeatureBadge active={lot.hasCameras} label="Cámaras" />
        <FeatureBadge active={lot.hasGuard} label="Guardia" />
        <FeatureBadge active={lot.is24Hours} label="24 hrs" />
        {lot.securityScore !== null ? (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10">
            Seguridad {lot.securityScore}/5
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-xs text-[var(--muted)]">
        <div className="flex items-center justify-between gap-3">
          <span>Último reporte</span>
          <strong className="text-right text-[var(--foreground)]">
            {lot.lastReportType ? parkingReportLabels[lot.lastReportType] : "Sin actividad"} · {formatRelativeTime(lot.lastReportAt)}
          </strong>
        </div>
        <InfoRow label="Horario" value={lot.hoursText} />
        <InfoRow label="Horario pico" value={lot.peakHoursText} />
        <InfoRow label="Mejor horario" value={lot.bestTimeText} />
        <div className="flex items-center justify-between gap-3">
          <span>Predicción</span>
          <strong className="text-right text-[var(--foreground)]">{getParkingPrediction(lot)}</strong>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {quickReports.map((reportType) => (
          <button
            key={reportType}
            type="button"
            onClick={() => onReport(lot, reportType)}
            className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            {parkingReportLabels[reportType]}
          </button>
        ))}
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const styleMap = {
    slate: "bg-[var(--card)] text-[var(--foreground)]",
    emerald: "bg-emerald-50 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-50",
    amber: "bg-amber-50 text-amber-900 dark:bg-amber-400/15 dark:text-amber-50",
    rose: "bg-rose-50 text-rose-900 dark:bg-rose-400/15 dark:text-rose-50",
  } as const;

  return (
    <div className={`rounded-3xl px-4 py-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${styleMap[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm placeholder:text-[var(--muted)]"
      />
    </label>
  );
}

function CheckboxPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`easy-parking-focus inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
        checked
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card-strong)] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <strong className="text-right text-[var(--foreground)]">{value}</strong>
    </div>
  );
}

function FeatureBadge({ active, label }: { active: boolean | null; label: string }) {
  if (active !== true) {
    return null;
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-100 dark:ring-emerald-300/30">
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: ParkingStatus }) {
  const color = status === "empty" ? "bg-emerald-500" : status === "half_full" ? "bg-amber-400" : "bg-rose-500";
  return <span className={`h-3 w-3 rounded-full ${color}`} aria-label={parkingStatusLabels[status]} />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function getGroupStatus(lots: ParkingLot[]): ParkingStatus {
  if (lots.length === 0) return "empty";
  if (lots.some((lot) => lot.status === "empty")) return "empty";
  if (lots.some((lot) => lot.status === "half_full")) return "half_full";
  return "full";
}

function getWalkingDistanceLabel(lot: ParkingLot, userLocation: Coordinates | null) {
  if (!userLocation) {
    return "Activa ubicación";
  }

  return `${getWalkingMinutes(lot, userLocation)} min`;
}

function getWalkingMinutes(lot: ParkingLot, userLocation: Coordinates | null) {
  if (!userLocation) {
    return Number.MAX_SAFE_INTEGER;
  }

  const meters = getDistanceMeters(userLocation, {
    latitude: lot.latitude,
    longitude: lot.longitude,
  });

  return Math.max(1, Math.round(meters / 75));
}

function getDistanceMeters(a: Coordinates, b: Coordinates) {
  const earthRadius = 6371000;
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getFallbackParkingName(geocoded: GeocodedAddress) {
  return geocoded.displayName?.split(",")[0]?.trim() || geocoded.road || "Estacionamiento";
}

function sortNullableNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function toOptionalNumber(value: string) {
  const clean = value.trim();

  if (!clean) {
    return null;
  }

  const numeric = Number(clean);
  return Number.isFinite(numeric) ? numeric : null;
}

function toOptionalText(value: string) {
  const clean = value.trim();
  return clean ? clean : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

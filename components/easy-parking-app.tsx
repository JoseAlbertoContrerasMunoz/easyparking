"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatDateShort,
  parkingSizeLabels,
  parkingSizeTone,
  parkingStatusLabels,
  parkingStatusTone,
  toParkingLot,
  type ParkingLot,
  type ParkingLotRow,
  type ParkingSize,
  type ParkingStatus,
} from "@/lib/parking";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type EasyParkingAppProps = {
  currentUserId: string;
  currentUserEmail: string;
  initialParkingLots: ParkingLot[];
};

const ParkingMap = dynamic(() => import("./parking-map").then((module) => module.ParkingMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-[var(--border)] bg-white/70 text-sm text-[var(--muted)]">
      Cargando mapa...
    </div>
  ),
});

const defaultCenter: Coordinates = {
  latitude: 19.4326,
  longitude: -99.1332,
};

export function EasyParkingApp({
  currentUserId,
  currentUserEmail,
  initialParkingLots,
}: EasyParkingAppProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>(initialParkingLots);
  const [parkingSize, setParkingSize] = useState<ParkingSize>("medium");
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const supportsGeolocation = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "geolocation" in navigator,
    () => false,
  );

  const center = selectedLocation ?? userLocation ?? defaultCenter;

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
        setSelectedLocation(coords);
      },
      () => {
        setFeedbackMessage("No pudimos obtener tu ubicación. Puedes elegir un punto manualmente.");
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

  const totals = useMemo(() => {
    const empty = parkingLots.filter((lot) => lot.status === "empty").length;
    const halfFull = parkingLots.filter((lot) => lot.status === "half_full").length;
    const full = parkingLots.filter((lot) => lot.status === "full").length;

    return {
      total: parkingLots.length,
      empty,
      halfFull,
      full,
    };
  }, [parkingLots]);

  async function resolveAddress(coords: Coordinates) {
    const response = await fetch(`/api/geocode/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);

    if (!response.ok) {
      throw new Error("No se pudo resolver la dirección.");
    }

    return (await response.json()) as {
      displayName: string | null;
      address: string | null;
    };
  }

  async function handleCreateParking() {
    const coords = selectedLocation ?? userLocation;

    if (!coords) {
      setFeedbackMessage("Primero elige un punto en el mapa o activa tu ubicación.");
      return;
    }

    setIsResolvingLocation(true);
    setFeedbackMessage(null);

    try {
      const geocoded = await resolveAddress(coords);
      const { error, data } = await supabase
        .from("parking_lots")
        .insert({
          owner_id: currentUserId,
          name: geocoded.displayName?.split(",")[0] ?? `Estacionamiento ${parkingLots.length + 1}`,
          address: geocoded.address ?? geocoded.displayName ?? "Dirección pendiente",
          latitude: coords.latitude,
          longitude: coords.longitude,
          size: parkingSize,
        })
        .select(
          "id, owner_id, name, address, latitude, longitude, size, current_status, last_report_at, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        throw error ?? new Error("No se pudo crear el estacionamiento.");
      }

      setParkingLots((current) => [toParkingLot(data as ParkingLotRow), ...current]);
      setFeedbackMessage("Estacionamiento creado y guardado en Supabase.");
      router.refresh();
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "No se pudo crear el estacionamiento en la BD.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function updateParkingStatus(id: string, status: ParkingStatus) {
    setFeedbackMessage(null);

    const { error } = await supabase.from("parking_lot_reports").insert({
      parking_lot_id: id,
      reporter_id: currentUserId,
      status,
    });

    if (error) {
      setFeedbackMessage("No se pudo guardar el reporte en la BD.");
      return;
    }

    setFeedbackMessage("Reporte guardado y estado sincronizado.");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4">
        <header className="easy-parking-panel rounded-[32px] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Easy Parking
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {currentUserEmail}
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Reporta estacionamientos en tiempo real con un mapa claro y rápido.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  Usa tu ubicación, marca un punto en el mapa y actualiza si un estacionamiento
                  está vacío, medio lleno o muy lleno. Todo lo que ves sale de la base de datos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:items-center">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[460px]">
                <MetricCard label="Total" value={totals.total} />
                <MetricCard label="Vacíos" value={totals.empty} tone="emerald" />
                <MetricCard label="Medios" value={totals.halfFull} tone="amber" />
                <MetricCard label="Llenos" value={totals.full} tone="rose" />
              </div>
              <a
                href="/auth/signout"
                className="easy-parking-focus inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
              >
                Cerrar sesión
              </a>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="easy-parking-panel flex min-h-[620px] flex-col overflow-hidden rounded-[32px] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Mapa</h2>
                <p className="text-sm text-[var(--muted)]">
                  Haz clic para ubicar un estacionamiento o usa tu posición actual.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => userLocation && setSelectedLocation(userLocation)}
                  className="easy-parking-focus rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
                >
                  Usar mi ubicación
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(center)}
                  className="easy-parking-focus rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Centrar mapa
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-[28px]">
              <ParkingMap
                center={center}
                userLocation={userLocation}
                selectedLocation={selectedLocation}
                parkingLots={parkingLots}
                onPickLocation={setSelectedLocation}
              />
            </div>

            <div className="mt-4 grid gap-4 rounded-[24px] border border-[var(--border)] bg-white/70 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Nuevo estacionamiento</p>
                <h3 className="text-base font-semibold text-balance">
                  Selecciona un punto y define el tamaño.
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  El nombre se completa automáticamente con geocoding inverso.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]">
                  Tamaño
                  <select
                    value={parkingSize}
                    onChange={(event) => setParkingSize(event.target.value as ParkingSize)}
                    className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  >
                    <option value="small">Chico</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </label>

                <button
                  type="button"
                  disabled={isResolvingLocation}
                  onClick={handleCreateParking}
                  className="easy-parking-focus rounded-2xl bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolvingLocation ? "Creando..." : "Añadir estacionamiento"}
                </button>
              </div>
            </div>

            {!supportsGeolocation ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Tu navegador no expone geolocalización.
              </p>
            ) : null}

            {feedbackMessage ? (
              <p className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-800">
                {feedbackMessage}
              </p>
            ) : null}
          </div>

          <aside className="easy-parking-panel flex min-h-[620px] flex-col rounded-[32px] p-4 sm:p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Estacionamientos registrados</h2>
              <p className="text-sm text-[var(--muted)]">
                Cambia el estado con un clic. Este estado se guarda como un reporte real en Supabase.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {parkingLots.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-white/60 p-5 text-sm text-[var(--muted)]">
                  No hay estacionamientos todavía. Crea el primero desde el mapa.
                </div>
              ) : null}

              {parkingLots.map((lot) => (
                <article
                  key={lot.id}
                  className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{lot.name}</h3>
                      <p className="text-sm text-[var(--muted)]">{lot.address}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${parkingStatusTone[lot.status]}`}
                    >
                      {parkingStatusLabels[lot.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 ring-1 ${parkingSizeTone[lot.size]}`}
                    >
                      {parkingSizeLabels[lot.size]}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                      {lot.latitude.toFixed(5)}, {lot.longitude.toFixed(5)}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                      {formatDateShort(lot.updatedAt)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["empty", "half_full", "full"] as ParkingStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateParkingStatus(lot.id, status)}
                        className={`easy-parking-focus rounded-full px-3 py-2 text-xs font-semibold transition ${
                          status === lot.status
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-black/5"
                        }`}
                      >
                        {parkingStatusLabels[status]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const styleMap = {
    slate: "bg-white/80 text-[var(--foreground)]",
    emerald: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-900",
    rose: "bg-rose-50 text-rose-900",
  } as const;

  return (
    <div className={`rounded-3xl px-4 py-3 shadow-sm ring-1 ring-black/5 ${styleMap[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
    </div>
  );
}
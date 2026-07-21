"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, Map as MapIcon, Loader2 } from "lucide-react";
import { VET_LOCATIONS } from "@/data/vet-locations";
import { filterVets, buildSuggestions, type VetFilterState } from "./vet-utils";
import type { BasemapMode } from "./vet-map-style";
import { VetFilters } from "./VetFilters";
import { VetList } from "./VetList";
import { VetDetail } from "./VetDetail";

// WebGL map is client-only; ssr:false must live inside a Client Component.
const VetMap = dynamic(() => import("./VetMap").then((mod) => ({ default: mod.VetMap })), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const STATES = [...new Set(VET_LOCATIONS.map((location) => location.state))].sort((a, b) => a.localeCompare(b));
const SUGGESTIONS = buildSuggestions(VET_LOCATIONS);

const EMPTY_FILTERS: VetFilterState = {
  query: "",
  service: "",
  state: "",
  openNow: false,
  radiusKm: 0,
  userCoordinates: null,
};

type GeoStatus = "idle" | "locating" | "error";

function readFilters(params: URLSearchParams): VetFilterState {
  return {
    query: params.get("q") ?? "",
    service: params.get("service") ?? "",
    state: params.get("state") ?? "",
    openNow: params.get("open") === "1",
    radiusKm: Number(params.get("radius") ?? 0) || 0,
    userCoordinates: null,
  };
}

function readBasemap(params: URLSearchParams): BasemapMode {
  const value = params.get("basemap");
  if (value === "light" || value === "dark") return value;
  return "satellite";
}

/** Two-panel (desktop) / toggled single-panel (mobile) greyhound Vet Finder. */
export function VetFinder(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filters, setFilters] = useState<VetFilterState>(() => readFilters(new URLSearchParams(searchParams)));
  const [basemap, setBasemap] = useState<BasemapMode>(() => readBasemap(new URLSearchParams(searchParams)));
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("sel"));
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const results = useMemo(() => filterVets(VET_LOCATIONS, filters), [filters]);
  const selected =
    (selectedId && (results.find((r) => r.id === selectedId) ?? VET_LOCATIONS.find((v) => v.id === selectedId))) || null;

  // Persist shareable state in the URL (userCoordinates stays local for privacy).
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.service) params.set("service", filters.service);
    if (filters.state) params.set("state", filters.state);
    if (filters.openNow) params.set("open", "1");
    if (filters.radiusKm) params.set("radius", String(filters.radiusKm));
    if (selectedId) params.set("sel", selectedId);
    if (basemap !== "satellite") params.set("basemap", basemap);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, selectedId, basemap, pathname, router]);

  const patchFilters = useCallback((patch: Partial<VetFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("map");
  }, []);

  const handleUseLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFilters((current) => ({
          ...current,
          userCoordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude },
        }));
        setGeoStatus("idle");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedId(null);
  }, []);

  return (
    <section className="relative mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="giq-panel giq-vet-search-panel mb-4 p-4">
        <VetFilters
          filters={filters}
          onPatch={patchFilters}
          states={STATES}
          suggestions={SUGGESTIONS}
          onUseLocation={handleUseLocation}
          geoStatus={geoStatus}
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <p className="text-[13px] font-semibold text-[hsl(var(--muted-foreground))] tabular-nums" aria-live="polite">
          {results.length} clinic{results.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2" role="group" aria-label="View toggle">
          <ViewToggle icon={List} label="List" active={mobileView === "list"} onClick={() => setMobileView("list")} />
          <ViewToggle icon={MapIcon} label="Map" active={mobileView === "map"} onClick={() => setMobileView("map")} />
        </div>
      </div>

      <div className="grid h-[clamp(320px,calc(100dvh-var(--giq-mobile-dock-clearance)-220px),720px)] overflow-hidden rounded-2xl border border-[hsl(var(--border))] shadow-[0_22px_60px_-24px_hsl(0_0%_0%/0.7)] lg:h-[clamp(560px,calc(100dvh-var(--giq-member-header-clearance)-var(--giq-mobile-dock-clearance)-32px),800px)] lg:grid-cols-[minmax(300px,360px)_1fr]">
        <div
          className={`min-h-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-1)/0.55)] ${
            mobileView === "map" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[hsl(var(--secondary)/0.35)] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[hsl(var(--foreground))] tabular-nums" aria-live="polite">
              {results.length} clinic{results.length === 1 ? "" : "s"}
            </h2>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--secondary-light))]">
              Australia-wide
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <VetList results={results} selectedId={selectedId} onSelect={handleSelect} onClear={clearFilters} />
          </div>
        </div>

        <div className={`giq-vet-map-shell relative min-h-0 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          <VetMap
            locations={results}
            selectedId={selectedId}
            onSelect={handleSelect}
            basemap={basemap}
            onBasemap={setBasemap}
            userCoordinates={filters.userCoordinates}
          />
          {selected && (
            <aside
              className="giq-glass-panel giq-vet-map-detail"
              aria-label={`${selected.name} details`}
            >
              <VetDetail location={selected} onClose={() => setSelectedId(null)} />
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

function ViewToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof List;
  label: string;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`giq-filter-chip inline-flex flex-1 items-center justify-center gap-1.5 ${active ? "giq-filter-chip-active" : ""}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function MapSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--surface-1))]">
      <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary-bright))]" aria-hidden="true" />
      <span className="sr-only">Loading map</span>
    </div>
  );
}

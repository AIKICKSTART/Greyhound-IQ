"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap, type GeoJSONSource, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Moon, Sun, Satellite, Box } from "lucide-react";
import type { VetResult, Coordinates } from "./vet-utils";
import {
  MAP_CONFIG,
  loadBasemapStyle,
  prepareMarkerImages,
  registerDiamondImages,
  addClinicLayers,
  clinicsGeoJson,
  ensureTerrain,
  removeTerrain,
  ensureBuildings3d,
  type BasemapMode,
} from "./vet-map-style";

interface VetMapProps {
  locations: VetResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  basemap: BasemapMode;
  onBasemap: (mode: BasemapMode) => void;
  userCoordinates: Coordinates | null;
}

const BASEMAPS: { value: BasemapMode; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "satellite", label: "Satellite", icon: Satellite },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function emptyCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: [] };
}

/**
 * MapLibre GL map driven imperatively. WebGL-only, so it is dynamically
 * imported with `ssr: false` by the VetFinder container. Clustered clinic
 * markers, click-to-select, a lightweight popup and the branded basemap
 * styles are all applied here.
 */
export function VetMap({ locations, selectedId, onSelect, basemap, onBasemap, userCoordinates }: VetMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const readyRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [is3d, setIs3d] = useState(false);
  const is3dRef = useRef(false);

  // Latest props for event handlers without rebinding listeners.
  const locationsRef = useRef(locations);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    locationsRef.current = locations;
    onSelectRef.current = onSelect;
  });

  // Mount: create the map, bind style + interaction handlers once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    void Promise.all([loadBasemapStyle(basemap), prepareMarkerImages()]).then(([style]) => {
      if (cancelled || !container) return;
      const map = new maplibregl.Map({
        container,
        style,
        center: MAP_CONFIG.australiaCentre,
        zoom: MAP_CONFIG.australiaZoom,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      // Compass + pitch visualiser on the left edge; the 3D badge/toggle own
      // the right edge and the basemap pills sit below these on the left.
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
        "top-left"
      );

      // style.load fires on first load and after every setStyle; re-add the
      // clinic content each time because setStyle wipes sources/layers/images.
      map.on("style.load", () => {
        registerDiamondImages(map);
        addClinicLayers(map, clinicsGeoJson(locationsRef.current));
        // A basemap switch rebuilds the style, so restore 3D content if active.
        if (is3dRef.current) {
          ensureBuildings3d(map, true);
          ensureTerrain(map);
        }
        readyRef.current = true;
      });

      // MapLibre measures the container at construction; with async style load,
      // dynamic import, and CSS-driven panel height the canvas can mount at the
      // wrong size (blank / stretched map). Resize once loaded, and observe the
      // container so it also tracks mobile↔desktop and orientation changes.
      map.on("load", () => map.resize());
      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
      resizeObserverRef.current = resizeObserver;

      map.on("click", "clinic-diamonds", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      map.on("click", "clinic-clusters", (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource("clinics") as GeoJSONSource | undefined;
        if (!feature || clusterId == null || !source) return;
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) =>
            map.easeTo({ center: coordinates, zoom, duration: prefersReducedMotion() ? 0 : 450 })
          )
          .catch(() => map.easeTo({ center: coordinates, zoom: map.getZoom() + 2 }));
      });

      const setCursor = (cursor: string) => (): void => {
        map.getCanvas().style.cursor = cursor;
      };
      map.on("mouseenter", "clinic-diamonds", setCursor("pointer"));
      map.on("mouseleave", "clinic-diamonds", setCursor(""));
      map.on("mouseenter", "clinic-clusters", setCursor("pointer"));
      map.on("mouseleave", "clinic-clusters", setCursor(""));
    });

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Basemap changes are handled by a dedicated effect; only mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch: reload the style; the style.load handler re-adds content.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    void loadBasemapStyle(basemap).then((style) => map.setStyle(style));
  }, [basemap]);

  // Filtered results changed: update the clustered source in place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("clinics") as GeoJSONSource | undefined;
    if (source) source.setData(clinicsGeoJson(locations));
  }, [locations]);

  // Selection changed: highlight, popup and ease toward the clinic.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = locations.find((location) => location.id === selectedId) ?? null;
    const source = map.getSource("selected-clinic") as GeoJSONSource | undefined;

    if (!selected) {
      source?.setData(emptyCollection());
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const coordinates: [number, number] = [selected.longitude, selected.latitude];
    source?.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { id: selected.id }, geometry: { type: "Point", coordinates } }],
    });

    popupRef.current?.remove();
    // anchor:"bottom" pins the popup ABOVE the marker deterministically (no
    // auto-anchor race with easeTo), maxWidth keeps it compact, and the easeTo
    // offset drops the marker below centre so the popup always lands inside the
    // map rather than clipping against the panel's rounded overflow edge.
    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: false,
      anchor: "bottom",
      offset: 16,
      maxWidth: "260px",
      focusAfterOpen: false,
      className: "giq-vet-popup",
    })
      .setLngLat(coordinates)
      .setHTML(
        `<strong>${escapeHtml(selected.name)}</strong><span>${escapeHtml(
          [selected.suburb, selected.state, selected.postcode].filter(Boolean).join(" ")
        )}</span>`
      )
      .addTo(map);

    const desktopDetail = window.matchMedia("(min-width: 1024px)").matches;
    map.easeTo({
      center: coordinates,
      zoom: Math.max(map.getZoom(), 11),
      offset: desktopDetail ? [-190, 40] : [0, -120],
      duration: prefersReducedMotion() ? 0 : 500,
    });
  }, [selectedId, locations]);

  // User location marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoordinates) return;
    const marker = new maplibregl.Marker({ color: "#f1bd4f" })
      .setLngLat([userCoordinates.longitude, userCoordinates.latitude])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [userCoordinates]);

  // Toggle the 3D view: raise buildings (vector basemaps), drape terrain, and
  // tilt the camera. Motion is instant under prefers-reduced-motion.
  const toggle3d = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3dRef.current;
    is3dRef.current = next;
    setIs3d(next);
    const duration = prefersReducedMotion() ? 0 : next ? 900 : 700;
    if (next) {
      ensureBuildings3d(map, true);
      ensureTerrain(map);
      map.easeTo({ pitch: 55, duration });
    } else {
      ensureBuildings3d(map, false);
      removeTerrain(map);
      map.easeTo({ pitch: 0, duration });
    }
  }, []);

  // Fill the bounded map panel. MapLibre's own `.maplibregl-map { position:
  // relative }` overrides Tailwind's `.absolute` (equal specificity, its CSS
  // loads later), so inset-0 can't stretch the div. The wrapper below has a
  // definite height, so plain h-full/w-full resolves without the position war.
  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label="Map of greyhound veterinary clinics"
        role="region"
      />

      {/* Basemap pills — top-left, below the zoom/tilt controls */}
      <div
        className="giq-map-chrome absolute left-2.5 top-[7.25rem] z-10 flex overflow-hidden"
        role="group"
        aria-label="Map style"
      >
        {BASEMAPS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onBasemap(value)}
            aria-pressed={basemap === value}
            className="giq-map-pill inline-flex min-h-[38px] items-center gap-1.5 px-2.5 text-[10px]"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Brand 3D badge — top-right */}
      <div className="giq-map-chrome pointer-events-none absolute right-2.5 top-2.5 z-10 hidden items-center gap-2 px-2.5 py-1.5 sm:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/apple-icon.png"
          alt=""
          width={34}
          height={34}
          className="h-[34px] w-[34px] rounded-md object-contain"
        />
        <span className="leading-tight">
          <strong className="block text-[11px] uppercase tracking-[0.04em] text-[hsl(var(--foreground))]">
            Greyhounds IQ 3D map
          </strong>
          <small className="block text-[10px] text-[hsl(var(--muted-foreground))]">
            Select an icon for details
          </small>
        </span>
      </div>

      {/* 3D view toggle — top-right, below the badge */}
      <button
        type="button"
        onClick={toggle3d}
        aria-pressed={is3d}
        className="giq-map-chrome giq-map-3d absolute right-2.5 top-2.5 z-10 inline-flex min-h-[38px] items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.08em] sm:top-[4.6rem]"
      >
        <Box className="h-4 w-4" aria-hidden="true" />
        <span>{is3d ? "2D view" : "3D view"}</span>
      </button>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

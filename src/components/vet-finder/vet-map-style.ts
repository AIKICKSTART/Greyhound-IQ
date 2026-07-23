/**
 * MapLibre brand styling for the Vet Finder, ported from the prototype
 * (script.js): the OpenFreeMap dark/positron recolours, night/day sky,
 * keyless satellite + raster fallback builders, the racing-diamond marker
 * icon and the clustered clinic source/layer definitions.
 *
 * Tiles are keyless (OpenFreeMap vector, Esri raster imagery, OSM raster
 * fallback) — no API keys anywhere.
 */

import type {
  Map as MlMap,
  StyleSpecification,
  LayerSpecification,
  StyleImageInterface,
} from "maplibre-gl";
import type { VetResult } from "./vet-utils";

export type BasemapMode = "dark" | "light" | "satellite";

export const MAP_CONFIG = {
  darkStyleUrl: "https://tiles.openfreemap.org/styles/dark",
  lightStyleUrl: "https://tiles.openfreemap.org/styles/positron",
  rasterTilesUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  // Keyless terrarium-encoded raster DEM (Mapterhorn open tiles) for the 3D
  // view. Requires the tiles.mapterhorn.com host in csp.ts img-src/connect-src.
  terrainTilesUrl: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
  rasterAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  australiaCentre: [134.0, -26.8] as [number, number],
  australiaZoom: 4,
  clusterMaxZoom: 11,
  clusterRadius: 64,
} as const;

// Road/land recolours keyed by OpenMapTiles layer id.
const darkBrandLayers: Record<string, { "background-color"?: string; [key: string]: unknown }> = {
  background: { "background-color": "#07090f" },
  water: { "fill-color": "#0a0c19", "fill-antialias": false },
  landcover_ice_shelf: { "fill-color": "#10131c" },
  landcover_glacier: { "fill-color": "#10131c" },
  landuse_residential: { "fill-color": "#0b0e13", "fill-opacity": 0.55 },
  landcover_wood: { "fill-color": "#0d1219" },
  landuse_park: { "fill-color": "#0d1119" },
  waterway: { "line-color": "#10142a" },
  building: { "fill-color": "#0d0f16", "fill-outline-color": "#1a1e2a" },
  "aeroway-area": { "fill-color": "#0c0f15" },
  highway_path: { "line-color": "#2b2f39" },
  highway_minor: { "line-color": "#333842" },
  highway_major_casing: { "line-color": "#20232c" },
  highway_major_inner: { "line-color": "#3d434f" },
  highway_major_subtle: { "line-color": "#2c313b" },
  highway_motorway_casing: { "line-color": "#232733" },
  highway_motorway_inner: { "line-color": "#4a5160" },
  highway_motorway_subtle: { "line-color": "#3a4049" },
  road_pier: { "line-color": "#333842" },
  road_area_pier: { "fill-color": "#0d1017" },
  railway: { "line-color": "#272b34" },
  railway_minor: { "line-color": "#22262e" },
  railway_transit: { "line-color": "#2a2438" },
  boundary_state: { "line-color": "#3a3354", "line-opacity": 0.85 },
  "boundary_country_z0-4": { "line-color": "#4a4f5c" },
  "boundary_country_z5-": { "line-color": "#4a4f5c" },
};

const darkLabelLayers: Record<string, { color: string; halo: string }> = {
  water_name: { color: "#57617e", halo: "#07090f" },
  highway_name_other: { color: "#a9adb7", halo: "#07090f" },
  highway_name_motorway: { color: "#b7bbc4", halo: "#07090f" },
  place_other: { color: "#9aa0ab", halo: "#07090f" },
  place_suburb: { color: "#a2a7b1", halo: "#07090f" },
  place_village: { color: "#a2a7b1", halo: "#07090f" },
  place_town: { color: "#b2b6bf", halo: "#07090f" },
  place_city: { color: "#c8cad1", halo: "#07090f" },
  place_city_large: { color: "#d8b45d", halo: "#07090f" },
  place_state: { color: "#c09a45", halo: "#07090f" },
  place_country_other: { color: "#8f95a3", halo: "#07090f" },
  place_country_minor: { color: "#8f95a3", halo: "#07090f" },
  place_country_major: { color: "#8f95a3", halo: "#07090f" },
};

const lightBrandLayers: Record<string, { [key: string]: unknown }> = {
  background: { "background-color": "#edeef1" },
  water: { "fill-color": "#c6d5e2", "fill-antialias": false },
  landcover_ice_shelf: { "fill-color": "#f2f3f5" },
  landcover_glacier: { "fill-color": "#f2f3f5" },
  landuse_residential: { "fill-color": "#e4e5e9", "fill-opacity": 0.6 },
  landcover_wood: { "fill-color": "#d6dfd4" },
  landuse_park: { "fill-color": "#d9e2d6" },
  waterway: { "line-color": "#b7c9da" },
  building: { "fill-color": "#dbdce1", "fill-outline-color": "#c5c7cf" },
  "aeroway-area": { "fill-color": "#e2e3e8" },
  highway_path: { "line-color": "#c9ccd3" },
  highway_minor: { "line-color": "#ffffff" },
  highway_major_casing: { "line-color": "#b6bac2" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_major_subtle: { "line-color": "#c4c8d0" },
  highway_motorway_casing: { "line-color": "#a8adb8" },
  highway_motorway_inner: { "line-color": "#f4f5f7" },
  highway_motorway_subtle: { "line-color": "#c0c4cd" },
  road_pier: { "line-color": "#e8e9ec" },
  road_area_pier: { "fill-color": "#e8e9ec" },
  railway: { "line-color": "#b9bec8" },
  railway_minor: { "line-color": "#c4c8d0" },
  railway_transit: { "line-color": "#b3a8c4" },
  boundary_state: { "line-color": "#8b6aa8", "line-opacity": 0.75 },
  "boundary_country_z0-4": { "line-color": "#8a8f99" },
  "boundary_country_z5-": { "line-color": "#8a8f99" },
};

const lightLabelLayers: Record<string, { color: string; halo: string }> = {
  water_name: { color: "#4f6f8a", halo: "#f2f4f7" },
  highway_name_other: { color: "#5d626c", halo: "#f2f4f7" },
  highway_name_motorway: { color: "#4f545e", halo: "#f2f4f7" },
  place_other: { color: "#5d626c", halo: "#f2f4f7" },
  place_suburb: { color: "#565b65", halo: "#f2f4f7" },
  place_village: { color: "#565b65", halo: "#f2f4f7" },
  place_town: { color: "#4b505a", halo: "#f2f4f7" },
  place_city: { color: "#3f444e", halo: "#f2f4f7" },
  place_city_large: { color: "#8a6a1f", halo: "#f5f2e8" },
  place_state: { color: "#6e269c", halo: "#f2f4f7" },
  place_country_other: { color: "#6a6f79", halo: "#f2f4f7" },
  place_country_minor: { color: "#6a6f79", halo: "#f2f4f7" },
  place_country_major: { color: "#6a6f79", halo: "#f2f4f7" },
};

const nightSky = {
  "sky-color": "#0a0714",
  "horizon-color": "#3a2054",
  "fog-color": "#241040",
  "sky-horizon-blend": 0.85,
  "horizon-fog-blend": 0.5,
  "fog-ground-blend": 0.35,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 0.4, 12, 0.15],
};

const daySky = {
  ...nightSky,
  "sky-color": "#a8c6e8",
  "horizon-color": "#dfe9f5",
  "fog-color": "#e6ecf4",
};

// The fetched OpenFreeMap style JSON is loosely typed; mutate in place and
// cast on return. Glyph/sprite/source URLs stay absolute so fonts + icons
// keep resolving.
type MutableStyle = { name?: string; sky?: unknown; layers?: MutableLayer[] };
type MutableLayer = { id: string; type: string; paint?: Record<string, unknown> };

function applyBrandStyle(
  styleJson: MutableStyle,
  brand: Record<string, Record<string, unknown>>,
  labels: Record<string, { color: string; halo: string }>,
  sky: unknown,
  name: string
): StyleSpecification {
  (styleJson.layers ?? []).forEach((layer) => {
    const recolor = brand[layer.id];
    if (recolor) {
      layer.paint = { ...(layer.paint ?? {}), ...recolor };
    }
    const label = labels[layer.id];
    if (label && layer.type === "symbol") {
      layer.paint = {
        ...(layer.paint ?? {}),
        "text-color": label.color,
        "text-halo-color": label.halo,
        "text-halo-width": 1.2,
      };
    }
  });
  styleJson.name = name;
  styleJson.sky = sky;
  return styleJson as unknown as StyleSpecification;
}

function buildSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Greyhounds IQ satellite",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sky: nightSky,
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Maxar, Earthstar Geographics',
      },
      "esri-labels": {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Labels &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#07090f" } },
      { id: "esri-imagery", type: "raster", source: "esri-imagery" },
      { id: "esri-labels", type: "raster", source: "esri-labels", paint: { "raster-opacity": 0.92 } },
    ],
  } as unknown as StyleSpecification;
}

function buildRasterFallbackStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Greyhounds IQ raster fallback",
    sky: nightSky,
    sources: {
      osm: {
        type: "raster",
        tiles: [MAP_CONFIG.rasterTilesUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution: MAP_CONFIG.rasterAttribution,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#07090f" } },
      { id: "osm", type: "raster", source: "osm" },
    ],
  } as unknown as StyleSpecification;
}

/**
 * Resolve a fully-branded style for the requested basemap. Falls back to OSM
 * raster tiles if the vector style cannot be fetched (e.g. offline).
 */
export async function loadBasemapStyle(mode: BasemapMode): Promise<StyleSpecification> {
  if (mode === "satellite") return buildSatelliteStyle();
  try {
    const url = mode === "light" ? MAP_CONFIG.lightStyleUrl : MAP_CONFIG.darkStyleUrl;
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`Style request failed: HTTP ${response.status}`);
    const styleJson = (await response.json()) as MutableStyle;
    return mode === "light"
      ? applyBrandStyle(styleJson, lightBrandLayers, lightLabelLayers, daySky, "Greyhounds IQ day")
      : applyBrandStyle(styleJson, darkBrandLayers, darkLabelLayers, nightSky, "Greyhounds IQ night");
  } catch {
    return buildRasterFallbackStyle();
  }
}

// Composited brand-icon markers (the gold "IQ" app icon in a rounded tile),
// matching the prototype. Built once from /apple-icon.png; the drawn diamond
// below is the fallback when the asset can't be loaded (e.g. offline).
type MarkerPair = { normal: StyleImageInterface; selected: StyleImageInterface };
let markerImages: MarkerPair | null | undefined;

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/** Composite the brand app icon into a rounded marker tile. */
function composeMarkerIcon(image: HTMLImageElement, selected: boolean): StyleImageInterface {
  const size = 96;
  const content = selected ? 70 : 66;
  const inset = (size - content) / 2;
  const radius = content * 0.25;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return drawDiamondIcon(selected);

  // Crop the icon's outer bezel (~12% inset) so the IQ art fills the tile.
  const src = image.naturalWidth || image.width || 180;
  const cropInset = src * 0.12;
  const cropSize = src - cropInset * 2;

  roundedRectPath(context, inset, inset, content, content, radius);
  context.save();
  context.clip();
  context.drawImage(image, cropInset, cropInset, cropSize, cropSize, inset, inset, content, content);
  context.restore();

  roundedRectPath(context, inset, inset, content, content, radius);
  context.lineWidth = selected ? 5 : 3;
  context.strokeStyle = selected ? "#f1bd4f" : "rgba(215, 215, 219, 0.95)";
  context.stroke();

  if (selected) {
    roundedRectPath(context, inset - 2, inset - 2, content + 4, content + 4, radius + 2);
    context.lineWidth = 4;
    context.strokeStyle = "rgba(241, 189, 79, 0.35)";
    context.stroke();
  }

  return { width: size, height: size, data: context.getImageData(0, 0, size, size).data };
}

/** Preload + composite the brand marker once. Safe to call repeatedly. */
export async function prepareMarkerImages(): Promise<void> {
  if (markerImages !== undefined) return;
  try {
    const image = await loadImageElement("/apple-icon.png");
    markerImages = { normal: composeMarkerIcon(image, false), selected: composeMarkerIcon(image, true) };
  } catch {
    markerImages = null;
  }
}

/** Racing-diamond marker drawn to a canvas, returned as a MapLibre image. */
function drawDiamondIcon(selected: boolean): StyleImageInterface {
  const size = 96;
  const centre = size / 2;
  const radius = 30;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }

  const diamondPath = (inset: number): void => {
    const r = radius - inset;
    context.beginPath();
    context.moveTo(centre, centre - r);
    context.lineTo(centre + r, centre);
    context.lineTo(centre, centre + r);
    context.lineTo(centre - r, centre);
    context.closePath();
  };

  diamondPath(0);
  const fill = context.createLinearGradient(centre - radius, centre - radius, centre + radius, centre + radius);
  if (selected) {
    fill.addColorStop(0, "#4a3a58");
    fill.addColorStop(0.55, "#160d22");
    fill.addColorStop(1, "#8b35c2");
  } else {
    fill.addColorStop(0, "#302b37");
    fill.addColorStop(0.5, "#09090d");
    fill.addColorStop(1, "#702493");
  }
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = selected ? 5 : 4;
  context.strokeStyle = selected ? "#f1bd4f" : "#d7d7db";
  context.stroke();

  diamondPath(7);
  context.lineWidth = 2;
  context.strokeStyle = "#d6aa4b";
  context.stroke();

  context.fillStyle = "#f1bd4f";
  context.font = "italic 800 24px 'Segoe UI', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("IQ", centre, centre + 2);

  return { width: size, height: size, data: context.getImageData(0, 0, size, size).data };
}

export function registerDiamondImages(map: MlMap): void {
  const normal = markerImages?.normal ?? drawDiamondIcon(false);
  const selected = markerImages?.selected ?? drawDiamondIcon(true);
  if (!map.hasImage("clinic-diamond")) {
    map.addImage("clinic-diamond", normal, { pixelRatio: 2 });
  }
  if (!map.hasImage("clinic-diamond-selected")) {
    map.addImage("clinic-diamond-selected", selected, { pixelRatio: 2 });
  }
}

export function clinicsGeoJson(locations: VetResult[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: locations.map((location) => ({
      type: "Feature",
      id: location.id,
      properties: { id: location.id },
      geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
    })),
  };
}

/** Add the clustered clinic source and its glow/cluster/diamond layers. */
export function addClinicLayers(map: MlMap, data: GeoJSON.FeatureCollection<GeoJSON.Point>): void {
  if (!map.getSource("clinics")) {
    map.addSource("clinics", {
      type: "geojson",
      data,
      promoteId: "id",
      cluster: true,
      clusterMaxZoom: MAP_CONFIG.clusterMaxZoom,
      clusterRadius: MAP_CONFIG.clusterRadius,
    });
  }

  const layers: LayerSpecification[] = [
    {
      id: "clinic-glow",
      type: "circle",
      source: "clinics",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#a34de0",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 11, 15, 16],
        "circle-blur": 1,
        "circle-opacity": 0.32,
      },
    },
    {
      id: "clinic-clusters",
      type: "circle",
      source: "clinics",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#1c1430", 25, "#251539", 75, "#301144"],
        "circle-radius": ["step", ["get", "point_count"], 17, 25, 21, 75, 26],
        "circle-stroke-color": "#d6aa4b",
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.92,
        "circle-opacity": 0.94,
      },
    },
    {
      id: "clinic-cluster-count",
      type: "symbol",
      source: "clinics",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
      },
      paint: { "text-color": "#f1bd4f" },
    },
    {
      id: "clinic-diamonds",
      type: "symbol",
      source: "clinics",
      filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], ""]],
      layout: {
        "icon-image": "clinic-diamond",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.72, 12, 1, 15, 1.15],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
  ];
  layers.forEach((layer) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  });

  if (!map.getSource("selected-clinic")) {
    map.addSource("selected-clinic", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  const selectedLayers: LayerSpecification[] = [
    {
      id: "clinic-selected-glow",
      type: "circle",
      source: "selected-clinic",
      paint: { "circle-color": "#c56fff", "circle-radius": 18, "circle-blur": 0.9, "circle-opacity": 0.5 },
    },
    {
      id: "clinic-diamond-selected",
      type: "symbol",
      source: "selected-clinic",
      layout: {
        "icon-image": "clinic-diamond-selected",
        "icon-size": 1.28,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
  ];
  selectedLayers.forEach((layer) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  });
}

/* ------------------------------------------------------------------ *
 *  3D view: keyless raster-DEM terrain + extruded buildings          *
 *  (ported from the prototype's script.js). All lazy — nothing is    *
 *  fetched until the 3D toggle is switched on for the first time.    *
 * ------------------------------------------------------------------ */

/** Attach the keyless Mapterhorn terrain DEM. No-op if tiles can't load. */
export function ensureTerrain(map: MlMap): void {
  try {
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        tiles: [MAP_CONFIG.terrainTilesUrl],
        encoding: "terrarium",
        tileSize: 512,
        maxzoom: 12,
        attribution:
          '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">© Mapterhorn</a>',
      });
    }
    map.setTerrain({ source: "terrain-dem", exaggeration: 1.25 });
  } catch {
    // Terrain unavailable (offline / blocked) — 3D degrades to pitch only.
  }
}

export function removeTerrain(map: MlMap): void {
  try {
    map.setTerrain(null);
  } catch {
    // no-op
  }
}

/**
 * Add (once) and toggle the extruded-buildings layer. Only the vector
 * basemaps expose an `openmaptiles` source, so satellite silently skips
 * buildings and relies on terrain + pitch for its 3D read.
 */
export function ensureBuildings3d(map: MlMap, visible: boolean): void {
  if (!map.getSource("openmaptiles")) return;
  if (!map.getLayer("buildings-3d")) {
    const firstSymbol = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
    try {
      map.addLayer(
        {
          id: "buildings-3d",
          source: "openmaptiles",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 14.5,
          layout: { visibility: visible ? "visible" : "none" },
          paint: {
            // Dark violet silhouettes warming to a gold crown on the tallest towers.
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "render_height"], 8],
              0, "#181026",
              45, "#241040",
              140, "#3a1f56",
              320, "#54401f",
            ],
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14.5, 0,
              15, ["coalesce", ["get", "render_height"], 8],
            ],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.88,
            "fill-extrusion-vertical-gradient": true,
          },
        } as LayerSpecification,
        firstSymbol
      );
    } catch {
      return;
    }
  }
  if (map.getLayer("buildings-3d")) {
    map.setLayoutProperty("buildings-3d", "visibility", visible ? "visible" : "none");
  }
}

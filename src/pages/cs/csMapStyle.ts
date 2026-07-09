/**
 * CitySignal · v7 фирменный стиль карты «csbrand».
 *
 *  Полностью авторская отрисовка Москвы в палитре CitySignal поверх векторных
 *  тайлов MapTiler (схема OpenMapTiles). Перенесено точь-в-точь из
 *  `journey-prod.jsx` (v7): палитра CS_PAL, генератор стиля makeCSStyle,
 *  кинематографичное небо applyCinematicSky.
 *
 *  Тайлы и глифы (бренд-моно JetBrains Mono) идут с MapTiler по зашитому ключу.
 */

import type { StyleSpecification, Map as MlMap } from "maplibre-gl"

export const MAPTILER_KEY = "r1IYbrF2LfLWCyt8CxIc"

type Pal = Record<string, string | number>

const CS_PAL: { light: Pal; dark: Pal } = {
  light: { bg: "#E4E4E1", water: "#A9BEEA", green: "#D6D9CC", greenHi: "#CFD4C4", building: "#D3D3CB", b3d: "#CFCFC6", bout: "#C2C2B9", road: "#FFFFFF", roadHi: "#FFFFFF", casing: "#C6C6BE", rail: "#C9C9C1", admin0: "rgba(13,13,13,0.34)", admin1: "rgba(13,13,13,0.16)", text: "#0D0D0D", text2: "rgba(13,13,13,0.62)", halo: "#E4E4E1", roadText: "rgba(13,13,13,0.6)", roadHalo: "#FFFFFF", accent: "#0055FF", light3d: "#FFFFFF", lightI: 0.5 },
  dark: { bg: "#131418", water: "#16203B", green: "#1A201C", greenHi: "#1E241F", building: "#202329", b3d: "#262A34", bout: "#2B2F39", road: "#3E4350", roadHi: "#4A5063", casing: "#1C1F27", rail: "#2A2D36", admin0: "rgba(255,255,255,0.32)", admin1: "rgba(255,255,255,0.14)", text: "#F3F3F1", text2: "rgba(243,243,241,0.6)", halo: "#0F1014", roadText: "rgba(243,243,241,0.62)", roadHalo: "#10121A", accent: "#3D7BFF", light3d: "#B9CCF2", lightI: 0.42 },
}

export function makeCSStyle(dark: boolean): StyleSpecification {
  const P = dark ? CS_PAL.dark : CS_PAL.light
  const nm = ["coalesce", ["get", "name:ru"], ["get", "name:latin"], ["get", "name"]]
  const F = ["JetBrains Mono Medium"] // наш бренд-моно (MapTiler раздаёт его MapLibre-совместимыми glyph-ами)
  return {
    version: 8,
    name: "CitySignal " + (dark ? "Dark" : "Light"),
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`,
    light: { anchor: "viewport", position: [1.15, 210, 28], color: P.light3d as string, intensity: P.lightI as number },
    sources: { composite: { type: "vector", url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}` } },
    layers: [
      { id: "cs-bg", type: "background", paint: { "background-color": P.bg } },
      { id: "cs-landcover", type: "fill", source: "composite", "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "grass", "scrub", "heath", "wetland"], true, false],
        paint: { "fill-color": P.green, "fill-opacity": 0.65 } },
      { id: "cs-park", type: "fill", source: "composite", "source-layer": "park",
        paint: { "fill-color": P.green, "fill-opacity": 0.55 } },
      { id: "cs-water", type: "fill", source: "composite", "source-layer": "water",
        paint: { "fill-color": P.water } },
      { id: "cs-water-edge", type: "line", source: "composite", "source-layer": "water",
        paint: { "line-color": P.accent, "line-opacity": 0.4, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 1.6] } },
      { id: "cs-waterway", type: "line", source: "composite", "source-layer": "waterway",
        paint: { "line-color": P.water, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 16, 2.4] } },
      { id: "cs-building", type: "fill", source: "composite", "source-layer": "building", minzoom: 13,
        // colour flips to signal-blue when the feature-state `hl` is set (the
        // event's building) — recolours the real building in place, so there's
        // no overlay extrusion to z-fight with.
        paint: { "fill-color": ["case", ["boolean", ["feature-state", "hl"], false], P.accent, P.building], "fill-outline-color": P.bout, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.92] } },
      { id: "cs-building-3d", type: "fill-extrusion", source: "composite", "source-layer": "building", minzoom: 14,
        paint: { "fill-extrusion-color": ["case", ["boolean", ["feature-state", "hl"], false], P.accent, P.b3d],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["coalesce", ["to-number", ["get", "render_height"]], 8]],
          "fill-extrusion-base": ["coalesce", ["to-number", ["get", "render_min_height"]], 0],
          "fill-extrusion-opacity": 0.95 } },
      { id: "cs-road-casing", type: "line", source: "composite", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": P.casing,
          "line-width": ["interpolate", ["linear"], ["zoom"],
            8, ["match", ["get", "class"], ["motorway", "trunk"], 2.4, 0.6],
            14, ["match", ["get", "class"], ["motorway", "trunk"], 14, ["primary", "secondary"], 9, 5],
            18, ["match", ["get", "class"], ["motorway", "trunk"], 34, ["primary", "secondary"], 24, 16]] } },
      { id: "cs-road", type: "line", source: "composite", "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["match", ["get", "class"], ["motorway", "trunk"], P.roadHi, P.road],
          "line-width": ["interpolate", ["linear"], ["zoom"],
            8, ["match", ["get", "class"], ["motorway", "trunk"], 1.2, 0.2],
            14, ["match", ["get", "class"], ["motorway", "trunk"], 10, ["primary", "secondary"], 6, 3],
            18, ["match", ["get", "class"], ["motorway", "trunk"], 28, ["primary", "secondary"], 18, 11]] } },
      { id: "cs-rail", type: "line", source: "composite", "source-layer": "transportation", minzoom: 11,
        // surface rail only — drop "transit" (metro) so the city centre isn't
        // criss-crossed with blue lines; muted so it never competes with the
        // signal-blue event-building highlight.
        filter: ["match", ["get", "class"], ["rail"], true, false],
        paint: { "line-color": P.casing, "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 16, 1.6], "line-dasharray": [2, 2.2] } },
      { id: "cs-admin-1", type: "line", source: "composite", "source-layer": "boundary",
        filter: ["all", [">=", ["get", "admin_level"], 3], ["==", ["get", "maritime"], 0]],
        paint: { "line-color": P.admin1, "line-width": 0.7, "line-dasharray": [3, 2] } },
      { id: "cs-admin-0", type: "line", source: "composite", "source-layer": "boundary",
        filter: ["all", ["<=", ["get", "admin_level"], 2], ["==", ["get", "maritime"], 0]],
        paint: { "line-color": P.admin0, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 10, 1.4] } },
      { id: "cs-road-label", type: "symbol", source: "composite", "source-layer": "transportation_name", minzoom: 13,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], true, false],
        layout: { "symbol-placement": "line", "text-field": nm, "text-font": F, "text-size": 10, "text-letter-spacing": 0.02, "text-max-angle": 30 },
        paint: { "text-color": P.roadText, "text-halo-color": P.roadHalo, "text-halo-width": 1.3 } },
      { id: "cs-place-minor", type: "symbol", source: "composite", "source-layer": "place", minzoom: 11,
        filter: ["match", ["get", "class"], ["suburb", "neighbourhood", "quarter", "village", "hamlet"], true, false],
        layout: { "text-field": nm, "text-font": F,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 12.5], "text-letter-spacing": 0.04, "text-transform": "uppercase", "text-max-width": 8 },
        paint: { "text-color": P.text2, "text-halo-color": P.halo, "text-halo-width": 1.4 } },
      { id: "cs-place-major", type: "symbol", source: "composite", "source-layer": "place",
        filter: ["match", ["get", "class"], ["city", "town"], true, false],
        layout: { "text-field": nm, "text-font": F,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11.5, 12, 19], "text-letter-spacing": 0.05, "text-transform": "uppercase", "text-max-width": 7 },
        paint: { "text-color": P.text, "text-halo-color": P.halo, "text-halo-width": 1.7 } },
    ],
  } as unknown as StyleSpecification
}

export const CS_STYLE_LIGHT = makeCSStyle(false)
export const CS_STYLE_DARK = makeCSStyle(true)

/** Кинематографичный наклон: небо + туман у горизонта (MapLibre setSky).
 *  Свет для 3D-зданий задаётся в style.light. Туман гаснет на большом зуме. */
export function applyCinematicSky(map: MlMap, dark: boolean) {
  try {
    map.setSky(
      dark
        ? {
            "sky-color": "#0C1430", "sky-horizon-blend": 0.7, "horizon-color": "#1A2542",
            "horizon-fog-blend": 0.7, "fog-color": "#131418", "fog-ground-blend": 0.85,
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 11, 0.4, 13, 0],
          }
        : {
            "sky-color": "#CFDCF2", "sky-horizon-blend": 0.6, "horizon-color": "#ECEEE9",
            "horizon-fog-blend": 0.7, "fog-color": "#E4E4E1", "fog-ground-blend": 0.82,
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 11, 0.4, 13, 0],
          }
    )
  } catch { /* старый MapLibre без setSky — пропускаем */ }
}

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { typeColors } from "../utils/coloring";
import { formatNumber } from "../utils/metrics";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const WORLD_BOUNDS = [
  [-160, -50],
  [170, 68],
];

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

const scaledSize = (pop) => {
  if (!pop || pop <= 0) return 3;
  return 0.5 + Math.sqrt(pop / 500000);
};

const toGeoJSON = (arr) => ({
  type: "FeatureCollection",
  features: arr.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    properties: {
      name: c.name,
      country: c.country,
      population: c.characteristics?.population,
      size: scaledSize(c.characteristics?.population),
      color: typeColors[c.type] || "#888888",
    },
  })),
});

const syncData = (map, { cities, activeType }) => {
  map
    .getSource("active-type")
    ?.setData(toGeoJSON(cities.filter((c) => c.type === activeType)));
};

const fitWorld = (map) =>
  map.fitBounds(WORLD_BOUNDS, { padding: 8, animate: false });

const TypeMap = ({ cities, activeType, onWebglError }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const dataRef = useRef({ cities, activeType });
  const onWebglErrorRef = useRef(onWebglError);

  useEffect(() => {
    onWebglErrorRef.current = onWebglError;
  }, [onWebglError]);

  useEffect(() => {
    const container = mapContainer.current;
    if (!container || mapRef.current) return undefined;

    if (!webglAvailable()) {
      onWebglErrorRef.current?.();
      return undefined;
    }

    let map;
    try {
      map = new maplibregl.Map({
        container,
        style: DARK_STYLE,
        bounds: WORLD_BOUNDS,
        fitBoundsOptions: { padding: 8 },
        minZoom: 0,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch (err) {
      console.error("MapLibre init failed:", err);
      onWebglErrorRef.current?.();
      return undefined;
    }

    mapRef.current = map;
    map.scrollZoom.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("active-type", { type: "geojson", data: toGeoJSON([]) });
      map.addLayer({
        id: "active-type-layer",
        type: "circle",
        source: "active-type",
        paint: {
          "circle-radius": ["get", "size"],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
        },
      });

      loadedRef.current = true;
      syncData(map, dataRef.current);

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

      map.on("mousemove", "active-type-layer", (e) => {
        const f = e.features[0];
        const { name, country, population } = f.properties;
        map.getCanvas().style.cursor = "pointer";
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<b>${name}</b>, ${country}<br>Population: ${formatNumber(population, 0)}`
          )
          .addTo(map);
      });

      map.on("mouseleave", "active-type-layer", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      map.resize();
      if (container.clientWidth !== lastWidth) {
        lastWidth = container.clientWidth;
        fitWorld(map);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      loadedRef.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    dataRef.current = { cities, activeType };
    if (mapRef.current && loadedRef.current) syncData(mapRef.current, dataRef.current);
  }, [cities, activeType]);

  return <div ref={mapContainer} className="type-map-canvas" />;
};

export default TypeMap;

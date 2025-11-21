import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { typeColors } from "../utils/coloring";
import { formatNumber } from "../utils/metrics";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TypeMap = ({ cities, activeType }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  // Adjust marker size by population
  const scaledSize = (pop) => {
    if (!pop || pop <= 0) return 3;
    return 0.5 + Math.sqrt(pop / 500000); // tweak as needed
  };

  const toGeoJSON = (arr, scalePopulation = false) => ({
    type: "FeatureCollection",
    features: arr.map((c) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [c.lon, c.lat],
      },
      properties: {
        name: c.name,
        country: c.country,
        population: c.population,
        size: scalePopulation ? scaledSize(c.population) : 2,
        color: typeColors[c.type] || "#888888",
      },
    })),
  });

  const allCitiesGeoJSON = toGeoJSON(cities, false);

  const activeTypeGeoJSON = toGeoJSON(
    cities.filter((c) => c.type === activeType),
    true
  );

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center: [10, 20],
      zoom: 1.4,
    });

    mapRef.current = map;

    map.on("load", () => {
      // --- Background all cities ---
      map.addSource("all-cities", {
        type: "geojson",
        data: allCitiesGeoJSON,
      });

      map.addLayer({
        id: "all-cities-layer",
        type: "circle",
        source: "all-cities",
        paint: {
          "circle-radius": 2,
          "circle-color": "#999",
          "circle-opacity": 0.25,
        },
      });

      // --- Active type (pop-scaled) ---
      map.addSource("active-type", {
        type: "geojson",
        data: activeTypeGeoJSON,
      });

      map.addLayer({
        id: "active-type-layer",
        type: "circle",
        source: "active-type",
        paint: {
          "circle-radius": ["get", "size"],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
        },
      });

      // --- Hover popup ---
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      map.on("mousemove", "active-type-layer", (e) => {
        const f = e.features[0];
        const { name, country, population } = f.properties;

        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<b>${name}</b>, ${country}<br>Population: ${(formatNumber(population, 0))}`
          )
          .addTo(map);
      });

      map.on("mouseleave", "active-type-layer", () => popup.remove());
    });
  }, []);

  // Update active type data when switching types
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("active-type")) return;

    const nextData = toGeoJSON(
      cities.filter((c) => c.type === activeType),
      true
    );

    map.getSource("active-type").setData(nextData);
  }, [activeType]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "480px",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    />
  );
};

export default TypeMap;

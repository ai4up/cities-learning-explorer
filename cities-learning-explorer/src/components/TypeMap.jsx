import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist";

const TypeMap = ({ cities, activeType }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Fail-safe guards
    if (!Array.isArray(cities) || cities.length === 0) {
      Plotly.purge(mapRef.current);
      return;
    }

    const typeCities = cities.filter((c) => c.type === activeType);

    // Avoid crashes when switching types
    if (typeCities.length === 0) {
      Plotly.purge(mapRef.current);
      return;
    }

    // Scale marker size by population (log-scale)
    const markerSizes = typeCities.map((c) => {
      const p = Number(c.population);
      if (!p || p <= 0) return 6;
      return 1 + Math.sqrt(p/100_000); // adjustable scaling
    });

    const trace = {
      type: "scattergeo",
      mode: "markers",
      lat: typeCities.map((c) => c.lat),
      lon: typeCities.map((c) => c.lon),
      text: typeCities.map(
        (c) =>
          `<b>${c.name}, ${c.country}</b><br>Population: ${Math.round(
            c.population
          ).toLocaleString()}`
      ),
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        size: markerSizes,
        color: "#58a6ff",
        line: { width: 0.5, color: "#c9d1d9" },
        opacity: 0.85,
      },
    };

    const layout = {
      dragmode: false,
      geo: {
        projection: { type: "natural earth" },
        showland: true,
        landcolor: "rgba(60,60,60,0.25)",
        showcountries: true,
        countrycolor: "#444",
        coastlinecolor: "#555",
        bgcolor: "rgba(0,0,0,0)",
      },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      height: 380,             // ⬅ Bigger map
    };

    Plotly.newPlot(mapRef.current, [trace], layout, {
      displayModeBar: false,
      responsive: true,
    });

    const resize = () => Plotly.Plots.resize(mapRef.current);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      Plotly.purge(mapRef.current);
    };
  }, [cities, activeType]);

  return (
    <div
      ref={mapRef}
      className="typology-map-plot"
      style={{ width: "100%", height: "380px" }} // bigger display area
    />
  );
};

export default TypeMap;

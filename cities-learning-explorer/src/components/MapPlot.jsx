import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";

const MapPlot = ({ samples, colors, sizes, onSelectSample }) => {
  const plotRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!plotRef.current) return;
    if (!samples.length) return;

    const lats = samples.map((s) =>
      s.lat !== undefined ? s.lat : s.latitude ?? null
    );
    const lons = samples.map((s) =>
      s.lon !== undefined ? s.lon : s.longitude ?? null
    );

    const markerSizes = sizes.map((s) => s * 1.4); // slightly larger on map

    const trace = {
      type: "scattergeo",
      mode: "markers",
      lat: lats,
      lon: lons,
      text: samples.map(
        (s) => `${s.name}${s.country ? ", " + s.country : ""}`
      ),
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        color: colors,
        size: markerSizes,
        line: { width: 0 },
        opacity: 1.0,
      },
    };

    const layout = {
      geo: {
        projection: { type: "natural earth" },
        showland: true,
        landcolor: "#1b1f23",
        showocean: true,
        oceancolor: "#0d1117",
        bgcolor: "#0d1117",
      },
      margin: { l: 0, r: 0, b: 0, t: 0 },
      showlegend: false,
      uirevision: "map-view",
    };

    const config = { displayModeBar: true, responsive: true };

    const clickHandler = (ev) => {
      if (ev && ev.points && ev.points.length > 0) {
        const idx = ev.points[0].pointNumber;
        const selected = samples[idx];
        if (selected) {
          onSelectSample((prev) => {
            if (prev && prev.id === selected.id) return null;
            return selected;
          });
        }
      }
    };

    if (!initializedRef.current) {
      Plotly.newPlot(plotRef.current, [trace], layout, config);
      plotRef.current.on("plotly_click", clickHandler);
      initializedRef.current = true;
    } else {
      Plotly.react(plotRef.current, [trace], layout, config);
      plotRef.current.removeAllListeners &&
        plotRef.current.removeAllListeners("plotly_click");
      plotRef.current.on("plotly_click", clickHandler);
    }
  }, [samples, colors, sizes, onSelectSample]);

  return <div className="plot-container" ref={plotRef} />;
};

export default MapPlot;

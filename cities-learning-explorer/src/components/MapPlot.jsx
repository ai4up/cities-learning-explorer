import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";

const MapPlot = ({ samples, colors, sizes, onSelectSample }) => {
  const plotRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!plotRef.current) return;
    if (!samples.length) return;

    const visible = samples
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => sizes[i] > 0 && colors[i] !== "rgba(0,0,0,0)");

    const lats = visible.map(v =>
      v.s.lat !== undefined ? v.s.lat : v.s.latitude ?? null
    );
    const lons = visible.map(v =>
      v.s.lon !== undefined ? v.s.lon : v.s.longitude ?? null
    );
    const markerSizes = visible.map(v => sizes[v.i] * 1.4);
    const markerColors = visible.map(v => colors[v.i]);
    const labels = visible.map(
      v => `${v.s.name}${v.s.country ? ", " + v.s.country : ""}`
    );

    const trace = {
      type: "scattergeo",
      mode: "markers",
      lat: lats,
      lon: lons,
      text: labels,
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        color: markerColors,
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
        const realIndex = visible[idx].i;
        const selected = samples[realIndex];

        if (selected) {
          onSelectSample((prev) =>
            prev && prev.id === selected.id ? null : selected
          );
        }
      }
    };

    if (!initializedRef.current) {
      Plotly.newPlot(plotRef.current, [trace], layout, config);
      plotRef.current.on("plotly_click", clickHandler);
      initializedRef.current = true;
    } else {
      Plotly.react(plotRef.current, [trace], layout, config);
      plotRef.current.removeAllListeners?.("plotly_click");
      plotRef.current.on("plotly_click", clickHandler);
    }
  }, [samples, colors, sizes, onSelectSample]);

  return <div className="plot-container" ref={plotRef} />;
};

export default MapPlot;

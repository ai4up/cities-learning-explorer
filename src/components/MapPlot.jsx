import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";

const MapPlot = ({ samples, colors, sizes, onSelectSample, setSearchValue, viewMode }) => {
  const plotRef = useRef(null);
  const initializedRef = useRef(false);

  const computeLayoutSize = () => {
    if (!plotRef.current) return null;
    const rect = plotRef.current.getBoundingClientRect();
    const width = rect.width || plotRef.current.offsetWidth || 0;
    if (!width) return null;
    const desiredHeight =
      viewMode === "both"
        ? Math.max(width / 2, 360)
        : Math.max(rect.height, width / 2);
    return { width, height: desiredHeight };
  };

  useEffect(() => {
    if (!plotRef.current || !samples.length) return;

    let currentShowCountries = false;
    let currentScale = 1;

    if (plotRef.current && plotRef.current.layout && plotRef.current.layout.geo) {
      currentShowCountries = plotRef.current.layout.geo.showcountries || false;
      currentScale = plotRef.current.layout.geo.projection?.scale || 1;
    }

    const visible = samples
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => sizes[i] > 0 && colors[i] !== "rgba(0,0,0,0)");

    const lats = visible.map(v =>
      v.s.lat !== undefined ? v.s.lat : v.s.latitude ?? null
    );
    const lons = visible.map(v =>
      v.s.lon !== undefined ? v.s.lon : v.s.longitude ?? null
    );

    const zoomMultiplier = Math.max(1, Math.sqrt(currentScale));
    const markerSizes = visible.map(v => sizes[v.i] * zoomMultiplier);
    const markerColors = visible.map(v => colors[v.i]);
    const labels = visible.map(v => `${v.s.name}${v.s.country ? ", " + v.s.country : ""}`);

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

    const size = computeLayoutSize();

    const layout = {
      geo: {
        projection: {
          type: "natural earth",
          scale: plotRef.current?.layout?.geo?.projection?.scale
        },
        center: plotRef.current?.layout?.geo?.center,
        showframe: false,
        showland: true,
        landcolor: "#1b1f23",
        showocean: true,
        oceancolor: "#0d1117",
        bgcolor: "#0d1117",
        showcountries: currentShowCountries,
        countrycolor: "#444",
        countrywidth: 0.5,
        lataxis: { showgrid: false, zeroline: false },
        lonaxis: { showgrid: false, zeroline: false },
      },
      paper_bgcolor: "#0d1117",
      plot_bgcolor: "#0d1117",
      margin: { l: 0, r: 0, b: 0, t: 0 },
      showlegend: false,
      uirevision: "map-view",
      autosize: true,
      width: size?.width,
      height: size?.height,
    };

    const config = { displayModeBar: false, responsive: true };

    const clickHandler = (ev) => {
      if (ev?.points?.length > 0) {
        const idx = ev.points[0].pointNumber;
        const selected = samples[visible[idx].i];
        setSearchValue("");
        if (selected) {
          onSelectSample(prev => prev?.id === selected.id ? null : selected);
        }
      }
    };

    const handleRelayout = (eventData) => {
      let lonSpan = null;
      if (eventData["geo.lonaxis.range"]) {
        lonSpan = Math.abs(eventData["geo.lonaxis.range"][1] - eventData["geo.lonaxis.range"][0]);
      } else if (eventData["geo.projection.scale"]) {
        lonSpan = 360 / eventData["geo.projection.scale"];
      }

      if (lonSpan !== null) {
        const shouldShowCountries = lonSpan < 180;
        if (shouldShowCountries !== plotRef.current.layout.geo.showcountries) {
          Plotly.relayout(plotRef.current, { "geo.showcountries": shouldShowCountries });
        }
        const zoomMultiplier = Math.max(1, Math.sqrt(180 / lonSpan));
        const newSizes = visible.map(v => sizes[v.i] * zoomMultiplier);
        Plotly.restyle(plotRef.current, { "marker.size": [newSizes] }, [0]);
      }
    };

    if (!initializedRef.current) {
      Plotly.newPlot(plotRef.current, [trace], layout, config);
      initializedRef.current = true;
    } else {
      Plotly.react(plotRef.current, [trace], layout, config);
    }

    plotRef.current.removeAllListeners("plotly_click");
    plotRef.current.removeAllListeners("plotly_relayout");
    plotRef.current.on("plotly_click", clickHandler);
    plotRef.current.on("plotly_relayout", handleRelayout);

    return () => {
      if (plotRef.current) {
        plotRef.current.removeAllListeners("plotly_click");
        plotRef.current.removeAllListeners("plotly_relayout");
      }
    };
  }, [samples, colors, sizes, onSelectSample]);

  return <div className="plot-container" ref={plotRef} />;
};

export default MapPlot;

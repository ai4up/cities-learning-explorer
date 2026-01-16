import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";

const MapPlot = ({ samples, colors, sizes, onSelectSample, selectedSample, setSearchValue, viewMode }) => {
  const plotRef = useRef(null);
  const initializedRef = useRef(false);
  const isInternalClick = useRef(false);
  const lastScaleRef = useRef(1);
  const lastCenterRef = useRef({ lat: 0, lon: 0 });
  const MAX_ZOOM_MULTIPLIER = 3;

  useEffect(() => {
    if (!plotRef.current || !samples.length) return;

    // 1. Determine current state from layout or refs
    let currentShowCountries = plotRef.current?.layout?.geo?.showcountries || false;
    let currentScale = lastScaleRef.current;
    let currentCenter = lastCenterRef.current;

    // 2. Handle External Selection (Auto-zoom to city)
    if (selectedSample && !isInternalClick.current) {
      const lat = selectedSample.lat ?? selectedSample.latitude;
      const lon = selectedSample.lon ?? selectedSample.longitude;

      if (lat !== undefined && lon !== undefined) {
        currentScale = 3;
        currentCenter = { lat, lon };
        currentShowCountries = true;
        lastScaleRef.current = 3;
        lastCenterRef.current = currentCenter;
      }
    }

    isInternalClick.current = false;

    // 3. Filter visible points based on colors and sizes
    const visible = samples
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => sizes[i] > 0 && colors[i] !== "rgba(0,0,0,0)");

    // 4. Uniform Scaling Calculation with Max Cap
    const zoomMultiplier = Math.min(
      MAX_ZOOM_MULTIPLIER,
      Math.max(1, Math.sqrt(currentScale))
    );
    const markerSizes = visible.map(v => sizes[v.i] * zoomMultiplier);

    const trace = {
      type: "scattergeo",
      mode: "markers",
      lat: visible.map(v => v.s.lat ?? v.s.latitude ?? null),
      lon: visible.map(v => v.s.lon ?? v.s.longitude ?? null),
      text: visible.map(v => `${v.s.name}${v.s.country ? ", " + v.s.country : ""}`),
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        color: visible.map(v => colors[v.i]),
        size: markerSizes,
        line: { width: 0 },
        opacity: 1.0,
      },
    };

    const layout = {
      geo: {
        projection: {
          type: "natural earth",
          scale: currentScale
        },
        center: currentCenter,
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
      uirevision: "map_state",
      autosize: true,
    };

    const config = { displayModeBar: false, responsive: true };

    const clickHandler = (ev) => {
      if (ev?.points?.length > 0) {
        const idx = ev.points[0].pointNumber;
        const selected = samples[visible[idx].i];
        isInternalClick.current = true;
        setSearchValue("");
        if (selected) {
          onSelectSample(prev => prev?.id === selected.id ? null : selected);
        }
      }
    };

    const handleRelayout = (eventData) => {
      let scale = eventData["geo.projection.scale"];
      if (!scale && eventData["geo.lonaxis.range"]) {
        scale = 360 / Math.abs(eventData["geo.lonaxis.range"][1] - eventData["geo.lonaxis.range"][0]);
      }

      if (eventData["geo.center"]) {
        lastCenterRef.current = eventData["geo.center"];
      }

      if (scale) {
        lastScaleRef.current = scale;

        const shouldShowCountries = scale > 2;
        if (shouldShowCountries !== plotRef.current.layout.geo.showcountries) {
          Plotly.relayout(plotRef.current, { "geo.showcountries": shouldShowCountries });
        }

        const zoomMult = Math.min(MAX_ZOOM_MULTIPLIER, Math.max(1, Math.sqrt(scale)));
        const newSizes = visible.map(v => sizes[v.i] * zoomMult);
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
  }, [samples, colors, sizes, onSelectSample, selectedSample, viewMode]);

  return <div className="plot-container" ref={plotRef} />;
};

export default MapPlot;

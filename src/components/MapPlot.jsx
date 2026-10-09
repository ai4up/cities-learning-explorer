import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";

const MAX_ZOOM_MULTIPLIER = 3;

// Latitudes covering all cities; used as the visible band on portrait screens.
const PORTRAIT_LAT_RANGE = [-58, 78];
const PORTRAIT_CENTER_LON = 15;

// Natural earth projection (y in radians-units; x scale at the equator).
const naturalEarthY = (deg) => {
  const phi = (deg * Math.PI) / 180;
  const p2 = phi * phi;
  const p4 = p2 * p2;
  return phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
};
const NATURAL_EARTH_X_EQUATOR = 0.8707;

// Plotly fits the whole world into the container width, which letterboxes the
// map into a thin band on portrait screens. There, show a lon/lat box with the
// container's aspect ratio instead, so the map fills the full screen.
const getDefaultView = (el) => {
  const w = el?.clientWidth || 0;
  const h = el?.clientHeight || 0;
  if (!w || !h || h <= w) {
    return { center: { lat: 0, lon: 0 }, lonRange: null, latRange: null };
  }

  const [latMin, latMax] = PORTRAIT_LAT_RANGE;
  const height = naturalEarthY(latMax) - naturalEarthY(latMin);
  const lonSpan = ((w / h) * height * 180) / (Math.PI * NATURAL_EARTH_X_EQUATOR);
  const lon = PORTRAIT_CENTER_LON;
  return {
    center: { lat: (latMin + latMax) / 2, lon },
    lonRange: [lon - lonSpan / 2, lon + lonSpan / 2],
    latRange: [...PORTRAIT_LAT_RANGE],
  };
};

const defaultViewLayout = (view) => ({
  "geo.projection.scale": 1,
  "geo.center": view.center,
  "geo.lonaxis.range": view.lonRange,
  "geo.lataxis.range": view.latRange,
  "geo.showcountries": false,
});

const sameView = (a, b) =>
  JSON.stringify([a?.lonRange, a?.latRange]) === JSON.stringify([b?.lonRange, b?.latRange]);

const MapPlot = ({ samples, colors, sizes, onSelectSample, selectedSample, setSearchValue, viewMode, resetToken }) => {
  const plotRef = useRef(null);
  const initializedRef = useRef(false);
  const isInternalClick = useRef(false);
  const lastScaleRef = useRef(1);
  const lastCenterRef = useRef(null);
  const defaultViewRef = useRef(null);
  const userMovedRef = useRef(false);

  useEffect(() => {
    if (!plotRef.current || resetToken === 0) return;

    const view = getDefaultView(plotRef.current);
    defaultViewRef.current = view;
    lastScaleRef.current = 1;
    lastCenterRef.current = view.center;
    userMovedRef.current = false;

    Plotly.relayout(plotRef.current, defaultViewLayout(view));
  }, [resetToken]);

  // Keep the default view filling the container on resize / rotation, unless the user has moved the map.
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!initializedRef.current || userMovedRef.current) return;
      const view = getDefaultView(el);
      if (sameView(view, defaultViewRef.current)) return;

      defaultViewRef.current = view;
      lastScaleRef.current = 1;
      lastCenterRef.current = view.center;
      Plotly.relayout(el, defaultViewLayout(view));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!plotRef.current || !samples.length) return;

    if (!defaultViewRef.current) {
      defaultViewRef.current = getDefaultView(plotRef.current);
      lastCenterRef.current = defaultViewRef.current.center;
    }
    const defaultView = defaultViewRef.current;

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
        userMovedRef.current = true;
      }
    }

    isInternalClick.current = false;

    // 3. Filter visible points based on colors and sizes
    const visible = samples
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => sizes[i] > 0 && colors[i] !== "rgba(0,0,0,0)");

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
        lataxis: { showgrid: false, zeroline: false, ...(defaultView.latRange && { range: defaultView.latRange }) },
        lonaxis: { showgrid: false, zeroline: false, ...(defaultView.lonRange && { range: defaultView.lonRange }) },
      },
      paper_bgcolor: "#0d1117",
      plot_bgcolor: "#0d1117",
      margin: { l: 0, r: 0, b: 0, t: 0 },
      showlegend: false,
      uirevision: resetToken,
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
      const isUserGesture =
        "geo.center.lon" in eventData || "geo.center.lat" in eventData;
      if (isUserGesture) {
        userMovedRef.current = true;
        lastCenterRef.current = {
          lon: eventData["geo.center.lon"] ?? lastCenterRef.current?.lon ?? 0,
          lat: eventData["geo.center.lat"] ?? lastCenterRef.current?.lat ?? 0,
        };
      }

      let scale = eventData["geo.projection.scale"];
      if (!scale && !defaultViewRef.current?.lonRange && eventData["geo.lonaxis.range"]) {
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

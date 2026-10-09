import Plotly from 'plotly.js-dist';
import React, { useEffect, useRef } from "react";
import { isCompactViewport } from "../utils/viewport";

const MAX_ZOOM_MULTIPLIER = 3;

// Natural earth projection: y of a latitude, and the x scale at the equator.
const naturalEarthY = (deg) => {
  const phi = (deg * Math.PI) / 180;
  const p2 = phi * phi;
  const p4 = p2 * p2;
  return phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
};
const WORLD_WIDTH = 2 * Math.PI * 0.8707;
// Horizontal scale at a latitude, relative to the equator.
const naturalEarthXFactor = (deg) => {
  const phi = (deg * Math.PI) / 180;
  const p2 = phi * phi;
  const p4 = p2 * p2;
  return (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))) / 0.8707;
};

// Latitude bands: preferred (all cities, no Antarctica), full globe, and the tightest crop allowed.
const LAT_PREFERRED = [-58, 78];
const LAT_FULL = [-90, 90];
const LAT_MIN = [-45, 68];
// Longitudes spanned by the cities (Americas to New Zealand).
const CITY_LON_SPAN = 300;
const CITY_LON_CENTER = 28;
const PORTRAIT_LON_CENTER = 15;

const bandHeight = ([south, north]) => naturalEarthY(north) - naturalEarthY(south);
const lerpBand = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lonSpanFor = (aspect, band) => (aspect * bandHeight(band) * 360) / WORLD_WIDTH;
const aspectFor = (lonSpan, band) => ((lonSpan / 360) * WORLD_WIDTH) / bandHeight(band);

// Interpolate between two latitude bands until the visible longitude span hits the target.
const solveBand = (aspect, from, to, targetLonSpan) => {
  let lo = 0;
  let hi = 1;
  const grows = bandHeight(to) > bandHeight(from);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const span = lonSpanFor(aspect, lerpBand(from, to, mid));
    if (span < targetLonSpan === grows) lo = mid;
    else hi = mid;
  }
  return lerpBand(from, to, (lo + hi) / 2);
};

const pickLatBand = (aspect) => {
  const fullAt = aspectFor(CITY_LON_SPAN, LAT_FULL);
  const preferredAt = aspectFor(CITY_LON_SPAN, LAT_PREFERRED);
  const worldAt = aspectFor(360, LAT_PREFERRED);

  // Portrait: hide Antarctica and crop longitudes; the user pans sideways.
  if (aspect <= 1) return LAT_PREFERRED;
  // Squarish: gradually show more latitude so more longitude fits.
  if (aspect < fullAt) return lerpBand(LAT_PREFERRED, LAT_FULL, (aspect - 1) / (fullAt - 1));
  // Landscape: keep all cities in view, using as little latitude as possible.
  if (aspect < preferredAt) return solveBand(aspect, LAT_PREFERRED, LAT_FULL, CITY_LON_SPAN);
  if (aspect <= worldAt) return LAT_PREFERRED;
  // Very wide: the whole globe fits horizontally, so crop latitude instead.
  if (aspect < aspectFor(360, LAT_MIN)) return solveBand(aspect, LAT_PREFERRED, LAT_MIN, 360);
  return LAT_MIN;
};

const pickLonCenter = (span) => {
  if (span >= 360) return 0;
  if (span >= CITY_LON_SPAN) return (CITY_LON_CENTER * (360 - span)) / (360 - CITY_LON_SPAN);
  const t = Math.min(1, Math.max(0, (span - 200) / (CITY_LON_SPAN - 200)));
  return PORTRAIT_LON_CENTER + (CITY_LON_CENTER - PORTRAIT_LON_CENTER) * t;
};

// By default Plotly fits the whole globe into the container, leaving empty bands
// above/below (or left/right). Instead pick a lon/lat box with the container's
// aspect ratio so the map always fills the full plot area.
const getDefaultView = (el) => {
  const w = el?.clientWidth || 0;
  const h = el?.clientHeight || 0;
  if (!w || !h) {
    return { center: { lat: 0, lon: 0 }, lonRange: null, latRange: null };
  }

  const aspect = w / h;
  const latRange = pickLatBand(aspect).map((v) => Math.round(v * 100) / 100);
  const lonSpan = Math.min(360, lonSpanFor(aspect, latRange));
  const lon = pickLonCenter(lonSpan);
  const lonRange = lonSpan >= 360 ? [-180, 180] : [lon - lonSpan / 2, lon + lonSpan / 2];
  return {
    center: { lat: (latRange[0] + latRange[1]) / 2, lon },
    lonRange: lonRange.map((v) => Math.round(v * 100) / 100),
    latRange,
  };
};

// How many pixels a centered city must move left to land in the middle of the
// map area that is not covered by the info panel (and open controls).
const getObstructionOffsetPx = (el) => {
  const root = el?.closest(".explorer-root");
  const panel = root?.querySelector(".info-panel");
  if (!panel) return 0;

  const map = el.getBoundingClientRect();
  const info = panel.getBoundingClientRect();
  // Hidden, or so wide that there is no uncovered area beside it.
  if (!info.width || info.width > map.width * 0.7 || info.left <= map.left) return 0;

  let left = map.left;
  const controls = root.querySelector(".controls");
  const controlsShown = controls && (controls.dataset.open === "true" || !isCompactViewport());
  if (controlsShown) {
    const c = controls.getBoundingClientRect();
    if (c.right < info.left) left = Math.max(left, c.right);
  }

  const right = Math.min(info.left, map.right);
  return map.left + map.width / 2 - (left + right) / 2;
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
        let centerLon = lon;
        const lonSpan = defaultView.lonRange ? defaultView.lonRange[1] - defaultView.lonRange[0] : 0;
        const offsetPx = getObstructionOffsetPx(plotRef.current);
        if (lonSpan && offsetPx) {
          const pxPerDeg = ((plotRef.current.clientWidth * currentScale) / lonSpan) * naturalEarthXFactor(lat);
          centerLon = ((((lon + offsetPx / pxPerDeg + 180) % 360) + 360) % 360) - 180;
        }
        currentCenter = { lat, lon: centerLon };
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

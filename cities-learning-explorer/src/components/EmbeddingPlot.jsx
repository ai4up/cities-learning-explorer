import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist";

const EmbeddingPlot = ({
  samples,
  colors,
  sizes,
  selectedDims,
  onSelectSample,
  resetToken,
  viewMode,
}) => {
  const plotRef = useRef(null);
  const axisRangesRef = useRef(null);
  const cameraRef = useRef(null);
  const initializedRef = useRef(false);
  const lastClickTsRef = useRef(0);
  const samplesRef = useRef(samples);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  const computeLayoutSize = () => {
    if (!plotRef.current) return null;

    const rect = plotRef.current.getBoundingClientRect();
    const width = rect.width || plotRef.current.offsetWidth || 0;
    if (!width) return null;

    let height;
    if (viewMode === "both") {
      height = Math.max(window.innerHeight / 2, 360);
    } else {
      height = window.innerHeight;
    }

    return { width, height };
  };

  // Compute axis ranges
  useEffect(() => {
    if (!samples.length || selectedDims.length !== 3) return;

    const [dx, dy, dz] = selectedDims.map((d) => parseInt(d, 10));
    const xs = samples.map((s) => s.embedding[dx]);
    const ys = samples.map((s) => s.embedding[dy]);
    const zs = samples.map((s) => s.embedding[dz]);
    const pad = 0.5;

    axisRangesRef.current = {
      x: [Math.min(...xs) - pad, Math.max(...xs) + pad],
      y: [Math.min(...ys) - pad, Math.max(...ys) + pad],
      z: [Math.min(...zs) - pad, Math.max(...zs) + pad],
    };
  }, [samples, selectedDims]);

  // Build/update plot
  useEffect(() => {
    if (!plotRef.current || !axisRangesRef.current || selectedDims.length !== 3 || !samples.length)
      return;

    const [dx, dy, dz] = selectedDims.map((d) => parseInt(d, 10));

    const x = samples.map((s) => s.embedding[dx]);
    const y = samples.map((s) => s.embedding[dy]);
    const z = samples.map((s) => s.embedding[dz]);

    const trace = {
      x,
      y,
      z,
      mode: "markers",
      type: "scatter3d",
      text: samples.map((s) => `${s.name}${s.country ? ", " + s.country : ""}`),
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        color: colors,
        size: sizes,
        line: { width: 0 },
        opacity: 1.0,
      },
    };

    const size = computeLayoutSize();

    const layout = {
      scene: {
        bgcolor: "#0d1117",
        xaxis: { title: `latent_${dx}`, range: axisRangesRef.current.x },
        yaxis: { title: `latent_${dy}`, range: axisRangesRef.current.y },
        zaxis: { title: `latent_${dz}`, range: axisRangesRef.current.z },
        camera: cameraRef.current || undefined,
        uirevision: "embedding-view",
      },
      margin: { l: 0, r: 0, b: 0, t: 0 },
      showlegend: false,
      width: size?.width,
      height: size?.height,
    };

    const config = { displayModeBar: true, responsive: true };
    const CLICK_SUPPRESS_MS = 200;
    const clickHandler = (ev) => {
      const now = performance.now();
      if (now - lastClickTsRef.current < CLICK_SUPPRESS_MS) return; // suppress mac double-hard-click
      lastClickTsRef.current = now;

      if (ev?.points?.length > 0) {
        const idx = ev.points[0].pointNumber;
        const selected = samplesRef.current[idx];

        if (selected) {
          onSelectSample((prev) =>
            prev && prev.id === selected.id ? null : selected
            );
        }
      }
    };

    if (!initializedRef.current) {
      Plotly.newPlot(plotRef.current, [trace], layout, config).then(() => {
        initializedRef.current = true;
        plotRef.current.on("plotly_click", clickHandler);
        plotRef.current.on("plotly_relayout", (ev) => {
          if (ev["scene.camera"]) {
            cameraRef.current = ev["scene.camera"];
          }
        });
      });
    } else {
      if (!plotRef.current._fullLayout) return;
      requestAnimationFrame(() => {
        Plotly.react(plotRef.current, [trace], layout, config);
      });
    }
  }, [samples, colors, sizes, selectedDims, onSelectSample, viewMode]);

  // Reset camera
  useEffect(() => {
    if (!plotRef.current || !plotRef.current._fullLayout) return;
    Plotly.relayout(plotRef.current, { "scene.camera": null });
    cameraRef.current = null;
  }, [resetToken]);

  return <div className="plot-container" ref={plotRef} />;
};

export default EmbeddingPlot;

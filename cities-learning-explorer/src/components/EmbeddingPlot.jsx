import React, { useEffect, useRef } from "react";
import Plotly from 'plotly.js-dist';

const EmbeddingPlot = ({
  samples,
  colors,
  sizes,
  selectedDims,
  onSelectSample,
  resetToken,
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

  // Compute axis ranges
  useEffect(() => {
    if (!samples.length) return;
    if (selectedDims.length !== 3) return;

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

  // Build / update plot
  useEffect(() => {
    if (!plotRef.current) return;
    if (!axisRangesRef.current) return;
    if (selectedDims.length !== 3) return;
    if (!samples.length) return;

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
      text: samples.map(
        (s) => `${s.name}${s.country ? ", " + s.country : ""}`
      ),
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        color: colors,
        size: sizes,
        line: { width: 0 },
        opacity: 1.0,
      },
    };

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
    };

    const config = { displayModeBar: true, responsive: true };
    const CLICK_SUPPRESS_MS = 200;
    const clickHandler = (ev) => {
      const now = performance.now();
      if (now - lastClickTsRef.current < CLICK_SUPPRESS_MS) {
        // duplicate mac hard-click event → ignore
        return;
      }
      lastClickTsRef.current = now;

      if (ev && ev.points && ev.points.length > 0) {
        const idx = ev.points[0].pointNumber;
        const selected = samplesRef.current[idx];

        if (selected) {
          onSelectSample((prev) => {
            if (prev && prev.id === selected.id) return null;
            return selected;
          });
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
      return;
    }

    if (!plotRef.current._fullLayout) return;

    requestAnimationFrame(() => {
      Plotly.react(plotRef.current, [trace], layout, config);
    });

  }, [samples, colors, sizes, selectedDims, onSelectSample]);

  useEffect(() => {
    if (!plotRef.current || !plotRef.current._fullLayout) return;
    Plotly.relayout(plotRef.current, { "scene.camera": null });
    cameraRef.current = null;
  }, [resetToken]);

  return <div className="plot-container" ref={plotRef} />;
};

export default EmbeddingPlot;

import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist";
import { metricList, formatNumber } from "../utils/metrics";
import { typeColors } from "../utils/coloring";

const METRIC_KEYS = [
  "population",
  "gdp_ppp",
  "population_density",
  "emissions",
  "hdd",
  "cdd",
];

const LOG_SCALE = {
  population: true,
  gdp_ppp: false,
  population_density: false,
  emissions: false,
  hdd: false,
  cdd: false,
};

const RANGE = {
  population: [10_000, 10_000_000],
  gdp_ppp: [0, 50_000],
  population_density: [0, 100_000],
  emissions: [0, 15],
  hdd: [0, 5000],
  cdd: [0, 5000],
};

const TypeMetricsPlot = ({ cities, activeType }) => {
  const plotRef = useRef(null);

  useEffect(() => {
    if (!plotRef.current || !cities?.length || !activeType) return;

    const traces = [];

    METRIC_KEYS.forEach((key, i) => {
      const def = metricList.find((m) => m.key === key);
      if (!def) return;

      const label = def.label;

      const allVals = cities
        .map((c) => ({
          val: Number(c[key]),
          name: c.name,
          country: c.country,
        }))
        .filter((d) => !isNaN(d.val));

      const filtered = cities
        .filter((c) => c.type === activeType)
        .map((c) => ({
          val: Number(c[key]),
          name: c.name,
          country: c.country,
        }))
        .filter((d) => !isNaN(d.val));

      if (!allVals.length || !filtered.length) return;

      const idx = i + 1; // horizontal axis index

      // All cities (background)
      traces.push({
        name: `${label} (all)`,
        x: allVals.map(() => label),
        y: allVals.map((v) => v.val),
        type: "box",
        marker: { color: "rgba(139,148,158,0.4)" },
        line: { color: "rgba(139,148,158,0.9)" },
        opacity: 0.4,
        boxpoints: false,
        xaxis: "x" + idx,
        yaxis: "y" + idx,
        hoverinfo: "skip",
      });

      // Selected type (foreground)
      traces.push({
        name: `${label} (${activeType})`,
        x: filtered.map(() => label),
        y: filtered.map((v) => v.val),      // REAL VALUES (no rounding)
        type: "box",
        marker: { 
          color: typeColors[activeType],
          size: 1
        },
        line: { color: typeColors[activeType], width: 2 },
        boxpoints: "outliers",
        jitter: 0.4,
        pointpos: 0,
        opacity: 0.95,
        customdata: filtered.map((v) => ({
          name: v.name,
          country: v.country,
          display: formatNumber(v.val, def.decimals),  // display-only
        })),
        hovertemplate:
          `<b>%{customdata.name}, %{customdata.country}</b><br>` +
          `${label}: %{customdata.display}${def.unit ? " " + def.unit : ""}` +
          `<extra></extra>`,
        xaxis: "x" + idx,
        yaxis: "y" + idx,
      });
    });

    // Layout: ALL BOX PLOTS IN A SINGLE ROW
    const layout = {
      uirevision: "stay",
      grid: {
        rows: 1,
        columns: METRIC_KEYS.length,
        pattern: "independent",
      },
      showlegend: false,
      margin: { l: 40, r: 20, t: 10, b: 70 },
      height: 420, // more height for horizontal layout
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#c9d1d9" },
    };

    // Configure axes for each boxplot
    METRIC_KEYS.forEach((key, i) => {
      const idx = i + 1;
      const l = RANGE[key][0];
      const u = RANGE[key][1];

      layout["yaxis" + idx] = {
        type: LOG_SCALE[key] ? "log" : "linear",
        gridcolor: "#21262d",
        zerolinecolor: "#21262d",
        automargin: true,
        range: LOG_SCALE[key] 
          ? [Math.log10(l), Math.log10(u)]
          : [l, u],
      };

      layout["xaxis" + idx] = {
        tickangle: -45,
        automargin: true,
      };
    });

    Plotly.newPlot(plotRef.current, traces, layout, {
      displayModeBar: false,
      responsive: true,
    });

    const resize = () => Plotly.Plots.resize(plotRef.current);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      Plotly.purge(plotRef.current);
    };
  }, [cities, activeType]);

  return <div ref={plotRef} className="typology-metrics-plot" />;
};

export default TypeMetricsPlot;

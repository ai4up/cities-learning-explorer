import React, { useEffect, useRef, useState } from "react";
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

const columnsForWidth = (width) => {
  if (width >= 840) return 6;
  if (width >= 480) return 3;
  return 2;
};

const heightForRows = (rows) => (rows === 1 ? 340 : rows * 270);

const TypeMetricsPlot = ({ cities, activeType }) => {
  const frameRef = useRef(null);
  const plotRef = useRef(null);
  const [columns, setColumns] = useState(6);

  const rows = Math.ceil(METRIC_KEYS.length / columns);
  const height = heightForRows(rows);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const update = () => setColumns(columnsForWidth(frame.clientWidth));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const plotElement = plotRef.current;
    if (!plotElement || !cities?.length || !activeType) return;

    const traces = [];
    const annotations = [];
    const color = typeColors[activeType];

    METRIC_KEYS.forEach((key, i) => {
      const def = metricList.find((m) => m.key === key);
      if (!def) return;

      const idx = i + 1;
      const label = def.label;

      const toPoints = (list) =>
        list
          .map((c) => ({
            val: Number(c.characteristics?.[key]),
            name: c.name,
            country: c.country,
          }))
          .filter((d) => !isNaN(d.val));

      const allVals = toPoints(cities);
      const filtered = toPoints(cities.filter((c) => c.type === activeType));
      if (!allVals.length || !filtered.length) return;

      traces.push({
        name: "All cities",
        x: allVals.map(() => "All"),
        y: allVals.map((v) => v.val),
        type: "box",
        marker: { color: "rgba(139,148,158,0.4)" },
        line: { color: "rgba(139,148,158,0.8)", width: 1 },
        fillcolor: "rgba(139,148,158,0.12)",
        boxpoints: false,
        xaxis: "x" + idx,
        yaxis: "y" + idx,
        hoverinfo: "skip",
      });

      traces.push({
        name: activeType,
        x: filtered.map(() => activeType),
        y: filtered.map((v) => v.val),
        type: "box",
        marker: { color, size: 2 },
        line: { color, width: 1.5 },
        boxpoints: "outliers",
        opacity: 0.95,
        customdata: filtered.map((v) => ({
          name: v.name,
          country: v.country,
          display: formatNumber(v.val, def.decimals),
        })),
        hovertemplate:
          `<b>%{customdata.name}, %{customdata.country}</b><br>` +
          `${label}: %{customdata.display}${def.unit ? " " + def.unit : ""}` +
          `<extra></extra>`,
        xaxis: "x" + idx,
        yaxis: "y" + idx,
      });

      annotations.push({
        text: def.unit
          ? `${label}<br><span style="font-size:10px;color:#8b949e">${def.unit}</span>`
          : `${label}<br> `,
        xref: `x${idx} domain`,
        yref: `y${idx} domain`,
        x: 0.5,
        y: 1,
        yanchor: "bottom",
        yshift: 6,
        showarrow: false,
        font: { size: 11, color: "#c9d1d9" },
      });
    });

    const layout = {
      uirevision: "stay",
      height,
      grid: {
        rows,
        columns,
        pattern: "independent",
        xgap: 0.35,
        ygap: rows > 1 ? 0.4 : 0,
      },
      showlegend: false,
      annotations,
      margin: { l: 44, r: 8, t: 44, b: 12 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#c9d1d9", size: 10 },
      hoverlabel: { bgcolor: "#161b22", bordercolor: "#30363d", font: { color: "#e6edf3" } },
    };

    METRIC_KEYS.forEach((key, i) => {
      const idx = i + 1;
      const [lower, upper] = RANGE[key];

      layout["yaxis" + idx] = {
        type: LOG_SCALE[key] ? "log" : "linear",
        gridcolor: "#21262d",
        zerolinecolor: "#21262d",
        tickformat: "~s",
        automargin: true,
        range: LOG_SCALE[key] ? [Math.log10(lower), Math.log10(upper)] : [lower, upper],
      };

      layout["xaxis" + idx] = {
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        fixedrange: true,
      };
    });

    Plotly.react(plotElement, traces, layout, {
      displayModeBar: false,
      responsive: true,
    });
  }, [cities, activeType, columns, rows, height]);

  useEffect(() => {
    const plotElement = plotRef.current;
    return () => {
      if (plotElement) Plotly.purge(plotElement);
    };
  }, []);

  return (
    <div className="metrics-plot">
      <div className="metrics-legend" aria-hidden="true">
        <span>
          <i className="metrics-legend-swatch metrics-legend-swatch-all" />
          All cities
        </span>
        <span>
          <i
            className="metrics-legend-swatch"
            style={{ background: typeColors[activeType] }}
          />
          {activeType}
        </span>
      </div>
      {/* Explicit height is required: explorer.css forces .js-plotly-plot to height: 100% */}
      <div ref={frameRef} className="metrics-plot-frame" style={{ height }}>
        <div ref={plotRef} />
      </div>
    </div>
  );
};

export default TypeMetricsPlot;

import React from "react";
import { Range } from "react-range";
import { SqrtRange } from "./SqrtRangeSlider";
import { metricList, typeDescriptions } from "../utils/metrics";
import { percentileColor } from "../utils/coloring";

const StyledTrack = ({ props, children, minPct, maxPct }) => {
  const { key, style, ...rest } = props;
  return (
    <div {...rest} className="slider-track" style={style}>
      <div
        className="slider-track-active"
        style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
      />
      {children}
    </div>
  );
};

const StyledThumb = ({ props }) => {
  const { key, ...rest } = props;
  return <div {...rest} className="slider-thumb" />;
};


const Controls = ({
  viewMode,
  setViewMode,
  searchValue,
  setSearchValue,
  suggestions,
  setSelectedSample,
  colorKey,
  setColorKey,
  regions,
  selectedRegions,
  setSelectedRegions,
  types,
  selectedTypes,
  setSelectedTypes,
  populationThreshold,
  setPopulationThreshold,
  studyThreshold,
  setStudyThreshold,
  selectedDims,
  setSelectedDims,
  categories,
  categoryColors,
  onResetView,
  onResetFilters,
  controlsOpen,
  setControlsOpen,
  metricFilters,
  setMetricFilters,
  pendingMetric,
  setPendingMetric,
}) => {
  const viewBtnStyle = (mode) => ({
    flex: 1,
    marginBottom: 0,
    marginRight: "4px",
    padding: "6px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: viewMode === mode ? "#238636" : "#161b22",
    color: "#c9d1d9",
    cursor: "pointer",
  });

  return (
    <>
    <button className="controls-toggle" onClick={() => setControlsOpen(o => !o)}>
      {controlsOpen ? "▲ Hide Control Panel" : "▼ Show Control Panel"}
    </button>
    <div className="controls" data-open={controlsOpen}>
      {/* View mode toggle */}
      <div style={{ display: "flex", marginBottom: "10px", gap: "4px" }}>
        <button
          style={viewBtnStyle("map")}
          onClick={() => setViewMode("map")}
        >
          Map
        </button>
        <button
          style={viewBtnStyle("embedding")}
          onClick={() => setViewMode("embedding")}
        >
          <span className="type-tooltip">
            Embedding
            <span className="type-tooltip-content">
              Shows cities in a 3D latent space learned with Deep Embedded Clustering (DEC), which groups cities based on similar characteristics.
            </span>
          </span>
        </button>
        <button
          style={viewBtnStyle("both")}
          onClick={() => setViewMode("both")}
        >
          Both
        </button>
      </div>

      {/* Search input with clear button */}
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}
      >
        <input
          type="text"
          placeholder="Search city..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              const s = suggestions[0];
              setSelectedSample(s);
              setSearchValue(`${s.name}, ${s.country}`);
            }
          }}
          list="suggestions"
          style={{ flex: 1, padding: "6px" }}
        />
        {searchValue && (
          <button
            onClick={() => {
              setSearchValue("");
              setSelectedSample(null);
            }}
            style={{
              marginLeft: "6px",
              padding: "4px 6px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "#21262d",
              color: "#c9d1d9",
              cursor: "pointer",
              width: "26px",
            }}
          >
            &times;
          </button>
        )}
      </div>

      <datalist id="suggestions">
        {suggestions.map((s, idx) => (
          <option key={idx} value={`${s.name}, ${s.country}`} />
        ))}
      </datalist>

      {/* Colour key selector */}
      <select
        value={colorKey}
        onChange={(e) => setColorKey(e.target.value)}
      >
        <optgroup label="Color by categories">
          <option value="type">Type</option>
          <option value="region">Region</option>
        </optgroup>

        <optgroup label="Color by percentiles">
          {metricList.map((m) => (
            <option key={m.key + "_pct"} value={m.key + "_pct"}>
              {m.label}
            </option>
          ))}
        </optgroup>
      </select>

      {/* Region & Type filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          maxHeight: "150px",
          overflowY: "auto",
          marginBottom: "12px",
          marginTop: "12px",
        }}
      >
        {/* Regions */}
        <div>
          <div
            style={{
              fontSize: "0.8em",
              marginBottom: "6px",
              fontWeight: "bold",
            }}
          >
            Regions
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {regions.map((reg) => (
              <label
                key={reg}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.75em",
                  marginBottom: "2px",
                  paddingLeft: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.has(reg)}
                  onChange={() => {
                    const set = new Set(selectedRegions);
                    set.has(reg) ? set.delete(reg) : set.add(reg);
                    setSelectedRegions(set);
                  }}
                  style={{
                    margin: 0,
                    width: "14px",
                    flexShrink: 0,
                  }}
                />
                {reg}
              </label>
            ))}
          </div>
        </div>

        {/* Types */}
        <div>
          <div
            style={{
              fontSize: "0.8em",
              marginBottom: "6px",
              fontWeight: "bold",
            }}
          >
            Types
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {types.map((t) => (
              <label
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.75em",
                  marginBottom: "2px",
                  paddingLeft: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(t)}
                  onChange={() => {
                    const set = new Set(selectedTypes);
                    set.has(t) ? set.delete(t) : set.add(t);
                    setSelectedTypes(set);
                  }}
                  style={{
                    margin: 0,
                    width: "14px",
                    flexShrink: 0,
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Population slider */}
      <div style={{ marginTop: "12px", marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "0.8em" }}>
          Population:{" "}
          {Math.round(populationThreshold.min).toLocaleString()} –{" "}
          {Math.round(populationThreshold.max).toLocaleString()}
        </label>

        <SqrtRange
          minValue={populationThreshold.min}
          maxValue={populationThreshold.max}
          onChange={setPopulationThreshold}
          max={10_000_000}
          step={100}
          StyledTrack={StyledTrack}
          StyledThumb={StyledThumb}
        />
      </div>

      {/* Number of Studies slider */}
      <div style={{ marginTop: "12px", marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "0.8em" }}>
          Studies: {Math.round(studyThreshold.min)} – {Math.round(studyThreshold.max)}
        </label>

        <SqrtRange
          minValue={studyThreshold.min}
          maxValue={studyThreshold.max}
          onChange={setStudyThreshold}
          max={500}
          step={1}
          StyledTrack={StyledTrack}
          StyledThumb={StyledThumb}
        />
      </div>

      {/* Render Metric Sliders */}
      {metricFilters.map((f, idx) => {
        const metric = metricList.find(m => f.key === m.key + "_pct");

        return (
          <div key={f.key} style={{ marginTop: "12px", marginBottom: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.8em",
                marginBottom: "12px",
              }}
            >
              {metric.label}: {f.min}% – {f.max}%

              <span
                style={{ cursor: "pointer", opacity: 0.7 }}
                onClick={() =>
                  setMetricFilters(prev => prev.filter((_, i) => i !== idx))
                }
              >
                ×
              </span>
            </div>

            <Range
              step={1}
              min={0}
              max={100}
              values={[f.min, f.max]}
              onChange={(values) => {
                const [min, max] = values;
                setMetricFilters(prev => {
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], min, max };
                  return copy;
                });
              }}
              renderTrack={({ props, children, index }) => (
                <StyledTrack key={index} props={props} minPct={f.min} maxPct={f.max}>
                  {children}
                </StyledTrack>
              )}
              renderThumb={({ props, index }) => {
                const { key, ...rest } = props;
                return <StyledThumb key={index} props={rest} />;
              }}
            />
          </div>
        );
      })}

      {/* Add Metric Filter Button */}
      <div style={{ marginTop: "16px" }}>
        {!pendingMetric && (
          <div
            onClick={() => setPendingMetric("placeholder")}
            style={{
              marginBottom: "20px",
              color: "#8b949e",
              fontSize: "0.7em",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            + Add metric filter
          </div>
        )}

        {/* Inline selector appears only after clicking + Add */}
        {pendingMetric && (
          <div style={{ marginTop: "6px" }}>
            <select
              autoFocus
              defaultValue=""
              style={{
                padding: "6px",
                background: "#161b22",
                color: "#c9d1d9",
                border: "1px solid #30363d",
                borderRadius: "4px",
                width: "100%",
              }}
              onChange={(e) => {
                const key = e.target.value;
                if (key) {
                  setMetricFilters(prev => [
                    ...prev,
                    { key, min: 0, max: 100 }
                  ]);
                }
                setPendingMetric(null);
              }}
            >
              <option value="" disabled>
                Select metric…
              </option>
              {metricList
                .filter(m =>
                  m.key !== "population" &&
                  !metricFilters.some(f => f.key === m.key + "_pct")
                )
                .map(m => (
                  <option key={m.key + "_pct"} value={m.key + "_pct"}>
                    {m.label}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Embedding dimensions */}
      {(viewMode === "embedding" || viewMode === "both") && (
        <div style={{ marginBottom: "18px", fontSize: "0.8em" }}>
          <div style={{ marginBottom: "4px" }}>
            Select embedding dimensions (3 of 4):
          </div>
          <div style={{ marginLeft: "8px" }}>
            {["0", "1", "2", "3"].map((dim) => {
              const checked = selectedDims.includes(dim);
              const disabled = !checked && selectedDims.length === 3;

              return (
                <label
                  key={dim}
                  style={{
                    marginRight: "10px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => {
                      setSelectedDims((prev) =>
                        prev.includes(dim)
                          ? prev.filter((d) => d !== dim)
                          : [...prev, dim]
                      );
                    }}
                  />
                  <span style={{ marginLeft: "4px" }}>{dim}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onResetView}>Reset view</button>
        <button onClick={onResetFilters}>Reset filters</button>
      </div>
    </div>

    {/* Percentile legend */}
    {colorKey.endsWith("_pct") && (
      <div className="legend" style={{ marginTop: "8px" }}>
        {[10, 30, 50, 70, 90].map((p) => (
          <div key={p} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: percentileColor(p) }}
            ></div>
            <span style={{ fontSize: "0.8em" }}>{p}%</span>
          </div>
        ))}
      </div>
    )}
    {/* Legend */}
    {(colorKey === "type" || colorKey === "region") && (
      <div className="legend">
        {categories.map((cat) => (
          <div className="legend-item" key={cat}>
            <div
              className="legend-color"
              style={{ backgroundColor: categoryColors[cat] }}
            ></div>
            {typeDescriptions[cat] ? (
              <span className="type-tooltip" style={{ fontSize: "0.8em" }}>
                {cat}
                <span className="type-tooltip-content">
                  {typeDescriptions[cat]}
                </span>
              </span>
            ) : (
              <span style={{ fontSize: "0.8em" }}>{cat}</span>
            )}
          </div>
        ))}
      </div>
    )}
    </>
  );
};

export default Controls;

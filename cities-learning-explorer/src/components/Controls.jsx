import React from "react";

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
    <div className="controls">
      {/* View mode toggle */}
      <div style={{ display: "flex", marginBottom: "10px", gap: "4px" }}>
        <button
          style={viewBtnStyle("embedding")}
          onClick={() => setViewMode("embedding")}
        >
          Embedding
        </button>
        <button
          style={viewBtnStyle("map")}
          onClick={() => setViewMode("map")}
        >
          Map
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
              setSelectedSample(suggestions[0]);
              setSearchValue(suggestions[0].name);
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
          <option key={idx} value={s.name} />
        ))}
      </datalist>

      {/* Colour key selector */}
      <select
        value={colorKey}
        onChange={(e) => setColorKey(e.target.value)}
      >
        <option value="type">Colour by Type</option>
        <option value="region">Colour by Region</option>
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
      <div style={{ marginTop: "12px" }}>
        <label style={{ display: "block", fontSize: "0.8em" }}>
          Population ≥ {populationThreshold.toLocaleString()}
        </label>
        <input
          type="range"
          min="0"
          max={Math.sqrt(10_000_000)}
          step="100"
          value={Math.sqrt(populationThreshold)}
          onChange={(e) => {
            const real = Math.pow(Number(e.target.value), 2);
            setPopulationThreshold(real);
          }}
          style={{ width: "90%" }}
        />
      </div>

      {/* Number of Studies slider */}
      <div style={{ marginBottom: "6px" }}>
        <label style={{ display: "block", fontSize: "0.8em" }}>
          Number of Studies ≥ {studyThreshold}
        </label>
        <input
          type="range"
          min="0"
          max={Math.sqrt(500)}
          step="1"
          value={Math.sqrt(studyThreshold)}
          onChange={(e) => {
            const real = Math.pow(Number(e.target.value), 2);
            setStudyThreshold(real);
          }}
          style={{ width: "90%" }}
        />
      </div>

      {/* Embedding dimensions */}
      <div style={{ marginBottom: "18px", fontSize: "0.8em" }}>
        <div style={{ marginBottom: "4px" }}>
          Select Embedding Dimensions (3 of 4):
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

      {/* Buttons */}
      <button onClick={onResetView}>Reset View</button>
      <button onClick={onResetFilters}>Reset Filters</button>

      {/* Legend */}
      <div className="legend">
        {categories.map((cat) => (
          <div className="legend-item" key={cat}>
            <div
              className="legend-color"
              style={{ backgroundColor: categoryColors[cat] }}
            ></div>
            <span style={{ fontSize: "0.8em" }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Controls;

import React, { useEffect, useMemo, useState } from "react";
import Controls from "./components/Controls";
import EmbeddingPlot from "./components/EmbeddingPlot";
import MapPlot from "./components/MapPlot";
import InfoPanel from "./components/InfoPanel";
import { palette, computeColors, computeSizes } from "./utils/coloring";

const App = () => {
  const [samples, setSamples] = useState([]);
  const [viewMode, setViewMode] = useState("embedding");

  const [colorKey, setColorKey] = useState("type");
  const [selectedSample, setSelectedSample] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [populationThreshold, setPopulationThreshold] = useState(1_000_000);
  const [studyThreshold, setStudyThreshold] = useState(5);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedDims, setSelectedDims] = useState(["0", "1", "2"]);
  const [resetToken, setResetToken] = useState(0);

  // Load data
  useEffect(() => {
    fetch("/cities.json")
      .then((res) => res.json())
      .then((data) => {
        setSamples(data);
        console.log("Example city:", data[0]);
      })
      .catch((err) => console.error("Failed to load JSON:", err));
  }, []);

  const regions = useMemo(
    () => Array.from(new Set(samples.map((s) => s.region))).sort(),
    [samples]
  );

  const types = useMemo(
    () => Array.from(new Set(samples.map((s) => s.type))).sort(),
    [samples]
  );

  // Initialise selections when regions/types change
  useEffect(() => {
    setSelectedRegions(new Set(regions));
    setSelectedTypes(new Set(types));
  }, [regions, types]);

  const categories = useMemo(
    () => Array.from(new Set(samples.map((s) => s[colorKey]))).sort(),
    [samples, colorKey]
  );

  const categoryColors = useMemo(() => {
    const map = {};
    categories.forEach((cat, idx) => {
      map[cat] = palette[idx % palette.length];
    });
    return map;
  }, [categories]);

  // Colors & sizes shared by both plots
  const colors = useMemo(
    () =>
      computeColors(samples, {
        populationThreshold,
        studyThreshold,
        selectedRegions,
        selectedTypes,
        colorKey,
        selectedSample,
        categoryColors,
      }),
    [
      samples,
      populationThreshold,
      studyThreshold,
      selectedRegions,
      selectedTypes,
      colorKey,
      selectedSample,
      categoryColors,
    ]
  );

  const sizes = useMemo(
    () =>
      computeSizes(samples, {
        populationThreshold,
        studyThreshold,
        selectedRegions,
        selectedTypes,
        selectedSample,
      }),
    [
      samples,
      populationThreshold,
      studyThreshold,
      selectedRegions,
      selectedTypes,
      selectedSample,
    ]
  );

  // Search suggestions
  const suggestions = useMemo(() => {
    const val = searchValue.toLowerCase();
    if (!val) return [];
    return samples
      .filter((s) => s.name.toLowerCase().includes(val))
      .slice(0, 10);
  }, [searchValue, samples]);

  // Auto-select exact match by name
  useEffect(() => {
    const exact = samples.find(
      (s) => s.name.toLowerCase() === searchValue.toLowerCase()
    );
    if (exact) {
      setSelectedSample(exact);
    }
  }, [searchValue, samples]);

  const handleResetView = () => {
    setResetToken((t) => t + 1);
    setSelectedSample(null);
  };

  const handleResetFilters = () => {
    setPopulationThreshold(1_000_000);
    setStudyThreshold(5);
    setSelectedRegions(new Set(regions));
    setSelectedTypes(new Set(types));
    setSelectedSample(null);
  };

  return (
    <div className="app-root">
      {/* Plot area */}
      <div className="plots-wrapper">
        {(viewMode === "embedding" || viewMode === "both") && (
          <EmbeddingPlot
            samples={samples}
            colors={colors}
            sizes={sizes}
            selectedDims={selectedDims}
            onSelectSample={setSelectedSample}
            resetToken={resetToken}
          />
        )}

        {(viewMode === "map" || viewMode === "both") && (
          <MapPlot
            samples={samples}
            colors={colors}
            sizes={sizes}
            onSelectSample={setSelectedSample}
          />
        )}
      </div>

      {/* Shared controls */}
      <Controls
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        suggestions={suggestions}
        setSelectedSample={setSelectedSample}
        colorKey={colorKey}
        setColorKey={setColorKey}
        regions={regions}
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        types={types}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        populationThreshold={populationThreshold}
        setPopulationThreshold={setPopulationThreshold}
        studyThreshold={studyThreshold}
        setStudyThreshold={setStudyThreshold}
        selectedDims={selectedDims}
        setSelectedDims={setSelectedDims}
        categories={categories}
        categoryColors={categoryColors}
        onResetView={handleResetView}
        onResetFilters={handleResetFilters}
      />

      {/* Info panel */}
      {selectedSample && (
        <InfoPanel
          selectedSample={selectedSample}
          samples={samples}
          setSelectedSample={setSelectedSample}
        />
      )}
    </div>
  );
};

export default App;

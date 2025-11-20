import React, { useEffect, useMemo, useState } from "react";
import Controls from "./components/Controls";
import EmbeddingPlot from "./components/EmbeddingPlot";
import MapPlot from "./components/MapPlot";
import InfoPanel from "./components/InfoPanel";
import { palette, computeColors, computeSizes } from "./utils/coloring";

// ------------------------------------------------------
// URL helper functions
// ------------------------------------------------------
const readURLParams = () => new URLSearchParams(window.location.search);

const updateURLParams = (updates = {}) => {
  const params = readURLParams();

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, value);
  });

  const qs = params.toString();
  window.history.replaceState({}, "", qs ? `?${qs}` : "/");
};

const loadInitialURLState = (samples) => {
  const params = readURLParams();
  const city = params.get("city");
  const view = params.get("view");

  const selectedCity =
    city ? samples.find((s) => String(s.id) === String(city)) : null;

  const viewMode =
    view === "map" || view === "embedding" || view === "both"
      ? view
      : null;

  return { selectedCity, viewMode };
};

const App = () => {
  const [samples, setSamples] = useState([]);
  const [viewMode, setViewMode] = useState("map");
  const [colorKey, setColorKey] = useState("type");
  const [initialURLProcessed, setInitialURLProcessed] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [populationThreshold, setPopulationThreshold] = useState(viewMode === "map" ? 250_000 : 1_000_000);
  const [studyThreshold, setStudyThreshold] = useState(viewMode === "map" ? 0 : 5);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedDims, setSelectedDims] = useState(["0", "1", "2"]);
  const [resetToken, setResetToken] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(true);

  // ------------------------------------------------------
  // Load data + initialize URL-based state
  // ------------------------------------------------------
  useEffect(() => {
    fetch("/cities.json")
      .then((res) => res.json())
      .then((data) => {
        setSamples(data);
        console.log("Example city:", data[0]);

        // Pull initial state (city + viewMode) from URL
        const { selectedCity, viewMode: urlView } = loadInitialURLState(data);

        if (selectedCity) setSelectedSample(selectedCity);
        if (urlView) setViewMode(urlView);

        setInitialURLProcessed(true);
      })
      .catch((err) => console.error("Failed to load JSON:", err));
  }, []);

  // ------------------------------------------------------
  // Derived lists (regions/types/categories)
  // ------------------------------------------------------
  const regions = useMemo(
    () => Array.from(new Set(samples.map((s) => s.region))).sort(),
    [samples]
  );

  const types = useMemo(
    () => Array.from(new Set(samples.map((s) => s.type))).sort(),
    [samples]
  );

  // Initialize selected filters
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

  // ------------------------------------------------------
  // Compute per-city rendering colors and sizes
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  // Search suggestions
  // ------------------------------------------------------
  const suggestions = useMemo(() => {
    const val = searchValue.toLowerCase();
    if (!val) return [];
    return samples
      .filter((s) => `${s.name} ${s.country}`.toLowerCase().includes(val))
      .slice(0, 10);
  }, [searchValue, samples]);

  // Auto-select exact match
  useEffect(() => {
    const exact = samples.find((s) =>
      s.name.toLowerCase() === searchValue.toLowerCase() ||
      (`${s.name}, ${s.country}`.toLowerCase() === searchValue.toLowerCase())
    );
    if (exact) {
      setSelectedSample(exact);
    }
  }, [searchValue, samples]);

  // ------------------------------------------------------
  // Reset handlers
  // ------------------------------------------------------
  const handleResetView = () => {
    setResetToken((t) => t + 1);
    setSelectedSample(null);
  };

  const handleResetFilters = () => {
    setPopulationThreshold(viewMode === "map" ? 250_000 : 1_000_000);
    setStudyThreshold(viewMode === "map" ? 0 : 5);
    setSelectedRegions(new Set(regions));
    setSelectedTypes(new Set(types));
    setSelectedSample(null);

    // Clear city from URL
    updateURLParams({ city: null });
  };

  // ------------------------------------------------------
  // Sync viewMode -> URL
  // ------------------------------------------------------
  useEffect(() => {
    if (!initialURLProcessed) return;

    updateURLParams({
      view: viewMode,
      city: selectedSample ? selectedSample.id : null,
    });
  }, [viewMode, initialURLProcessed]);

  // ------------------------------------------------------
  // Sync selectedSample -> URL
  // ------------------------------------------------------
  useEffect(() => {
    if (!initialURLProcessed) return;

    updateURLParams({
      city: selectedSample ? selectedSample.id : null,
    });
  }, [selectedSample, initialURLProcessed]);

  // ------------------------------------------------------
  // Render UI
  // ------------------------------------------------------
  return (
    <div className={`app-root mode-${viewMode}`}>
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
            viewMode={viewMode}
          />
        )}

        {(viewMode === "map" || viewMode === "both") && (
          <MapPlot
            samples={samples}
            colors={colors}
            sizes={sizes}
            onSelectSample={setSelectedSample}
            viewMode={viewMode}
          />
        )}
      </div>

      {/* Controls */}
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
        controlsOpen={controlsOpen}
        setControlsOpen={setControlsOpen}
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

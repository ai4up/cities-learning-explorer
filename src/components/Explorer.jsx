import React, { useCallback, useEffect, useMemo, useState } from "react";
import Controls from "./Controls";
import EmbeddingPlot from "./EmbeddingPlot";
import MapPlot from "./MapPlot";
import InfoPanel from "./InfoPanel";
import FeedbackNote from "./FeedbackNote";
import Plotly from "plotly.js-dist";
import { palette, computeColors, computeSizes, typeColorsExplore } from "../utils/coloring";
import { isCompactViewport } from "../utils/viewport";
import { EvidencePanel, MockBanner } from "./MockEvidence";
import Tutorial from "./Tutorial";
import {
  LENS_KEYS,
  OVERALL_LENS,
  applyLens,
  loadMock,
  tagCounts,
  tagsForLens,
  tutorialSeen,
} from "../utils/mockLens";
import "../styles/explorer.css";

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
  const basePath = window.location.pathname;
  window.history.replaceState({}, "", qs ? `${basePath}?${qs}` : basePath);
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


// MOCK: a lens can be preselected with ?lens=mobility or ?lens=energy
const initialLens = () => {
  const lens = readURLParams().get("lens");
  return LENS_KEYS.includes(lens) ? lens : OVERALL_LENS;
};

const Explorer = () => {
  const [samples, setSamples] = useState([]);
  const [viewMode, setViewMode] = useState("map");
  const [colorKey, setColorKey] = useState("type");
  const [initialURLProcessed, setInitialURLProcessed] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [populationThreshold, setPopulationThreshold] = useState({
    min: viewMode === "map" ? 500_000 : 1_000_000,
    max: 50_000_000
  });
  const [studyThreshold, setStudyThreshold] = useState({
    min: viewMode === "map" ? 0 : 5,
    max: 3000
  });
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedDims, setSelectedDims] = useState(["0", "1", "2"]);
  const [resetToken, setResetToken] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(() => !isCompactViewport());
  const [metricFilters, setMetricFilters] = useState([]);
  const [pendingMetric, setPendingMetric] = useState(null);

  // MOCK: similarity lenses and hand-tagged evidence
  const [mock, setMock] = useState({ lenses: null, evidence: null });
  const [lens, setLensState] = useState(initialLens);
  const [tutorialOpen, setTutorialOpen] = useState(() => !tutorialSeen());
  const [drawer, setDrawer] = useState(null); // { cityId, tag, forId }: evidence opened from city forId

  useEffect(() => {
    loadMock().then(setMock);
  }, []);

  const lensActive = Boolean(mock.lenses?.lenses?.[lens]);

  const setLens = useCallback((next) => {
    setLensState(next);
    // Colouring stays as chosen; only the subtype colouring needs a lens to exist
    setColorKey((key) => (next === OVERALL_LENS && key === "lens_subtype" ? "type" : key));
    updateURLParams({ lens: next === OVERALL_LENS ? null : next });
  }, []);

  // Cities with the peers, coordinates and subtype of the chosen lens
  const viewSamples = useMemo(
    () => applyLens(samples, mock.lenses, lens),
    [samples, mock.lenses, lens]
  );

  const byId = useMemo(
    () => new Map(viewSamples.map((s) => [s.id, s])),
    [viewSamples]
  );

  const selectedView = useMemo(
    () => (selectedSample ? byId.get(selectedSample.id) || selectedSample : null),
    [selectedSample, byId]
  );

  const openEvidence = useCallback(
    (cityId, tag) => setDrawer({ cityId, tag, forId: selectedSample?.id }),
    [selectedSample]
  );
  // The evidence view belongs to the city it was opened from; selecting another city leaves it
  const evidenceOpen = Boolean(
    drawer && mock.evidence && selectedSample && drawer.forId === selectedSample.id
  );

  // The tour explains the city panel on a city that has every section: Berlin under
  // the mobility domain, unless such a city is already open. With `withStudies` it also
  // opens the studies of the first solution that has any.
  const showTutorialExample = (withStudies) => {
    const keep = Boolean(mock.evidence?.cities?.[selectedSample?.id]);
    const cityId = keep ? selectedSample.id : 5483;
    const domainLens = lensActive ? lens : "mobility";
    if (!keep) selectSample(samples.find((s) => s.id === cityId) || null);
    if (!lensActive && mock.lenses) setLens(domainLens);
    if (!withStudies || !mock.evidence) return setDrawer(null);
    const counts = tagCounts(mock.evidence, cityId);
    const tag = tagsForLens(mock.evidence, domainLens).find((t) => counts[t] > 0);
    return setDrawer(tag ? { cityId, tag, forId: cityId } : null);
  };

  const lensSubtypeDescriptions = useMemo(() => {
    const map = {};
    (mock.lenses?.lenses?.[lens]?.subtypes || []).forEach((s) => {
      map[s.name] = s.description;
    });
    return map;
  }, [mock.lenses, lens]);

  // ------------------------------------------------------
  // Load data + initialize URL-based state
  // ------------------------------------------------------
  useEffect(() => {
    const citiesUrl = `${import.meta.env.BASE_URL}cities.json`;
    fetch(citiesUrl)
      .then((res) => res.json())
      .then((data) => {
        setSamples(data);
        const allRegions = Array.from(new Set(data.map((s) => s.region)));
        const allTypes = Array.from(new Set(data.map((s) => s.type)));
        setSelectedRegions(new Set(allRegions));
        setSelectedTypes(new Set(allTypes));
        const { selectedCity, viewMode: urlView } = loadInitialURLState(data);

        if (selectedCity) setSelectedSample(selectedCity);
        if (urlView) setViewMode(urlView);

        setInitialURLProcessed(true);
      })
      .catch((err) => console.error("Failed to load JSON:", err));
  }, []);

  // ------------------------------------------------------
  // Keyboard Listeners (Escape to deselect)
  // ------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedSample(null);
        setSearchValue("");
        updateURLParams({ city: null });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          viewSamples
            .map((s) => s[colorKey])
            .filter((value) => value !== null && value !== undefined)
        )
      ).sort(),
    [viewSamples, colorKey]
  );

  const categoryColors = useMemo(() => {
    if (colorKey === "type") return typeColorsExplore;
    const map = {};
    categories.forEach((cat, idx) => {
      map[cat] = palette[idx % palette.length];
    });
    return map;
  }, [categories, colorKey]);

  // ------------------------------------------------------
  // Compute per-city rendering colors and sizes
  // ------------------------------------------------------
  const colors = useMemo(
    () =>
      computeColors(viewSamples, {
        populationThreshold,
        studyThreshold,
        selectedRegions,
        selectedTypes,
        colorKey,
        selectedSample: selectedView,
        categoryColors,
        metricFilters,
      }),
    [
      viewSamples,
      populationThreshold,
      studyThreshold,
      selectedRegions,
      selectedTypes,
      colorKey,
      selectedView,
      categoryColors,
      metricFilters,
    ]
  );

  const sizes = useMemo(
    () =>
      computeSizes(viewSamples, {
        populationThreshold,
        studyThreshold,
        selectedRegions,
        selectedTypes,
        selectedSample: selectedView,
        metricFilters,
      }),
    [
      viewSamples,
      populationThreshold,
      studyThreshold,
      selectedRegions,
      selectedTypes,
      selectedView,
      metricFilters,
    ]
  );

  // ------------------------------------------------------
  // Search suggestions
  // ------------------------------------------------------
  const suggestions = useMemo(() => {
    const val = searchValue.toLowerCase();
    if (!val) return [];
    return samples
      .filter((s) => {
        const name = s.name.toLowerCase();
        const country = (s.country || "").toLowerCase();
        return `${name} ${country}`.includes(val) || `${name}, ${country}`.includes(val);
      })
      .sort(
        (a, b) =>
          (b.characteristics?.population || 0) - (a.characteristics?.population || 0)
      )
      .slice(0, 10);
  }, [searchValue, samples]);

  // On small screens the filter panel and the city panel share the same
  // space, so picking a city collapses the filters.
  const selectSample = useCallback((next) => {
    setSelectedSample(next);
    if (isCompactViewport()) setControlsOpen(false);
  }, []);

  // A tap on a touch screen leaves the hover label in place; drop it whenever
  // the selection changes so it does not linger behind or after the panel.
  useEffect(() => {
    if (!isCompactViewport()) return;
    document
      .querySelectorAll(".explorer-root .js-plotly-plot")
      .forEach((gd) => Plotly.Fx.unhover(gd));
  }, [selectedSample]);

  // ------------------------------------------------------
  // Reset handlers
  // ------------------------------------------------------
  const handleResetView = () => {
    setResetToken((t) => t + 1);
    setSelectedSample(null);
    setSearchValue("");
    updateURLParams({ city: null });
  };

  const handleResetFilters = () => {
    setPopulationThreshold(viewMode === "map" ? { min: 500_000, max: 50_000_000 } : { min: 1_000_000, max: 50_000_000 });
    setStudyThreshold(viewMode === "map" ? { min: 0, max: 3000 } : { min: 5, max: 3000 });
    setSelectedRegions(new Set(regions));
    setSelectedTypes(new Set(types));
    setMetricFilters([]);
    setPendingMetric(null);
    setSelectedSample(null);
    setSearchValue("");
    updateURLParams({ city: null });
  };

  // ------------------------------------------------------
  // Sync viewMode & selectedSample -> URL
  // ------------------------------------------------------
  useEffect(() => {
    if (!initialURLProcessed) return;
    updateURLParams({
      view: viewMode,
      city: selectedSample ? selectedSample.id : null,
    });
  }, [viewMode, selectedSample, initialURLProcessed]);

  // Behave like a native map app: lock page scroll/zoom so gestures only move the map.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("explorer-active");

    const viewport = document.querySelector('meta[name="viewport"]');
    const prevViewport = viewport?.getAttribute("content");
    viewport?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    );

    // iOS Safari ignores user-scalable=no, so block its proprietary pinch gestures.
    const preventGesture = (e) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);

    return () => {
      html.classList.remove("explorer-active");
      if (viewport && prevViewport) viewport.setAttribute("content", prevViewport);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  // ------------------------------------------------------
  // Render UI
  // ------------------------------------------------------
  return (
    <div
      className={`explorer-root mode-${viewMode}${controlsOpen ? " controls-open" : ""}${selectedSample ? " city-selected" : ""}`}
    >
      <div className="plots-wrapper">
        {(viewMode === "embedding" || viewMode === "both") && (
          <EmbeddingPlot
            key={lensActive ? lens : OVERALL_LENS} /* fresh axes for each lens space */
            samples={viewSamples}
            colors={colors}
            sizes={sizes}
            selectedDims={selectedDims}
            onSelectSample={selectSample}
            resetToken={resetToken}
            viewMode={viewMode}
          />
        )}

        {(viewMode === "map" || viewMode === "both") && (
          <MapPlot
            samples={viewSamples}
            colors={colors}
            sizes={sizes}
            selectedSample={selectedView}
            onSelectSample={selectSample}
            setSearchValue={setSearchValue}
            viewMode={viewMode}
            resetToken={resetToken}
          />
        )}
      </div>

      <Controls
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        suggestions={suggestions}
        setSelectedSample={selectSample}
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
        metricFilters={metricFilters}
        setMetricFilters={setMetricFilters}
        pendingMetric={pendingMetric}
        setPendingMetric={setPendingMetric}
        lens={lens}
        setLens={setLens}
        lensData={mock.lenses}
        lensSubtypeDescriptions={lensSubtypeDescriptions}
        onOpenTutorial={() => setTutorialOpen(true)}
      />

      <MockBanner />

      {tutorialOpen && (
        <Tutorial
          onClose={() => setTutorialOpen(false)}
          panelState={`${selectedSample?.id}-${lens}-${evidenceOpen}`}
          showExampleCity={() => showTutorialExample(false)}
          showExampleEvidence={() => showTutorialExample(true)}
        />
      )}

      <FeedbackNote />

      {/* MOCK: the evidence view takes the place of the city panel, so the map stays visible */}
      {selectedSample && evidenceOpen && (
        <EvidencePanel
          key={`${drawer.cityId}-${drawer.tag}`}
          drawer={drawer}
          evidence={mock.evidence}
          backLabel={selectedSample.name}
          onClose={() => setDrawer(null)}
        />
      )}

      {selectedSample && !evidenceOpen && (
        <InfoPanel
          selectedSample={selectedView}
          samples={viewSamples}
          setSelectedSample={selectSample}
          setSearchValue={setSearchValue}
          mock={mock}
          lens={lensActive ? lens : OVERALL_LENS}
          setLens={setLens}
          byId={byId}
          openEvidence={openEvidence}
        />
      )}
    </div>
  );
};

export default Explorer;
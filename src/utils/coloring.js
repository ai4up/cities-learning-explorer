export const TYPE_ALPHA_MIN = 0.2;

export const typeColors = {
  "Type 1": "#ff9f6e",
  "Type 2": "#8fd48e",
  "Type 3": "#6fb7ff",
  "Type 4": "#d18bff",
};

export const typeColorsExplore = {
  "Type 1": "#e6194b",
  "Type 2": "#4363d8",
  "Type 3": "#3cb44b",
  "Type 4": "#ffe119",
  "Mixed": "#3b3a3aff",
};

export const palette = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#808080",
];

export const domainPalette = [
  "#b36c75", // muted red
  "#7fa87f", // muted green
  "#c7bd7a", // muted yellow
  "#7d89b5", // muted blue
  "#c8956b", // muted orange
  "#a487b4", // muted purple
  "#82baba", // muted teal
  "#c78ab8", // muted magenta
  "#a8c57c", // muted lime
  "#d8b8b8", // muted pink
];

export const toRgba = (hex, alpha) => {
  if (!hex || hex.startsWith("rgba(")) return hex;
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const bigint = parseInt(expanded, 16);
  if (Number.isNaN(bigint)) return hex;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const getSubtypeProbability = (sample) => {
  const probs = sample?.subtype_europe_probabilities;
  if (Array.isArray(probs)) {
    const numeric = probs.filter((p) => typeof p === "number" && !Number.isNaN(p));
    return numeric.length ? Math.max(...numeric) : 1;
  }
  if (probs && typeof probs === "object") {
    const numeric = Object.values(probs).filter((p) => typeof p === "number" && !Number.isNaN(p));
    return numeric.length ? Math.max(...numeric) : 1;
  }
  return 1;
};

const getMetricValue = (sample, key) => sample?.characteristics?.[key];
const getPercentileValue = (sample, key) => {
  const baseKey = key.endsWith("_pct") ? key.slice(0, -4) : key;
  return sample?.percentiles?.[baseKey];
};

export const getCategoryColor = (sample, colorKey, categoryColors) => {

  if (colorKey === "type") {
    const base = categoryColors[sample.type] || "#ffffff";
    const alpha = Math.min(1, Math.max(TYPE_ALPHA_MIN, sample.probability - 0.2));
    if (alpha >= 0.999 || sample.type === "Mixed") return base;
    return toRgba(base, alpha);
  }

  if (colorKey === "region") {
    return categoryColors[sample.region] || "#ffffff";
  }

  if (colorKey === "subtype_europe") {
    const base = categoryColors[sample.subtype_europe] || "#8b949e";
    const subtypeProb = getSubtypeProbability(sample);
    const alpha = Math.min(1, Math.max(TYPE_ALPHA_MIN, subtypeProb - 0.2));
    if (alpha >= 0.999) return base;
    return toRgba(base, alpha);
  }

  if (colorKey.endsWith("_pct")) {
    const p = getPercentileValue(sample, colorKey);
    return percentileColor(p);
  }

  return "#999999";
};


export const computeColors = (
  samples,
  {
    populationThreshold,
    studyThreshold,
    selectedRegions,
    selectedTypes,
    colorKey,
    selectedSample,
    categoryColors,
    metricFilters,
  }
) => {
  return samples.map((s) => {
    const population = getMetricValue(s, "population");
    const inFilter =
      population >= populationThreshold.min &&
      population <= populationThreshold.max &&
      s.n_studies >= studyThreshold.min &&
      s.n_studies <= studyThreshold.max &&
      selectedRegions.has(s.region) &&
      selectedTypes.has(s.type) &&
      metricFilters.every(f => {
        const v = getPercentileValue(s, f.key);
        return typeof v === "number" && v >= f.min && v <= f.max;
      });

    if (!inFilter) return "rgba(0,0,0,0)";

    const categoryColor = getCategoryColor(s, colorKey, categoryColors);

    if (selectedSample) {
      if (selectedSample.id === s.id) return "#ffffff";
      if (selectedSample.neighbors && selectedSample.neighbors.includes(s.id)) {
        return categoryColor;
      }
      return colorKey === "type" || colorKey === "subtype_europe"
        ? toRgba(
            "#555555",
            Math.min(
              1,
              Math.max(
                TYPE_ALPHA_MIN,
                (colorKey === "type" ? s?.probability : getSubtypeProbability(s)) ?? 1
              )
            )
          )
        : "#555555";
    }
    return categoryColor;
  });
};

export const computeSizes = (
  samples,
  {
    populationThreshold,
    studyThreshold,
    selectedRegions,
    selectedTypes,
    selectedSample,
    metricFilters,
  }
) => {
  return samples.map((s) => {
    const population = getMetricValue(s, "population");
    const inFilter =
      population >= populationThreshold.min &&
      population <= populationThreshold.max &&
      s.n_studies >= studyThreshold.min &&
      s.n_studies <= studyThreshold.max &&
      selectedRegions.has(s.region) &&
      selectedTypes.has(s.type) &&
      metricFilters.every(f => {
        const v = getPercentileValue(s, f.key);
        return typeof v === "number" && v >= f.min && v <= f.max;
      });

    if (!inFilter) return 0;

    const base = 2;
    const studyFactor = Math.log10((s.n_studies || 0) + 1) * 3.0;
    const size = base + studyFactor;

    if (selectedSample) {
      if (selectedSample.id === s.id) return size * 1.8;
      if (selectedSample.neighbors?.includes(s.id)) return size * 1.4;
      return size * 0.8;
    }

    return size;
  });
};

export function percentileColor(p) {
  if (p == null || isNaN(p)) return "#8b949e"; // fallback gray

  if (p < 20) return "#7d5fa6";  // deep muted purple
  if (p < 40) return "#a18bbcff";  // soft lavender-purple
  if (p < 60) return "#c9c5d0ff";  // lavender-gray (midpoint)
  if (p < 80) return "#7eb5b4";  // soft teal-gray
  return "#397e7dff";              // deep muted teal
}

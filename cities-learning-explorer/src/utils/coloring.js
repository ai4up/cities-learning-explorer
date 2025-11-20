export const TYPE_ALPHA_MIN = 0.2;

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

export const getCategoryColor = (sample, colorKey, categoryColors) => {
  const base = categoryColors[sample[colorKey]] || "#ffffff";
  if (colorKey !== "type") return base;

  const alpha = Math.min(1, Math.max(TYPE_ALPHA_MIN, sample?.probability ?? 1));
  if (alpha >= 0.999) return base;
  return toRgba(base, alpha);
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
  }
) => {
  return samples.map((s) => {
    const inFilter =
      (s.population >= populationThreshold) &&
      (s.n_studies >= studyThreshold) &&
      selectedRegions.has(s.region) &&
      selectedTypes.has(s.type);

    if (!inFilter) return "rgba(0,0,0,0)";

    const categoryColor = getCategoryColor(s, colorKey, categoryColors);

    if (selectedSample) {
      if (selectedSample.id === s.id) return "#ffffff";
      if (selectedSample.neighbors && selectedSample.neighbors.includes(s.id)) {
        return categoryColor;
      }
      return colorKey === "type"
        ? toRgba(
            "#555555",
            Math.min(1, Math.max(TYPE_ALPHA_MIN, s?.probability ?? 1))
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
  }
) => {
  return samples.map((s) => {
    const inFilter =
      (s.population >= populationThreshold) &&
      (s.n_studies >= studyThreshold) &&
      selectedRegions.has(s.region) &&
      selectedTypes.has(s.type);

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
  if (p == null || isNaN(p)) return "#8b949e"; // neutral gray

  if (p < 20) return "#d35f5f";   // muted red
  if (p < 40) return "#d7a06a";   // muted orange
  if (p < 60) return "#d4c06a";   // muted yellow
  if (p < 80) return "#7fbf8e";   // muted light green
  return "#5f9f72";               // muted green
}

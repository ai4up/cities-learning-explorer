// MOCK (funder prototype): similarity lenses and hand-tagged evidence.
// Data comes from preprocessing/mock/*.py and is illustrative only.

export const OVERALL_LENS = "overall";
export const LENS_KEYS = ["mobility", "energy"];
// Each lens is built for one solution domain: peers and evidence are matched on it.
export const LENS_DOMAIN = { mobility: "Mobility", energy: "Energy" };

// Solution tags that belong to the lens (all of them for the overall typology).
export const tagsForLens = (evidence, lens) =>
  Object.keys(evidence?.tags || {}).filter(
    (t) => !LENS_DOMAIN[lens] || evidence.tags[t].domain === LENS_DOMAIN[lens]
  );

export const domainColors = {
  Mobility: "#7d89b5",
  Energy: "#c8956b",
};

export const loadMock = async () => {
  const base = import.meta.env.BASE_URL;
  const get = (file) =>
    fetch(`${base}mock/${file}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null); // missing file: the dev server answers with index.html
  const [lenses, evidence] = await Promise.all([get("lenses.json"), get("evidence.json")]);
  return { lenses, evidence };
};

// Returns the samples with peers, coordinates and subtype of the chosen lens.
// `_i` is the position of the city in the lens arrays.
export const applyLens = (samples, lensData, lensKey) => {
  if (!lensData) return samples;
  const position = new Map(lensData.ids.map((id, i) => [id, i]));
  const lens = lensData.lenses[lensKey];
  return samples.map((s) => {
    const i = position.get(s.id);
    if (i === undefined) return s;
    if (!lens) return { ...s, _i: i };
    return {
      ...s,
      _i: i,
      neighbors: lens.neighbors[i],
      neighbor_distances: lens.neighbor_distances[i],
      embedding: [...lens.coords[i], 0],
      lens_subtype: lens.subtypes[lens.subtype[i]].name,
    };
  });
};

export const tagCounts = (evidence, cityId) => {
  const counts = {};
  Object.keys(evidence?.tags || {}).forEach((t) => {
    counts[t] = 0;
  });
  (evidence?.cities?.[cityId]?.studies || []).forEach((study) =>
    study.tags.forEach((t) => {
      counts[t.tag] += 1;
    })
  );
  return counts;
};

// Percentile of one lens variable for a city (the public transport value is synthetic).
export const lensPercentile = (sample, key, lensData) =>
  key === "public_transport_access"
    ? lensData.public_transport_access_pct[sample._i]
    : sample.percentiles?.[key];

// Tutorial: shown on the first visit only
const SEEN_KEY = "cities-explorer-tutorial-seen";

export const tutorialSeen = () => {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: do not show the tour on every visit
  }
};

export const markTutorialSeen = () => {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked */
  }
};

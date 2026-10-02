export const metricList = [
  { key: "population", label: "Population", decimals: -3 },
  { key: "population_growth", label: "Population growth", unit: "%", decimals: 1 },
  { key: "population_density", label: "Population density", unit: "people/km²", decimals: -2 },
  { key: "population_density_growth", label: "Population density growth", unit: "%", decimals: 1 },
  { key: "population_age", label: "Population age index", decimals: 2 },
  { key: "gdp_ppp", label: "GDP PPP", unit: "int'l $/cap", decimals: -2 },
  { key: "gdp_ppp_growth", label: "GDP PPP growth", unit: "%", decimals: 1 },
  { key: "hdd", label: "Heating Degree Days", unit: "°C", decimals: -1 },
  { key: "cdd", label: "Cooling Degree Days", unit: "°C", decimals: -1 },
  { key: "critical_infrastructure", label: "Critical infrastructure index", decimals: 2 },
  { key: "female_gender_index", label: "Female gender index", decimals: 2 },
  { key: "hdi", label: "Human development index", decimals: 2 },
  { key: "emissions", label: "GHG emissions", unit: "tCO₂e/cap", decimals: 2 },
];

export const typeDescriptions = {
  "Type 1": "Small, low-income cities with the lowest GHG emissions, low HDI, and limited critical infrastructure; high cooling needs in tropical regions, mostly in South and Southeast Asia and Africa.",
  "Type 2": "Rapidly growing, lower-income cities with rising GDP, low density, sprawled development, limited critical infrastructure, and high cooling demand in subtropical developing regions.",
  "Type 3": "Wealthier, low-growth cities with high per-capita emissions, strong infrastructure, and higher gender equality; mainly in the Global North, plus some in Latin America, Africa, and Asia.",
  "Type 4": "Large and megacities with high density, fast growth, strong infrastructure, and very high CO₂ emissions; globally distributed across both developing and developed contexts.",
};

export const typeEuropeSubtypeDescriptions = {
  Shrinking: "European cities facing population decline, aging pressures, and legacy infrastructure adaptation needs.",
  Growing: "European cities with sustained demographic and economic expansion and comparatively high infrastructure pressure.",
  Established: "Mature European cities with stable trajectories and comparatively strong institutional capacity.",
  Metropolises: "Large metropolitan hubs with concentrated activity and high climate governance complexity.",
  Metropolis: "Large metropolitan hubs with concentrated activity and high climate governance complexity.",
};

// --- European typology variables ---
export const euMetricList = [
  { key: "ghg_share_energy_industry", label: "Energy + industry", unit: "%", decimals: 1, groupKey: "ghg" },
  { key: "ghg_share_residential", label: "Residential", unit: "%", decimals: 1, groupKey: "ghg" },
  { key: "ghg_share_transport", label: "Transport", unit: "%", decimals: 1, groupKey: "ghg" },
  { key: "ghg_share_waste", label: "Waste", unit: "%", decimals: 1, groupKey: "ghg" },
  { key: "ghg_share_agriculture", label: "Agriculture", unit: "%", decimals: 1, groupKey: "ghg" },

  { key: "area", label: "Area", unit: "km²", decimals: 0, groupKey: "built" },
  { key: "built_up_area_per_capita", label: "Built-up area per capita", unit: "m²/cap", decimals: 1, groupKey: "built" },
  { key: "built_up_volume_per_capita", label: "Built-up volume per capita", unit: "m³/cap", decimals: -1, groupKey: "built" },
  { key: "built_pre_1975", label: "Built-up before 1975", unit: "%", decimals: 1, groupKey: "built" },
  { key: "road_network_density", label: "Road network density", unit: "m/m²", decimals: 3, groupKey: "built" },
  { key: "greenness", label: "Greenness index", decimals: 2, groupKey: "built" },

  { key: "storms", label: "Storms", unit: "#/yr", decimals: 0, groupKey: "haz" },
  { key: "floods", label: "Floods", unit: "#/yr", decimals: 0, groupKey: "haz" },
  { key: "heatwaves", label: "Heatwaves", unit: "#/yr", decimals: 0, groupKey: "haz" },
  { key: "heatwave_change", label: "Heatwave change", unit: "%", decimals: 1, groupKey: "haz" },
  { key: "drought_change", label: "Drought change", unit: "%", decimals: 1, groupKey: "haz" },
  { key: "heavy_precipitation_change", label: "Heavy precipitation change", unit: "%", decimals: 1, groupKey: "haz" },
  { key: "coastal_flooding_share", label: "Coastal flooding share", unit: "%", decimals: 1, groupKey: "haz" },

  { key: "age_dependency_ratio", label: "Age dependency ratio", unit: "%", decimals: 1, groupKey: "gov" },
  { key: "internet_latency", label: "Internet latency", unit: "ms", decimals: 0, groupKey: "gov" },
  { key: "decentralization_index_administrative", label: "Decentralization index: administrative", decimals: 1, groupKey: "gov" },
  { key: "decentralization_index_political", label: "Decentralization index: political", decimals: 1, groupKey: "gov" },
  { key: "decentralization_index_fiscal", label: "Decentralization index: fiscal", decimals: 1, groupKey: "gov" },
  { key: "conflicts", label: "Conflicts", unit: "#/(1M cap·yr)", decimals: 1, scale: 1000000, groupKey: "gov" },
];

export const euMetricGroups = [
  { key: "ghg", label: "Sectoral shares of GHG emissions" },
  { key: "built", label: "Urban form and infrastructure" },
  { key: "haz", label: "Climate hazards and trends" },
  { key: "gov", label: "Demography and governance" },
];

export function getEuropeanSubtype(sample) {
  return sample?.subtype_europe || null;
}

export function groupEuropeanCharacteristics(euCharacteristics, euPercentiles = null) {
  if (!euCharacteristics || typeof euCharacteristics !== "object") return [];

  const grouped = {};
  euMetricGroups.forEach((group) => {
    grouped[group.key] = [];
  });

  euMetricList.forEach((metric) => {
    const value = euCharacteristics[metric.key];
    const displayValue = formatNumber(value, metric.decimals, metric.scale);
    if (displayValue == null) return;

    grouped[metric.groupKey].push({
      key: metric.key,
      label: metric.label,
      unit: metric.unit ?? null,
      displayValue,
      pct: euPercentiles?.[metric.key] ?? null,
    });
  });

  return euMetricGroups
    .map((group) => ({ group: group.label, items: grouped[group.key] }))
    .filter((group) => group.items.length > 0);
}

export function formatNumber(value, decimals, scale = 1) {
  if (value == null || typeof value !== "number" || Number.isNaN(value)) return null;
  const scaled = value * scale;
  if (decimals == null) return scaled;

  if (decimals >= 0) {
    return scaled.toFixed(decimals);
  }

  const factor = Math.pow(10, -decimals);
  return (Math.round(scaled / factor) * factor).toLocaleString();
}

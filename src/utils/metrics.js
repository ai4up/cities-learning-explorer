export const metricList = [
    { key: "population", label: "Population", decimals: -3 },
    { key: "population_growth", label: "Population growth", unit: "%", decimals: 1 },
    { key: "population_density", label: "Population density", unit: "people/km²", decimals: -2 },
    { key: "population_density_growth", label: "Population density growth", unit: "%", decimals: 1 },
    { key: "gdp_ppp", label: "GDP PPP", unit: "int'l $/capita", decimals: -2 },
    { key: "gdp_ppp_growth", label: "GDP PPP growth", unit: "%", decimals: 1 },
    { key: "hdd", label: "Heating Degree Days", unit: "°C", decimals: -1 },
    { key: "cdd", label: "Cooling Degree Days", unit: "°C", decimals: -1 },
    { key: "critical_infrastructure", label: "Critical infrastructure", decimals: 2 },
    { key: "greenness_index", label: "Greenness", decimals: 2 },
    { key: "precipitation", label: "Precipitation", unit: "mm", decimals: -1 },
    { key: "female_gender_index", label: "Female gender index", decimals: 2 },
    { key: "hdi", label: "Human development index", decimals: 2 },
    { key: "emissions", label: "GHG emissions", unit: "tCO₂e/capita", decimals: 2 },
  ];
  
export const typeDescriptions = {
  "Type 1": "Small, low-income cities with the lowest GHG emissions, low HDI, and limited critical infrastructure; high cooling needs in tropical regions, mostly in South and Southeast Asia and Africa.",
  "Type 2": "Rapidly growing, lower-income cities with rising GDP, low density, sprawled development, limited critical infrastructure, and high cooling demand in subtropical developing regions.",
  "Type 3": "Wealthier, low-growth cities with high per-capita emissions, strong infrastructure, and higher gender equality; mainly in the Global North, plus some in Latin America, Africa, and Asia.",
  "Type 4": "Large and megacities with high density, fast growth, strong infrastructure, and very high CO₂ emissions; globally distributed across both developing and developed contexts."
};

export function formatNumber(value, decimals) {
  if (decimals == null) return value;
  if (typeof value !== "number") return value;

  if (decimals >= 0) {
    return value.toFixed(decimals);
  }

  // negative decimals → round visually to tens, hundreds, thousands…
  const factor = Math.pow(10, -decimals);
  return (Math.round(value / factor) * factor).toLocaleString();
}
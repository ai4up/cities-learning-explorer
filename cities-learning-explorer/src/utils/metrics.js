export const metricList = [
    { key: "population", label: "Population" },
    { key: "population_growth", label: "Population growth" },
    { key: "population_density", label: "Population density" },
    { key: "population_density_growth", label: "Population density growth" },
    { key: "gdp_ppp", label: "GDP PPP" },
    { key: "gdp_ppp_growth", label: "GDP PPP growth" },
    { key: "hdd", label: "Heating Degree Days" },
    { key: "cdd", label: "Cooling Degree Days" },
    { key: "critical_infrastructure", label: "Critical infrastructure" },
    { key: "greenness_index", label: "Greenness" },
    { key: "precipitation", label: "Precipitation" },
  ];
  
export const typeDescriptions = {
  "Type 1": "Small, low-income cities with the lowest GHG emissions, low HDI, and limited critical infrastructure; high cooling needs in tropical regions, mostly in South and Southeast Asia and Africa.",
  "Type 2": "Rapidly growing, lower-income cities with rising GDP, low density, sprawled development, limited critical infrastructure, and high cooling demand in subtropical developing regions.",
  "Type 3": "Wealthier, low-growth cities with high per-capita emissions, strong infrastructure, and higher gender equality; mainly in the Global North, plus some in Latin America, Africa, and Asia.",
  "Type 4": "Large and megacities with high density, fast growth, strong infrastructure, and very high CO₂ emissions; globally distributed across both developing and developed contexts."
};

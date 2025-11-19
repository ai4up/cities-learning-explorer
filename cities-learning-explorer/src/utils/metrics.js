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
  
  export const getProbabilities = (sample) => {
    if (sample && Array.isArray(sample.type_probabilities)) {
      return sample.type_probabilities;
    }
    if (sample && sample.probabilities) {
      return [
        sample.probabilities.mean_prob_cluster_0 || 0,
        sample.probabilities.mean_prob_cluster_1 || 0,
        sample.probabilities.mean_prob_cluster_2 || 0,
        sample.probabilities.mean_prob_cluster_3 || 0,
      ];
    }
    const keys = [
      "mean_prob_cluster_0",
      "mean_prob_cluster_1",
      "mean_prob_cluster_2",
      "mean_prob_cluster_3",
    ];
    return keys.map((k) =>
      sample && sample[k] !== undefined ? sample[k] : 0
    );
  };
  
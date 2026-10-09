import React from "react";
import {
  formatNumber,
  getEuropeanSubtype,
  groupEuropeanCharacteristics,
  metricList,
  typeEuropeSubtypeDescriptions,
  typeDescriptions,
} from "../utils/metrics";
import { domainPalette, typeColorsExplore, percentileColor } from "../utils/coloring";
import MethodologySection from "./MethodologySection";

const InfoPanel = ({ selectedSample, samples, setSelectedSample, setSearchValue }) => {
  const [openSections, setOpenSections] = React.useState({
    type: false,
    domains: false,
    similar: false,
    metrics: false,
    euMetrics: false,
  });

  if (!selectedSample) return null;

  const similarWithStudies =
    selectedSample.neighbors
      ?.slice(0, 10)
      .map((idx, i) => ({
        neighbour: samples.find((s) => s.id === idx),
        dist: selectedSample.neighbor_distances?.[i],
      }))
      .filter((x) => x.neighbour && x.neighbour.n_studies > 0) || [];

  const toggle = (key) => {
    setOpenSections(s => ({ ...s, [key]: !s[key] }));
  };

  const euCharacteristicGroups = groupEuropeanCharacteristics(
    selectedSample.eu_characteristics,
    selectedSample.eu_percentiles,
  );
  const globalTypeDescription = typeDescriptions[selectedSample.type];
  const europeanSubtype = getEuropeanSubtype(selectedSample);
  const europeanSubtypeDescription = europeanSubtype
    ? typeEuropeSubtypeDescriptions[europeanSubtype]
    : null;

  return (
    <div className="info-panel">
      <div className="info-panel-header">
        <h3>
          {selectedSample.name}
          {selectedSample.country ? ", " + selectedSample.country : ""}
        </h3>
        <button
          type="button"
          className="info-close"
          aria-label="Close city details"
          title="Close"
          onClick={() => {
            setSearchValue("");
            setSelectedSample(null);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="info-panel-body">
        <div style={{ fontSize: "0.8em", lineHeight: "1.3em" }}>
          <div style={{ position: "relative" }}>
            <strong>Type:</strong>{" "}
            <span className="type-tooltip">
              {selectedSample.type}
              {globalTypeDescription && (
                <span className="type-tooltip-content">
                  {globalTypeDescription}
                </span>
              )}
            </span>
          </div>
          {europeanSubtype && (
            <div style={{ position: "relative" }}>
              <strong>Subtype (Europe only):</strong>{" "}
              <span className="type-tooltip type-tooltip-right">
                {europeanSubtype}
                {europeanSubtypeDescription && (
                  <span className="type-tooltip-content">
                    {europeanSubtypeDescription}
                  </span>
                )}
              </span>
            </div>
          )}
          <div>
            <strong>Region:</strong> {selectedSample.region}
          </div>
          <div>
            <strong>GHS-UCDB ID:</strong> {selectedSample.id}
          </div>
          <div>
            <strong>Number of studies:</strong> {selectedSample.n_studies}
          </div>
        </div>

        {/* Cluster assignment probabilities */}
        {selectedSample.type_probabilities && (
          <div
            style={{
              marginTop: "18px",
              borderTop: "1px solid #444",
              paddingTop: "12px",
            }}
          >
            <strong>Type probabilities</strong>
            <MethodologySection
              isOpen={openSections.type}
              onToggle={() => toggle("type")}
            >
              <p>
                We identify global city types using  <a href="https://doi.org/10.48550/arXiv.1511.06335" target="_blank" rel="noopener noreferrer">Deep Embedded Clustering (DEC)</a>, an unsupervised machine-learning method. It learns a compact representation of each city and groups cities with similar profiles.
              </p>
              <p>
                Because clustering can vary with different starting conditions, we repeat the process many times and combine the results through ensemble clustering. The final type reflects the most common assignment across runs, while the type probabilities show how consistently the model associates the city with each cluster.
              </p>
            </MethodologySection>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                height: "80px",
                marginTop: "4px",
              }}
            >
              {selectedSample.type_probabilities.map((val, idx) => {
                const pct = Math.round(val * 100);
                const label = `T${idx + 1}`;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      marginRight: idx < 3 ? "4px" : "0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: typeColorsExplore[`Type ${idx + 1}`],
                        height: `${pct}%`,
                        borderRadius: "2px",
                        width: "75%",
                      }}
                    ></div>
                    <span style={{ fontSize: "0.7em", marginTop: "4px" }}>
                      {label}: {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional metrics */}
        <div
          style={{
            marginTop: "18px",
            borderTop: "1px solid #444",
            paddingTop: "12px",
          }}
        >
          <strong>City characteristics</strong>
          <MethodologySection
            isOpen={openSections.metrics}
            onToggle={() => toggle("metrics")}
          >
            <p>
              Metrics are sourced from the <a href="https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php" target="_blank" rel="noopener noreferrer"> Global Human Settlement Layer (GHSL)</a> and related datasets. The built-up share is the share of the urban centre area covered by settlements in the <a href="https://geoservice.dlr.de/web/maps/eoc:wsf2019" target="_blank" rel="noopener noreferrer">World Settlement Footprint 2019</a> (DLR).
            </p>
            <p>
              Percentile ranks indicate the share of cities worldwide that have lower values, showing how each city compares to its global peers for each characteristic.
            </p>
            <p>
              The indicator &ldquo;Informal settlements proportion&rdquo; describes the proportion of urban population living in slums or informal settlements. It uses UN-Habitat SDG 11.1.1 at national level, mapped to cities by country, using the latest non-null country value (typically 2022, earlier if 2022 is unavailable).
            </p>
          </MethodologySection>
          <div
            style={{
              margin: "0 0 4px 0",
              fontSize: "0.7em",
              marginTop: "12px",
            }}
          >
            {metricList.map((item) => {
              const val = selectedSample.characteristics?.[item.key];
              const pct = selectedSample.percentiles?.[item.key];
              let displayVal;
              if (val !== undefined && val !== null) {
                displayVal = formatNumber(val, item.decimals);
              } else {
                displayVal = "-";
              }
              return (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "2px",
                  }}
                >
                  {/* Label + Unit */}
                  <span>
                    {item.label}
                    {item.unit && (
                      <span style={{ color: "#8b949e" }}> [{item.unit}]</span>
                    )}
                  </span>

                  <div style={{ textAlign: "right" }}>
                    {/* Metric value */}
                    <span style={{ fontWeight: "bold"}}>{displayVal}</span>

                    {/* Percentile chip */}
                    {pct != null && (
                      <span
                        title={`${pct}th percentile globally`}
                        style={{
                          marginLeft: "6px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: percentileColor(pct),
                          color: "#0d1117",
                          fontSize: "0.7em",
                          fontWeight: "bold",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "15px",
                        }}
                      >
                        {Math.round(pct)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {euCharacteristicGroups.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <strong>Additional indicators (Europe only)</strong>
              <MethodologySection
                isOpen={openSections.euMetrics}
                onToggle={() => toggle("euMetrics")}
              >
                <p>
                  Metrics are sourced from [1]. Variable definitions and calculation details are documented in the <a href="https://doi.org/10.1088/1748-9326/ae7e97/data2" target="_blank" rel="noopener noreferrer"> Supplementary data</a>.
                </p>
                <div style={{ fontSize: "0.75em" }}>
                  [1] <a href="https://doi.org/10.1088/1748-9326/ae7e97" target="_blank" rel="noopener noreferrer">Kopp, Mira, et al. "Climate mitigation and adaptation strategies tailored for different types of European cities: A typology and associated systematic review." <em>Environmental Research Letters</em> 21.14 (2026)</a>
                </div>
              </MethodologySection>
              <div style={{ fontSize: "0.7em", marginTop: "8px" }}>
              {euCharacteristicGroups.map(({ group, items }) => (
                <div key={group} style={{ marginBottom: "8px" }}>
                  <div style={{ color: "#8b949e", marginBottom: "2px" }}>
                    {group}
                  </div>
                  {items.map(({ key, label, unit, displayValue, pct }) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "2px",
                      }}
                    >
                      <span>
                        {label}
                        {unit && <span style={{ color: "#8b949e" }}> [{unit}]</span>}
                      </span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: "bold" }}>
                          {displayValue}
                        </span>
                        {pct != null && (
                          <span
                            title={`${pct}th percentile among all cities`}
                            style={{
                              marginLeft: "6px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: percentileColor(pct),
                              color: "#0d1117",
                              fontSize: "0.7em",
                              fontWeight: "bold",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: "15px",
                            }}
                          >
                            {Math.round(pct)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* Domain solution counts (horizontal bar chart) */}
        {selectedSample.solution_domain_counts && (
          <div
            style={{
              marginTop: "18px",
              borderTop: "1px solid #444",
              paddingTop: "12px",
            }}
          >
            <strong>Climate solution domains</strong>
            <MethodologySection
              isOpen={openSections.domains}
              onToggle={() => toggle("domains")}
            >
              <p>
                We analyze more than 100,000 peer-reviewed studies on cities and climate change (based on [1]).
                Each study is linked to specific cities using automated geoparsing and city-name detection.
              </p>
              <p>
                The bars show the number of case studies mentioning each domain for this city.
              </p>
              <p>
                Note that the total number of studies per city may differ from the number of solutions, as some studies do not cover specific solutions, while others address multiple domains.
              </p>

              <div style={{ fontSize: "0.75em" }}>
                [1] <a href="https://doi.org/10.1038/s44284-025-00260-8" target="_blank" rel="noopener noreferrer">Montfort, Simon, et al. "Systematic global stocktake of over 50,000 urban climate change studies." <em>Nature Cities</em> 2.7 (2025).</a>
              </div>

            </MethodologySection>

            {Object.values(selectedSample.solution_domain_counts).every((v) => v === 0) ? (
              <div style={{ marginTop: "6px", fontStyle: "italic", fontSize: "0.75em" }}>
                No domain information available.
              </div>
            ) : (
              <div style={{ marginTop: "10px" }}>
                {Object.entries(selectedSample.solution_domain_counts)
                  .filter(([, val]) => val > 0)
                  .map(([label, val], idx) => {
                    const max = Math.max(
                      ...Object.values(selectedSample.solution_domain_counts)
                    );
                    const widthPct = Math.round((val / max) * 100);

                    return (
                      <div
                        key={label}
                        style={{
                          marginBottom: "6px",
                          fontSize: "0.75em",
                        }}
                      >
                        {/* Label */}
                        <div style={{ marginBottom: "2px" }}>{label}</div>

                        {/* Horizontal bar */}
                        <div
                          style={{
                            height: "10px",
                            backgroundColor: domainPalette[idx % domainPalette.length],
                            width: `${widthPct}%`,
                            borderRadius: "2px",
                          }}
                        ></div>

                        {/* Value */}
                        <div
                          style={{
                            fontSize: "0.65em",
                            opacity: 0.8,
                            marginTop: "2px",
                          }}
                        >
                          {val} {val === 1 ? "study" : "studies"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Nearest neighbours list */}
        <div
          style={{
            marginTop: "18px",
            borderTop: "1px solid #444",
            paddingTop: "12px",
          }}
        >
          <strong>Similar cities with evidence</strong>
          <MethodologySection
            isOpen={openSections.similar}
            onToggle={() => toggle("similar")}
          >
            <p>
              Similarity is based on k-nearest neighbors in the embedding space learned from the Deep Embedded Clustering (DEC) model.
            </p>
            <p>
              Distances are computed using Euclidean distance in the latent space, averaged across all ensemble clustering runs to ensure robustness.
              The distance to each neighboring city is shown. Smaller values indicate greater similarity, meaning climate solution studies from these cities may be more transferable.
            </p>
            <p>
              We list the closest cities that also have at least one climate-relevant case study, highlighting sources of transferable evidence.
            </p>
          </MethodologySection>
        </div>
        <div style={{ fontSize: "0.75em" }}>
          {similarWithStudies.length === 0 ? (
            <div style={{ marginTop: "6px", fontStyle: "italic" }}>
              No studies available for the most similar 10 cities.
            </div>
          ) : (
            <ul>
              {similarWithStudies.map(({ neighbour, dist }) => (
                <div
                  key={neighbour.id}
                  style={{ display: "flex", gap: "0.25rem" }}
                >
                  <span>{dist?.toFixed(1)}:</span>
                  <li
                    onClick={() => setSelectedSample(neighbour)}
                    style={{
                      cursor: "pointer",
                      textDecoration: "underline",
                      listStyle: "none",
                    }}
                  >
                    {neighbour.name}, {neighbour.country}
                  </li>
                  <span>({neighbour.n_studies} studies)</span>
                </div>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;

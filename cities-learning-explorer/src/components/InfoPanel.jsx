import React from "react";
import { metricList, getProbabilities, typeDescriptions } from "../utils/metrics";
import { palette } from "../utils/coloring";

const InfoPanel = ({ selectedSample, samples, setSelectedSample }) => {
  if (!selectedSample) return null;

  const similarWithStudies =
    selectedSample.neighbors
      ?.slice(0, 10)
      .map((idx, i) => ({
        neighbour: samples.find((s) => s.id === idx),
        dist: selectedSample.neighbor_distances?.[i],
      }))
      .filter((x) => x.neighbour && x.neighbour.n_studies > 0) || [];

  return (
    <div className="info-panel">
      <h3>
        {selectedSample.name}
        {selectedSample.country ? ", " + selectedSample.country : ""}
      </h3>
      <div style={{ fontSize: "0.8em", lineHeight: "1.3em" }}>
        <div style={{ position: "relative" }}>
          <strong>Type:</strong>{" "}
          <span className="type-tooltip">
            {selectedSample.type}
            <span className="type-tooltip-content">
              {typeDescriptions[selectedSample.type]}
            </span>
          </span>
        </div>
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
      {(selectedSample.type_probabilities ||
        selectedSample.probabilities ||
        selectedSample.mean_prob_cluster_0 !== undefined) && (
        <div
          style={{
            marginTop: "18px",
            borderTop: "1px solid #444",
            paddingTop: "8px",
          }}
        >
          <strong>Type probabilities:</strong>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              height: "80px",
              marginTop: "4px",
            }}
          >
            {getProbabilities(selectedSample).map((val, idx) => {
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
                      backgroundColor: palette[idx % palette.length],
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
          marginTop: "8px",
          fontSize: "0.7em",
          borderTop: "1px solid #444",
          paddingTop: "8px",
        }}
      >
        <div
          style={{
            margin: "0 0 4px 0",
            fontSize: "1.5em",
            fontWeight: "bold",
            paddingBottom: "8px",
          }}
        >
          City characteristics
        </div>
        {metricList.map((item) => {
          const val = selectedSample[item.key];
          let displayVal;
          if (val !== undefined && val !== null) {
            displayVal =
              typeof val === "number"
                ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : val;
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
              <span>{item.label}</span>
              <span style={{ fontWeight: "bold" }}>{displayVal}</span>
            </div>
          );
        })}
      </div>

      {/* Domain solution counts (horizontal bar chart) */}
      {selectedSample.solution_domain_counts && (
        <div
          style={{
            marginTop: "18px",
            borderTop: "1px solid #444",
            paddingTop: "8px",
          }}
        >
          <strong>Climate solution domains:</strong>

          {Object.values(selectedSample.solution_domain_counts).every((v) => v === 0) ? (
            <div style={{ marginTop: "6px", fontStyle: "italic", fontSize: "0.75em" }}>
              No domain information available.
            </div>
          ) : (
            <div style={{ marginTop: "10px" }}>
              {Object.entries(selectedSample.solution_domain_counts)
                .filter(([label, val]) => val > 0)
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
                          backgroundColor: palette[idx % palette.length],
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
          paddingTop: "8px",
        }}
      >
        <strong>Similar cities with evidence:</strong>
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

      {/* Close button */}
      <div style={{ marginTop: "12px", textAlign: "center" }}>
        <button
          onClick={() => setSelectedSample(null)}
          style={{
            backgroundColor: "#21262d",
            color: "#c9d1d9",
            border: "1px solid #30363d",
            padding: "6px 15px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.8em"
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default InfoPanel;

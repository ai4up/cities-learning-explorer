import React from "react";
import { metricList, getProbabilities } from "../utils/metrics";
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
        <div>
          <strong>Type:</strong> {selectedSample.type}
        </div>
        <div>
          <strong>Region:</strong> {selectedSample.region}
        </div>
        <div>
          <strong>GHS-UCDB ID:</strong> {selectedSample.id}
        </div>
        <div>
          <strong>Number of Studies:</strong> {selectedSample.n_studies}
        </div>
      </div>

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
          <strong>Type assignment probabilities:</strong>
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
    </div>
  );
};

export default InfoPanel;

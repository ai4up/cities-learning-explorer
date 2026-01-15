import React, { useEffect, useMemo, useState } from "react";
import TypeMetricsPlot from "./TypeMetricsPlot";
import TypeMap from "./TypeMap";
import "../styles/landing.css"; // make sure this path matches your project

const TYPE_ORDER = ["Type 1", "Type 2", "Type 3", "Type 4"];
const TYPE_META = {
  "Type 1": {
    title: "Type 1 – Cities with major development needs",
    subtitle:
      "Small, low-income cities with limited infrastructure, low emissions, and rising exposure to climate extremes.",
    bullets: [
      "Relatively small populations and low GDP per capita.",
      "Lowest CO₂ emissions, lowest human development index, and lowest levels of critical infrastructure among all types.",
      "Often located in tropical regions with high cooling needs.",
    ],
  },

  "Type 2": {
    title: "Type 2 – Rapidly expanding cities with high urban planning potential",
    subtitle:
      "Fast-growing cities with moderate population density, incomes, and emissions.",
    bullets: [
      "Characterised by rapid urban expansion and significant GDP growth.",
      "Relatively low population density and sprawled development patterns.",
      "Low levels of critical infrastructure.",
    ],
  },

  "Type 3": {
    title: "Type 3 – Wealthier, slower-growing, high-emitting cities with large mitigation responsibilities",
    subtitle:
      "Cities with higher incomes, higher emissions, strong infrastructure, and lower growth rates.",
    bullets: [
      "Wealthier cities with low GDP growth, low population density, and limited population growth.",
      "Relatively high CO₂ emissions, higher critical infrastructure levels, and higher gender equality.",
      "Mostly located in temperate and cold regions with lower cooling and higher heating needs.",
    ],
  },

  "Type 4": {
    title: "Type 4 – Large and megacities with complex climate challenges",
    subtitle:
      "High-density cities with rapid growth, extensive infrastructure, and very high CO₂ emissions.",
    bullets: [
      "Mostly large and megacities with high population density and high population growth.",
      "Relatively high levels of critical infrastructure and very high CO₂ emissions.",
      "Developed-country megacities face combined mitigation and adaptation pressures.",
    ],
  },
};

const LandingPage = () => {
  const [cities, setCities] = useState([]);
  const [activeType, setActiveType] = useState("Type 1");
  const [webglFailed, setWebglFailed] = useState(false);

  // Load cities.json
  useEffect(() => {
    fetch("/cities.json")
      .then((res) => res.json())
      .then((data) => {
        setCities(data || []);

        // Ensure activeType exists in data
        const availableTypes = Array.from(new Set(data.map((c) => c.type))).sort();
        if (!availableTypes.includes("Type 1") && availableTypes.length > 0) {
          setActiveType(availableTypes[0]);
        }
      })
      .catch((err) =>
        console.error("Failed to load cities.json for landing page:", err)
      );
  }, []);

  // Basic stats per type (count + region shares)
  const typeStats = useMemo(() => {
    if (!cities.length) return {};
    const stats = {};

    TYPE_ORDER.forEach((t) => {
      const filtered = cities.filter((c) => c.type === t);

      // count cities per region
      const regionCounts = {};
      filtered.forEach((c) => {
        regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
      });

      const regions = Object.keys(regionCounts).sort();

      stats[t] = {
        count: filtered.length,
        regions,
        regionCounts,
      };
    });

    return stats;
  }, [cities]);


  return (
    <div className="landing-root">
      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1 className="landing-title">A Global Typology of 11,000 Cities</h1>
          <p className="landing-subtitle">
            A data-driven classification of 11,000 cities that links urban structure to the global evidence base on climate solutions – enabling systematic comparison, gap detection, and evidence-based transfer learning.
          </p>

          <div className="landing-hero-actions">
            <a href="/explore" className="landing-btn-primary">
              Explore the typology
            </a>
            <a
              href="https://doi.org/10.21203/rs.3.rs-8363797/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn-secondary"
            >
              Read the paper
            </a>
          </div>
        </div>

        {/* SHORT INTRO */}
        <section className="landing-intro">
          <div className="landing-intro-grid">
            <div>
              <h2 style={{ marginBottom: "6px" }}>Why a global city typology?</h2>
              <p
                style={{
                  fontSize: "0.95rem",
                  color: "#c9d1d9",
                  lineHeight: 1.5,
                }}
              >
                Cities play a central role in climate mitigation and adaptation, but
                case study evidence is fragmented and unevenly distributed. Most
                cities have only a handful of documented climate solutions – if any.
              </p>
              <p>
                By building a global typology of cities, we can identify which cities
                are similar, where evidence is concentrated, and how lessons from
                well-studied cities can inform climate action elsewhere.
              </p>
            </div>
            <div>
              <ul className="landing-bullets">
                <li>11,000+ cities from the Global Human Settlement Layer (GHSL).</li>
                <li>
                  4 data-driven city types derived from 11 urban indicators using
                  Deep Embedded Clustering (DEC).
                </li>
                <li>100,000+ climate-relevant case studies mapped to cities.</li>
                <li>
                  A framework for evidence-based transfer learning between similar
                  cities and types.
                </li>
              </ul>
            </div>
          </div>
        </section>
        <div className="scroll-hint">
          <span>Discover the four city types</span>
          <div className="scroll-chevron">⌄</div>
        </div>
      </section>

      {/* TYPOLOGY EXPLAINER */}
      <section className="landing-typology">
        {/* LEFT: type cards */}
        <div className="typology-left">
          <div className="typology-heading">The four global city types</div>
          <div className="typology-intro">
            Scroll through the city types on the left. The charts on the right
            update to show how cities of the selected type compare to all other
            cities and where they are located globally.
          </div>

          <div className="typology-scroll-container">
            {TYPE_ORDER.map((t) => {
              const meta = TYPE_META[t];
              const isActive = activeType === t;
              const stats = typeStats[t] || { count: 0, regions: [], regionCounts: {} };
              const regionShares = stats.regions
                .map((r) => ({
                  region: r,
                  share: ((stats.regionCounts[r] / stats.count) * 100).toFixed(1),
                }))
                .sort((a, b) => b.share - a.share); // highest first

              return (
                <div
                  key={t}
                  className={
                    "typology-section" + (isActive ? " typology-section-active" : "")
                  }
                  onClick={() => setActiveType(t)}
                  onMouseEnter={() => setActiveType(t)}
                >
                  <h3>{meta?.title || t}</h3>
                  {meta?.subtitle && (
                    <p className="typology-subtitle">{meta.subtitle}</p>
                  )}
                  <p
                    style={{
                      fontSize: "0.8rem",
                      marginBottom: "4px",
                      color: "#8b949e",
                    }}
                  >
                    {stats.count.toLocaleString()} cities ·{" "}
                    {regionShares.length > 0
                      ? regionShares
                          .slice(0, 3)
                          .map((r) => `${r.region} (${r.share}%)`)
                          .join(" · ")
                      : "—"}
                  </p>
                  {meta?.bullets && (
                    <ul
                      style={{
                        paddingLeft: "18px",
                        margin: 0,
                        fontSize: "0.84rem",
                      }}
                    >
                      {meta.bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: "4px" }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: metrics + map */}
        <div className="typology-right">
          <div className="typology-right-inner">
            <div className="typology-map-panel">
              <div className="typology-viz-title">
                Global footprint of {activeType}
                <span className="typology-viz-subtitle">
                  {" "}
                  Cities of the selected type are highlighted.
                </span>
              </div>

              {webglFailed ? (
                <div className="map-fallback">
                  WebGL is disabled on this device.<br />
                  The interactive map cannot be displayed.
                </div>
              ) : (
                <TypeMap
                  cities={cities}
                  activeType={activeType}
                  onWebglError={() => setWebglFailed(true)}
                />
              )}
            </div>

            <div className="typology-viz-panel">
              <div className="typology-viz-title">
                Distribution of city characteristics
                <span className="typology-viz-subtitle">
                  {" "}
                  Boxplots show all cities (background) and the selected type
                  (colored), across key indicators.
                </span>
              </div>
              <TypeMetricsPlot cities={cities} activeType={activeType} />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER / CTA */}
      <section className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <h2>Ready to explore individual cities?</h2>
            <p>
              Switch to the interactive explorer to inspect city characteristics,
              evidence on climate solutions, and similar cities in detail.
            </p>
          </div>
          <a href="/explore" className="landing-btn-primary">
            Go to Explorer
          </a>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;

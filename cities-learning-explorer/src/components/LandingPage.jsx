import React, { useEffect, useMemo, useState } from "react";
import TypeMetricsPlot from "./TypeMetricsPlot";
import TypeMap from "./TypeMap";
import "../styles/landing.css"; // make sure this path matches your project

const TYPE_ORDER = ["Type 1", "Type 2", "Type 3", "Type 4"];

const TYPE_META = {
  "Type 1": {
    title: "Type 1 – Emerging and rapidly growing cities",
    subtitle:
      "Fast-growing cities with lower economic capacity and infrastructure pressure.",
    bullets: [
      "Often smaller and mid-sized cities with rapid population and density growth.",
      "Limited infrastructure and financial capacity can constrain climate action.",
      "High potential to avoid carbon lock-in through early, strategic investments.",
    ],
  },
  "Type 2": {
    title: "Type 2 – Developing and expanding cities",
    subtitle:
      "Cities balancing growth, infrastructure expansion, and resilience needs.",
    bullets: [
      "Growing populations and built-up areas with rising infrastructure demands.",
      "Moderate economic capacity with competing development and climate priorities.",
      "Key opportunities for integrated planning of housing, mobility, and energy.",
    ],
  },
  "Type 3": {
    title: "Type 3 – Established and planning-focused cities",
    subtitle:
      "More mature cities with significant planning and adaptation activity.",
    bullets: [
      "Moderate-to-high income levels with relatively stable population growth.",
      "Stronger planning institutions and existing climate or sustainability agendas.",
      "Focus on retrofitting, adaptation, and improving existing systems.",
    ],
  },
  "Type 4": {
    title: "Type 4 – Large and high-income cities",
    subtitle:
      "Wealthy or mega-cities with high emissions and complex challenges.",
    bullets: [
      "High economic output, often with large populations and dense urban cores.",
      "High per-capita or total emissions and large mitigation responsibilities.",
      "Pioneers of ambitious climate policies with strong global learning potential.",
    ],
  },
};

const LandingPage = () => {
  const [cities, setCities] = useState([]);
  const [activeType, setActiveType] = useState("Type 1");

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

  // Basic stats per type (count + regions)
  const typeStats = useMemo(() => {
    if (!cities.length) return {};
    const stats = {};
    TYPE_ORDER.forEach((t) => {
      const subset = cities.filter((c) => c.type === t);
      stats[t] = {
        count: subset.length,
        regions: Array.from(new Set(subset.map((c) => c.region))).sort(),
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
            Explore a data-driven typology of more than 11,000 cities worldwide.
            We combine urban indicators, deep embedded clustering, and a systematic
            map of climate solutions to highlight where evidence exists – and
            where learning potential is greatest.
          </p>

          <div className="landing-hero-actions">
            <a href="/explore" className="landing-btn-primary">
              Explore the typology
            </a>
            <a
              href="https://doi.org/10.48550/arXiv.XXXX.XXXXX"
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
              const stats = typeStats[t] || { count: 0, regions: [] };

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
                    {stats.regions.length > 0 ? stats.regions.join(" · ") : "—"}
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
              <TypeMap cities={cities} activeType={activeType} />
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

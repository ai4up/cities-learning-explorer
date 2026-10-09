import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TypeMetricsPlot from "./TypeMetricsPlot";
import TypeMap from "./TypeMap";
import SiteFooter from "./SiteFooter";
import { typeColors } from "../utils/coloring";
import "../styles/landing.css";

const PAPER_URL = "https://doi.org/10.21203/rs.3.rs-8363797/v1";

const TYPE_ORDER = ["Type 1", "Type 2", "Type 3", "Type 4"];
const TYPE_META = {
  "Type 1": {
    name: "Cities with major development needs",
    subtitle:
      "Small, low-income cities with limited infrastructure, low emissions, and rising exposure to climate extremes.",
    bullets: [
      "Relatively small populations and low GDP per capita.",
      "Lowest CO₂ emissions, lowest human development index, and lowest levels of critical infrastructure among all types.",
      "Often located in tropical regions with high cooling needs.",
    ],
  },

  "Type 2": {
    name: "Rapidly expanding cities with high urban planning potential",
    subtitle:
      "Fast-growing cities with moderate population density, incomes, and emissions.",
    bullets: [
      "Characterised by rapid urban expansion and significant GDP growth.",
      "Relatively low population density and sprawled development patterns.",
      "Low levels of critical infrastructure.",
    ],
  },

  "Type 3": {
    name: "Wealthier, slower-growing, high-emitting cities with large mitigation responsibilities",
    subtitle:
      "Cities with higher incomes, higher emissions, strong infrastructure, and lower growth rates.",
    bullets: [
      "Wealthier cities with low GDP growth, low population density, and limited population growth.",
      "Relatively high CO₂ emissions, higher critical infrastructure levels, and higher gender equality.",
      "Mostly located in temperate and cold regions with lower cooling and higher heating needs.",
    ],
  },

  "Type 4": {
    name: "Large and megacities with complex climate challenges",
    subtitle:
      "High-density cities with rapid growth, extensive infrastructure, and very high CO₂ emissions.",
    bullets: [
      "Mostly large and megacities with high population density and high population growth.",
      "Relatively high levels of critical infrastructure and very high CO₂ emissions.",
      "Developed-country megacities face combined mitigation and adaptation pressures.",
    ],
  },
};

const AFFILIATIONS = [
  {
    name: "Potsdam Institute for Climate Impact Research (PIK)",
    url: "https://www.pik-potsdam.de/",
    logo: "logos/pik.png",
    logoAlt: "PIK logo",
  },
  {
    name: "Technische Universität Berlin",
    url: "https://www.tu.berlin/",
    logo: "logos/tu-berlin.svg",
    logoAlt: "TU Berlin logo",
  },
  {
    name: "École polytechnique fédérale de Lausanne (EPFL)",
    url: "https://www.epfl.ch/",
    logo: "logos/epfl.svg",
    logoAlt: "EPFL logo",
  },
  {
    name: "ETH Zurich",
    url: "https://ethz.ch/",
    logo: "logos/eth-zurich.svg",
    logoAlt: "ETH Zurich logo",
  },
];

const CITATION_BIBTEX = `@unpublished{montfort_global_typology_cities,
  title   = {A global typology of cities supporting coordinated climate action},
  author  = {Montfort, Simon and Nachtigall, Florian and Repke, Tim and Binder, Claudia R. and Creutzig, Felix},
  note    = {Forthcoming in Nature Climate Change},
}`;

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
  </svg>
);

const LandingPage = () => {
  const [cities, setCities] = useState([]);
  const [activeType, setActiveType] = useState("Type 1");
  const [webglFailed, setWebglFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle");

  useEffect(() => {
    const citiesUrl = `${import.meta.env.BASE_URL}cities.json`;
    fetch(citiesUrl)
      .then((res) => res.json())
      .then((data) => {
        const normalized = data || [];
        setCities(normalized);

        const availableTypes = Array.from(new Set(normalized.map((c) => c.type))).sort();
        if (!availableTypes.includes("Type 1") && availableTypes.length > 0) {
          setActiveType(availableTypes[0]);
        }
      })
      .catch((err) =>
        console.error("Failed to load cities.json for landing page:", err)
      );
  }, []);

  // Basic stats per type (count + region shares, highest share first)
  const typeStats = useMemo(() => {
    const stats = {};

    TYPE_ORDER.forEach((t) => {
      const filtered = cities.filter((c) => c.type === t);
      const regionCounts = {};
      filtered.forEach((c) => {
        regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
      });

      stats[t] = {
        count: filtered.length,
        regionShares: Object.entries(regionCounts)
          .map(([region, n]) => ({ region, share: (n / filtered.length) * 100 }))
          .sort((a, b) => b.share - a.share),
      };
    });

    return stats;
  }, [cities]);

  const copyBibtex = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(CITATION_BIBTEX);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = CITATION_BIBTEX;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) {
          throw new Error("document.execCommand('copy') returned false");
        }
      }

      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy BibTeX:", err);
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 3000);
    }
  };

  const activeMeta = TYPE_META[activeType];
  const activeStats = typeStats[activeType] || { count: 0, regionShares: [] };
  const activeColor = typeColors[activeType];

  return (
    <div className="landing-root">
      {/* HERO */}
      <header className="landing-hero">
        <div className="landing-container landing-hero-inner">
          <div className="landing-brand-row" aria-label="Institutional affiliations">
            {AFFILIATIONS.map((institution) => (
              <a
                key={institution.name}
                className="landing-brand-link"
                href={institution.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={institution.name}
                title={institution.name}
              >
                <img
                  src={`${import.meta.env.BASE_URL}${institution.logo}`}
                  alt={institution.logoAlt}
                  className="landing-brand-logo"
                />
              </a>
            ))}
          </div>

          <h1 className="landing-title">A Global Typology of 11,000 Cities</h1>
          <p className="landing-subtitle">
            A data-driven classification of 11,000 cities that links urban structure to the global evidence base on climate solutions – enabling systematic comparison, gap detection, and evidence-based transfer learning.
          </p>

          <div className="landing-hero-actions">
            <Link to="/explore" className="landing-btn-primary">
              Explore the typology
            </Link>
            <a
              href={PAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn-secondary"
            >
              Read the paper
            </a>
          </div>
        </div>

        <a href="#city-types" className="scroll-hint">
          <span>Discover the four city types</span>
          <span className="scroll-chevron" aria-hidden="true">⌄</span>
        </a>
      </header>

      {/* INTRO */}
      <section className="landing-section">
        <div className="landing-container landing-intro-grid">
          <div>
            <h2 className="landing-h2">Why a global city typology?</h2>
            <p>
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
          <ul className="landing-facts">
            <li>
              <strong>11,000+</strong> cities from the Global Human Settlement Layer (GHSL).
            </li>
            <li>
              <strong>4</strong> data-driven city types derived from 11 urban indicators
              using Deep Embedded Clustering (DEC).
            </li>
            <li>
              <strong>100,000+</strong> climate-relevant case studies mapped to cities.
            </li>
            <li>
              A framework for evidence-based transfer learning between similar cities
              and types.
            </li>
          </ul>
        </div>
      </section>

      {/* TYPOLOGY EXPLAINER */}
      <section className="landing-section" id="city-types">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-h2">The four global city types</h2>
            <p>
              Select a city type to see where its cities are located and how they
              compare to all other cities across key indicators.
            </p>
          </div>

          <div className="type-tabs" role="tablist" aria-label="City types">
            {TYPE_ORDER.map((t) => {
              const selected = activeType === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`type-tab-${t.replace(" ", "-")}`}
                  aria-selected={selected}
                  aria-controls="type-panel"
                  className="type-tab"
                  style={{ "--type-color": typeColors[t] }}
                  onClick={() => setActiveType(t)}
                  onMouseEnter={() => setActiveType(t)}
                  onFocus={() => setActiveType(t)}
                >
                  <span className="type-tab-label">{t}</span>
                  <span className="type-tab-name">{TYPE_META[t].name}</span>
                  <span className="type-tab-count">
                    {typeStats[t].count ? `${typeStats[t].count.toLocaleString()} cities` : "\u00a0"}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="type-panel"
            role="tabpanel"
            aria-labelledby={`type-tab-${activeType.replace(" ", "-")}`}
            className="type-panel"
            style={{ "--type-color": activeColor }}
          >
            <div className="type-detail">
              <article className="type-detail-text">
                <span className="type-tab-label">{activeType}</span>
                <h3>{activeMeta?.name}</h3>
                <p className="type-detail-subtitle">{activeMeta?.subtitle}</p>

                {activeStats.count > 0 && (
                  <div className="type-chips">
                    <span className="type-chip type-chip-strong">
                      {activeStats.count.toLocaleString()} cities
                    </span>
                    {activeStats.regionShares.slice(0, 3).map((r) => (
                      <span key={r.region} className="type-chip">
                        {r.region} {r.share.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                )}

                <ul className="type-detail-list">
                  {activeMeta?.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </article>

              <div className="viz-panel viz-panel-map">
                <div className="viz-panel-header">
                  <span className="viz-panel-title">Global footprint</span>
                  <span className="viz-panel-caption">
                    {activeType} cities highlighted, sized by population
                  </span>
                </div>
                <div className="type-map">
                  {webglFailed ? (
                    <div className="map-fallback">
                      WebGL is disabled on this device.
                      <br />
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
              </div>
            </div>

            <div className="viz-panel">
              <div className="viz-panel-header">
                <span className="viz-panel-title">Distribution of city characteristics</span>
                <span className="viz-panel-caption">
                  All cities compared with {activeType} across key indicators
                </span>
              </div>
              <TypeMetricsPlot cities={cities} activeType={activeType} />
            </div>
          </div>
        </div>
      </section>

      {/* CITATION */}
      <section className="landing-section">
        <div className="landing-container landing-narrow">
          <h2 className="landing-h2">Citation</h2>
          <p className="citation-text">
            Montfort, S., Nachtigall, F., Repke, T., Binder, C. R., & Creutzig, F.{" "}
            <em>A global typology of cities supporting coordinated climate action</em>.
            Forthcoming in Nature Climate Change.
          </p>
          <div className="citation-bibtex-wrap">
            <button
              type="button"
              className={`citation-copy-icon citation-copy-${copyStatus}`}
              onClick={copyBibtex}
              aria-label="Copy BibTeX"
              title={
                copyStatus === "copied"
                  ? "Copied"
                  : copyStatus === "error"
                    ? "Copy failed"
                    : "Copy BibTeX"
              }
            >
              {copyStatus === "copied" ? <CheckIcon /> : <CopyIcon />}
            </button>
            <pre className="citation-bibtex">
              <code>{CITATION_BIBTEX}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section landing-cta">
        <div className="landing-container landing-narrow">
          <h2 className="landing-h2">Ready to explore individual cities?</h2>
          <p>
            Switch to the interactive explorer to inspect city characteristics,
            evidence on climate solutions, and similar cities in detail.
          </p>
          <Link to="/explore" className="landing-btn-primary">
            Go to Explorer
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default LandingPage;

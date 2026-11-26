// MOCK (funder prototype): evidence bars, lens peers and the evidence panel.
import React, { useState } from "react";
import { percentileColor } from "../utils/coloring";
import { LENS_DOMAIN, domainColors, lensPercentile, tagCounts, tagsForLens } from "../utils/mockLens";
import "../styles/mock.css";

const sectionStyle = {
  marginTop: "18px",
  borderTop: "1px solid #444",
  paddingTop: "12px",
};

export const MockBanner = () => (
  <div className="mock-banner">
    Illustrative prototype · domain-specific similarity and solution tags are mock data
  </div>
);

// Hover text placed above its anchor, so it never covers what is being hovered.
const Tip = ({ content, children, className = "", ...rest }) => {
  const [pos, setPos] = useState(null);
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 308)),
      bottom: window.innerHeight - r.top + 8,
    });
  };
  return (
    <span className={className} onMouseEnter={show} onMouseLeave={() => setPos(null)} {...rest}>
      {children}
      {pos && (
        <span className="mock-tip" style={pos}>
          {content}
        </span>
      )}
    </span>
  );
};

const Definition = ({ tag }) => (
  <>
    <strong>{tag.label}</strong>
    <br />
    {tag.definition}
    <br />
    <em>Example: &ldquo;{tag.example}&rdquo;</em>
  </>
);

// A compact solution tag with a count; its definition shows on hover.
const TagChip = ({ tagKey, evidence, count, onClick }) => {
  const tag = evidence.tags[tagKey];
  return (
    <Tip
      content={<Definition tag={tag} />}
      className="mock-chip mock-chip-clickable"
      style={{ borderColor: domainColors[tag.domain] }}
      onClick={onClick}
    >
      <span className="mock-chip-dot" style={{ backgroundColor: domainColors[tag.domain] }} />
      {tag.short}
      <span className="mock-chip-count">{count}</span>
    </Tip>
  );
};

// City panel: verified studies per solution as bars, coloured by domain.
// Under a lens only the solutions of its domain are shown, so peers and evidence match.
export const EvidenceSection = ({ city, evidence, openEvidence, lens, setLens }) => {
  const counts = tagCounts(evidence, city.id);
  const domain = LENS_DOMAIN[lens];
  const tags = tagsForLens(evidence, lens);
  const max = Math.max(1, ...tags.map((t) => counts[t]));
  const otherLens = Object.keys(LENS_DOMAIN).find((k) => k !== lens);
  return (
    <div className="mock-sec-solutions" style={sectionStyle}>
      <strong>{domain ? `${domain} solutions` : "Climate solutions"} with verified evidence</strong>
      <div className="mock-note">
        Click a bar to read the studies.
        {!domain && (
          <span className="mock-legend">
            {evidence.domains.map((d) => (
              <span key={d}>
                <span className="mock-chip-dot" style={{ backgroundColor: domainColors[d] }} /> {d}
              </span>
            ))}
          </span>
        )}
      </div>
      <div style={{ marginTop: "10px" }}>
        {tags.map((key) => {
          const tag = evidence.tags[key];
          const n = counts[key];
          return (
            <Tip
              key={key}
              content={<Definition tag={tag} />}
              className={`mock-bar-row${n ? " mock-bar-row-clickable" : " mock-bar-row-empty"}`}
              onClick={n ? () => openEvidence(city.id, key) : undefined}
            >
              <span className="mock-bar-label">{tag.label}</span>
              <span className="mock-bar-line">
                <span
                  className="mock-bar"
                  style={{ width: `${(n / max) * 82}%`, backgroundColor: domainColors[tag.domain] }}
                />
                <span className="mock-bar-count">
                  {n ? `${n} ${n === 1 ? "study" : "studies"} ›` : "no verified study"}
                </span>
              </span>
            </Tip>
          );
        })}
      </div>
      {domain ? (
        <div className="mock-note">
          Matches the selected solution domain.{" "}
          <span className="mock-link" onClick={() => setLens(otherLens)}>
            Switch to {LENS_DOMAIN[otherLens]}
          </span>
        </div>
      ) : (
        <div className="mock-note">
          Find cities similar for one domain:{" "}
          {Object.entries(LENS_DOMAIN).map(([key, d], i) => (
            <React.Fragment key={key}>
              {i > 0 && " · "}
              <span className="mock-link" onClick={() => setLens(key)}>
                {d}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const PercentileChip = ({ value }) => (
  <span className="mock-pct" style={{ backgroundColor: percentileColor(value) }}>
    {value == null ? "–" : `${Math.round(value)}%`}
  </span>
);

// City panel: peers under the selected lens, the nearest evidence cities and,
// for an evidence city, the cities that could learn from it.
export const LensPeers = ({ selected, byId, mock, lens, setSelectedSample, openEvidence }) => {
  const [compareId, setCompareId] = useState(null);
  const lensData = mock.lenses;
  const info = lensData.lenses[lens];
  const evidence = mock.evidence;
  const evidenceIds = Object.values(lensData.evidence_cities);
  const nCities = lensData.ids.length;

  // Cities to learn from: similar cities that have studies in the domain of the lens
  const domain = LENS_DOMAIN[lens];
  const peers = (selected.neighbors || [])
    .map((id, i) => ({ city: byId.get(id), dist: selected.neighbor_distances?.[i] }))
    .filter((p) => p.city && p.city.solution_domain_counts?.[domain] > 0)
    .slice(0, 10);

  const nearestEvidence = evidenceIds
    .filter((id) => id !== selected.id && byId.get(id))
    .map((id) => ({ city: byId.get(id), rank: info.evidence[id].rank[selected._i] }))
    .sort((a, b) => a.rank - b.rank);

  const learners = evidenceIds.includes(selected.id)
    ? info.learners[selected.id]
        .slice(0, 12)
        .map(([id, dist]) => ({ city: byId.get(id), dist }))
        .filter((p) => p.city)
    : null;

  const chipsFor = (city) => {
    if (!evidence?.cities?.[city.id]) return null;
    const counts = tagCounts(evidence, city.id);
    return (
      <div className="mock-chip-list mock-chip-list-indent">
        {tagsForLens(evidence, lens)
          .filter((t) => counts[t] > 0)
          .map((t) => (
            <TagChip
              key={t}
              tagKey={t}
              evidence={evidence}
              count={counts[t]}
              onClick={() => openEvidence(city.id, t)}
            />
          ))}
      </div>
    );
  };

  return (
    <>
      {evidence && nearestEvidence.length > 0 && (
        <div className="mock-sec-nearest" style={sectionStyle}>
          <strong>Nearest cities with verified {LENS_DOMAIN[lens].toLowerCase()} evidence</strong>
          <div className="mock-note">
            How similar this city is, for this solution domain, to the cities whose studies have been checked.
          </div>
          <div className="mock-list">
            {nearestEvidence.map(({ city, rank }) => (
              <div key={city.id} className="mock-row">
                <div className="mock-row-main">
                  <span className="mock-link" onClick={() => setSelectedSample(city)}>
                    {city.name}, {city.country}
                  </span>
                  <span className="mock-rank">
                    #{rank.toLocaleString()} most similar of {nCities.toLocaleString()}
                  </span>
                </div>
                {chipsFor(city)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mock-sec-learn" style={sectionStyle}>
        <strong>{selected.name} could potentially learn from</strong>
        <div className="mock-note">
          The most similar cities in terms of {info.label.toLowerCase()} that have {domain.toLowerCase()}{" "}
          studies (counts are not yet verified). Lower distance means more similar on:{" "}
          {info.variables.map((v) => v.label).join(", ")}.
        </div>
        {peers.length === 0 && (
          <div className="mock-note" style={{ fontStyle: "italic" }}>
            None of the {selected.neighbors?.length} most similar cities has {domain.toLowerCase()} studies.
          </div>
        )}
        <div className="mock-list">
          {peers.map(({ city, dist }) => (
            <div key={city.id} className="mock-row">
              <div className="mock-row-main">
                <span className="mock-dist">{dist?.toFixed(2)}</span>
                <span className="mock-link" onClick={() => setSelectedSample(city)}>
                  {city.name}, {city.country}
                </span>
                <span className="mock-count">
                  {city.solution_domain_counts[domain]}{" "}
                  {city.solution_domain_counts[domain] === 1 ? "study" : "studies"}
                </span>
                <span
                  className="mock-compare"
                  onClick={() => setCompareId(compareId === city.id ? null : city.id)}
                >
                  {compareId === city.id ? "hide" : "why similar?"}
                </span>
              </div>
              {compareId === city.id && (
                <div className="mock-compare-table">
                  <div className="mock-compare-head">
                    <span>Percentile among all cities</span>
                    <span>{selected.name}</span>
                    <span>{city.name}</span>
                  </div>
                  {info.variables.map((v) => (
                    <div key={v.key} className="mock-compare-row">
                      <span>{v.label}</span>
                      <PercentileChip value={lensPercentile(selected, v.key, lensData)} />
                      <PercentileChip value={lensPercentile(city, v.key, lensData)} />
                    </div>
                  ))}
                </div>
              )}
              {chipsFor(city)}
            </div>
          ))}
        </div>
      </div>

      {learners && (
        <div className="mock-sec-learners" style={sectionStyle}>
          <strong>Cities that could potentially learn from {selected.name}</strong>
          <div className="mock-note">
            The cities most similar to {selected.name} for this solution domain, where its evidence is most likely to transfer.
          </div>
          <div className="mock-list">
            {learners.map(({ city, dist }) => (
              <div key={city.id} className="mock-row-main">
                <span className="mock-dist">{dist.toFixed(2)}</span>
                <span className="mock-link" onClick={() => setSelectedSample(city)}>
                  {city.name}, {city.country}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// One study: title (opens the abstract), authors, year, link, and its solution tags.
// Hovering a tag marks the passage of the abstract that the tag rests on.
const Study = ({ study, evidence, isOpen, onToggle }) => {
  const [hovered, setHovered] = useState(null);
  const spans = [...study.tags].sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  spans.forEach((t) => {
    parts.push(study.abstract.slice(at, t.start));
    parts.push(
      <mark key={t.tag} className={hovered === t.tag ? "mock-mark-strong" : ""}>
        {study.abstract.slice(t.start, t.end)}
      </mark>
    );
    at = t.end;
  });
  parts.push(study.abstract.slice(at));

  return (
    <div className="mock-study">
      <div className="mock-study-title" onClick={onToggle}>
        <span className="mock-caret">{isOpen ? "▾" : "▸"}</span>
        {study.title}
      </div>
      <div className="mock-study-meta">
        {study.authors}
        {study.year ? ` · ${study.year}` : ""} ·{" "}
        <a href={study.doi || study.openalex} target="_blank" rel="noopener noreferrer">
          Open study ↗
        </a>
      </div>
      {isOpen && (
        <>
          <div className="mock-chip-list">
            {study.tags.map((t) => {
              const tag = evidence.tags[t.tag];
              return (
                <span
                  key={t.tag}
                  className={`mock-chip mock-chip-hover${hovered === t.tag ? " mock-chip-active" : ""}`}
                  style={{ borderColor: domainColors[tag.domain] }}
                  onMouseEnter={() => setHovered(t.tag)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="mock-chip-dot" style={{ backgroundColor: domainColors[tag.domain] }} />
                  {tag.short}
                </span>
              );
            })}
          </div>
          <p className="mock-abstract">{parts}</p>
          {study.excerpt && (
            <div className="mock-note mock-excerpt-note">
              Excerpt: only the passage behind the tag is shown. The full abstract is available from the
              publisher via &ldquo;Open study&rdquo;.
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Takes the place of the city panel: the studies behind one solution in one city.
export const EvidencePanel = ({ drawer, evidence, backLabel, onClose }) => {
  const city = evidence.cities[drawer.cityId];
  const tag = evidence.tags[drawer.tag];
  // Studies with a full abstract first, then those shown as an excerpt
  const studies = city
    ? city.studies
        .filter((s) => s.tags.some((t) => t.tag === drawer.tag))
        .sort((a, b) => Number(a.excerpt) - Number(b.excerpt))
    : [];
  const [openId, setOpenId] = useState(studies[0]?.id ?? null);
  if (!city) return null;

  return (
    <div className="info-panel mock-evidence-panel">
      <div className="mock-evidence-header">
        <span className="mock-back" onClick={onClose}>
          ← {backLabel}
        </span>
        <h3>
          {tag.label}{" "}
          <Tip content={<Definition tag={tag} />} className="mock-info">
            ⓘ
          </Tip>
        </h3>
        <div className="mock-note">
          {studies.length} verified {studies.length === 1 ? "study" : "studies"} in {city.name} · hover a tag to
          highlight the passage it rests on
        </div>
      </div>
      <div className="info-panel-body">
        {studies.map((study) => (
          <Study
            key={study.id}
            study={study}
            evidence={evidence}
            isOpen={openId === study.id}
            onToggle={() => setOpenId(openId === study.id ? null : study.id)}
          />
        ))}
      </div>
    </div>
  );
};

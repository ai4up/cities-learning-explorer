// MOCK (funder prototype): a short, skippable tour of the explorer.
import React, { useEffect, useState } from "react";
import { markTutorialSeen } from "../utils/mockLens";
import "../styles/mock.css";

// `target` is marked while the step is shown. Steps with `panel` are about a section of
// the city panel: an example city is opened first and the section is scrolled into view.
// Steps with `evidence` open the studies of an example solution.
const STEPS = [
  {
    title: "Find cities to learn from",
    text: "This explorer groups about 11,000 cities by their characteristics and links them to peer-reviewed climate studies. Search for a city here, or click one on the map.",
    target: ".top-search-bar",
  },
  {
    title: "Choose a solution domain",
    text: "Cities that are similar for mobility are not necessarily similar for energy. Pick a domain, and similar cities are found on the indicators that matter for it. The indicators used are listed right below the selector.",
    target: ".mock-domain-select",
  },
  {
    title: "Filter and colour the map",
    text: "Narrow the map by region, city type, population or number of studies, and choose what the colours show. The legend is at the bottom left.",
    target: ".controls",
  },
  {
    title: "City panel: type",
    text: "Selecting a city opens this panel. It starts with the city's type, region and number of studies. The bars show how consistently the city is assigned to each of the four types: one tall bar is a clear case, several bars a city between types.",
    target: ".mock-sec-type",
    panel: true,
  },
  {
    title: "City panel: characteristics",
    text: "The indicators that describe the city. The coloured chip next to each value is its percentile: the share of all cities with a lower value. European cities have additional indicators below.",
    target: ".mock-sec-characteristics",
    panel: true,
  },
  {
    title: "City panel: solutions with verified evidence",
    text: "Each bar is a climate solution with studies from this city that were checked against the solution's definition. The bars are colour-coded by solution domain: blue for mobility, orange for energy. With a solution domain selected, only that domain's solutions are shown. Hover a bar to read the definition. The bars are clickable: click one to open the studies behind it.",
    target: ".mock-sec-solutions",
    panel: true,
  },
  {
    title: "The studies behind a solution",
    text: "Clicking a bar opens this list in place of the city panel. Each study shows its title, authors and year. Click a title to open or close its abstract, and \"Open study\" to go to the publication. The arrow at the top left takes you back to the city.",
    target: ".mock-evidence-panel",
    evidence: true,
  },
  {
    title: "Why a study carries a solution tag",
    text: "Every open study shows its solution tag above the abstract. The passage that justifies the tag is underlined in the abstract. Hover the tag and that passage lights up in yellow, so you can check the classification yourself.",
    target: ".mock-evidence-panel .mock-chip-hover",
    evidence: true,
  },
  {
    title: "City panel: nearest cities with evidence",
    text: "How close this city is, for the chosen solution domain, to the cities whose studies have been verified, and which solutions those cities have evidence for. Click a solution to read their studies.",
    target: ".mock-sec-nearest",
    panel: true,
  },
  {
    title: "City panel: who can learn from whom",
    text: "First, the most similar cities that have studies in this domain: places this city could learn from. \"Why similar?\" compares the two cities indicator by indicator. Below that, the cities that could learn from this one.",
    target: ".mock-sec-learn",
    panel: true,
  },
];

const Tutorial = ({ onClose, showExampleCity, showExampleEvidence, panelState }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    markTutorialSeen();
    onClose();
  };

  const go = (next) => {
    if (STEPS[next].evidence) showExampleEvidence();
    else if (STEPS[next].panel) showExampleCity();
    setStep(next);
  };

  // Mark the part of the screen the step talks about
  useEffect(() => {
    const el = current.target ? document.querySelector(current.target) : null;
    if (!el) return undefined;
    const mark = current.panel ? "mock-tour-section" : "mock-tour-target";
    el.classList.add(mark);
    if (current.panel) el.scrollIntoView({ block: "start", behavior: "smooth" });
    return () => el.classList.remove(mark);
  }, [current, panelState]);

  return (
    <div className="mock-tour" role="dialog" aria-label="Tutorial">
      <div className="mock-tour-top">
        <span className="mock-tour-progress">
          {step + 1} / {STEPS.length}
        </span>
        <span className="mock-tour-skip" onClick={finish}>
          Skip tutorial
        </span>
      </div>
      <h3>{current.title}</h3>
      <p>{current.text}</p>
      <div className="mock-tour-actions">
        {step > 0 && (
          <button type="button" className="mock-tour-btn" onClick={() => go(step - 1)}>
            Back
          </button>
        )}
        <button
          type="button"
          className="mock-tour-btn mock-tour-btn-primary"
          onClick={() => (last ? finish() : go(step + 1))}
        >
          {last ? "Start exploring" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default Tutorial;

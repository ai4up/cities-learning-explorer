import React, { useEffect, useState } from "react";

const ISSUE_URL =
  "https://github.com/ai4up/cities-learning-explorer/issues/new";
const EMAIL = ["nachtigall", "tu-berlin.de"].join("@");
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent("City Explorer feedback")}`;

const AUTO_HIDE_MS = 6000;

const FeedbackNote = () => {
  const [hidden, setHidden] = useState(false);

  // On small screens space is scarce, so the note fades out after a few seconds.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 768px)").matches) return undefined;
    const timer = window.setTimeout(() => setHidden(true), AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <aside
      className={`feedback-note${hidden ? " feedback-note-hidden" : ""}`}
      aria-label="Feedback"
      aria-hidden={hidden}
    >
      <span className="feedback-note-text">
        Spotted a bug or have feedback?
      </span>
      <span className="feedback-note-text-short">Feedback:</span>
      <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
        Open an issue
      </a>
      <span aria-hidden="true">·</span>
      <a href={MAILTO}>Email us</a>
    </aside>
  );
};

export default FeedbackNote;

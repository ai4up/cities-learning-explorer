import React from "react";

const ISSUE_URL = "https://github.com/ai4up/cities-learning-explorer/issues/new";
const EMAIL = ["nachtigall", "tu-berlin.de"].join("@");
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent("City Explorer feedback")}`;

const FeedbackNote = () => (
  <aside className="feedback-note" aria-label="Feedback">
    <span className="feedback-note-text">Spotted a bug or have feedback?</span>
    <span className="feedback-note-text-short">Feedback:</span>
    <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
      Open an issue
    </a>
    <span aria-hidden="true">·</span>
    <a href={MAILTO}>Email us</a>
  </aside>
);

export default FeedbackNote;

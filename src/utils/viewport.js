// Phones (portrait and landscape) and short windows: collapsible filters, compact top bar.
// Keep in sync with the compact media queries in styles/explorer.css.
export const COMPACT_QUERY = "(max-width: 768px), (max-height: 540px)";

export const isCompactViewport = () =>
  typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches;

const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim();
const plausibleScriptSrc = import.meta.env.VITE_PLAUSIBLE_SCRIPT_SRC?.trim();

export function initializeAnalytics() {
  if (!import.meta.env.PROD) return;
  if (!plausibleDomain || !plausibleScriptSrc) return;
  if (document.querySelector('script[data-analytics="plausible"]')) return;

  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-domain", plausibleDomain);
  script.setAttribute("data-analytics", "plausible");
  script.src = plausibleScriptSrc;
  document.head.appendChild(script);
}

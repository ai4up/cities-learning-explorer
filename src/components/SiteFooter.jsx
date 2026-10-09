import React from "react";
import { Link } from "react-router-dom";
import "../styles/site-footer.css";

const SiteFooter = () => (
  <footer className="site-footer">
    <div className="site-footer-inner">
      <p className="site-footer-ack">
        We gratefully acknowledge support from the{" "}
        <strong>Holcim Foundation for Sustainable Construction</strong> through
        the <strong>GloType</strong> project.
      </p>
      <nav className="site-footer-links" aria-label="Footer">
        <Link to="/explore">Explorer</Link>
        <a
          href="https://doi.org/10.21203/rs.3.rs-8363797/v1"
          target="_blank"
          rel="noopener noreferrer"
        >
          Paper
        </a>
        <Link to="/impressum">Impressum</Link>
      </nav>
    </div>
  </footer>
);

export default SiteFooter;

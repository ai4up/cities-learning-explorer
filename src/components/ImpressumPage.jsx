import React from "react";
import { Link } from "react-router-dom";
import SiteFooter from "./SiteFooter";
import "../styles/impressum.css";

const PIK_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d2435.4479936464554!2d13.0635074!3d52.3804286!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47a8f5966fb9462f%3A0xb7e9d470cb3893f8!2sPotsdam%20Institute%20for%20Climate%20Impact%20Research!5e0!3m2!1sen!2sde!4v1791541318747!5m2!1sen!2sde";

const ImpressumPage = () => (
  <div className="impressum-root">
    <main className="impressum-main">
      <Link to="/" className="impressum-back">
        ← Back to overview
      </Link>
      <h1>Impressum</h1>
      <p className="impressum-legal-basis">
        Angaben gemäß § 18 Abs. 1 MStV und, soweit anwendbar, § 5 DDG
      </p>

      <div className="impressum-grid">
        <div className="impressum-details">
          <section>
            <h2>Responsible</h2>
            <address>
              Florian Nachtigall
              <br />
              c/o Potsdam-Institut für Klimafolgenforschung (PIK) e.V.
              <br />
              Telegrafenberg A 31
              <br />
              14473 Potsdam
              <br />
              Germany
            </address>
          </section>
          <section>
            <h2>Contact</h2>
            <p>Email: nachtigall(at)tu-berlin.de</p>
          </section>
        </div>

        <div className="impressum-map">
          <iframe
            title="Map showing the Potsdam Institute for Climate Impact Research"
            src={PIK_MAP_EMBED}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
);

export default ImpressumPage;

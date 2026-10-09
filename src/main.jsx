import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Explorer from "./components/Explorer.jsx";
import LandingPage from "./components/LandingPage.jsx";
import ImpressumPage from "./components/ImpressumPage.jsx";
import { initializeAnalytics } from "./utils/analytics.js";
import "./index.css";

initializeAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<Explorer />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

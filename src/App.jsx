import React, { useEffect, useMemo, useState } from "react";
import LandingPage from "./components/LandingPage";
import Explorer from "./components/Explorer";


const App = () => {
  const path = window.location.pathname || "/";

  if (path === "/" || path === "") {
    return <LandingPage />;
  }

  // e.g. /explore or anything else
  return <Explorer />;
};

export default App;
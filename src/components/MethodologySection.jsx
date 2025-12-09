import React from "react";

const MethodologySection = ({ isOpen, onToggle, children }) => (
  <>
    <span className="methodology-toggle" onClick={onToggle}>ⓘ</span>
    {isOpen && (
      <div className="methodology-box">
        {children}
      </div>
    )}
  </>
);

export default MethodologySection;

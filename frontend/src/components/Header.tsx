"use client";

import React, { useEffect, useState } from "react";

interface HeaderProps {
  onOpenDisclaimer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDisclaimer }) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Theme initialization
    const savedTheme = (typeof window !== "undefined" && localStorage.getItem("jerifin-theme")) as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("jerifin-theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  };

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand-block">
          <span className="brand-wordmark">Jerifin</span>
          <span className="brand-subtitle">Institutional Capital Allocation & Treasury Risk Platform</span>
        </div>

        <div className="status-cluster">
          <div className="demo-indicator" title="Deterministic synthetic market data for demonstration">
            <span className="demo-dot" />
            <span>DEMO / SYNTHETIC DATA • INR</span>
          </div>

          {/* Institutional Light / Dark Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} institutional theme`}
            aria-label="Toggle theme"
          >
            <span>{theme === "light" ? "🌙 Dark" : "☀️ Light"}</span>
          </button>

          <button
            onClick={onOpenDisclaimer}
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "4px 10px" }}
            title="View methodology, disclaimers, and mathematical assumptions"
          >
            Methodology & Disclaimer
          </button>
        </div>
      </div>
    </header>
  );
};

"use client";

import React, { useState } from "react";
import { formatCurrencyINR } from "../lib/formatters";

interface CapitalSelectorProps {
  capital: number;
  onCapitalChange: (newCapital: number) => void;
}

const PRESETS = [
  { label: "₹10 Cr", value: 100_000_000 },
  { label: "₹50 Cr", value: 500_000_000 },
  { label: "₹100 Cr (Demo)", value: 1_000_000_000 },
  { label: "₹250 Cr", value: 2_500_000_000 },
  { label: "₹500 Cr", value: 5_000_000_000 },
  { label: "₹1,000 Cr", value: 10_000_000_000 },
];

export const CapitalSelector: React.FC<CapitalSelectorProps> = ({
  capital,
  onCapitalChange,
}) => {
  const [customVal, setCustomVal] = useState<string>(capital.toString());
  const [isEditing, setIsEditing] = useState(false);

  const handlePresetClick = (val: number) => {
    setCustomVal(val.toString());
    onCapitalChange(val);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customVal.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      onCapitalChange(parsed);
      setIsEditing(false);
    }
  };

  return (
    <div className="capital-bar">
      <div className="capital-left">
        <div>
          <span className="section-tag" style={{ display: "block", marginBottom: "2px" }}>
            Portfolio Capital Pool
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {formatCurrencyINR(capital, true)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              ({formatCurrencyINR(capital, false)})
            </span>
          </div>
        </div>

        <div className="capital-presets">
          {PRESETS.map((p) => {
            const isActive = Math.abs(capital - p.value) < 1.0;
            return (
              <button
                key={p.label}
                type="button"
                className={`preset-btn ${isActive ? "active" : ""}`}
                onClick={() => handlePresetClick(p.value)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleCustomSubmit} className="capital-input-wrap">
        <label
          htmlFor="custom-capital"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
          }}
        >
          Custom Amount:
        </label>
        <input
          id="custom-capital"
          type="text"
          className="capital-input"
          value={customVal}
          onChange={(e) => {
            setCustomVal(e.target.value);
            setIsEditing(true);
          }}
          onBlur={() => {
            const parsed = parseFloat(customVal.replace(/[^0-9.]/g, ""));
            if (!isNaN(parsed) && parsed > 0) {
              onCapitalChange(parsed);
            }
          }}
          placeholder="e.g. 1000000000"
        />
        {isEditing && (
          <button type="submit" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "12px" }}>
            Apply
          </button>
        )}
      </form>
    </div>
  );
};

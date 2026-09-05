"use client";

import React from "react";
import {
  formatCurrencyINR,
  formatDuration,
  formatPercent,
} from "../lib/formatters";
import { AssetItem } from "../lib/types";

interface AllocationTableProps {
  assets: AssetItem[];
  weights: Record<string, number>;
  capital: number;
  monetaryAllocations?: Record<string, number>;
  stressedWeights?: Record<string, number>;
  onWeightChange: (symbol: string, newWeight: number) => void;
  onNormalizeWeights: () => void;
  isStressed?: boolean;
}

export const AllocationTable: React.FC<AllocationTableProps> = ({
  assets,
  weights,
  capital,
  monetaryAllocations = {},
  stressedWeights,
  onWeightChange,
  onNormalizeWeights,
  isStressed = false,
}) => {
  const sumWeights = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const isWeightValid = Math.abs(sumWeights - 1.0) < 0.001;

  // Calculate liquidity tier distribution
  let t1Weight = 0;
  let t2Weight = 0;
  let t3Weight = 0;

  assets.forEach((a) => {
    const w = weights[a.symbol] || 0;
    if (a.liquidity_tier === 1) t1Weight += w;
    else if (a.liquidity_tier === 2) t2Weight += w;
    else t3Weight += w;
  });

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      <div className="section-header">
        <div>
          <div className="section-tag">Allocation Matrix</div>
          <h2 className="section-header-title">
            Current Treasury Holdings & Asset Universe
          </h2>
          <div className="section-header-desc">
            Granular instrument distribution across liquidity tiers and duration horizons.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isWeightValid && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--status-breach-fg)",
                }}
              >
                Sum: {formatPercent(sumWeights, false, 1)} (≠ 100%)
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "3px 8px" }}
                onClick={onNormalizeWeights}
              >
                Normalize to 100%
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Liquidity Tier Horizon Ladder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "10px 16px",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-hairline)",
          borderBottom: "none",
          fontSize: "12px",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>
          Horizon Breakdown:
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", backgroundColor: "#10B981", borderRadius: "1px" }} />
            <span>Tier 1 (T+0 Immediate Cash):</span>
            <strong className="tabular-nums">{formatPercent(t1Weight, false, 1)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", backgroundColor: "#3B82F6", borderRadius: "1px" }} />
            <span>Tier 2 (T+30 Operating T-Bills & CP):</span>
            <strong className="tabular-nums">{formatPercent(t2Weight, false, 1)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", backgroundColor: "#F59E0B", borderRadius: "1px" }} />
            <span>Tier 3 (Strategic Yield & Credit):</span>
            <strong className="tabular-nums">{formatPercent(t3Weight, false, 1)}</strong>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="financial-table">
          <thead>
            <tr>
              <th>Security / Instrument</th>
              <th>Asset Class</th>
              <th>Tier</th>
              <th className="num">Duration</th>
              <th className="num">Exp Return</th>
              <th className="num" style={{ minWidth: "160px" }}>
                Target Weight
              </th>
              <th className="num">Monetary Allocation</th>
              {isStressed && stressedWeights && (
                <th className="num" style={{ color: "var(--status-breach-fg)" }}>
                  Stressed Drift Weight
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const currentW = weights[a.symbol] || 0.0;
              const monVal =
                monetaryAllocations[a.symbol] ?? currentW * capital;
              const stressedW = stressedWeights ? stressedWeights[a.symbol] : undefined;

              return (
                <tr key={a.symbol}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span className="symbol-ticker">{a.symbol}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {a.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                    {a.asset_class}
                  </td>
                  <td>
                    <span className="tier-pill">
                      Tier {a.liquidity_tier}
                    </span>
                  </td>
                  <td className="num tabular-nums text-muted">
                    {formatDuration(a.duration)}
                  </td>
                  <td className="num tabular-nums text-muted">
                    {a.expected_return ? formatPercent(a.expected_return) : "—"}
                  </td>
                  <td className="num">
                    <div className="weight-cell-wrap">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(currentW * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          onWeightChange(a.symbol, val);
                        }}
                        className="range-slider"
                        style={{ width: "80px" }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={(currentW * 100).toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          if (!isNaN(val)) onWeightChange(a.symbol, Math.max(0, Math.min(1, val)));
                        }}
                        className="weight-input"
                      />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                        %
                      </span>
                    </div>
                  </td>
                  <td className="num tabular-nums text-strong">
                    {formatCurrencyINR(monVal, true)}
                  </td>
                  {isStressed && stressedWeights && (
                    <td
                      className="num tabular-nums"
                      style={{
                        fontWeight: 600,
                        color:
                          stressedW !== undefined && stressedW > currentW + 0.02
                            ? "var(--status-breach-fg)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {stressedW !== undefined ? formatPercent(stressedW, false, 2) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "var(--surface-alt)", fontWeight: 700 }}>
              <td colSpan={5} style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase" }}>
                Total Allocated Portfolio
              </td>
              <td
                className="num tabular-nums"
                style={{
                  color: isWeightValid ? "var(--text-primary)" : "var(--status-breach-fg)",
                }}
              >
                {formatPercent(sumWeights, false, 2)}
              </td>
              <td className="num tabular-nums text-strong">
                {formatCurrencyINR(capital, true)}
              </td>
              {isStressed && stressedWeights && (
                <td className="num tabular-nums">
                  100.00%
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

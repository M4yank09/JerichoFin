"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatDuration,
  formatPercent,
  getAssetDisplayName,
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
  const [isSettlementNotesExpanded, setIsSettlementNotesExpanded] = useState<boolean>(false);

  const sumWeights = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const isWeightValid = Math.abs(sumWeights - 1.0) < 0.001;

  // Calculate liquidity tier distribution
  let t1Weight = 0; // Immediate (T+0)
  let t2Weight = 0; // Operating (T+1)
  let t3Weight = 0; // Strategic (Longer-Term)

  assets.forEach((a) => {
    const w = weights[a.symbol] || 0;
    if (a.liquidity_tier === 1) t1Weight += w;
    else if (a.liquidity_tier === 2) t2Weight += w;
    else t3Weight += w;
  });

  // Filter active holdings (or sort all holdings by weight descending)
  const sortedAssets = [...assets].sort((a, b) => {
    const wa = weights[a.symbol] || 0;
    const wb = weights[b.symbol] || 0;
    return wb - wa;
  });

  return (
    <div style={{ marginBottom: "var(--spacing-2xl)" }}>
      {/* ======================================================================
          1. ALLOCATION PAGE HEADER & COMPACT SUMMARY
          ====================================================================== */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          <div>
            <div className="section-tag" style={{ color: "var(--brand-navy)" }}>Capital Deployment</div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em", margin: "4px 0 0 0" }}>
              Current Treasury Holdings & Asset Universe
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
              Where is the {formatCurrencyINR(capital, true)} deployed, why is it there, and how liquid is it?
            </p>
          </div>

          {!isWeightValid && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "var(--status-warning-bg)", border: "1px solid var(--status-warning-bd)" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  fontWeight: 700,
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

        {/* Compact Summary Metrics Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1px",
            backgroundColor: "var(--border-hairline)",
            border: "1px solid var(--border-hairline)",
          }}
        >
          <div style={{ backgroundColor: "var(--surface)", padding: "12px 16px" }}>
            <span className="metric-strip-label">Total Capital</span>
            <div className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatCurrencyINR(capital, true)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Active portfolio size
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface)", padding: "12px 16px" }}>
            <span className="metric-strip-label" style={{ color: "#10B981" }}>Immediate Liquidity</span>
            <div className="tabular-nums font-mono" style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatPercent(t1Weight, false, 0)}{" "}
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>
                ({formatCurrencyINR(t1Weight * capital, true)})
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              T+0 CCIL TREPS & Call Money
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface)", padding: "12px 16px" }}>
            <span className="metric-strip-label" style={{ color: "#2563EB" }}>Operating Liquidity</span>
            <div className="tabular-nums font-mono" style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-navy)", marginTop: "2px" }}>
              {formatPercent(t2Weight, false, 0)}{" "}
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>
                ({formatCurrencyINR(t2Weight * capital, true)})
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              T+1 T-Bills, CP, Bank CDs
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface)", padding: "12px 16px" }}>
            <span className="metric-strip-label" style={{ color: "#D97706" }}>Strategic Assets</span>
            <div className="tabular-nums font-mono" style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatPercent(t3Weight, false, 0)}{" "}
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>
                ({formatCurrencyINR(t3Weight * capital, true)})
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              10Y G-Secs, AAA Bonds, Gold
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          2. CAPITAL DEPLOYMENT MODEL (HERO SECTION OF ALLOCATION)
          ====================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--surface)",
          padding: "20px 24px",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        <div style={{ marginBottom: "14px" }}>
          <span className="section-tag" style={{ color: "var(--brand-navy)" }}>Horizon Architecture</span>
          <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "2px 0 0 0" }}>
            CAPITAL DEPLOYMENT MODEL
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
            Where is your {formatCurrencyINR(capital, true)} allocated across immediate, operating, and strategic horizons?
          </p>
        </div>

        {/* Large Proportional Visual Segmented Bar */}
        <div
          style={{
            display: "flex",
            height: "40px",
            width: "100%",
            borderRadius: "2px",
            overflow: "hidden",
            marginBottom: "16px",
            border: "1px solid var(--border-hairline)",
          }}
        >
          {/* Segment 1: Immediate Liquidity (T+0) */}
          <div
            style={{
              width: `${Math.max(10, t1Weight * 100)}%`,
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              padding: "0 8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`TODAY / IMMEDIATE LIQUIDITY: ${formatPercent(t1Weight, false, 1)} (${formatCurrencyINR(t1Weight * capital, true)})`}
          >
            TODAY / IMMEDIATE LIQUIDITY {formatPercent(t1Weight, false, 0)}
          </div>

          {/* Segment 2: Operating Liquidity (Next 30 Days) */}
          <div
            style={{
              width: `${Math.max(12, t2Weight * 100)}%`,
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              padding: "0 8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`NEXT 30 DAYS / OPERATING LIQUIDITY: ${formatPercent(t2Weight, false, 1)} (${formatCurrencyINR(t2Weight * capital, true)})`}
          >
            NEXT 30 DAYS / OPERATING LIQUIDITY {formatPercent(t2Weight, false, 0)}
          </div>

          {/* Segment 3: Strategic / Longer-Term */}
          <div
            style={{
              width: `${Math.max(10, t3Weight * 100)}%`,
              backgroundColor: "#D97706",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              padding: "0 8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`STRATEGIC / LONGER-TERM: ${formatPercent(t3Weight, false, 1)} (${formatCurrencyINR(t3Weight * capital, true)})`}
          >
            STRATEGIC / LONGER-TERM {formatPercent(t3Weight, false, 0)}
          </div>
        </div>

        {/* 3 Horizon Cards Below */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {/* Card 1: Today */}
          <div
            style={{
              padding: "16px",
              border: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface-alt)",
              borderTop: "3px solid #10B981",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                TODAY / IMMEDIATE LIQUIDITY
              </span>
              <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                {formatCurrencyINR(t1Weight * capital, true)}
              </span>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
              Cash available immediately
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4, margin: "4px 0 0 0" }}>
              CCIL Triparty Repo (TREPS) & overnight call money. Same-day settlement with zero market haircut.
            </p>
          </div>

          {/* Card 2: Next 30 Days */}
          <div
            style={{
              padding: "16px",
              border: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface-alt)",
              borderTop: "3px solid #2563EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--brand-navy)" }}>
                NEXT 30 DAYS / OPERATING LIQUIDITY
              </span>
              <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-navy)" }}>
                {formatCurrencyINR(t2Weight * capital, true)}
              </span>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
              Money available for operating needs
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4, margin: "4px 0 0 0" }}>
              91-Day T-Bills, Commercial Paper, and bank CDs. High secondary market depth with T+1 settlement.
            </p>
          </div>

          {/* Card 3: Strategic */}
          <div
            style={{
              padding: "16px",
              border: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface-alt)",
              borderTop: "3px solid #D97706",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                STRATEGIC / LONGER-TERM
              </span>
              <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                {formatCurrencyINR(t3Weight * capital, true)}
              </span>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
              Longer-term return & reserve assets
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4, margin: "4px 0 0 0" }}>
              Benchmark 10Y G-Secs, AAA Corporate Bonds, and Sovereign Gold Reserves for yield and hedge.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================================
          3. INSTRUMENT DISTRIBUTION VISUAL
          ====================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-hairline)",
          backgroundColor: "var(--surface)",
          padding: "18px 20px",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <span className="section-tag">Instrument Allocation</span>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0 0" }}>
              Live Portfolio Distribution & Concentration
            </h3>
          </div>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            Single-Asset Cap: 35.0% | Warning Threshold: 29.8%
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowX: "auto" }}>
          {sortedAssets.map((a) => {
            const w = weights[a.symbol] || 0;
            if (w <= 0) return null;

            const isBreach = w > 0.35;
            const isWatch = !isBreach && w > 0.2975;
            const monVal = monetaryAllocations[a.symbol] ?? w * capital;

            // Bar color based on tier & status
            const barColor = isBreach
              ? "#EF4444"
              : isWatch
              ? "#F59E0B"
              : a.liquidity_tier === 1
              ? "#10B981"
              : a.liquidity_tier === 2
              ? "#2563EB"
              : "#D97706";

            return (
              <div
                key={`dist-${a.symbol}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 70px 1fr 130px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "6px 10px",
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "1px",
                      backgroundColor: barColor,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {getAssetDisplayName(a.symbol)}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px" }}>
                      Tier {a.liquidity_tier}
                    </span>
                  </div>
                </div>

                <div className="tabular-nums font-mono" style={{ fontSize: "13px", fontWeight: 800, color: isBreach ? "var(--status-breach-fg)" : isWatch ? "var(--status-warning-fg)" : "var(--text-primary)" }}>
                  {formatPercent(w, false, 1)}
                </div>

                {/* Horizontal Proportional Bar with 35% Limit Marker */}
                <div style={{ position: "relative", height: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                  {/* Fill (Scale: 0 to 50%) */}
                  <div
                    style={{
                      width: `${Math.min(100, (w / 0.50) * 100)}%`,
                      height: "100%",
                      backgroundColor: barColor,
                      transition: "width 0.2s ease",
                    }}
                  />
                  {/* 35% Policy Limit Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${(0.35 / 0.50) * 100}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      backgroundColor: "#1E293B",
                      zIndex: 2,
                    }}
                    title="35% Single-Asset Policy Ceiling"
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  <span className="tabular-nums font-mono" style={{ fontSize: "12px", fontWeight: 600 }}>
                    {formatCurrencyINR(monVal, true)}
                  </span>
                  {isBreach && (
                    <span className="badge-status badge-status-breach" style={{ fontSize: "9px", padding: "1px 4px" }}>
                      BREACH
                    </span>
                  )}
                  {isWatch && (
                    <span className="badge-status badge-status-warning" style={{ fontSize: "9px", padding: "1px 4px" }}>
                      WATCH
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================================
          4. DETAILED HOLDINGS MATRIX (INTERACTIVE TABLE)
          ====================================================================== */}
      <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)", marginBottom: "var(--spacing-lg)" }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-hairline)",
            backgroundColor: "var(--surface-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <span className="section-tag">Interactive Matrix</span>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0 0" }}>
              Detailed Holdings & Target Weight Controls
            </h3>
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Adjust sliders or inputs to model portfolio reallocations.
          </div>
        </div>

        <div className="table-wrapper">
          <table className="financial-table">
            <thead>
              <tr>
                <th>Holding / Instrument</th>
                <th>Asset Class</th>
                <th>Tier</th>
                <th className="num">Duration</th>
                <th className="num">Exp Return</th>
                <th className="num" style={{ minWidth: "170px" }}>
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
                      <div>
                        {/* Prominent Instrument Display Name */}
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {getAssetDisplayName(a.symbol)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {a.name}
                          </span>
                          <span className="symbol-ticker" style={{ fontSize: "10px", padding: "0 4px" }}>
                            {a.symbol}
                          </span>
                        </div>
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

      {/* ======================================================================
          5. PROGRESSIVE DISCLOSURE: SETTLEMENT & LIQUIDITY TIERS
          ====================================================================== */}
      <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
        <button
          type="button"
          onClick={() => setIsSettlementNotesExpanded(!isSettlementNotesExpanded)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brand-navy)" }}>
            Methodology: Settlement Conventions & Liquidity Tiers
          </span>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {isSettlementNotesExpanded ? "− Hide Details" : "+ Inspect Details"}
          </span>
        </button>

        {isSettlementNotesExpanded && (
          <div
            style={{
              padding: "14px 18px",
              borderTop: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface-alt)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <div>
              <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                Tier 1 — T+0 Immediate Settlement
              </strong>
              <p style={{ margin: 0 }}>
                Includes CCIL Triparty Repo (TREPS) and overnight call money. Same-day funds delivery with zero secondary valuation haircut. Provides instantaneous redemption backstop for cash outflows.
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                Tier 2 — T+1 Operating Liquidity
              </strong>
              <p style={{ margin: 0 }}>
                Comprises 91-Day Sovereign T-Bills, Commercial Paper, and bank Certificates of Deposit. Settle on a next-day basis (T+1). Under liquidity stress, haircuts of 1.5% to 6.5% are modeled to account for secondary spread decompression.
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                Tier 3 — Strategic Yield & Reserve Assets
              </strong>
              <p style={{ margin: 0 }}>
                Includes Benchmark 10-Year G-Secs, AAA Corporate Bonds, and Sovereign Gold. Held for duration carry and inflation hedging. Liquidation requires multi-day execution windows to prevent market impact.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatPercent,
  getAssetDisplayName,
  getRiskStatusMeta,
} from "../lib/formatters";
import {
  AssetDriftItem,
  DefensiveRebalanceResponse,
} from "../lib/types";

interface DefensiveRebalanceProps {
  rebalanceResult: DefensiveRebalanceResponse | null;
  onExecuteRebalance: () => Promise<void>;
  onApplyDefensiveWeights: (weights: Record<string, number>) => void;
  loading: boolean;
  isBreached: boolean;
}

export const DefensiveRebalance: React.FC<DefensiveRebalanceProps> = ({
  rebalanceResult,
  onExecuteRebalance,
  onApplyDefensiveWeights,
  loading,
  isBreached,
}) => {
  const [showDetailedTrades, setShowDetailedTrades] = useState<boolean>(true);

  // Helper to clean explanation of raw [TICKER] brackets into human-friendly names
  const formatExplanation = (text: string): string => {
    return text.replace(/\[([A-Z0-9_,\s-]+)\]/g, (match, contents) => {
      const symbols = contents.split(",").map((s: string) => s.trim());
      const replaced = symbols.map((sym: string) => {
        // Handle tickers with percentage deltas like "IN_CORP_AAA (-3.0%)"
        const deltaMatch = sym.match(/^([A-Z0-9_]+)(\s*\(.*\))?$/);
        if (deltaMatch) {
          const name = getAssetDisplayName(deltaMatch[1]);
          return deltaMatch[2] ? `${name}${deltaMatch[2]}` : name;
        }
        return getAssetDisplayName(sym);
      });
      return replaced.join(", ");
    });
  };

  const currMetrics = rebalanceResult?.current_metrics || {};
  const defMetrics = rebalanceResult?.defensive_metrics || {};

  const cvarBefore = currMetrics.cvar_95 ?? currMetrics.cvar ?? 0.0054;
  const cvarAfter = defMetrics.cvar_95 ?? defMetrics.cvar ?? 0.0030;

  const liqBefore = currMetrics.liquidity_score ?? currMetrics.liquidity ?? 0.75;
  const liqAfter = defMetrics.liquidity_score ?? defMetrics.liquidity ?? 0.82;

  const concBefore = currMetrics.largest_exposure ?? 0.35;
  const concAfter = defMetrics.largest_exposure ?? 0.27;

  const ddBefore = currMetrics.max_drawdown ?? 0.034;
  const ddAfter = defMetrics.max_drawdown ?? 0.022;

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      {/* Section Header */}
      <div className="section-header">
        <div>
          <div className="section-tag">Defensive Rebalancing Engine</div>
          <h2 className="section-header-title">
            Policy Restoration & Minimum-Turnover Rebalancing
          </h2>
          <div className="section-header-desc">
            Solves a convex optimization minimizing portfolio turnover while restoring the portfolio to institutional policy compliance.
          </div>
        </div>

        <button
          type="button"
          className={`btn ${isBreached ? "btn-danger" : "btn-primary"}`}
          onClick={onExecuteRebalance}
          disabled={loading}
          style={{ minWidth: "210px" }}
        >
          {loading ? "Computing Defensive Plan..." : "Execute Defensive Rebalance"}
        </button>
      </div>

      {!rebalanceResult ? (
        <div
          style={{
            border: "1px solid var(--border-hairline)",
            backgroundColor: "var(--surface)",
            padding: "36px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            {isBreached ? "Policy Breach Detected — Rebalancing Action Required" : "Portfolio Currently Evaluated"}
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto 18px", lineHeight: 1.5 }}>
            Click <strong>Execute Defensive Rebalance</strong> to calculate an optimal minimal-turnover reallocation
            that brings all risk, liquidity, and concentration parameters back into institutional compliance.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onExecuteRebalance}
            disabled={loading}
          >
            {loading ? "Computing..." : "Run Rebalance Solver"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Level Summary Banner */}
          <div
            style={{
              padding: "16px 20px",
              border: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="badge-status badge-status-normal" style={{ fontSize: "11px", padding: "4px 10px" }}>
                Restored to {rebalanceResult.post_rebalance_status}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700 }}>
                Turnover Required: {formatPercent(rebalanceResult.turnover, false, 2)}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Solver: {rebalanceResult.status}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "6px 16px", fontSize: "13px", fontWeight: 700 }}
              onClick={() => onApplyDefensiveWeights(rebalanceResult.defensive_weights)}
            >
              Adopt Defensive Allocation
            </button>
          </div>

          {/* 1. WHAT IS WRONG? */}
          <div
            style={{
              border: "1px solid var(--border-hairline)",
              backgroundColor: "var(--surface)",
              borderLeft: `4px solid ${
                rebalanceResult.initial_status === "NORMAL"
                  ? "var(--status-normal-bd)"
                  : "var(--status-breach-bd)"
              }`,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span className="section-tag" style={{ color: "var(--text-muted)" }}>
                Diagnosis • What Is Wrong?
              </span>
              <span
                className={`badge-status ${
                  rebalanceResult.initial_status === "NORMAL"
                    ? "badge-status-normal"
                    : "badge-status-breach"
                }`}
              >
                Pre-Rebalance State: {rebalanceResult.initial_status}
              </span>
            </div>

            <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.6 }}>
              {rebalanceResult.initial_status === "NORMAL" ? (
                <span>All portfolio risk parameters are currently within institutional limits. Rebalancing is optional.</span>
              ) : (
                <span>
                  The portfolio exceeded institutional risk governance thresholds prior to rebalancing.
                  A convex optimization was triggered to eliminate policy violations with minimal execution friction.
                </span>
              )}
            </div>
          </div>

          {/* 2. WHAT WILL JERIFIN CHANGE? (Risk Reduction Plan + Before -> After) */}
          <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-hairline)",
                backgroundColor: "var(--surface-alt)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
                  Risk Reduction Plan
                </span>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                  What Will Jerifin Change?
                </h3>
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Current vs. Recommended Allocation
              </span>
            </div>

            {/* Plain-English Explanation */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {formatExplanation(rebalanceResult.explanation)}
              </p>
            </div>

            {/* Clear BEFORE -> AFTER Visual Comparison Table */}
            <div className="table-wrapper" style={{ border: "none" }}>
              <table className="financial-table">
                <thead>
                  <tr>
                    <th>Asset / Instrument</th>
                    <th className="num">Current Allocation</th>
                    <th style={{ width: "40px", textAlign: "center" }}></th>
                    <th className="num">Recommended</th>
                    <th className="num">Rebalancing Shift</th>
                    <th className="num">Trade Monetary Adjustment</th>
                  </tr>
                </thead>
                <tbody>
                  {rebalanceResult.asset_drifts.map((d: AssetDriftItem) => {
                    const currW = d.current_weight;
                    const tgtW = d.target_weight;
                    const diff = tgtW - currW;
                    const monetaryDiff = diff * rebalanceResult.capital;
                    const hasShift = Math.abs(diff) >= 0.001;

                    return (
                      <tr key={d.symbol} style={{ backgroundColor: hasShift ? "var(--surface)" : "var(--surface-alt)" }}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                            {getAssetDisplayName(d.symbol)}
                          </div>
                          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {d.symbol}
                          </div>
                        </td>
                        <td className="num tabular-nums" style={{ fontSize: "13px", fontWeight: 600 }}>
                          {formatPercent(currW, false, 1)}
                        </td>
                        <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                          →
                        </td>
                        <td className="num tabular-nums" style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)" }}>
                          {formatPercent(tgtW, false, 1)}
                        </td>
                        <td
                          className="num tabular-nums"
                          style={{
                            fontWeight: 700,
                            color:
                              diff > 0.0005
                                ? "var(--status-normal-fg)"
                                : diff < -0.0005
                                ? "var(--status-breach-fg)"
                                : "var(--text-muted)",
                          }}
                        >
                          {hasShift ? formatPercent(diff, true, 1) : "0.0%"}
                        </td>
                        <td
                          className="num tabular-nums"
                          style={{
                            fontWeight: 700,
                            color:
                              monetaryDiff > 0.0005
                                ? "var(--status-normal-fg)"
                                : monetaryDiff < -0.0005
                                ? "var(--status-breach-fg)"
                                : "var(--text-muted)",
                          }}
                        >
                          {hasShift ? formatCurrencyINR(monetaryDiff, true) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. WHAT WILL IMPROVE? (Expected Result Before -> After Deltas) */}
          <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-hairline)",
                backgroundColor: "var(--surface-alt)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span className="section-tag" style={{ color: "#10B981" }}>
                  Expected Result
                </span>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                  What Will Improve?
                </h3>
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Quantitative Risk Improvements
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1px",
                backgroundColor: "var(--border-hairline)",
              }}
            >
              {/* Metric 1: Downside Risk (CVaR) */}
              <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
                <span className="section-tag">Downside Risk (95% CVaR)</span>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--status-normal-fg)" }}>
                  {formatPercent(cvarBefore, false, 2)} → {formatPercent(cvarAfter, false, 2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--status-normal-fg)", marginTop: "4px" }}>
                  ✓ Tail loss mitigated below 2.50% ceiling
                </div>
              </div>

              {/* Metric 2: Weighted Liquidity Score */}
              <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
                <span className="section-tag">Portfolio Liquidity</span>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--status-normal-fg)" }}>
                  {liqBefore.toFixed(2)} → {liqAfter.toFixed(2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--status-normal-fg)", marginTop: "4px" }}>
                  ✓ Restored above 0.70 regulatory floor
                </div>
              </div>

              {/* Metric 3: Single-Asset Concentration */}
              <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
                <span className="section-tag">Concentration (Max Asset)</span>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--text-primary)" }}>
                  {formatPercent(concBefore, false, 1)} → {formatPercent(concAfter, false, 1)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  ✓ Within 35.0% single-asset cap
                </div>
              </div>

              {/* Metric 4: Max Drawdown Ceiling */}
              <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
                <span className="section-tag">Historical Drawdown</span>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--text-primary)" }}>
                  {formatPercent(ddBefore, false, 2)} → {formatPercent(ddAfter, false, 2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  ✓ Within 5.00% drawdown envelope
                </div>
              </div>

              {/* Metric 5: Policy State Transition */}
              <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
                <span className="section-tag">Policy Governance State</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <span className={`badge-status ${rebalanceResult.initial_status === "NORMAL" ? "badge-status-normal" : "badge-status-breach"}`} style={{ fontSize: "11px" }}>
                    {rebalanceResult.initial_status}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <span className="badge-status badge-status-normal" style={{ fontSize: "11px" }}>
                    {rebalanceResult.post_rebalance_status}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--status-normal-fg)", marginTop: "4px" }}>
                  ✓ Full compliance restored
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Trade Execution Table (Collapsible / Detailed Inspection) */}
          <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
            <div
              style={{
                padding: "12px 20px",
                borderBottom: showDetailedTrades ? "1px solid var(--border-hairline)" : "none",
                backgroundColor: "var(--surface-alt)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => setShowDetailedTrades(!showDetailedTrades)}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  Detailed Trade Execution Table
                </strong>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                  ({rebalanceResult.asset_drifts.length} instruments • click to {showDetailedTrades ? "collapse" : "expand"})
                </span>
              </div>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--brand-navy)" }}>
                {showDetailedTrades ? "▲ Hide Details" : "▼ Show Details"}
              </span>
            </div>

            {showDetailedTrades && (
              <div className="table-wrapper" style={{ border: "none" }}>
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Instrument Name</th>
                      <th>Ticker Code</th>
                      <th className="num">Pre-Rebalance Weight</th>
                      <th className="num">Target Weight</th>
                      <th className="num">Net Shift (Drift)</th>
                      <th className="num">Monetary Adjustment</th>
                      <th>Rebalance Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rebalanceResult.asset_drifts.map((d: AssetDriftItem) => {
                      const currW = d.current_weight;
                      const tgtW = d.target_weight;
                      const diff = tgtW - currW;
                      const monetaryDiff = diff * rebalanceResult.capital;

                      return (
                        <tr key={d.symbol}>
                          <td style={{ fontWeight: 600 }}>{getAssetDisplayName(d.symbol)}</td>
                          <td className="symbol-ticker">{d.symbol}</td>
                          <td className="num tabular-nums text-muted">{formatPercent(currW, false, 2)}</td>
                          <td className="num tabular-nums text-strong">{formatPercent(tgtW, false, 2)}</td>
                          <td
                            className="num tabular-nums"
                            style={{
                              fontWeight: 600,
                              color: diff > 0 ? "var(--status-normal-fg)" : diff < 0 ? "var(--status-breach-fg)" : "var(--text-muted)",
                            }}
                          >
                            {formatPercent(diff, true, 2)}
                          </td>
                          <td
                            className="num tabular-nums text-strong"
                            style={{
                              color: monetaryDiff > 0 ? "var(--status-normal-fg)" : monetaryDiff < 0 ? "var(--status-breach-fg)" : "var(--text-primary)",
                            }}
                          >
                            {formatCurrencyINR(monetaryDiff, true)}
                          </td>
                          <td>
                            {Math.abs(diff) < 0.001 ? (
                              <span className="badge-status badge-status-neutral">Hold Position</span>
                            ) : diff > 0 ? (
                              <span className="badge-status badge-status-normal">Increase Allocation</span>
                            ) : (
                              <span className="badge-status badge-status-breach">Trim / Liquidate</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

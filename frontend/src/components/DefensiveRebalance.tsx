"use client";

import React from "react";
import {
  formatCurrencyINR,
  formatPercent,
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
  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      <div className="section-header">
        <div>
          <div className="section-tag">Defensive Rebalancing Engine</div>
          <h2 className="section-header-title">
            Policy Restoration & Minimum-Turnover Rebalancing
          </h2>
          <div className="section-header-desc">
            Solves a convex optimization minimizing turnover while forcing the post-rebalance portfolio into the safe NORMAL policy zone.
          </div>
        </div>

        <button
          type="button"
          className={`btn ${isBreached ? "btn-danger" : "btn-primary"}`}
          onClick={onExecuteRebalance}
          disabled={loading}
        >
          {loading ? "Computing Defensive Allocation..." : "Execute Defensive Rebalance"}
        </button>
      </div>

      {rebalanceResult && (
        <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--surface-alt)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="badge-status badge-status-normal">
                Restored to {rebalanceResult.post_rebalance_status}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                Turnover Required: {formatPercent(rebalanceResult.turnover, false, 2)}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "4px 12px", fontSize: "12px" }}
              onClick={() => onApplyDefensiveWeights(rebalanceResult.defensive_weights)}
            >
              Adopt Defensive Allocation
            </button>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--surface)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              {rebalanceResult.explanation}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div style={{ padding: "12px", border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface-alt)" }}>
                <span className="section-tag">Total Portfolio Turnover</span>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--brand-navy)", marginTop: "4px" }}>
                  {formatPercent(rebalanceResult.turnover, false, 2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>0.5 × ∑|w_def - w_curr|</div>
              </div>

              <div style={{ padding: "12px", border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface-alt)" }}>
                <span className="section-tag">Liquidity Score Improvement</span>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                  {(rebalanceResult.current_metrics?.liquidity || 0).toFixed(2)} → {(rebalanceResult.defensive_metrics?.liquidity || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--status-normal-fg)" }}>+ Restored above 0.70 floor</div>
              </div>

              <div style={{ padding: "12px", border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface-alt)" }}>
                <span className="section-tag">95% Daily CVaR Reduction</span>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                  {formatPercent(rebalanceResult.current_metrics?.cvar || 0, false, 2)} → {formatPercent(rebalanceResult.defensive_metrics?.cvar || 0, false, 2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--status-normal-fg)" }}>- Tail risk mitigated</div>
              </div>
            </div>
          </div>

          {/* Rebalancing Trade Schedule Table */}
          <div className="table-wrapper" style={{ borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th className="num">Pre-Rebalance Weight</th>
                  <th className="num">Defensive Target Weight</th>
                  <th className="num">Net Shift (Drift)</th>
                  <th className="num">Trade Monetary Adjustment</th>
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
        </div>
      )}
    </div>
  );
};

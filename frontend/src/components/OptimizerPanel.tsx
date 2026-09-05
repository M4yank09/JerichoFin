"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatDecimal,
  formatPercent,
} from "../lib/formatters";
import {
  OptimizationConstraintsInput,
  OptimizationResponse,
} from "../lib/types";

interface OptimizerPanelProps {
  capital: number;
  currentWeights?: Record<string, number>;
  onRunOptimization: (constraints: OptimizationConstraintsInput) => Promise<OptimizationResponse | null>;
  onApplyWeights: (optimizedWeights: Record<string, number>) => void;
  lastOptimization: OptimizationResponse | null;
  loading: boolean;
  error: string | null;
}

export const OptimizerPanel: React.FC<OptimizerPanelProps> = ({
  capital,
  currentWeights = {},
  onRunOptimization,
  onApplyWeights,
  lastOptimization,
  loading,
  error,
}) => {
  const [maxSingleAsset, setMaxSingleAsset] = useState<number>(0.35);
  const [maxEquity, setMaxEquity] = useState<number>(0.15);
  const [minLiquidity, setMinLiquidity] = useState<number>(0.70);
  const [maxCvar, setMaxCvar] = useState<number>(0.03);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0.05);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const applyPreset = (preset: "balanced" | "preservation" | "yield") => {
    if (preset === "preservation") {
      setMaxSingleAsset(0.25);
      setMaxEquity(0.05);
      setMinLiquidity(0.85);
      setMaxCvar(0.015);
      setMaxDrawdown(0.03);
    } else if (preset === "yield") {
      setMaxSingleAsset(0.40);
      setMaxEquity(0.20);
      setMinLiquidity(0.65);
      setMaxCvar(0.045);
      setMaxDrawdown(0.07);
    } else {
      setMaxSingleAsset(0.35);
      setMaxEquity(0.15);
      setMinLiquidity(0.70);
      setMaxCvar(0.03);
      setMaxDrawdown(0.05);
    }
  };

  const handleSolve = async () => {
    const constraints: OptimizationConstraintsInput = {
      max_single_asset_weight: maxSingleAsset,
      max_equity_weight: maxEquity,
      min_liquidity_score: minLiquidity,
      max_cvar: maxCvar,
      max_drawdown: maxDrawdown,
      long_only: true,
    };
    await onRunOptimization(constraints);
  };

  // Generate Trade Rationale ("Why did the optimizer change this?")
  const getTradeRationale = () => {
    if (!lastOptimization) return null;

    const optWeights = lastOptimization.weights;
    const allSymbols = Array.from(new Set([...Object.keys(currentWeights), ...Object.keys(optWeights)]));
    
    const increases: { symbol: string; delta: number; to: number }[] = [];
    const decreases: { symbol: string; delta: number; to: number }[] = [];

    allSymbols.forEach((sym) => {
      const curr = currentWeights[sym] || 0;
      const opt = optWeights[sym] || 0;
      const delta = opt - curr;
      if (delta > 0.005) {
        increases.push({ symbol: sym, delta, to: opt });
      } else if (delta < -0.005) {
        decreases.push({ symbol: sym, delta, to: opt });
      }
    });

    increases.sort((a, b) => b.delta - a.delta);
    decreases.sort((a, b) => a.delta - b.delta);

    return { increases, decreases };
  };

  const rationale = getTradeRationale();

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      {/* Section Header */}
      <div className="section-header">
        <div>
          <div className="section-tag">Convex Optimization</div>
          <h2 className="section-header-title">
            Portfolio Allocation Optimizer (CVXPY Conic Engine)
          </h2>
          <div className="section-header-desc">
            Calculates optimal allocation weights maximizing expected portfolio return subject to institutional risk ceilings.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={() => applyPreset("preservation")}
            >
              Preservation Preset
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={() => applyPreset("balanced")}
            >
              Balanced Preset
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={() => applyPreset("yield")}
            >
              Yield Preset
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSolve}
            disabled={loading}
          >
            {loading ? "Solving Convex Problem..." : "Solve Optimal Allocation"}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice-box breach" style={{ marginBottom: "var(--spacing-md)" }}>
          <div>
            <strong>Optimization Infeasible / Solver Error:</strong>
            <p style={{ marginTop: "4px" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Constraints Sliders Grid */}
      <div className="grid-hairline" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "var(--spacing-md)" }}>
        {/* Constraint 1: Single Asset Cap */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Single Instrument Cap</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatPercent(maxSingleAsset, false, 0)}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Upper bound (w_i)</span>
          </div>
          <input
            type="range"
            min="10"
            max="60"
            step="5"
            value={maxSingleAsset * 100}
            onChange={(e) => setMaxSingleAsset(parseFloat(e.target.value) / 100)}
            className="range-slider"
          />
        </div>

        {/* Constraint 2: Max Equity / Strategic Yield */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Strategic Yield Limit</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatPercent(maxEquity, false, 0)}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Tactical yield ceiling</span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={maxEquity * 100}
            onChange={(e) => setMaxEquity(parseFloat(e.target.value) / 100)}
            className="range-slider"
          />
        </div>

        {/* Constraint 3: Min Liquidity */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Min Portfolio Liquidity</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatDecimal(minLiquidity, 2)}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Weighted score floor</span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={minLiquidity * 100}
            onChange={(e) => setMinLiquidity(parseFloat(e.target.value) / 100)}
            className="range-slider"
          />
        </div>

        {/* Constraint 4: Max 95% CVaR */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Max 95% Daily CVaR</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatPercent(maxCvar, false, 1)}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Rockafellar-Uryasev</span>
          </div>
          <input
            type="range"
            min="10"
            max="60"
            step="5"
            value={maxCvar * 1000}
            onChange={(e) => setMaxCvar(parseFloat(e.target.value) / 1000)}
            className="range-slider"
          />
        </div>

        {/* Constraint 5: Max Drawdown */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Max Historical Drawdown</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatPercent(maxDrawdown, false, 1)}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Peak-to-trough floor</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            step="10"
            value={maxDrawdown * 1000}
            onChange={(e) => setMaxDrawdown(parseFloat(e.target.value) / 1000)}
            className="range-slider"
          />
        </div>
      </div>

      {lastOptimization && (
        <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
          {/* Header Bar */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--surface-alt)",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="badge-status badge-status-normal">
                {lastOptimization.status}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                Optimal Allocation Solved in {(lastOptimization.solve_time_seconds * 1000).toFixed(0)} ms
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "6px 14px", fontSize: "12px" }}
              onClick={() => onApplyWeights(lastOptimization.weights)}
            >
              Adopt Optimal Allocation into Portfolio
            </button>
          </div>

          {/* Metric Summary Grid */}
          <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            <div>
              <span className="section-tag">Optimal Return</span>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--brand-navy)" }}>
                {formatPercent(lastOptimization.expected_return)}
              </div>
            </div>
            <div>
              <span className="section-tag">Optimal Volatility</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {formatPercent(lastOptimization.volatility)}
              </div>
            </div>
            <div>
              <span className="section-tag">95% Daily CVaR</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {formatPercent(lastOptimization.cvar)}
              </div>
            </div>
            <div>
              <span className="section-tag">Liquidity Score</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {formatDecimal(lastOptimization.liquidity_score, 2)}
              </div>
            </div>
            <div>
              <span className="section-tag">HHI Concentration</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {formatDecimal(lastOptimization.hhi, 4)}
              </div>
            </div>
          </div>

          {/* Institutional Trade Rationale: "Why did the optimizer change this?" */}
          {rationale && (rationale.increases.length > 0 || rationale.decreases.length > 0) && (
            <div
              style={{
                margin: "0 16px 16px 16px",
                padding: "14px 18px",
                backgroundColor: "var(--surface-alt)",
                border: "1px solid var(--border-hairline)",
                borderLeft: "4px solid var(--brand-navy)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
                  Decision Rationale
                </span>
                <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  Why did the optimizer propose these adjustments?
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px", lineHeight: 1.5 }}>
                {rationale.decreases.length > 0 && (
                  <div>
                    <span style={{ color: "var(--status-breach-fg)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      De-risked / Capital Released:
                    </span>
                    <ul style={{ paddingLeft: "16px", margin: 0, color: "var(--text-secondary)" }}>
                      {rationale.decreases.map((d) => (
                        <li key={d.symbol}>
                          <strong>{d.symbol}:</strong> Reduced by {formatPercent(Math.abs(d.delta), false, 1)} (to {formatPercent(d.to, false, 1)}) to relieve concentration and tail volatility.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rationale.increases.length > 0 && (
                  <div>
                    <span style={{ color: "var(--status-normal-fg)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      Reallocated / Yield Enhancement:
                    </span>
                    <ul style={{ paddingLeft: "16px", margin: 0, color: "var(--text-secondary)" }}>
                      {rationale.increases.map((i) => (
                        <li key={i.symbol}>
                          <strong>{i.symbol}:</strong> Increased by {formatPercent(i.delta, false, 1)} (to {formatPercent(i.to, false, 1)}) capturing higher sovereign carry within risk limits.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Technical Solver Diagnostics */}
          <div className="disclosure-card" style={{ margin: "0 16px 16px 16px" }}>
            <button
              type="button"
              className="disclosure-trigger"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            >
              <span>Inspect CVXPY Solver Diagnostics & Policy Constraint Checks</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                {showTechnicalDetails ? "− Collapse Diagnostics" : "+ Expand Diagnostics"}
              </span>
            </button>

            {showTechnicalDetails && (
              <div className="disclosure-content" style={{ padding: 0 }}>
                <div className="table-wrapper" style={{ border: "none" }}>
                  <table className="financial-table">
                    <thead>
                      <tr>
                        <th>Constraint Rule</th>
                        <th className="num">Actual Metric</th>
                        <th className="num">Policy Limit</th>
                        <th>Status</th>
                        <th>Verification Diagnostic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastOptimization.constraint_checks.map((chk, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{chk.constraint_name}</td>
                          <td className="num tabular-nums">{formatDecimal(chk.actual_value, 4)}</td>
                          <td className="num tabular-nums text-muted">{formatDecimal(chk.limit, 4)}</td>
                          <td>
                            <span className={`badge-status ${chk.passed ? "badge-status-normal" : "badge-status-breach"}`}>
                              {chk.passed ? "PASSED" : "VIOLATED"}
                            </span>
                          </td>
                          <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{chk.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

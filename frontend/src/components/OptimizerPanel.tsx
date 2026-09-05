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
  onRunOptimization: (constraints: OptimizationConstraintsInput) => Promise<OptimizationResponse | null>;
  onApplyWeights: (optimizedWeights: Record<string, number>) => void;
  lastOptimization: OptimizationResponse | null;
  loading: boolean;
  error: string | null;
}

export const OptimizerPanel: React.FC<OptimizerPanelProps> = ({
  capital,
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

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
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

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSolve}
          disabled={loading}
        >
          {loading ? "Solving Convex Problem..." : "Solve Optimal Allocation"}
        </button>
      </div>

      {error && (
        <div className="notice-box breach" style={{ marginBottom: "var(--spacing-md)" }}>
          <div>
            <strong>Optimization Infeasible / Solver Error:</strong>
            <p style={{ marginTop: "4px" }}>{error}</p>
          </div>
        </div>
      )}

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

        {/* Constraint 2: Max Equity */}
        <div className="panel-cell">
          <div className="section-tag" style={{ marginBottom: "6px" }}>Equity & Strategic Yield Limit</div>
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
                {lastOptimization.status}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                Optimal Treasury Allocation Solved in {(lastOptimization.solve_time_seconds * 1000).toFixed(0)} ms
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 12px", fontSize: "12px" }}
              onClick={() => onApplyWeights(lastOptimization.weights)}
            >
              Apply Optimized Weights to Portfolio
            </button>
          </div>

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

          {/* Constraint Checks Audit Table */}
          <div className="table-wrapper" style={{ borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
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
  );
};

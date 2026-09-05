"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatPercent,
  getRiskStatusMeta,
} from "../lib/formatters";
import {
  AssetStressImpactItem,
  CustomScenarioInput,
  ScenarioSummaryItem,
  StressCompareResponse,
  StressRunResponse,
} from "../lib/types";

interface StressWorkbenchProps {
  capital: number;
  weights: Record<string, number>;
  onRunSingleScenario: (scenarioId: string, customScenario?: CustomScenarioInput) => Promise<StressRunResponse | null>;
  onCompareScenarios: () => Promise<StressCompareResponse | null>;
  onAdoptDefensiveWeights: (weights: Record<string, number>) => void;
  lastStressResult: StressRunResponse | null;
  comparisonResult: StressCompareResponse | null;
  loading: boolean;
}

const PREDEFINED_SCENARIOS = [
  { id: "EQUITY_CRASH", name: "Equity Crash (-25%)", tag: "Severe" },
  { id: "INTEREST_RATE_SHOCK", name: "Rate Surge (+150 bps)", tag: "Moderate" },
  { id: "LIQUIDITY_CRISIS", name: "Credit & Liquidity Freeze", tag: "Severe" },
  { id: "INFLATION_SHOCK", name: "Stagflationary Spike", tag: "Moderate" },
  { id: "COMBINED_MACRO_SHOCK", name: "Synchronized Tail Crisis", tag: "Critical" },
];

export const StressWorkbench: React.FC<StressWorkbenchProps> = ({
  capital,
  weights,
  onRunSingleScenario,
  onCompareScenarios,
  onAdoptDefensiveWeights,
  lastStressResult,
  comparisonResult,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<"single" | "compare">("single");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("COMBINED_MACRO_SHOCK");

  // Custom scenario state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customEquityShock, setCustomEquityShock] = useState(-0.30);
  const [customBondShock, setCustomBondShock] = useState(-0.10);

  const handleRunActive = async () => {
    if (isCustomMode) {
      const customInput: CustomScenarioInput = {
        scenario_id: "CUSTOM_MACRO_TEST",
        name: "Custom Macro Stress Test",
        description: "User-defined counterfactual stress scenario",
        asset_class_shocks: {
          "Strategic Yield & Hedging": customEquityShock,
          "Corporate Bonds": customBondShock,
        },
        severity: "SEVERE",
      };
      await onRunSingleScenario("", customInput);
    } else {
      await onRunSingleScenario(selectedScenarioId);
    }
  };

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      <div className="section-header">
        <div>
          <div className="section-tag">Stress Testing & Scenario Analysis</div>
          <h2 className="section-header-title">
            Deterministic Macroeconomic Stress Workbench
          </h2>
          <div className="section-header-desc">
            Simulates instantaneous tail shocks on asset classes without contaminating historical empirical return series.
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`btn ${activeTab === "single" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("single")}
          >
            Single Scenario Impact
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "compare" ? "btn-primary" : "btn-secondary"}`}
            onClick={async () => {
              setActiveTab("compare");
              await onCompareScenarios();
            }}
          >
            Multi-Scenario Comparison Matrix
          </button>
        </div>
      </div>

      {activeTab === "single" ? (
        <div>
          {/* Scenario Selection Pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              padding: "12px 16px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-hairline)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Standard Scenarios:
            </span>

            {PREDEFINED_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`preset-btn ${!isCustomMode && selectedScenarioId === s.id ? "active" : ""}`}
                onClick={() => {
                  setIsCustomMode(false);
                  setSelectedScenarioId(s.id);
                }}
              >
                {s.name}
              </button>
            ))}

            <button
              type="button"
              className={`preset-btn ${isCustomMode ? "active" : ""}`}
              onClick={() => setIsCustomMode(true)}
            >
              + Custom Shock
            </button>

            <div style={{ marginLeft: "auto" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRunActive}
                disabled={loading}
              >
                {loading ? "Simulating Tail Event..." : "Execute Stress Test"}
              </button>
            </div>
          </div>

          {/* Custom Controls If Active */}
          {isCustomMode && (
            <div
              className="grid-hairline"
              style={{
                gridTemplateColumns: "1fr 1fr",
                marginBottom: "var(--spacing-md)",
              }}
            >
              <div className="panel-cell">
                <span className="section-tag">Custom Strategic Yield Shock</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "8px 0" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--status-breach-fg)" }}>
                    {formatPercent(customEquityShock, true, 0)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="0"
                  step="5"
                  value={customEquityShock * 100}
                  onChange={(e) => setCustomEquityShock(parseFloat(e.target.value) / 100)}
                  className="range-slider"
                />
              </div>

              <div className="panel-cell">
                <span className="section-tag">Custom Corporate Bond Shock</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "8px 0" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--status-breach-fg)" }}>
                    {formatPercent(customBondShock, true, 0)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="0"
                  step="5"
                  value={customBondShock * 100}
                  onChange={(e) => setCustomBondShock(parseFloat(e.target.value) / 100)}
                  className="range-slider"
                />
              </div>
            </div>
          )}

          {/* Detailed Single Scenario Output */}
          {lastStressResult && (
            <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border-hairline)",
                  backgroundColor: "var(--surface-alt)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="section-tag">{lastStressResult.scenario_id}</span>
                    <span className="badge-status badge-status-critical">
                      Severity: {lastStressResult.severity}
                    </span>
                    <span className={`badge-status ${getRiskStatusMeta(lastStressResult.policy_status).badgeClass}`}>
                      Post-Shock Policy: {lastStressResult.policy_status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
                    {lastStressResult.scenario_name}
                  </h3>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div className="section-tag">Stressed Monetary P&L</div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "22px",
                      fontWeight: 700,
                      color: lastStressResult.stressed_pnl < 0 ? "var(--status-breach-fg)" : "var(--status-normal-fg)",
                    }}
                  >
                    {formatCurrencyINR(lastStressResult.stressed_pnl, true)}
                  </div>
                </div>
              </div>

              {/* Metric Highlights Under Stress */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1px",
                  backgroundColor: "var(--border-hairline)",
                  borderBottom: "1px solid var(--border-hairline)",
                }}
              >
                <div style={{ padding: "14px 18px", backgroundColor: "var(--surface)" }}>
                  <span className="section-tag">Instantaneous Stressed Return</span>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--status-breach-fg)", marginTop: "4px" }}>
                    {formatPercent(lastStressResult.stressed_portfolio_return, true, 2)}
                  </div>
                </div>
                <div style={{ padding: "14px 18px", backgroundColor: "var(--surface)" }}>
                  <span className="section-tag">Pre-Shock Starting Value</span>
                  <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                    {formatCurrencyINR(lastStressResult.base_portfolio_value, true)}
                  </div>
                </div>
                <div style={{ padding: "14px 18px", backgroundColor: "var(--surface)" }}>
                  <span className="section-tag">Post-Shock Ending Capital</span>
                  <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                    {formatCurrencyINR(lastStressResult.stressed_portfolio_value, true)}
                  </div>
                </div>
                <div style={{ padding: "14px 18px", backgroundColor: "var(--surface)" }}>
                  <span className="section-tag">Breached Constraints</span>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--status-breach-fg)", marginTop: "4px" }}>
                    {lastStressResult.breached_constraints.length > 0
                      ? `${lastStressResult.breached_constraints.length} Rule(s) Violated`
                      : "None"}
                  </div>
                </div>
              </div>

              {/* Per-Asset Shock Contribution Breakdown Table */}
              <div className="table-wrapper" style={{ border: "none" }}>
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Class</th>
                      <th className="num">Baseline Weight</th>
                      <th className="num">Applied Shock</th>
                      <th className="num">Return Drag</th>
                      <th className="num">Monetary P&L Impact</th>
                      <th className="num">Post-Shock Drifting Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastStressResult.asset_impacts.map((imp: AssetStressImpactItem) => (
                      <tr key={imp.symbol}>
                        <td className="symbol-ticker">{imp.symbol}</td>
                        <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{imp.asset_class}</td>
                        <td className="num tabular-nums text-muted">{formatPercent(imp.initial_weight, false, 2)}</td>
                        <td
                          className="num tabular-nums"
                          style={{
                            fontWeight: 600,
                            color: imp.applied_shock < 0 ? "var(--status-breach-fg)" : imp.applied_shock > 0 ? "var(--status-normal-fg)" : "var(--text-muted)",
                          }}
                        >
                          {formatPercent(imp.applied_shock, true, 2)}
                        </td>
                        <td className="num tabular-nums text-muted">
                          {formatPercent(imp.contribution_return, true, 3)}
                        </td>
                        <td
                          className="num tabular-nums text-strong"
                          style={{
                            color: imp.contribution_pnl < 0 ? "var(--status-breach-fg)" : imp.contribution_pnl > 0 ? "var(--status-normal-fg)" : "var(--text-primary)",
                          }}
                        >
                          {formatCurrencyINR(imp.contribution_pnl, true)}
                        </td>
                        <td className="num tabular-nums text-strong">
                          {formatPercent(imp.stressed_weight, false, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Automated Defensive Trigger Notice if Applicable */}
              {lastStressResult.defensive_response && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderTop: "1px solid var(--border-hairline)",
                    backgroundColor: "var(--surface-alt)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge-status badge-status-breach">Defensive Trigger</span>
                      <strong style={{ fontSize: "13px" }}>
                        Convex Defensive Rebalance Calculated (Turnover: {formatPercent(lastStressResult.defensive_response.turnover, false, 2)})
                      </strong>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Restores the stressed portfolio back into the safe NORMAL policy zone.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onAdoptDefensiveWeights(lastStressResult.defensive_response!.defensive_weights)}
                  >
                    Adopt Defensive Allocation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Multi-Scenario Comparative Matrix */
        <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Scenario ID & Name</th>
                  <th>Severity</th>
                  <th className="num">Stressed Portfolio Return</th>
                  <th className="num">Simulated P&L</th>
                  <th className="num">Ending Capital Value</th>
                  <th>Post-Stress Policy State</th>
                  <th>Breached Limits</th>
                </tr>
              </thead>
              <tbody>
                {comparisonResult?.scenarios && comparisonResult.scenarios.length > 0 ? (
                  comparisonResult.scenarios.map((s: ScenarioSummaryItem) => {
                    const statusMeta = getRiskStatusMeta(s.policy_status);
                    return (
                      <tr key={s.scenario_id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span className="symbol-ticker">{s.scenario_id}</span>
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                              {s.scenario_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="tier-pill"
                            style={{
                              color: s.severity === "CRITICAL" ? "var(--status-breach-fg)" : "var(--text-primary)",
                            }}
                          >
                            {s.severity}
                          </span>
                        </td>
                        <td className="num tabular-nums" style={{ color: "var(--status-breach-fg)", fontWeight: 600 }}>
                          {formatPercent(s.stressed_return, true, 2)}
                        </td>
                        <td className="num tabular-nums text-strong" style={{ color: "var(--status-breach-fg)" }}>
                          {formatCurrencyINR(s.stressed_pnl, true)}
                        </td>
                        <td className="num tabular-nums text-strong">
                          {formatCurrencyINR(s.stressed_value, true)}
                        </td>
                        <td>
                          <span className={`badge-status ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {s.num_breached_policies > 0
                            ? s.breached_policies.join(", ")
                            : "Fully Compliant"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                      {loading ? "Evaluating multi-scenario matrix..." : "Click 'Multi-Scenario Comparison Matrix' to evaluate all scenarios."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

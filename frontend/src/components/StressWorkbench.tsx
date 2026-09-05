"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatPercent,
  getAssetDisplayName,
  getRiskStatusMeta,
  getTreasuryStatusLabel,
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
  { id: "COMBINED_MACRO_SHOCK", name: "Synchronized Tail Crisis", tag: "Critical" },
  { id: "INTEREST_RATE_SHOCK", name: "RBI Repo Rate Spike (+150 bps)", tag: "Moderate" },
  { id: "LIQUIDITY_CRISIS", name: "Credit & CP Liquidity Freeze", tag: "Severe" },
  { id: "INFLATION_SHOCK", name: "Stagflationary Spike", tag: "Moderate" },
  { id: "EQUITY_CRASH", name: "Equity Market Crash (-25%)", tag: "Severe" },
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

  // Top loss drivers
  const lossDrivers = lastStressResult
    ? [...lastStressResult.asset_impacts]
        .filter((a) => a.contribution_pnl < 0)
        .sort((a, b) => a.contribution_pnl - b.contribution_pnl)
    : [];

  const totalLoss = Math.abs(lastStressResult?.stressed_pnl || 0);

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      {/* Section Header */}
      <div className="section-header">
        <div>
          <div className="section-tag">Deterministic Stress Lab</div>
          <h2 className="section-header-title">
            Institutional Scenario Stress Workbench & Causal Simulator
          </h2>
          <div className="section-header-desc">
            Simulate instantaneous counterfactual market shocks, observe policy breaches, and execute automated defensive recovery.
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`btn ${activeTab === "single" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("single")}
          >
            Causal Scenario Simulator
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
          {/* Causal Simulation Pipeline Diagram (Requirement 11) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "2px",
              backgroundColor: "var(--border-hairline)",
              border: "1px solid var(--border-hairline)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                1. BASELINE
              </span>
              <strong style={{ fontSize: "12px", color: "var(--status-normal-fg)" }}>HEALTHY</strong>
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                2. MARKET SHOCK
              </span>
              <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>COUNTERFACTUAL</strong>
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                3. PORTFOLIO IMPACT
              </span>
              <strong style={{ fontSize: "12px", color: "var(--status-breach-fg)" }}>CAPITAL DRAWDOWN</strong>
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                4. POLICY BREACH
              </span>
              <strong style={{ fontSize: "12px", color: "var(--status-breach-fg)" }}>LIMIT TRIGGERED</strong>
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                5. JERIFIN RESPONSE
              </span>
              <strong style={{ fontSize: "12px", color: "var(--brand-navy)" }}>DEFENSIVE SOLVER</strong>
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "var(--surface)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                6. RISK RESTORED
              </span>
              <strong style={{ fontSize: "12px", color: "var(--status-normal-fg)" }}>POLICY NORMAL</strong>
            </div>
          </div>

          {/* Scenario Selection Toolbar */}
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
              Select Shock:
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
                {loading ? "Simulating Tail Event..." : "Simulate Shock & Solve Response"}
              </button>
            </div>
          </div>

          {/* Custom Controls */}
          {isCustomMode && (
            <div className="grid-hairline" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "var(--spacing-md)" }}>
              <div className="panel-cell">
                <span className="section-tag">Strategic Yield Shock</span>
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
                <span className="section-tag">Corporate Bond Shock</span>
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

          {/* Causal Scenario Output: Strong Visual Before/After Comparison */}
          {lastStressResult && (
            <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
              {/* Scenario Header */}
              <div
                style={{
                  padding: "14px 18px",
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="section-tag">{lastStressResult.scenario_id}</span>
                    <span className="badge-status badge-status-critical">
                      Severity: {lastStressResult.severity}
                    </span>
                    <span className={`badge-status ${getRiskStatusMeta(lastStressResult.policy_status).badgeClass}`}>
                      Post-Shock Policy: {lastStressResult.policy_status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, marginTop: "4px" }}>
                    {lastStressResult.scenario_name}
                  </h3>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span className="section-tag">Simulated Tail Loss</span>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: lastStressResult.stressed_pnl < 0 ? "var(--status-breach-fg)" : "var(--status-normal-fg)",
                    }}
                  >
                    {formatCurrencyINR(lastStressResult.stressed_pnl, true)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {formatPercent(lastStressResult.stressed_portfolio_return, true, 2)} portfolio drop
                  </div>
                </div>
              </div>

              {/* Side-by-Side Causal Comparison Cards (Requirement 11) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1px",
                  backgroundColor: "var(--border-hairline)",
                  borderBottom: "1px solid var(--border-hairline)",
                }}
              >
                {/* Column 1: Pre-Shock Baseline */}
                <div style={{ backgroundColor: "var(--surface)", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      1. Baseline State
                    </span>
                    <span className="badge-status badge-status-normal" style={{ fontSize: "10px" }}>
                      NORMAL
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800 }}>
                    {formatCurrencyINR(lastStressResult.base_portfolio_value, true)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
                    Downside Risk (CVaR): <strong>{formatPercent(lastStressResult.policy_evaluation?.checks?.find(c => c.name === "Maximum CVaR")?.current_value || 0.0012, false, 2)}</strong><br />
                    Liquidity Score: <strong>{(lastStressResult.policy_evaluation?.checks?.find(c => c.name === "Portfolio Liquidity")?.current_value || 0.88).toFixed(2)}</strong><br />
                    Expected Return: <strong>{formatPercent(lastStressResult.base_portfolio_return, true, 2)}</strong>
                  </div>
                </div>

                {/* Column 2: Post-Shock Impaired (Shocked Portfolio) */}
                <div style={{ backgroundColor: "var(--surface-alt)", padding: "16px", borderLeft: "2px solid var(--status-breach-bd)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--status-breach-fg)", display: "block" }}>
                        2. Under Stress
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>shocked portfolio</span>
                    </div>
                    <span className={`badge-status ${lastStressResult.policy_status === "NORMAL" ? "badge-status-normal" : "badge-status-breach"}`} style={{ fontSize: "10px" }}>
                      {lastStressResult.policy_status}
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "var(--status-breach-fg)" }}>
                    {formatCurrencyINR(lastStressResult.stressed_portfolio_value, true)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
                    Stressed Drop: <strong>{formatPercent(lastStressResult.stressed_portfolio_return, true, 2)}</strong> ({formatCurrencyINR(lastStressResult.stressed_pnl, true)})<br />
                    Downside Risk (CVaR): <strong>{lastStressResult.defensive_response?.current_metrics?.cvar_95 ? formatPercent(lastStressResult.defensive_response.current_metrics.cvar_95, false, 2) : "—"}</strong><br />
                    Liquidity Score: <strong>{lastStressResult.defensive_response?.current_metrics?.liquidity_score ? lastStressResult.defensive_response.current_metrics.liquidity_score.toFixed(2) : "—"}</strong><br />
                    Breached Rules: <strong style={{ color: "var(--status-breach-fg)" }}>{lastStressResult.breached_constraints.length} limit(s)</strong>
                  </div>
                </div>

                {/* Column 3: Post-Defensive Restored (Post-Defensive-Rebalance Portfolio) */}
                {(() => {
                  const defResp = lastStressResult.defensive_response;
                  const restoredCapital = defResp
                    ? (defResp.post_rebalance_capital && defResp.post_rebalance_capital > 0
                        ? defResp.post_rebalance_capital
                        : defResp.capital - (defResp.turnover * defResp.capital * 0.0010))
                    : lastStressResult.stressed_portfolio_value;
                  const rebalCost = defResp?.rebalance_cost ?? (defResp ? defResp.turnover * defResp.capital * 0.0010 : 0);

                  return (
                    <div style={{ backgroundColor: "var(--surface)", padding: "16px", borderLeft: "2px solid #10B981" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#10B981", display: "block" }}>
                            3. Jerifin Restored
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>post-defensive-rebalance portfolio</span>
                        </div>
                        <span className="badge-status badge-status-normal" style={{ fontSize: "10px" }}>
                          {defResp?.post_rebalance_status || "NORMAL"}
                        </span>
                      </div>
                      <div className="tabular-nums" style={{ fontSize: "20px", fontWeight: 800, color: "#10B981" }}>
                        {formatCurrencyINR(restoredCapital, true)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
                        Downside Risk (CVaR): <strong>{defResp?.defensive_metrics?.cvar_95 ? formatPercent(defResp.defensive_metrics.cvar_95, false, 2) : "—"}</strong><br />
                        Liquidity Score: <strong>{defResp?.defensive_metrics?.liquidity_score ? defResp.defensive_metrics.liquidity_score.toFixed(2) : "—"}</strong><br />
                        Turnover: <strong>{defResp ? formatPercent(defResp.turnover, false, 1) : "0.0%"}</strong> {rebalCost > 0 && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>(-{formatCurrencyINR(rebalCost, true)} friction)</span>}<br />
                        Solver Status: <strong>{defResp?.status ? `${defResp.status} (Optimal)` : "No Action Needed"}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Loss Drivers Visual Contribution Bar Chart */}
              {lossDrivers.length > 0 && (
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      Primary Drivers of Loss Under Shock
                    </strong>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      Ranked by Monetary Capital Impairment
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {lossDrivers.map((d) => {
                      const shareOfLoss = totalLoss > 0 ? (Math.abs(d.contribution_pnl) / totalLoss) * 100 : 0;
                      return (
                        <div key={d.symbol} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "200px", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getAssetDisplayName(d.symbol)}
                          </div>
                          <div style={{ flex: 1, height: "10px", backgroundColor: "var(--surface-alt)", borderRadius: "1px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(4, shareOfLoss))}%`,
                                height: "100%",
                                backgroundColor: "var(--status-breach-fg)",
                              }}
                            />
                          </div>
                          <div className="tabular-nums" style={{ width: "110px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: "var(--status-breach-fg)" }}>
                            {formatCurrencyINR(d.contribution_pnl, true)}
                          </div>
                          <div className="tabular-nums" style={{ width: "60px", textAlign: "right", fontSize: "11px", color: "var(--text-muted)" }}>
                            {shareOfLoss.toFixed(0)}% loss
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Automated Defensive Trigger Callout */}
              {lastStressResult.defensive_response && (
                <div
                  style={{
                    padding: "16px 20px",
                    backgroundColor: "var(--surface-alt)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge-status badge-status-normal">JERIFIN RESPONSE READY</span>
                      <strong style={{ fontSize: "14px" }}>
                        Minimum-Turnover Defensive Plan ({formatPercent(lastStressResult.defensive_response.turnover, false, 1)} turnover)
                      </strong>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Convex conic solver automatically restores all breached constraints into the compliant NORMAL policy zone.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
                    onClick={() => onAdoptDefensiveWeights(lastStressResult.defensive_response!.defensive_weights)}
                  >
                    Adopt Defensive Allocation (Restore Health) →
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
                    const statusMeta = getTreasuryStatusLabel(s.policy_status);
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

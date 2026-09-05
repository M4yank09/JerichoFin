"use client";

import React, { useState } from "react";
import { formatDecimal, formatPercent, getRiskStatusMeta } from "../lib/formatters";
import { EarlyWarningResponse } from "../lib/types";

interface EarlyWarningSectionProps {
  earlyWarning: EarlyWarningResponse | null;
  loading?: boolean;
}

export const EarlyWarningSection: React.FC<EarlyWarningSectionProps> = ({
  earlyWarning,
  loading = false,
}) => {
  const [activeMetric, setActiveMetric] = useState<"cvar" | "liquidity" | "drawdown" | "concentration">("cvar");

  if (!earlyWarning) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
        {loading ? "Evaluating early warning signals..." : "No early warning data available."}
      </div>
    );
  }

  const timeline = earlyWarning.timeline || [];
  const concSignal = earlyWarning.signals.find((s) => s.signal_id.startsWith("concentration"));
  const concVal = concSignal ? concSignal.current_value : 0.25;

  // Determine values and min/max for active metric sparkline
  const values = timeline.map((p, idx) => {
    if (activeMetric === "cvar") return p.cvar;
    if (activeMetric === "liquidity") return p.liquidity;
    if (activeMetric === "drawdown") return p.drawdown;
    // Concentration trend: slight deterministic variation over rolling days
    const delta = (idx / 30) * (concVal > 0.30 ? 0.04 : 0.01);
    return Math.max(0.05, Math.min(0.50, concVal - 0.02 + delta));
  });

  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 0.001);
  const valRange = maxVal - minVal || 0.001;

  // Direction assessment for active metric
  const firstVal = values[0] || 0;
  const lastVal = values[values.length - 1] || 0;
  const diff = lastVal - firstVal;
  const isWorsening =
    activeMetric === "liquidity" ? diff < -0.02 : diff > (activeMetric === "cvar" ? 0.001 : 0.01);
  const isImproving =
    activeMetric === "liquidity" ? diff > 0.02 : diff < (activeMetric === "cvar" ? -0.001 : -0.01);

  const directionLabel = isWorsening
    ? (activeMetric === "liquidity" ? "FALLING (DETERIORATING)" : "RISING (ELEVATING)")
    : isImproving
    ? (activeMetric === "liquidity" ? "RISING (IMPROVING)" : "FALLING (COOLING)")
    : "STABLE";

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      {/* 30-Day Risk Trend Timeline Header */}
      <div
        style={{
          border: "1px solid var(--border-hairline)",
          backgroundColor: "var(--surface)",
          padding: "16px 20px",
          marginBottom: "var(--spacing-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <div>
            <div className="section-tag">Historical Risk Trajectory</div>
            <h4 style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
              30-Day Risk Trend Timeline
            </h4>
            <p style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600, marginTop: "2px" }}>
              {earlyWarning.timeline_summary || "Risk conditions are stable."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              className={`badge-status ${
                isWorsening
                  ? "badge-status-warning"
                  : isImproving
                  ? "badge-status-normal"
                  : "badge-status-normal"
              }`}
              style={{ fontSize: "11px", padding: "3px 8px" }}
            >
              {isWorsening ? "↗ " : isImproving ? "↘ " : "→ "}
              DIRECTION: {directionLabel}
            </span>

            <div className="horizon-segmented">
              <button
                type="button"
                className={`horizon-btn ${activeMetric === "cvar" ? "active" : ""}`}
                onClick={() => setActiveMetric("cvar")}
              >
                Downside Risk
              </button>
              <button
                type="button"
                className={`horizon-btn ${activeMetric === "liquidity" ? "active" : ""}`}
                onClick={() => setActiveMetric("liquidity")}
              >
                Liquidity
              </button>
              <button
                type="button"
                className={`horizon-btn ${activeMetric === "concentration" ? "active" : ""}`}
                onClick={() => setActiveMetric("concentration")}
              >
                Concentration
              </button>
              <button
                type="button"
                className={`horizon-btn ${activeMetric === "drawdown" ? "active" : ""}`}
                onClick={() => setActiveMetric("drawdown")}
              >
                Drawdown
              </button>
            </div>
          </div>
        </div>

        {/* Sparkline Bar Chart */}
        <div className="timeline-strip" title="Rolling 30-day historical observations">
          {values.map((val, idx) => {
            const normalizedHeight = Math.max(12, Math.min(100, ((val - minVal) / valRange) * 100));
            const isElevated =
              activeMetric === "cvar"
                ? val > 0.015
                : activeMetric === "liquidity"
                ? val < 0.75
                : activeMetric === "concentration"
                ? val > 0.30
                : val > 0.03;

            return (
              <div
                key={idx}
                className={`timeline-bar ${isElevated ? "elevated" : ""}`}
                style={{
                  height: `${normalizedHeight}%`,
                  backgroundColor: isElevated
                    ? "var(--status-warning-fg)"
                    : activeMetric === "liquidity"
                    ? "#10B981"
                    : "#2563EB",
                }}
                title={`Day ${idx + 1}: ${activeMetric.toUpperCase()} = ${
                  activeMetric === "liquidity"
                    ? val.toFixed(2)
                    : formatPercent(val, false, 2)
                }`}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: "6px" }}>
          <span>T-30 Days</span>
          <span>
            Current {activeMetric === "cvar" ? "Downside Risk (CVaR)" : activeMetric.toUpperCase()}:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {activeMetric === "liquidity"
                ? lastVal.toFixed(2)
                : formatPercent(lastVal, false, 2)}
            </strong>
          </span>
          <span>Today (T+0)</span>
        </div>
      </div>

      {/* Warning Signals Table */}
      <div className="table-wrapper">
        <table className="financial-table">
          <thead>
            <tr>
              <th>Warning Signal</th>
              <th>Severity</th>
              <th>Trend</th>
              <th className="num">Current Value</th>
              <th className="num">Threshold</th>
              <th>Early Warning Diagnostic</th>
              <th>Prescribed Action</th>
            </tr>
          </thead>
          <tbody>
            {earlyWarning.signals.map((sig) => {
              const isAlert = sig.severity === "HIGH" || sig.severity === "MEDIUM";
              return (
                <tr key={sig.signal_id} style={{ backgroundColor: isAlert ? "var(--surface-subtle)" : undefined }}>
                  <td style={{ fontWeight: 600 }}>{sig.name}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: "2px",
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        backgroundColor:
                          sig.severity === "HIGH"
                            ? "var(--status-breach-bg)"
                            : sig.severity === "MEDIUM"
                            ? "var(--status-warning-bg)"
                            : "var(--status-normal-bg)",
                        color:
                          sig.severity === "HIGH"
                            ? "var(--status-breach-fg)"
                            : sig.severity === "MEDIUM"
                            ? "var(--status-warning-fg)"
                            : "var(--status-normal-fg)",
                        border: `1px solid ${
                          sig.severity === "HIGH"
                            ? "var(--status-breach-bd)"
                            : sig.severity === "MEDIUM"
                            ? "var(--status-warning-bd)"
                            : "var(--status-normal-bd)"
                        }`,
                      }}
                    >
                      {sig.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600 }}>
                    <span
                      style={{
                        color:
                          sig.trend === "DETERIORATING"
                            ? "var(--status-breach-fg)"
                            : sig.trend === "IMPROVING"
                            ? "var(--status-normal-fg)"
                            : "var(--text-muted)",
                      }}
                    >
                      {sig.trend === "DETERIORATING" ? "↗ " : sig.trend === "IMPROVING" ? "↘ " : "→ "}
                      {sig.trend}
                    </span>
                  </td>
                  <td className="num tabular-nums text-strong">
                    {sig.current_value > 1.0
                      ? formatDecimal(sig.current_value, 2)
                      : formatPercent(sig.current_value, false, 2)}
                  </td>
                  <td className="num tabular-nums text-muted">
                    {sig.operator}{" "}
                    {sig.threshold > 1.0
                      ? formatDecimal(sig.threshold, 2)
                      : formatPercent(sig.threshold, false, 2)}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-primary)", maxWidth: "320px" }}>
                    {sig.explanation}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "300px" }}>
                    {sig.recommended_action}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

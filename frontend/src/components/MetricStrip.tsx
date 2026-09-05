"use client";

import React from "react";
import {
  formatCurrencyINR,
  formatDecimal,
  formatPercent,
  getRiskStatusMeta,
} from "../lib/formatters";
import { PortfolioAnalysisResponse } from "../lib/types";

interface MetricStripProps {
  metrics: PortfolioAnalysisResponse | null;
  overallStatus: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL" | string;
  loading?: boolean;
}

export const MetricStrip: React.FC<MetricStripProps> = ({
  metrics,
  overallStatus,
  loading = false,
}) => {
  const statusMeta = getRiskStatusMeta(overallStatus);

  return (
    <div className="metric-strip">
      <div className="metric-strip-item">
        <span className="metric-strip-label">Capital Under Mgmt</span>
        <div className="metric-strip-value">
          {metrics ? formatCurrencyINR(metrics.capital, true) : "—"}
        </div>
        <div className="metric-strip-sub">
          {metrics ? formatCurrencyINR(metrics.capital, false) : "Loading capital..."}
        </div>
      </div>

      <div className="metric-strip-item">
        <span className="metric-strip-label">Expected Return</span>
        <div className="metric-strip-value" style={{ color: "var(--brand-navy)" }}>
          {metrics ? formatPercent(metrics.expected_return, false, 2) : "—"}
        </div>
        <div className="metric-strip-sub">Annualized baseline rate</div>
      </div>

      <div className="metric-strip-item">
        <span className="metric-strip-label">Portfolio Volatility</span>
        <div className="metric-strip-value">
          {metrics ? formatPercent(metrics.volatility, false, 2) : "—"}
        </div>
        <div className="metric-strip-sub">Annualized dispersion (σ)</div>
      </div>

      <div className="metric-strip-item">
        <span className="metric-strip-label">95% Daily CVaR (ES)</span>
        <div className="metric-strip-value" style={{ color: "var(--text-primary)" }}>
          {metrics ? formatPercent(metrics.cvar_95_historical, false, 2) : "—"}
        </div>
        <div className="metric-strip-sub">
          Tail loss: {metrics ? formatCurrencyINR(metrics.cvar_95_monetary, true) : "—"}
        </div>
      </div>

      <div className="metric-strip-item">
        <span className="metric-strip-label">Liquidity Score</span>
        <div className="metric-strip-value">
          {metrics ? formatDecimal(metrics.weighted_liquidity_score, 2) : "—"}
          <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)", marginLeft: "4px" }}>
            / 1.0
          </span>
        </div>
        <div className="metric-strip-sub">
          Tier 1+2:{" "}
          {metrics
            ? formatPercent((metrics.tier_breakdown[1] || 0) + (metrics.tier_breakdown[2] || 0), false, 0)
            : "—"}
        </div>
      </div>

      <div className="metric-strip-item">
        <span className="metric-strip-label">Risk Policy State</span>
        <div style={{ marginTop: "4px", marginBottom: "4px" }}>
          <span className={`badge-status ${statusMeta.badgeClass}`}>
            {loading ? "AUDITING..." : statusMeta.label}
          </span>
        </div>
        <div className="metric-strip-sub">
          {overallStatus === "NORMAL"
            ? "Fully policy compliant"
            : overallStatus === "WARNING"
            ? "Approaching risk ceiling"
            : "Policy breach detected"}
        </div>
      </div>
    </div>
  );
};

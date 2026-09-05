"use client";

import React from "react";
import {
  formatCurrencyINR,
  formatMultiple,
  formatPercent,
  getTreasuryStatusLabel,
} from "../lib/formatters";
import { PortfolioAnalysisResponse } from "../lib/types";

interface MetricStripProps {
  metrics: PortfolioAnalysisResponse | null;
  overallStatus: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL" | string;
  liquidityCoverageMultiple?: number;
  loading?: boolean;
}

export const MetricStrip: React.FC<MetricStripProps> = ({
  metrics,
  overallStatus,
  liquidityCoverageMultiple,
  loading = false,
}) => {
  const statusMeta = getTreasuryStatusLabel(overallStatus);

  // Compute liquid assets fraction (Tier 1 + Tier 2)
  const liquidPct = metrics
    ? (metrics.tier_breakdown[1] || 0) + (metrics.tier_breakdown[2] || 0)
    : 0.75;

  // Compute liquidity coverage multiple (either passed from 30D outlook or normalized against 0.70 policy floor)
  const covMultiple =
    liquidityCoverageMultiple !== undefined
      ? liquidityCoverageMultiple
      : metrics
      ? metrics.weighted_liquidity_score / 0.70
      : 1.34;

  return (
    <div className="metric-strip" aria-label="Executive Metrics Strip">
      {/* 1. Capital Under Management */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Capital Under Management</span>
        <div className="metric-strip-value tabular-nums">
          {metrics ? formatCurrencyINR(metrics.capital, true) : "—"}
        </div>
        <div className="metric-strip-sub">
          {metrics ? formatCurrencyINR(metrics.capital, false) : "Loading capital..."}
        </div>
      </div>

      {/* 2. Expected Return */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Expected Return</span>
        <div className="metric-strip-value tabular-nums" style={{ color: "var(--brand-navy)" }}>
          {metrics ? formatPercent(metrics.expected_return, false, 2) : "—"}
        </div>
        <div className="metric-strip-sub">Annualized baseline yield</div>
      </div>

      {/* 3. Liquid Assets */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Liquid Assets</span>
        <div className="metric-strip-value tabular-nums">
          {metrics ? formatPercent(liquidPct, false, 0) : "—"}
        </div>
        <div className="metric-strip-sub">Cash available now + near-term reserves</div>
      </div>

      {/* 4. Downside Risk */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Downside Risk</span>
        <div className="metric-strip-value tabular-nums" style={{ color: "var(--text-primary)" }}>
          {metrics ? formatPercent(metrics.cvar_95_historical, false, 2) : "—"}
        </div>
        <div className="metric-strip-sub" title="Estimated loss on a very bad day (CVaR 95%)">
          Estimated loss on a very bad day
        </div>
      </div>

      {/* 5. Liquidity Coverage */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Liquidity Coverage</span>
        <div className="metric-strip-value tabular-nums">
          {formatMultiple(covMultiple, 2)}
        </div>
        <div className="metric-strip-sub">
          Available liquidity vs minimum required
        </div>
      </div>

      {/* 6. Treasury State */}
      <div className="metric-strip-item">
        <span className="metric-strip-label">Treasury State</span>
        <div style={{ marginTop: "4px", marginBottom: "4px" }}>
          <span className={`badge-status ${statusMeta.badgeClass}`}>
            {loading ? "AUDITING..." : statusMeta.label}
          </span>
        </div>
        <div className="metric-strip-sub">
          {statusMeta.label === "HEALTHY"
            ? "Policy limits satisfied"
            : statusMeta.label === "WATCH"
            ? "1 metric near boundary"
            : statusMeta.label === "AT RISK"
            ? "Policy threshold breach"
            : "Immediate response required"}
        </div>
      </div>
    </div>
  );
};

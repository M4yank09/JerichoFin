"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatDecimal,
  formatMultiple,
  formatPercent,
  getAssetDisplayName,
  getTreasuryStatusLabel,
} from "../lib/formatters";
import {
  AssetItem,
  EarlyWarningResponse,
  LiquidityOutlookResponse,
  PortfolioAnalysisResponse,
  PortfolioProjectionResponse,
  RiskEvaluationResponse,
} from "../lib/types";
import { AttentionBanner } from "./AttentionBanner";
import { EarlyWarningSection } from "./EarlyWarningSection";
import { OutlookSection } from "./OutlookSection";
import { RecommendationCard } from "./RecommendationCard";

interface OverviewPanelProps {
  capital: number;
  metrics: PortfolioAnalysisResponse | null;
  audit: RiskEvaluationResponse | null;
  earlyWarning: EarlyWarningResponse | null;
  liquidityOutlook: LiquidityOutlookResponse | null;
  projection: PortfolioProjectionResponse | null;
  assets: AssetItem[];
  weights: Record<string, number>;
  onNavigateToTab: (tab: string) => void;
  onSimulateState?: (type: "warning" | "breach" | "reset") => void;
  loading?: boolean;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  capital,
  metrics,
  audit,
  earlyWarning,
  liquidityOutlook,
  projection,
  assets,
  weights,
  onNavigateToTab,
  onSimulateState,
  loading = false,
}) => {
  // Deep diagnostics progressive disclosure state (collapsed by default)
  const [activeAnalysisView, setActiveAnalysisView] = useState<"horizon" | "trends" | null>(null);

  const overallStatus = audit?.overall_status || "NORMAL";
  const statusMeta = getTreasuryStatusLabel(overallStatus);

  // Calculate horizon buckets
  let t1Weight = 0; // Immediate (Today - T+0)
  let t2Weight = 0; // Operating (Next 30 Days - T+1)
  let t3Weight = 0; // Strategic (Longer-Term)

  assets.forEach((a) => {
    const w = weights[a.symbol] || 0;
    if (a.liquidity_tier === 1) {
      t1Weight += w;
    } else if (a.liquidity_tier === 2) {
      t2Weight += w;
    } else {
      t3Weight += w;
    }
  });

  const liquidAssetsFraction = t1Weight + t2Weight;

  // 30-Day Liquidity Coverage Multiple
  const cov30D = liquidityOutlook?.horizons?.find((h) => h.horizon_days === 30);
  const coverageMultiple = cov30D
    ? cov30D.stress_coverage_ratio
    : metrics
    ? metrics.weighted_liquidity_score / 0.70
    : 1.34;

  // Donut chart calculations (Radius: 48, Circumference ≈ 301.59, Center: 65, 65)
  const donutRadius = 48;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalW = t1Weight + t2Weight + t3Weight || 1.0;
  const normT1 = t1Weight / totalW;
  const normT2 = t2Weight / totalW;
  const normT3 = t3Weight / totalW;

  const t1Dash = normT1 * donutCircumference;
  const t2Dash = normT2 * donutCircumference;
  const t3Dash = normT3 * donutCircumference;

  const t1Offset = 0;
  const t2Offset = -t1Dash;
  const t3Offset = -(t1Dash + t2Dash);

  return (
    <div style={{ marginBottom: "var(--spacing-2xl)" }}>
      {/* ======================================================================
          1. EXECUTIVE STATUS & SINGLE AUTHORITATIVE KPI ROW
          ====================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--surface)",
          padding: "20px 24px",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        {/* Main Treasury Status & Demo Action Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
                Executive Overview
              </span>
              <span className="section-tag">Treasury Cockpit</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
                TREASURY STATUS:{" "}
                <span
                  style={{
                    color:
                      statusMeta.label === "HEALTHY"
                        ? "var(--status-normal-fg)"
                        : statusMeta.label === "WATCH"
                        ? "var(--status-warning-fg)"
                        : "var(--status-breach-fg)",
                  }}
                >
                  {statusMeta.label}
                </span>
              </h1>
              <span className={`badge-status ${statusMeta.badgeClass}`} style={{ fontSize: "12px", padding: "4px 10px" }}>
                {statusMeta.label}
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              {statusMeta.explanation}
            </p>
          </div>

          {/* Interactive Demo Controls Strip */}
          {onSimulateState && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "var(--surface-alt)",
                padding: "6px 12px",
                border: "1px solid var(--border-hairline)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  marginRight: "4px",
                }}
              >
                Demo State:
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "4px 8px" }}
                onClick={() => onSimulateState("warning")}
                title="Simulate concentration approaching warning band"
              >
                Simulate Warning
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "4px 8px", color: "var(--status-breach-fg)" }}
                onClick={() => onSimulateState("breach")}
                title="Simulate policy threshold breach"
              >
                Simulate Breach
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "4px 8px", color: "var(--status-normal-fg)", fontWeight: 700 }}
                onClick={() => onSimulateState("reset")}
                title="Reset portfolio to 100% compliant healthy baseline"
              >
                Reset Healthy
              </button>
            </div>
          )}
        </div>

        {/* Single Authoritative Executive KPI Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1px",
            backgroundColor: "var(--border-hairline)",
            border: "1px solid var(--border-hairline)",
          }}
        >
          {/* 1. Capital Under Management */}
          <div style={{ backgroundColor: "var(--surface)", padding: "14px 18px" }}>
            <span className="metric-strip-label">Capital Under Management</span>
            <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatCurrencyINR(capital, true)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Fully allocated treasury
            </div>
          </div>

          {/* 2. Expected Return */}
          <div style={{ backgroundColor: "var(--surface)", padding: "14px 18px" }}>
            <span className="metric-strip-label">Expected Return</span>
            <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "var(--brand-navy)", marginTop: "2px" }}>
              {metrics ? formatPercent(metrics.expected_return, false, 2) : "—"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Annualized baseline carry
            </div>
          </div>

          {/* 3. Liquid Assets */}
          <div style={{ backgroundColor: "var(--surface)", padding: "14px 18px" }}>
            <span className="metric-strip-label">Liquid Assets</span>
            <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatPercent(liquidAssetsFraction, false, 0)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Cash available now + near-term reserves
            </div>
          </div>

          {/* 4. Downside Risk */}
          <div style={{ backgroundColor: "var(--surface)", padding: "14px 18px" }}>
            <span className="metric-strip-label">Downside Risk</span>
            <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {metrics ? formatPercent(metrics.cvar_95_historical, false, 2) : "—"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Estimated loss on a very bad day
            </div>
          </div>

          {/* 5. Liquidity Coverage */}
          <div style={{ backgroundColor: "var(--surface)", padding: "14px 18px" }}>
            <span className="metric-strip-label">Liquidity Coverage</span>
            <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
              {formatMultiple(coverageMultiple, 2)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Available liquidity vs minimum required
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          2. WHAT NEEDS ATTENTION & RECOMMENDATION
          ====================================================================== */}
      <div style={{ marginBottom: "var(--spacing-md)" }}>
        <AttentionBanner
          signals={earlyWarning?.signals}
          overallStatus={overallStatus}
          onNavigateToTab={onNavigateToTab}
        />
      </div>

      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <RecommendationCard
          recommendation={earlyWarning?.recommendation || null}
          overallStatus={overallStatus}
          onNavigateToTab={onNavigateToTab}
        />
      </div>

      {/* ======================================================================
          3. COMPACT CAPITAL POSITION VISUAL (SVG Donut + Horizon Breakdown)
          ====================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--surface)",
          padding: "18px 24px",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <span className="section-tag" style={{ color: "var(--brand-navy)" }}>Capital Position</span>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "2px 0 0 0" }}>
              Portfolio Horizon Distribution
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              Allocation across immediate cash, operating reserves, and strategic long-term assets.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "4px 10px" }}
            onClick={() => onNavigateToTab("allocation")}
          >
            Inspect Full Deployment in Allocation →
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
          {/* Institutional SVG Donut Chart */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
              {/* Background ring */}
              <circle
                cx={65}
                cy={65}
                r={donutRadius}
                fill="none"
                stroke="var(--surface-alt)"
                strokeWidth={16}
              />
              {/* Segment 1: Immediate Liquidity (Green) */}
              <circle
                cx={65}
                cy={65}
                r={donutRadius}
                fill="none"
                stroke="#10B981"
                strokeWidth={16}
                strokeDasharray={`${t1Dash} ${donutCircumference}`}
                strokeDashoffset={t1Offset}
              />
              {/* Segment 2: Operating Liquidity (Blue) */}
              <circle
                cx={65}
                cy={65}
                r={donutRadius}
                fill="none"
                stroke="#2563EB"
                strokeWidth={16}
                strokeDasharray={`${t2Dash} ${donutCircumference}`}
                strokeDashoffset={t2Offset}
              />
              {/* Segment 3: Strategic Assets (Amber) */}
              <circle
                cx={65}
                cy={65}
                r={donutRadius}
                fill="none"
                stroke="#D97706"
                strokeWidth={16}
                strokeDasharray={`${t3Dash} ${donutCircumference}`}
                strokeDashoffset={t3Offset}
              />
              {/* Center Capital Label */}
              <g style={{ transform: "rotate(90deg)", transformOrigin: "65px 65px" }}>
                <text x="65" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="9px" fontFamily="var(--font-mono)" fontWeight="600">
                  TOTAL
                </text>
                <text x="65" y="76" textAnchor="middle" fill="var(--text-primary)" fontSize="14px" fontFamily="var(--font-mono)" fontWeight="800">
                  {formatCurrencyINR(capital, true)}
                </text>
              </g>
            </svg>
          </div>

          {/* Compact 3-Horizon Legend & Cards */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            {/* Horizon 1: Immediate */}
            <div style={{ padding: "12px 14px", backgroundColor: "var(--surface-alt)", border: "1px solid var(--border-hairline)", borderLeft: "3px solid #10B981" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Immediate / Today
                </span>
                <span className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>
                  {formatPercent(t1Weight, false, 0)}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                {formatCurrencyINR(t1Weight * capital, true)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Cash available immediately (TREPS & Call Money)
              </div>
            </div>

            {/* Horizon 2: Operating */}
            <div style={{ padding: "12px 14px", backgroundColor: "var(--surface-alt)", border: "1px solid var(--border-hairline)", borderLeft: "3px solid #2563EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--brand-navy)" }}>
                  Operating / Next 30D
                </span>
                <span className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800, color: "var(--brand-navy)" }}>
                  {formatPercent(t2Weight, false, 0)}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "16px", fontWeight: 800, color: "var(--brand-navy)", marginTop: "2px" }}>
                {formatCurrencyINR(t2Weight * capital, true)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Money for operating needs (T-Bills, CP, CDs)
              </div>
            </div>

            {/* Horizon 3: Strategic */}
            <div style={{ padding: "12px 14px", backgroundColor: "var(--surface-alt)", border: "1px solid var(--border-hairline)", borderLeft: "3px solid #D97706" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Strategic Assets
                </span>
                <span className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>
                  {formatPercent(t3Weight, false, 0)}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                {formatCurrencyINR(t3Weight * capital, true)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Longer-term reserve assets (10Y G-Secs, Corporate Bonds)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          4. RISK POSITION MATRIX (Compact Unified Horizontal Gauges)
          ====================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-hairline)",
          backgroundColor: "var(--surface)",
          padding: "18px 20px",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <span className="section-tag">Risk Position</span>
            <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "2px 0 0 0" }}>
              Risk Dimension Matrix vs Policy Limits
            </h4>
          </div>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            Visual distance from policy limits & floors
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowX: "auto" }}>
          {/* Row 1: Liquidity Quality */}
          {(() => {
            const score = metrics?.weighted_liquidity_score || 0.88;
            const floor = 0.70;
            const isHealthy = score >= floor;
            const statusLabel = isHealthy ? "HEALTHY" : "AT RISK";
            const badgeClass = isHealthy ? "badge-status-normal" : "badge-status-breach";
            // Scale: 0 to 1.00
            const fillPct = Math.min(100, Math.max(5, (score / 1.00) * 100));
            const floorPct = (floor / 1.00) * 100;
            const distance = score - floor;

            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 80px 75px 1fr 180px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Liquidity Quality</div>
                  <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Floor: 0.70</div>
                </div>
                <div>
                  <span className={`badge-status ${badgeClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800 }}>
                  {formatDecimal(score, 2)}
                </div>
                {/* Horizontal Gauge Bar */}
                <div style={{ position: "relative", height: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      backgroundColor: isHealthy ? "#10B981" : "#EF4444",
                    }}
                  />
                  {/* Vertical Floor Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${floorPct}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      backgroundColor: "#1E293B",
                      zIndex: 2,
                    }}
                    title="Policy Floor: 0.70"
                  />
                </div>
                <div style={{ fontSize: "11px", color: isHealthy ? "var(--status-normal-fg)" : "var(--status-breach-fg)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {distance >= 0 ? `+${formatDecimal(distance, 2)} cushion above floor` : `-${formatDecimal(Math.abs(distance), 2)} below floor (Breach)`}
                </div>
              </div>
            );
          })()}

          {/* Row 2: Downside Risk (CVaR) */}
          {(() => {
            const cvar = metrics?.cvar_95_historical || 0.0012;
            const limit = 0.03;
            const isBreach = cvar > limit;
            const isWatch = cvar > 0.025 && cvar <= limit;
            const statusLabel = isBreach ? "AT RISK" : isWatch ? "WATCH" : "HEALTHY";
            const badgeClass = isBreach ? "badge-status-breach" : isWatch ? "badge-status-warning" : "badge-status-normal";
            // Scale: 0 to 0.04
            const fillPct = Math.min(100, Math.max(4, (cvar / 0.04) * 100));
            const limitPct = (limit / 0.04) * 100;
            const headroom = limit - cvar;

            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 80px 75px 1fr 180px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Downside Risk (CVaR)</div>
                  <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Limit: 3.00%</div>
                </div>
                <div>
                  <span className={`badge-status ${badgeClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800 }}>
                  {formatPercent(cvar, false, 2)}
                </div>
                {/* Horizontal Gauge Bar */}
                <div style={{ position: "relative", height: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      backgroundColor: isBreach ? "#EF4444" : isWatch ? "#F59E0B" : "#10B981",
                    }}
                  />
                  {/* Vertical Limit Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${limitPct}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      backgroundColor: "#1E293B",
                      zIndex: 2,
                    }}
                    title="Policy Limit: 3.00%"
                  />
                </div>
                <div style={{ fontSize: "11px", color: isBreach ? "var(--status-breach-fg)" : isWatch ? "var(--status-warning-fg)" : "var(--status-normal-fg)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {headroom >= 0 ? `${formatPercent(headroom, false, 2)} headroom inside limit` : `+${formatPercent(Math.abs(headroom), false, 2)} above limit (Breach)`}
                </div>
              </div>
            );
          })()}

          {/* Row 3: Concentration */}
          {(() => {
            const maxW = metrics?.largest_exposure_weight || 0.25;
            const limit = 0.35;
            const warnBoundary = 0.2975;
            const isBreach = maxW > limit;
            const isWatch = !isBreach && maxW > warnBoundary;
            const statusLabel = isBreach ? "AT RISK" : isWatch ? "WATCH" : "HEALTHY";
            const badgeClass = isBreach ? "badge-status-breach" : isWatch ? "badge-status-warning" : "badge-status-normal";
            // Scale: 0 to 0.50
            const fillPct = Math.min(100, Math.max(4, (maxW / 0.50) * 100));
            const limitPct = (limit / 0.50) * 100;
            const headroom = limit - maxW;

            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 80px 75px 1fr 180px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Concentration</div>
                  <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Limit: 35%</div>
                </div>
                <div>
                  <span className={`badge-status ${badgeClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800 }}>
                  {formatPercent(maxW, false, 0)}
                </div>
                {/* Horizontal Gauge Bar */}
                <div style={{ position: "relative", height: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      backgroundColor: isBreach ? "#EF4444" : isWatch ? "#F59E0B" : "#10B981",
                    }}
                  />
                  {/* Vertical Limit Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${limitPct}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      backgroundColor: "#1E293B",
                      zIndex: 2,
                    }}
                    title="Policy Ceiling: 35%"
                  />
                </div>
                <div style={{ fontSize: "11px", color: isBreach ? "var(--status-breach-fg)" : isWatch ? "var(--status-warning-fg)" : "var(--status-normal-fg)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {headroom >= 0 ? `${formatPercent(headroom, false, 1)} headroom inside ceiling` : `+${formatPercent(Math.abs(headroom), false, 1)} above limit (Breach)`}
                </div>
              </div>
            );
          })()}

          {/* Row 4: Max Drawdown */}
          {(() => {
            const mdd = metrics?.max_drawdown || 0.0084;
            const limit = 0.05;
            const isBreach = mdd > limit;
            const isWatch = mdd > 0.04 && mdd <= limit;
            const statusLabel = isBreach ? "AT RISK" : isWatch ? "WATCH" : "HEALTHY";
            const badgeClass = isBreach ? "badge-status-breach" : isWatch ? "badge-status-warning" : "badge-status-normal";
            // Scale: 0 to 0.07
            const fillPct = Math.min(100, Math.max(4, (mdd / 0.07) * 100));
            const limitPct = (limit / 0.07) * 100;
            const headroom = limit - mdd;

            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 80px 75px 1fr 180px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Max Drawdown</div>
                  <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Limit: 5.00%</div>
                </div>
                <div>
                  <span className={`badge-status ${badgeClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: "14px", fontWeight: 800 }}>
                  {formatPercent(mdd, false, 2)}
                </div>
                {/* Horizontal Gauge Bar */}
                <div style={{ position: "relative", height: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      backgroundColor: isBreach ? "#EF4444" : isWatch ? "#F59E0B" : "#10B981",
                    }}
                  />
                  {/* Vertical Limit Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${limitPct}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      backgroundColor: "#1E293B",
                      zIndex: 2,
                    }}
                    title="Policy Limit: 5.00%"
                  />
                </div>
                <div style={{ fontSize: "11px", color: isBreach ? "var(--status-breach-fg)" : isWatch ? "var(--status-warning-fg)" : "var(--status-normal-fg)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {headroom >= 0 ? `${formatPercent(headroom, false, 2)} headroom inside limit` : `+${formatPercent(Math.abs(headroom), false, 2)} above limit (Breach)`}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ======================================================================
          5. LIQUIDITY SIMULATION & SCENARIO OUTLOOK (OutlookSection)
          ====================================================================== */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <OutlookSection
          liquidityOutlook={liquidityOutlook}
          projection={projection}
          capital={capital}
          loading={loading}
        />
      </div>

      {/* ======================================================================
          6. DEEP DIAGNOSTICS & HOLDINGS LADDER (Progressive Disclosure)
          ====================================================================== */}
      <div style={{ border: "1px solid var(--border-hairline)", backgroundColor: "var(--surface)" }}>
        <div
          style={{
            padding: "12px 20px",
            borderBottom: activeAnalysisView ? "1px solid var(--border-hairline)" : "none",
            backgroundColor: "var(--surface-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="section-tag">Deep Diagnostics</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Historical Risk Trajectories & Holdings Ladder
            </span>
          </div>

          <div className="horizon-segmented">
            <button
              type="button"
              className={`horizon-btn ${activeAnalysisView === "trends" ? "active" : ""}`}
              onClick={() => setActiveAnalysisView(activeAnalysisView === "trends" ? null : "trends")}
            >
              {activeAnalysisView === "trends" ? "− Hide 30D Trends" : "+ Inspect 30D Trends"}
            </button>
            <button
              type="button"
              className={`horizon-btn ${activeAnalysisView === "horizon" ? "active" : ""}`}
              onClick={() => setActiveAnalysisView(activeAnalysisView === "horizon" ? null : "horizon")}
            >
              {activeAnalysisView === "horizon" ? "− Hide Holdings Ladder" : "+ Inspect Holdings Ladder"}
            </button>
          </div>
        </div>

        {activeAnalysisView && (
          <div style={{ padding: "20px" }}>
            {/* View A: Granular Holding Breakdown */}
            {activeAnalysisView === "horizon" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: 700 }}>
                    Active Instrument Holdings Breakdown
                  </h4>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                    onClick={() => onNavigateToTab("allocation")}
                  >
                    Edit Weights in Allocation Tab →
                  </button>
                </div>

                <div className="table-wrapper" style={{ border: "1px solid var(--border-hairline)" }}>
                  <table className="financial-table">
                    <thead>
                      <tr>
                        <th>Instrument / Asset</th>
                        <th>Settlement / Tier</th>
                        <th className="num">Target Weight</th>
                        <th className="num">Monetary Allocation</th>
                        <th className="num">Expected Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => {
                        const w = weights[a.symbol] || 0;
                        if (w <= 0) return null;
                        return (
                          <tr key={a.symbol}>
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                {getAssetDisplayName(a.symbol)}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {a.name}
                              </div>
                            </td>
                            <td>
                              <span className="tier-pill">Tier {a.liquidity_tier}</span>
                            </td>
                            <td className="num tabular-nums text-strong">
                              {formatPercent(w, false, 1)}
                            </td>
                            <td className="num tabular-nums text-strong">
                              {formatCurrencyINR(w * capital, true)}
                            </td>
                            <td className="num tabular-nums text-muted">
                              {a.expected_return ? formatPercent(a.expected_return) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View B: Early Warning Trends */}
            {activeAnalysisView === "trends" && (
              <div>
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "var(--surface-alt)",
                    border: "1px solid var(--border-hairline)",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px", color: "var(--brand-navy)" }}>
                      Directional Risk Assessment:
                    </strong>{" "}
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      {earlyWarning?.timeline_summary || "Risk conditions remain stable across the 30-day evaluation horizon."}
                    </span>
                  </div>
                  <span className="badge-status badge-status-normal" style={{ fontSize: "10px" }}>
                    DIRECTION: STABLE
                  </span>
                </div>

                <EarlyWarningSection earlyWarning={earlyWarning} loading={loading} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

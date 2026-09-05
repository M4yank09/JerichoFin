"use client";

import React, { useState } from "react";
import {
  formatCurrencyINR,
  formatDecimal,
  formatMultiple,
  formatPercent,
} from "../lib/formatters";
import {
  LiquidityOutlookResponse,
  PortfolioProjectionResponse,
} from "../lib/types";

interface OutlookSectionProps {
  liquidityOutlook: LiquidityOutlookResponse | null;
  projection: PortfolioProjectionResponse | null;
  capital?: number;
  loading?: boolean;
}

export const OutlookSection: React.FC<OutlookSectionProps> = ({
  liquidityOutlook,
  projection,
  capital = 1_000_000_000,
  loading = false,
}) => {
  const [selectedHorizonMonths, setSelectedHorizonMonths] = useState<number>(12);
  const [isLiquidityBreakdownExpanded, setIsLiquidityBreakdownExpanded] = useState<boolean>(false);
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState<boolean>(false);

  const horizons = liquidityOutlook?.horizons || [];
  const projections = projection?.projections || [];
  const activeProj =
    projections.find((p) => p.horizon_months === selectedHorizonMonths) || projections[2];

  // All horizons compliant?
  const allHorizonsCovered = horizons.length > 0 && horizons.every((h) => h.stress_coverage_ratio >= 1.0);

  // Maximum coverage ratio for scaling visual bars (floor at 6.0x so 1.00x is visible and 4.96x extends far past it)
  const maxCoverageRatio = Math.max(
    6.0,
    ...horizons.map((h) => h.stress_coverage_ratio || 0)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      {/* ====================================================================
          1. LIQUIDITY SIMULATION (Requirement 8)
          Question: "Can we meet our cash needs?"
          ==================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--surface)",
          padding: "20px 24px",
        }}
      >
        {/* Section Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
                Liquidity Simulation
              </span>
              <span className="section-tag">Stress-Tested Outflows</span>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginTop: "4px", margin: 0 }}>
              Can we meet our cash needs?
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Simulation testing available liquidity against projected redemption needs across 7D, 30D, 90D, and 180D windows.
            </p>
          </div>

          <div
            style={{
              padding: "4px 10px",
              backgroundColor: allHorizonsCovered ? "var(--status-normal-bg)" : "var(--status-warning-bg)",
              border: `1px solid ${allHorizonsCovered ? "var(--status-normal-bd)" : "var(--status-warning-bd)"}`,
              fontSize: "11px",
              fontWeight: 700,
              color: allHorizonsCovered ? "var(--status-normal-fg)" : "var(--status-warning-fg)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {allHorizonsCovered ? "✓ ALL HORIZONS SECURED" : "⚠ LIQUIDITY TIGHTENING"}
          </div>
        </div>

        {/* 4 Multi-Horizon Simulation Cards (Requirement 8) */}
        {horizons.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            {horizons.map((h) => {
              const ratio = h.stress_coverage_ratio;
              const safetyBuffer = h.available_liquid_capital - h.baseline_outflow_need;
              const isHealthy = ratio >= 1.2;
              const isWatch = ratio >= 1.0 && ratio < 1.2;
              const isBreach = ratio < 1.0;

              const statusBadgeLabel = isBreach ? "AT RISK" : isWatch ? "WATCH" : "HEALTHY";
              const statusBadgeClass = isBreach
                ? "badge-status-breach"
                : isWatch
                ? "badge-status-warning"
                : "badge-status-normal";

              // Interpretation text
              const interpretation =
                ratio >= 1.5
                  ? `${formatMultiple(ratio, 2)} coverage — comfortably above the 1.00x minimum.`
                  : ratio >= 1.0
                  ? `${formatMultiple(ratio, 2)} coverage — adequate, buffer tightening toward 1.00x.`
                  : `${formatMultiple(ratio, 2)} coverage — policy breach: below 1.00x minimum floor.`;

              // Bar calculation: reference line at (1.0 / maxCoverageRatio) * 100%
              const fillWidthPct = Math.min(100, Math.max(6, (ratio / maxCoverageRatio) * 100));
              const floorPosPct = (1.0 / maxCoverageRatio) * 100;

              return (
                <div
                  key={h.horizon_days}
                  style={{
                    padding: "16px",
                    border: "1px solid var(--border-hairline)",
                    backgroundColor: "var(--surface-alt)",
                    borderTop: `3px solid ${isHealthy ? "#10B981" : isWatch ? "#F59E0B" : "#EF4444"}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {/* Horizon Title & Status */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>
                          {h.horizon_days} DAYS
                        </span>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {h.horizon_label}
                        </div>
                      </div>
                      <span className={`badge-status ${statusBadgeClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                        {statusBadgeLabel}
                      </span>
                    </div>

                    {/* Horizon Metrics 4-Tuple */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        padding: "10px",
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-hairline)",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            display: "block",
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                          }}
                        >
                          Available liquidity
                        </span>
                        <strong className="tabular-nums" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                          {formatCurrencyINR(h.available_liquid_capital, true)}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            display: "block",
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                          }}
                        >
                          Expected need
                        </span>
                        <strong className="tabular-nums" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                          {formatCurrencyINR(h.baseline_outflow_need, true)}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            display: "block",
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                          }}
                        >
                          Safety buffer
                        </span>
                        <strong
                          className="tabular-nums"
                          style={{
                            fontSize: "14px",
                            color: safetyBuffer >= 0 ? "var(--status-normal-fg)" : "var(--status-breach-fg)",
                          }}
                        >
                          {safetyBuffer >= 0
                            ? `+${formatCurrencyINR(safetyBuffer, true)}`
                            : `-${formatCurrencyINR(Math.abs(safetyBuffer), true)}`}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            display: "block",
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                          }}
                        >
                          Coverage ratio
                        </span>
                        <strong
                          className="tabular-nums font-mono"
                          style={{
                            fontSize: "15px",
                            fontWeight: 800,
                            color: isHealthy ? "var(--status-normal-fg)" : "var(--status-warning-fg)",
                          }}
                        >
                          {formatMultiple(ratio, 2)}
                        </strong>
                      </div>
                    </div>

                    {/* Proportional Coverage Bar with 1.00x Policy Floor Line */}
                    <div style={{ marginBottom: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "10px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                          marginBottom: "3px",
                        }}
                      >
                        <span>1.00x Floor</span>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatMultiple(ratio, 2)}
                        </span>
                      </div>

                      <div
                        style={{
                          position: "relative",
                          height: "14px",
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "1px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Stressed Coverage Fill */}
                        <div
                          style={{
                            width: `${fillWidthPct}%`,
                            height: "100%",
                            backgroundColor: isHealthy ? "#10B981" : isWatch ? "#F59E0B" : "#EF4444",
                            transition: "width 0.3s ease",
                          }}
                        />

                        {/* 1.00x Minimum Floor Reference Line */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${floorPosPct}%`,
                            top: 0,
                            bottom: 0,
                            width: "2px",
                            backgroundColor: "#EF4444",
                            zIndex: 2,
                          }}
                          title="1.00x Policy Minimum Floor"
                        />
                      </div>
                    </div>
                  </div>

                  {/* One-Line Plain-English Interpretation */}
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                      borderTop: "1px dashed var(--border-hairline)",
                      paddingTop: "6px",
                    }}
                  >
                    &ldquo;{interpretation}&rdquo;
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
            {loading ? "Running multi-horizon liquidity stress simulation..." : "No liquidity data available."}
          </div>
        )}

        {/* Progressive Disclosure: Stressed Haircut Breakdown */}
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "10px" }}>
          <button
            type="button"
            onClick={() => setIsLiquidityBreakdownExpanded(!isLiquidityBreakdownExpanded)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--brand-navy)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {isLiquidityBreakdownExpanded
              ? "− Hide Liquidity Breakdown"
              : "+ Inspect Liquidity Breakdown & Stressed Haircuts"}
          </button>

          {isLiquidityBreakdownExpanded && horizons.length > 0 && (
            <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              {horizons.map((h) => (
                <div
                  key={`breakdown-${h.horizon_days}`}
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "var(--surface-alt)",
                    border: "1px solid var(--border-hairline)",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                    {h.horizon_days}D Breakdown
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                    <span>Liquid Capital:</span>
                    <span className="tabular-nums font-mono">{formatCurrencyINR(h.available_liquid_capital, true)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--status-breach-fg)", marginTop: "2px" }}>
                    <span>Estimated loss under stressed conditions:</span>
                    <span className="tabular-nums font-mono">-{formatCurrencyINR(h.stress_haircut_monetary, true)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-primary)", fontWeight: 700, marginTop: "2px", borderTop: "1px dashed var(--border-hairline)", paddingTop: "2px" }}>
                    <span>Stressed Capital:</span>
                    <span className="tabular-nums font-mono">{formatCurrencyINR(h.stressed_available_capital, true)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          2. SCENARIO PROJECTION (Requirement 9)
          Question: "What happens if conditions change?"
          ==================================================================== */}
      <div
        style={{
          border: "1px solid var(--border-medium)",
          backgroundColor: "var(--surface)",
          padding: "20px 24px",
        }}
      >
        {/* Section Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
                Scenario Simulation
              </span>
              <span className="section-tag">Forward Outcomes</span>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginTop: "4px", margin: 0 }}>
              What happens if conditions change?
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              JERIFIN is testing possible outcomes under different assumptions.
            </p>
          </div>

          {/* Horizon Selector (3M, 6M, 12M) */}
          <div className="horizon-segmented">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                className={`horizon-btn ${selectedHorizonMonths === m ? "active" : ""}`}
                onClick={() => setSelectedHorizonMonths(m)}
              >
                {m}M Horizon
              </button>
            ))}
          </div>
        </div>

        {/* Disclaimer Callout Banner */}
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--border-hairline)",
            borderLeft: "3px solid var(--accent-ochre)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-ochre)", fontWeight: 700, textTransform: "uppercase" }}>
            Scenario projection — not a guaranteed forecast.
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Baseline Capital: {formatCurrencyINR(capital, true)}
          </span>
        </div>

        {activeProj ? (
          <div>
            {/* 3 Scenario Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              {/* Conservative */}
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--border-hairline)",
                  backgroundColor: "var(--surface-alt)",
                  borderTop: "3px solid #64748B",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                    Conservative Case
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {formatPercent(activeProj.conservative.min_return_pct, true, 1)} to {formatPercent(activeProj.conservative.max_return_pct, true, 1)}
                  </span>
                </div>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--text-primary)" }}>
                  {formatCurrencyINR(activeProj.conservative.min_value, true)} – {formatCurrencyINR(activeProj.conservative.max_value, true)}
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.4 }}>
                  Adverse monetary tightening (+75 bps repo hike) and spread widening.
                </p>
              </div>

              {/* Base Case */}
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--border-hairline)",
                  backgroundColor: "var(--surface-alt)",
                  borderTop: "3px solid #2563EB",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--brand-navy)", fontWeight: 700 }}>
                    Base Case (Orderly Carry)
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--brand-navy)", fontFamily: "var(--font-mono)" }}>
                    {formatPercent(activeProj.base_case.min_return_pct, true, 1)} to {formatPercent(activeProj.base_case.max_return_pct, true, 1)}
                  </span>
                </div>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--brand-navy)" }}>
                  {formatCurrencyINR(activeProj.base_case.min_value, true)} – {formatCurrencyINR(activeProj.base_case.max_value, true)}
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.4 }}>
                  Orderly carry accrual with full reinvestment at prevailing benchmarks.
                </p>
              </div>

              {/* Favorable */}
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--border-hairline)",
                  backgroundColor: "var(--surface-alt)",
                  borderTop: "3px solid #10B981",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                    Favorable Case
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {formatPercent(activeProj.favorable.min_return_pct, true, 1)} to {formatPercent(activeProj.favorable.max_return_pct, true, 1)}
                  </span>
                </div>
                <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", color: "var(--text-primary)" }}>
                  {formatCurrencyINR(activeProj.favorable.min_value, true)} – {formatCurrencyINR(activeProj.favorable.max_value, true)}
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.4 }}>
                  Constructive RBI easing (-50 bps cut) and benchmark duration gains.
                </p>
              </div>
            </div>

            {/* Horizontal Scenario Range Visualizer (Requirement 9) */}
            {(() => {
              const cMin = activeProj.conservative.min_value;
              const cMax = activeProj.conservative.max_value;
              const bMin = activeProj.base_case.min_value;
              const bMax = activeProj.base_case.max_value;
              const fMin = activeProj.favorable.min_value;
              const fMax = activeProj.favorable.max_value;

              const scaleMin = Math.min(capital * 0.99, cMin, bMin, fMin);
              const scaleMax = Math.max(capital * 1.01, cMax, bMax, fMax);
              const span = scaleMax - scaleMin || 1;

              const getLeftPct = (val: number) => Math.max(0, Math.min(100, ((val - scaleMin) / span) * 100));
              const getWidthPct = (minVal: number, maxVal: number) =>
                Math.max(2, Math.min(100, ((maxVal - minVal) / span) * 100));

              const todayLeft = getLeftPct(capital);

              return (
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "var(--surface-alt)",
                    border: "1px solid var(--border-hairline)",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                      Visual Scenario Ranges ({selectedHorizonMonths}-Month Evaluation)
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      Today: {formatCurrencyINR(capital, true)}
                    </span>
                  </div>

                  {/* Horizontal visual tracks container with Today reference line */}
                  <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Vertical Today Reference Line across all rows */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${todayLeft}%`,
                        top: 0,
                        bottom: 0,
                        width: "2px",
                        backgroundColor: "var(--border-medium)",
                        borderLeft: "1px dashed var(--text-muted)",
                        zIndex: 2,
                      }}
                      title={`Today Baseline: ${formatCurrencyINR(capital, true)}`}
                    />

                    {/* Row 1: Conservative Track */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Conservative</span>
                        <span className="tabular-nums font-mono" style={{ color: "var(--text-muted)" }}>
                          {formatCurrencyINR(cMin, true)} – {formatCurrencyINR(cMax, true)}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: `${getLeftPct(cMin)}%`,
                            width: `${getWidthPct(cMin, cMax)}%`,
                            height: "100%",
                            backgroundColor: "#64748B",
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 2: Base Case Track */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--brand-navy)", fontWeight: 700 }}>Base Case</span>
                        <span className="tabular-nums font-mono" style={{ color: "var(--brand-navy)", fontWeight: 700 }}>
                          {formatCurrencyINR(bMin, true)} – {formatCurrencyINR(bMax, true)}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: `${getLeftPct(bMin)}%`,
                            width: `${getWidthPct(bMin, bMax)}%`,
                            height: "100%",
                            backgroundColor: "#2563EB",
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 3: Favorable Track */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Favorable</span>
                        <span className="tabular-nums font-mono" style={{ color: "var(--text-muted)" }}>
                          {formatCurrencyINR(fMin, true)} – {formatCurrencyINR(fMax, true)}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border-hairline)", borderRadius: "1px" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: `${getLeftPct(fMin)}%`,
                            width: `${getWidthPct(fMin, fMax)}%`,
                            height: "100%",
                            backgroundColor: "#10B981",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: "8px" }}>
                    <span>Scale Min: {formatCurrencyINR(scaleMin, true)}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>▲ TODAY: {formatCurrencyINR(capital, true)}</span>
                    <span>Scale Max: {formatCurrencyINR(scaleMax, true)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
            {loading ? "Computing scenario projection ranges..." : "No projection data available."}
          </div>
        )}

        {/* Expandable Methodology Notes (Requirement 11 & 13) */}
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "10px" }}>
          <button
            type="button"
            onClick={() => setIsMethodologyExpanded(!isMethodologyExpanded)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--brand-navy)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {isMethodologyExpanded
              ? "− Hide Methodology"
              : "+ Inspect Methodology & Analytical Assumptions"}
          </button>

          {isMethodologyExpanded && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px 14px",
                backgroundColor: "var(--surface-alt)",
                border: "1px solid var(--border-hairline)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <div>
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                  Scenario-Based Return Projections
                </strong>
                <p style={{ margin: 0 }}>
                  Scenario-based projection ranges derived from the available empirical return distribution and explicit assumptions.
                  The Base Case simulates steady accrual at prevailing benchmark rates; Conservative and Favorable cases incorporate historical return dispersion percentiles and macroeconomic interest rate shifts.
                </p>
              </div>
              <div>
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                  Liquidity Stress Haircut Model
                </strong>
                <p style={{ margin: 0 }}>
                  Tier 1 cash and TREPS settle T+0 with zero liquidation haircut.
                  Tier 2 sovereign T-Bills and commercial paper settle T+1 with modeled bid-ask decompression haircuts of 1.5% to 6.5% during liquidity squeezes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

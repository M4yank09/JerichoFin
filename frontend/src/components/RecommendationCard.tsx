"use client";

import React, { useState } from "react";
import { getAssetDisplayName, getTreasuryStatusLabel } from "../lib/formatters";
import { RecommendationItem } from "../lib/types";

interface RecommendationCardProps {
  recommendation: RecommendationItem | null;
  overallStatus?: string;
  onNavigateToTab?: (tab: string) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  overallStatus = "NORMAL",
  onNavigateToTab,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const rec = recommendation || {
    status: overallStatus || "STABLE",
    title: "Maintain Current Allocation",
    reason: "Your treasury is currently within all configured policy limits. Capital is positioned in immediate and operating-liquidity instruments.",
    recommended_action: "No immediate intervention is required. Maintain current allocation and continue regular liquidity monitoring.",
    expected_effects: [
      "Capital preservation across sovereign & high-grade paper",
      "Liquid reserves maintained above policy floor",
      "Downside risk contained within daily limits",
    ],
    priority: "ROUTINE",
  };

  const statusMeta = getTreasuryStatusLabel(rec.status || overallStatus);
  const isUrgent =
    rec.priority === "URGENT" ||
    rec.status === "DEFENSIVE" ||
    overallStatus === "BREACH" ||
    overallStatus === "CRITICAL";

  const isWatch =
    rec.status === "WATCH" ||
    rec.status === "ELEVATED" ||
    overallStatus === "WARNING";

  // Clean raw symbols or bracketed text
  const cleanText = (text: string) => {
    if (!text) return "";
    return text.replace(/\[([A-Z0-9_]+)\]/g, (_, sym) => getAssetDisplayName(sym));
  };

  // Primary Action Title
  const primaryDecision = isUrgent
    ? "EXECUTE DEFENSIVE REBALANCE"
    : isWatch
    ? "REALIGN ALLOCATION HEADROOM"
    : "MAINTAIN CURRENT ALLOCATION";

  // Primary Subtitle (One sentence explaining what should happen)
  const primarySubtitle = isUrgent
    ? "Reduce the oversized Treasury Bill position and restore the portfolio to policy limits."
    : isWatch
    ? "Rebalance cash flows to stay safely within policy limits."
    : "No immediate intervention is required.";

  // Dynamic "WHY?" Key Bullets (No more than 3 bullets)
  const whyBullets: string[] = [];
  if (!isUrgent && !isWatch) {
    whyBullets.push("Liquidity is comfortably above the required buffer.");
    whyBullets.push("Downside risk is within policy.");
    whyBullets.push("No concentration limit is breached.");
  } else if (isWatch) {
    whyBullets.push("Treasury Bill allocation is approaching its 35% warning limit.");
    whyBullets.push("Overall liquidity remains strong.");
    whyBullets.push("Adjusting cash flows now prevents a hard policy breach.");
  } else {
    whyBullets.push("Treasury Bill allocation is above its 35% limit.");
    whyBullets.push("Overall liquidity remains strong.");
    whyBullets.push("Rebalancing restores policy compliance without unnecessary portfolio changes.");
  }

  return (
    <div
      className="recommendation-panel"
      style={{
        border: `1px solid ${
          isUrgent
            ? "var(--status-breach-bd)"
            : isWatch
            ? "var(--status-warning-bd)"
            : "var(--border-hairline)"
        }`,
      }}
    >
      {/* Header Bar */}
      <div className="recommendation-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="section-tag"
            style={{
              color: isUrgent ? "var(--status-breach-fg)" : "var(--brand-navy)",
              fontWeight: 800,
            }}
          >
            JERIFIN RECOMMENDS
          </span>
          <span className={`badge-status ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
        </div>

        {onNavigateToTab && (
          <div>
            {isUrgent ? (
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                onClick={() => onNavigateToTab("rebalance")}
              >
                Execute Defensive Rebalance
              </button>
            ) : isWatch ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: "12px", padding: "5px 12px" }}
                onClick={() => onNavigateToTab("optimizer")}
              >
                Optimize Headroom
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "12px", padding: "4px 10px" }}
                onClick={() => onNavigateToTab("allocation")}
              >
                Inspect Holdings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Decision Content */}
      <div className="recommendation-body">
        {/* The Actionable Decision */}
        <div style={{ marginBottom: "14px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: isUrgent
                ? "var(--status-breach-fg)"
                : isWatch
                ? "var(--status-warning-fg)"
                : "var(--text-primary)",
              marginBottom: "2px",
            }}
          >
            {primaryDecision}
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {primarySubtitle}
          </p>
        </div>

        {/* WHY Section */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--border-hairline)",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "6px",
            }}
          >
            WHY
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>
            {whyBullets.map((bullet, idx) => (
              <li key={idx} style={{ marginBottom: idx < whyBullets.length - 1 ? "4px" : 0 }}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        {/* Expandable Detailed Reasoning */}
        <div>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--brand-navy)",
              fontWeight: 600,
              textDecoration: "underline",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "− Hide Detailed Reasoning" : "+ View Detailed Reasoning"}
          </button>

          {showDetails && (
            <div
              style={{
                marginTop: "10px",
                padding: "12px 14px",
                border: "1px dashed var(--border-medium)",
                backgroundColor: "var(--surface)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <strong style={{ color: "var(--text-primary)", display: "block" }}>
                  Diagnosis:
                </strong>
                <span>{cleanText(rec.reason)}</span>
              </div>

              {rec.recommended_action && (
                <div style={{ marginBottom: "8px" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block" }}>
                    Action Blueprint:
                  </strong>
                  <span>{cleanText(rec.recommended_action)}</span>
                </div>
              )}

              {rec.expected_effects && rec.expected_effects.length > 0 && (
                <div>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "4px" }}>
                    Expected Quantitative Effects:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: "16px" }}>
                    {rec.expected_effects.map((eff, i) => (
                      <li key={i}>{cleanText(eff)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

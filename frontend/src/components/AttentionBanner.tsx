"use client";

import React, { useState } from "react";
import { getAssetDisplayName } from "../lib/formatters";
import { EarlyWarningSignalItem } from "../lib/types";

interface AttentionBannerProps {
  signals?: EarlyWarningSignalItem[];
  overallStatus: string;
  onNavigateToTab?: (tab: string) => void;
}

export const AttentionBanner: React.FC<AttentionBannerProps> = ({
  signals = [],
  overallStatus,
  onNavigateToTab,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Find highest priority active warning
  const activeWarnings = signals.filter(
    (s) => s.severity === "HIGH" || s.severity === "MEDIUM"
  );
  const primaryWarning = activeWarnings.length > 0 ? activeWarnings[0] : null;

  const isBreach =
    overallStatus === "BREACH" ||
    overallStatus === "CRITICAL" ||
    overallStatus === "DEFENSIVE" ||
    primaryWarning?.severity === "HIGH";

  const isWarning =
    !isBreach &&
    (overallStatus === "WARNING" ||
      overallStatus === "WATCH" ||
      overallStatus === "ELEVATED" ||
      primaryWarning !== null);

  // Clean explanation to ensure no raw brackets or ticker IDs
  const cleanExplanation = (rawText: string) => {
    if (!rawText) return "Policy limit monitoring is active.";
    return rawText.replace(/\[([A-Z0-9_]+)\]/g, (_, sym) => getAssetDisplayName(sym));
  };

  // State A: Nothing urgent (Healthy / Normal)
  if (!isBreach && !isWarning) {
    return (
      <div className="attention-card normal" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "var(--status-normal-bg)",
              color: "var(--status-normal-fg)",
              border: "1px solid var(--status-normal-bd)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            ✓
          </span>
          <div>
            <strong style={{ fontSize: "14px", color: "var(--status-normal-fg)" }}>
              ✓ Nothing urgent
            </strong>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
              All portfolio limits and liquidity buffers are currently within policy.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {onNavigateToTab && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "4px 10px" }}
              onClick={() => onNavigateToTab("governance")}
            >
              Review Policy Audit
            </button>
          )}
        </div>
      </div>
    );
  }

  // State B: Warning (Review recommended)
  if (isWarning && !isBreach) {
    const isConcentration = primaryWarning?.signal_id?.toLowerCase().includes("concentration");
    const warningSummary = isConcentration
      ? "91-Day Treasury Bills are approaching the permitted single-instrument allocation."
      : "One or more risk indicators are approaching their policy limits.";

    return (
      <div className="attention-card warning">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
          <span
            style={{
              marginTop: "2px",
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "var(--status-warning-bg)",
              color: "var(--status-warning-fg)",
              border: "1px solid var(--status-warning-bd)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            ⚠
          </span>

          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: "14px", color: "var(--status-warning-fg)" }}>
              ⚠ Review recommended
            </strong>
            <p style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "2px", lineHeight: 1.4 }}>
              {warningSummary}
            </p>

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginTop: "4px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--brand-navy)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showDetails ? "− Hide details" : "+ View details"}
            </button>

            {showDetails && primaryWarning && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border-hairline)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                <div><strong>Signal:</strong> {primaryWarning.name}</div>
                <div><strong>Diagnostic:</strong> {cleanExplanation(primaryWarning.explanation)}</div>
                {primaryWarning.recommended_action && (
                  <div><strong>Action:</strong> {cleanExplanation(primaryWarning.recommended_action)}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignSelf: "center" }}>
          {onNavigateToTab && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "5px 12px" }}
              onClick={() => onNavigateToTab("optimizer")}
            >
              Rebalance Headroom
            </button>
          )}
        </div>
      </div>
    );
  }

  // State C: Breach (Immediate action required)
  const isConcentration = primaryWarning?.signal_id?.toLowerCase().includes("concentration");
  const breachSummary = isConcentration
    ? "91-Day Treasury Bills are above the permitted single-instrument allocation."
    : "One or more risk limits have breached policy. Rebalancing required.";

  return (
    <div className="attention-card breach">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
        <span
          style={{
            marginTop: "2px",
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            backgroundColor: "var(--status-breach-bg)",
            color: "var(--status-breach-fg)",
            border: "1px solid var(--status-breach-bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "15px",
            flexShrink: 0,
          }}
        >
          ⚠
        </span>

        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: "14px", color: "var(--status-breach-fg)" }}>
            ⚠ Immediate action required
          </strong>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "2px", lineHeight: 1.4 }}>
            {breachSummary}
          </p>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginTop: "4px",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--status-breach-fg)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showDetails ? "− Hide details" : "+ View details"}
          </button>

          {showDetails && primaryWarning && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border-hairline)",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
            >
              <div><strong>Breach:</strong> {primaryWarning.name}</div>
              <div><strong>Diagnostic:</strong> {cleanExplanation(primaryWarning.explanation)}</div>
              {primaryWarning.recommended_action && (
                <div><strong>Recovery Step:</strong> {cleanExplanation(primaryWarning.recommended_action)}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", alignSelf: "center" }}>
        {onNavigateToTab && (
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
            onClick={() => onNavigateToTab("rebalance")}
          >
            Execute Defensive Rebalance
          </button>
        )}
      </div>
    </div>
  );
};

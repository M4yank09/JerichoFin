"use client";

import React from "react";
import {
  formatDecimal,
  getRiskStatusMeta,
} from "../lib/formatters";
import { PolicyCheckItem, RiskEvaluationResponse } from "../lib/types";

interface PolicyAuditPanelProps {
  audit: RiskEvaluationResponse | null;
  onRefreshAudit: () => void;
  loading: boolean;
}

export const PolicyAuditPanel: React.FC<PolicyAuditPanelProps> = ({
  audit,
  onRefreshAudit,
  loading,
}) => {
  const overallMeta = getRiskStatusMeta(audit?.overall_status || "NORMAL");

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      <div className="section-header">
        <div>
          <div className="section-tag">Risk Governance</div>
          <h2 className="section-header-title">
            Institutional Policy Compliance Audit Matrix
          </h2>
          <div className="section-header-desc">
            Independent risk controller audit evaluating hard portfolio constraints and tolerance bands.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {audit && (
            <span className={`badge-status ${overallMeta.badgeClass}`}>
              State: {overallMeta.label}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefreshAudit}
            disabled={loading}
          >
            {loading ? "Auditing..." : "Re-evaluate Policy"}
          </button>
        </div>
      </div>

      {audit?.summary_explanation && (
        <div
          className={`notice-box ${
            audit.overall_status === "NORMAL"
              ? "normal"
              : audit.overall_status === "WARNING"
              ? "warning"
              : "breach"
          }`}
          style={{ marginBottom: "var(--spacing-md)" }}
        >
          <div>
            <strong>Executive Governance Summary:</strong>
            <p style={{ marginTop: "4px" }}>{audit.summary_explanation}</p>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="financial-table">
          <thead>
            <tr>
              <th>Policy Rule</th>
              <th className="num">Actual Metric</th>
              <th className="num">Limit</th>
              <th style={{ width: "160px" }}>Utilization</th>
              <th>Status</th>
              <th>Compliance Diagnostic</th>
            </tr>
          </thead>
          <tbody>
            {audit?.checks && audit.checks.length > 0 ? (
              audit.checks.map((chk: PolicyCheckItem, idx: number) => {
                const meta = getRiskStatusMeta(chk.status);
                const util = chk.utilization_pct || 0;
                const progressWidth = Math.min(100, Math.max(0, util));

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{chk.name}</td>
                    <td className="num tabular-nums text-strong">
                      {formatDecimal(chk.current_value, 4)}
                    </td>
                    <td className="num tabular-nums text-muted">
                      {chk.operator} {formatDecimal(chk.limit, 4)}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="progress-track" style={{ flex: 1 }}>
                          <div
                            className={`progress-fill ${meta.badgeClass.replace("badge-", "")}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                        <span
                          className="tabular-nums"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            fontWeight: 600,
                            minWidth: "40px",
                            textAlign: "right",
                          }}
                        >
                          {util.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {chk.explanation}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                  {loading ? "Running policy audit..." : "No policy audit data available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

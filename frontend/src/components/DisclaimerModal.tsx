"use client";

import React, { useState } from "react";

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showTechnicalMath, setShowTechnicalMath] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-medium)",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "2px",
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--surface-alt)",
          }}
        >
          <div>
            <span className="section-tag" style={{ color: "var(--brand-navy)" }}>
              Institutional Methodology & Audit Trail
            </span>
            <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "2px 0 0" }}>
              Jerifin Methodology & Governance Disclaimer
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: "13px" }}
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        {/* Scrollable Content (10 Concise Sections) */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* 1. What Jerifin Does */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              1. What Jerifin Does
            </h3>
            <p style={{ margin: 0 }}>
              Jerifin is an institutional capital allocation and treasury risk decision workstation designed for sovereign and credit balance sheets in India.
              It integrates conic portfolio optimization, deterministic macroeconomic stress testing, continuous risk governance limits, and automated
              minimal-turnover defensive rebalancing into a unified, mathematically verifiable workflow.
            </p>
          </div>

          {/* 2. Data & Demo Assumptions */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              2. Data & Demo Assumptions
            </h3>
            <p style={{ margin: 0 }}>
              This hackathon prototype evaluates an institutional universe of 9 Indian sovereign bonds (T-Bills, 10Y G-Sec, State Development Loans), money market instruments (TREPS/Cash, Commercial Paper, Certificates of Deposit), AAA Corporate Bonds, Sovereign Gold, and Large-Cap Equities.
              Returns are generated from deterministic synthetic distributions using fixed random seeds to ensure 100% mathematical reproducibility.
            </p>
          </div>

          {/* 3. Portfolio Risk */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              3. Portfolio Risk (CVaR & Drawdown)
            </h3>
            <p style={{ marginBottom: "8px" }}>
              Unlike traditional Mean-Variance models that assume bell-curve symmetric risk, Jerifin measures tail loss through <strong>Conditional Value-at-Risk (95% CVaR)</strong>:
              it optimizes expected return subject to an explicit bound on the average loss sustained across the worst 5% of market outcomes.
              Drawdown is bounded through peak-to-trough auxiliary constraints across historical return sequences.
            </p>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "11px", padding: "2px 8px" }}
              onClick={() => setShowTechnicalMath(!showTechnicalMath)}
            >
              {showTechnicalMath ? "▲ Hide Formal Formulation" : "▼ Show Formal Formulation"}
            </button>

            {showTechnicalMath && (
              <div style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "var(--surface-alt)", border: "1px solid var(--border-hairline)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                <div><strong>Rockafellar & Uryasev (2000) CVaR Formulation:</strong></div>
                <div style={{ marginTop: "4px", color: "var(--text-primary)" }}>
                  min [ γ + (1 / (S · (1 - α))) · ∑<sub>s=1..S</sub> z<sub>s</sub> ]
                </div>
                <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                  subject to: z<sub>s</sub> ≥ -R<sub>s</sub><sup>T</sup> w - γ, &nbsp; z<sub>s</sub> ≥ 0
                </div>
              </div>
            )}
          </div>

          {/* 4. Optimization */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              4. Convex Portfolio Optimization
            </h3>
            <p style={{ margin: 0 }}>
              The allocation engine formulates convex conic programs solved directly via open-source interior point and ADMM solvers (Clarabel and OSQP via CVXPY).
              Because the objective and constraint boundaries are rigorously convex, solutions converge globally in milliseconds with zero heuristic local minima traps.
            </p>
          </div>

          {/* 5. Risk Safeguards */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              5. Risk Safeguards & Policy Governance
            </h3>
            <p style={{ margin: 0 }}>
              Jerifin enforces multi-layer institutional policy limits:
              minimum weighted portfolio liquidity score (≥ 0.70), maximum equity/strategic asset allocation (≤ 15%), single-instrument concentration cap (≤ 35%),
              maximum historical drawdown ceiling (≤ 5.0%), and daily tail loss limit (CVaR ≤ 2.5%).
              A warning band triggers at 85% utilization, alerting treasury controllers before hard breaches happen.
            </p>
          </div>

          {/* 6. Stress Testing */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              6. Macroeconomic Stress Testing
            </h3>
            <p style={{ margin: 0 }}>
              The Stress Lab applies instantaneous counterfactual shocks (e.g. rate spike, liquidity freeze, credit rout) to test balance sheet resilience.
              Stress shocks are isolated from historical covariance and trace the causal chain from asset-level impairment to portfolio P&amp;L, policy breach, and automated defensive restoration.
            </p>
          </div>

          {/* 7. Early Warning */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              7. Early Warning Engine
            </h3>
            <p style={{ margin: 0 }}>
              Continuous surveillance tracks 30-day velocity metrics: CVaR drift velocity, liquidity buffer compression, single-asset concentration proximity, and drawdown acceleration.
              This converts static compliance checks into a forward-looking early warning system.
            </p>
          </div>

          {/* 8. Liquidity Outlook */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              8. Multi-Horizon Liquidity Outlook
            </h3>
            <p style={{ margin: 0 }}>
              Capital availability is modeled across 7-day, 30-day, 90-day, and 180-day redemption horizons.
              Each tier models secondary market valuation haircuts under both baseline and stressed credit freeze scenarios, ensuring liquidity coverage ratios (LCR) remain compliant.
            </p>
          </div>

          {/* 9. Portfolio Outlook */}
          <div style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "14px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              9. Portfolio Projections & Assumptions
            </h3>
            <div style={{ padding: "8px 12px", backgroundColor: "var(--surface-alt)", borderLeft: "3px solid var(--status-warning-bd)", marginBottom: "6px" }}>
              <strong>Scenario projection — not a guaranteed forecast:</strong>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Scenario-based projection ranges derived from the available empirical return distribution and explicit assumptions.
              </div>
            </div>
            <p style={{ margin: 0 }}>
              Projections illustrate conservative, base, and favorable potential outcomes across 3M, 6M, and 12M time horizons without claiming predictive certainty.
            </p>
          </div>

          {/* 10. Limitations / Disclaimer */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
              10. Limitations & Hackathon Prototype Disclaimer
            </h3>
            <p style={{ margin: 0 }}>
              Jerifin is a technology and algorithmic demonstration platform. It does not provide certified financial, legal, or investment advice.
              All valuations, synthetic yields, and simulated stress tests should be validated against proprietary institutional books and corporate investment policy statements (IPS) before executing live market trades.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--surface-alt)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Zero Black-Box Machine Learning • 100% Mathematically Auditable
          </div>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ padding: "6px 16px" }}>
            Acknowledge & Return
          </button>
        </div>
      </div>
    </div>
  );
};

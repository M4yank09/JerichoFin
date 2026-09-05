"use client";

import React from "react";

interface MethodologyPanelProps {
  onOpenDisclaimer?: () => void;
}

export const MethodologyPanel: React.FC<MethodologyPanelProps> = ({ onOpenDisclaimer }) => {
  const steps = [
    {
      num: "01",
      title: "CAPITAL",
      tag: "Capital Pool Sizing",
      desc: "Specify and scale total institutional treasury pool (from ₹10 Cr to ₹1,000+ Cr) across Indian sovereign and credit assets. Monetary allocations scale dynamically without altering underlying percentage weights.",
    },
    {
      num: "02",
      title: "PORTFOLIO ANALYSIS",
      tag: "Deterministic Metrics",
      desc: "Calculate live expected annualized carry, empirical volatility, 95% CVaR tail risk, and weighted liquidity score across RBI settlement tiers in real time.",
    },
    {
      num: "03",
      title: "OPTIMIZATION",
      tag: "Convex Conic Solver",
      desc: "Solve a convex conic optimization problem using CVXPY and Clarabel/OSQP, maximizing expected return subject to exact Rockafellar-Uryasev CVaR and Chekhlov drawdown limits.",
    },
    {
      num: "04",
      title: "RISK SAFEGUARDS",
      tag: "Policy Governance",
      desc: "Audit holdings against institutional mandates: 15% equity ceiling, 35% single-asset cap, and 0.70 liquidity floor, continuously monitored by a 30-day early-warning velocity engine.",
    },
    {
      num: "05",
      title: "STRESS TEST",
      tag: "Causal Shock Engine",
      desc: "Simulate instantaneous counterfactual macroeconomic shocks (liquidity freeze, rate hike, credit spread rout) to quantify monetary drawdown and trigger policy breach alerts.",
    },
    {
      num: "06",
      title: "DEFENSIVE REBALANCE",
      tag: "Minimum-Turnover Recovery",
      desc: "Execute automated convex rebalancing minimizing portfolio turnover to eliminate policy breaches, restore tail-risk limits, and return the treasury to compliant NORMAL status.",
    },
  ];

  return (
    <div style={{ marginBottom: "var(--spacing-2xl)", maxWidth: "880px", margin: "0 auto var(--spacing-2xl)" }}>
      {/* Section Header */}
      <div className="section-header" style={{ textAlign: "center", display: "block", marginBottom: "32px" }}>
        <div className="section-tag" style={{ justifyContent: "center" }}>Institutional Decision Pipeline</div>
        <h2 className="section-header-title" style={{ fontSize: "24px", marginTop: "4px" }}>
          How Jerifin Works
        </h2>
        <div className="section-header-desc" style={{ maxWidth: "600px", margin: "8px auto 0" }}>
          A deterministic, six-stage workflow connecting capital sizing to convex optimization, risk governance limits, and automated policy restoration.
        </div>
      </div>

      {/* Visual Pipeline Process (CAPITAL -> ... -> DEFENSIVE REBALANCE) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {steps.map((step, index) => (
          <React.Fragment key={step.title}>
            {/* Step Card */}
            <div
              style={{
                width: "100%",
                border: "1px solid var(--border-hairline)",
                backgroundColor: "var(--surface)",
                padding: "20px 24px",
                display: "flex",
                alignItems: "flex-start",
                gap: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  color: "var(--brand-navy)",
                  minWidth: "36px",
                  paddingTop: "2px",
                }}
              >
                {step.num}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0, letterSpacing: "0.03em" }}>
                    {step.title}
                  </h3>
                  <span className="section-tag" style={{ margin: 0 }}>
                    {step.tag}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            </div>

            {/* Downward Connector Arrow (except after last step) */}
            {index < steps.length - 1 && (
              <div
                style={{
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: "18px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ↓
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Bottom CTA to open Methodology & Disclaimer Modal */}
      <div
        style={{
          marginTop: "36px",
          padding: "24px",
          border: "1px solid var(--border-hairline)",
          backgroundColor: "var(--surface-alt)",
          textAlign: "center",
          borderRadius: "2px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
          Looking for Detailed Formulations & Assumptions?
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto 16px", lineHeight: 1.5 }}>
          Explore the formal CVXPY conic optimization problem, Rockafellar-Uryasev CVaR proofs, liquidity haircut parameters, and audit notices.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenDisclaimer}
          style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 700 }}
        >
          Open Full Methodology & Disclaimer
        </button>
      </div>
    </div>
  );
};

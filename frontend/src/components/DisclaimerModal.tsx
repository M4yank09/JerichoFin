"use client";

import React from "react";

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-medium)",
          maxWidth: "680px",
          width: "100%",
          padding: "28px",
          borderRadius: "2px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <span className="section-tag">Institutional Transparency & Audit Trail</span>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
              Methodology, Data Disclaimers & Assumptions
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "4px 8px", fontSize: "12px" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ padding: "10px 14px", backgroundColor: "var(--surface-alt)", borderLeft: "3px solid var(--brand-navy)" }}>
            <strong>HACKATHON DEMONSTRATION NOTICE:</strong>
            <p style={{ marginTop: "4px" }}>
              Jerifin is an institutional treasury risk simulation platform created for algorithmic demonstration. All market returns, asset tickers, covariance matrices, and stress events are deterministic synthetic simulations. They do NOT constitute audited investment advice or real-time exchange quotes.
            </p>
          </div>

          <div>
            <strong style={{ color: "var(--text-primary)" }}>1. Deterministic Synthetic Return Engine:</strong>
            <p>
              Historical asset returns are generated via multivariate normal distributions with explicit correlation matrices (flight-to-safety sovereign bonds vs corporate credit contagion) using fixed RNG seeds (seed=42), ensuring 100% mathematical reproducibility.
            </p>
          </div>

          <div>
            <strong style={{ color: "var(--text-primary)" }}>2. CVXPY Scenario-Based Risk Formulation:</strong>
            <p>
              Portfolio optimization and CVaR calculations utilize the exact convex formulation of Rockafellar & Uryasev (2000). Maximum drawdown constraints utilize the Chekhlov, Uryasev & Zabarankin (2005) linear program formulation directly on discrete empirical return paths.
            </p>
          </div>

          <div>
            <strong style={{ color: "var(--text-primary)" }}>3. Statistical VaR vs Deterministic Stress Shocks:</strong>
            <p>
              Empirical historical VaR and CVaR are probabilistic quantile metrics derived from daily return distributions. In contrast, stress test scenarios are counterfactual, instantaneous macroeconomic shocks and are strictly isolated from the historical covariance matrix.
            </p>
          </div>

          <div>
            <strong style={{ color: "var(--text-primary)" }}>4. Dynamic Capital Scaling:</strong>
            <p>
              Monetary allocations scale strictly linearly ($A_i = w_i \times C$). Adjusting portfolio capital between ₹10 Cr and ₹1,000+ Cr updates monetary allocations without modifying underlying percentage weights.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Acknowledge & Return to Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

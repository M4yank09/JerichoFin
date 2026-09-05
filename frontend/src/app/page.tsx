"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AllocationTable } from "../components/AllocationTable";
import { CapitalSelector } from "../components/CapitalSelector";
import { DefensiveRebalance } from "../components/DefensiveRebalance";
import { DisclaimerModal } from "../components/DisclaimerModal";
import { Header } from "../components/Header";
import { MetricStrip } from "../components/MetricStrip";
import { OptimizerPanel } from "../components/OptimizerPanel";
import { PolicyAuditPanel } from "../components/PolicyAuditPanel";
import { StressWorkbench } from "../components/StressWorkbench";
import { api } from "../lib/api";
import {
  AssetItem,
  CustomScenarioInput,
  DefensiveRebalanceResponse,
  OptimizationConstraintsInput,
  OptimizationResponse,
  PortfolioAnalysisResponse,
  RiskEvaluationResponse,
  StressCompareResponse,
  StressRunResponse,
} from "../lib/types";

export default function WorkstationPage() {
  // ---------------------------------------------------------------------------
  // Core Portfolio State
  // ---------------------------------------------------------------------------
  // Default Demo Capital: ₹100 Cr (1,000,000,000)
  const [capital, setCapital] = useState<number>(1_000_000_000.0);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  // ---------------------------------------------------------------------------
  // Calculation & Engine Output States
  // ---------------------------------------------------------------------------
  const [metrics, setMetrics] = useState<PortfolioAnalysisResponse | null>(null);
  const [audit, setAudit] = useState<RiskEvaluationResponse | null>(null);
  const [lastOptimization, setLastOptimization] = useState<OptimizationResponse | null>(null);
  const [rebalanceResult, setRebalanceResult] = useState<DefensiveRebalanceResponse | null>(null);
  const [lastStressResult, setLastStressResult] = useState<StressRunResponse | null>(null);
  const [comparisonResult, setComparisonResult] = useState<StressCompareResponse | null>(null);

  // ---------------------------------------------------------------------------
  // UI & Loading States
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState<boolean>(true);
  const [optLoading, setOptLoading] = useState<boolean>(false);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [rebalLoading, setRebalLoading] = useState<boolean>(false);
  const [stressLoading, setStressLoading] = useState<boolean>(false);

  const [optError, setOptError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState<boolean>(false);

  // Active Navigation Tab
  const [activeSection, setActiveSection] = useState<"allocation" | "optimizer" | "governance" | "rebalance" | "stress">("allocation");

  // ---------------------------------------------------------------------------
  // 1. Initial Data Fetching
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setLoading(true);
        const universe = await api.getAssets();
        if (!isMounted) return;

        setAssets(universe.assets);

        // Standard institutional default weights
        const initialWeights: Record<string, number> = {
          USD_CASH: 0.20,
          US_TBILL_3M: 0.35,
          COMM_PAPER_30D: 0.20,
          US_CORP_IG: 0.15,
          STRAT_YIELD_BUF: 0.10,
        };

        setWeights(initialWeights);

        // Run baseline analytics
        const analysis = await api.analyzePortfolio({
          capital: 1_000_000_000.0,
          weights: initialWeights,
        });
        if (!isMounted) return;
        setMetrics(analysis);

        // Run baseline policy evaluation
        const riskEval = await api.evaluateRisk({
          weights: initialWeights,
          capital: 1_000_000_000.0,
        });
        if (!isMounted) return;
        setAudit(riskEval);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load institutional data.";
        setGlobalError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => { isMounted = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Re-Analyze Portfolio When Weights or Capital Change
  // ---------------------------------------------------------------------------
  const refreshAnalysis = useCallback(
    async (newCapital: number, newWeights: Record<string, number>) => {
      try {
        const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 0.001) return; // Only evaluate valid sum = 1.0

        const analysis = await api.analyzePortfolio({
          capital: newCapital,
          weights: newWeights,
        });
        setMetrics(analysis);

        const riskEval = await api.evaluateRisk({
          weights: newWeights,
          capital: newCapital,
        });
        setAudit(riskEval);
      } catch (err: unknown) {
        console.error("Refresh analysis error:", err);
      }
    },
    []
  );

  // Capital Change Handler
  const handleCapitalChange = (newCapital: number) => {
    setCapital(newCapital);
    if (Object.keys(weights).length > 0) {
      refreshAnalysis(newCapital, weights);
    }
  };

  // Weight Adjustment Handler
  const handleWeightChange = (symbol: string, newWeight: number) => {
    const updated = { ...weights, [symbol]: newWeight };
    setWeights(updated);
    refreshAnalysis(capital, updated);
  };

  // Weight Normalization Utility
  const handleNormalizeWeights = () => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum <= 0) return;
    const normalized: Record<string, number> = {};
    for (const [sym, w] of Object.entries(weights)) {
      normalized[sym] = parseFloat((w / sum).toFixed(4));
    }
    // Adjust remainder on first asset
    const newSum = Object.values(normalized).reduce((a, b) => a + b, 0);
    const diff = parseFloat((1.0 - newSum).toFixed(4));
    const firstKey = Object.keys(normalized)[0];
    if (firstKey) normalized[firstKey] = parseFloat((normalized[firstKey] + diff).toFixed(4));

    setWeights(normalized);
    refreshAnalysis(capital, normalized);
  };

  // ---------------------------------------------------------------------------
  // 3. Optimization Action
  // ---------------------------------------------------------------------------
  const handleRunOptimization = async (
    constraints: OptimizationConstraintsInput
  ): Promise<OptimizationResponse | null> => {
    try {
      setOptLoading(true);
      setOptError(null);
      const res = await api.optimizePortfolio({
        capital,
        constraints,
      });
      setLastOptimization(res);
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Optimization failed.";
      setOptError(msg);
      return null;
    } finally {
      setOptLoading(false);
    }
  };

  const handleApplyOptimizedWeights = (optWeights: Record<string, number>) => {
    setWeights(optWeights);
    refreshAnalysis(capital, optWeights);
    setActiveSection("allocation");
  };

  // ---------------------------------------------------------------------------
  // 4. Policy Re-Audit Action
  // ---------------------------------------------------------------------------
  const handleRefreshAudit = async () => {
    try {
      setAuditLoading(true);
      const res = await api.evaluateRisk({
        weights,
        capital,
      });
      setAudit(res);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Defensive Rebalance Action
  // ---------------------------------------------------------------------------
  const handleExecuteRebalance = async () => {
    try {
      setRebalLoading(true);
      const res = await api.rebalanceDefensive({
        capital,
        current_weights: weights,
      });
      setRebalanceResult(res);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setRebalLoading(false);
    }
  };

  const handleApplyDefensiveWeights = (defWeights: Record<string, number>) => {
    setWeights(defWeights);
    refreshAnalysis(capital, defWeights);
    setActiveSection("allocation");
  };

  // ---------------------------------------------------------------------------
  // 6. Stress Testing Actions
  // ---------------------------------------------------------------------------
  const handleRunSingleScenario = async (
    scenarioId: string,
    customScenario?: CustomScenarioInput
  ): Promise<StressRunResponse | null> => {
    try {
      setStressLoading(true);
      const res = await api.runStressTest({
        capital,
        weights,
        scenario_id: scenarioId || undefined,
        custom_scenario: customScenario,
        trigger_defensive_on_breach: true,
      });
      setLastStressResult(res);
      return res;
    } catch (err: unknown) {
      console.error(err);
      return null;
    } finally {
      setStressLoading(false);
    }
  };

  const handleCompareScenarios = async (): Promise<StressCompareResponse | null> => {
    try {
      setStressLoading(true);
      const res = await api.compareStressScenarios({
        capital,
        weights,
      });
      setComparisonResult(res);
      return res;
    } catch (err: unknown) {
      console.error(err);
      return null;
    } finally {
      setStressLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isBreached = audit?.overall_status === "BREACH" || audit?.overall_status === "CRITICAL";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Institutional Masthead */}
      <Header onOpenDisclaimer={() => setIsDisclaimerOpen(true)} />

      <main className="workstation-container" style={{ flex: 1 }}>
        {/* Global Connection / Data Error Notice */}
        {globalError && (
          <div className="notice-box breach" style={{ marginTop: "var(--spacing-lg)" }}>
            <div>
              <strong>Connection Warning:</strong>
              <p style={{ marginTop: "4px" }}>{globalError}</p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                Verify the backend is running with: <code>uvicorn backend.app.main:app --host 127.0.0.1 --port 8000</code>
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Capital Selector Bar */}
        <CapitalSelector capital={capital} onCapitalChange={handleCapitalChange} />

        {/* High-Density Metric Summary Strip */}
        <MetricStrip
          metrics={metrics}
          overallStatus={audit?.overall_status || "NORMAL"}
          loading={loading || auditLoading}
        />

        {/* Workstation Navigation Tabs */}
        <nav className="workstation-tabs" aria-label="Workstation Sections">
          <button
            type="button"
            className={`tab-btn ${activeSection === "allocation" ? "active" : ""}`}
            onClick={() => setActiveSection("allocation")}
          >
            1. Holdings & Universe
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "optimizer" ? "active" : ""}`}
            onClick={() => setActiveSection("optimizer")}
          >
            2. CVXPY Optimizer
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "governance" ? "active" : ""}`}
            onClick={() => setActiveSection("governance")}
          >
            3. Policy Governance {isBreached && <span style={{ color: "var(--status-breach-fg)", fontWeight: 700 }}>•</span>}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "rebalance" ? "active" : ""}`}
            onClick={() => setActiveSection("rebalance")}
          >
            4. Defensive Rebalance
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "stress" ? "active" : ""}`}
            onClick={() => setActiveSection("stress")}
          >
            5. Stress Workbench
          </button>
        </nav>

        {/* Workstation Tab Views */}
        <div style={{ marginTop: "var(--spacing-lg)" }}>
          {activeSection === "allocation" && (
            <AllocationTable
              assets={assets}
              weights={weights}
              capital={capital}
              monetaryAllocations={metrics?.monetary_allocations}
              stressedWeights={lastStressResult?.stressed_weights}
              onWeightChange={handleWeightChange}
              onNormalizeWeights={handleNormalizeWeights}
              isStressed={!!lastStressResult}
            />
          )}

          {activeSection === "optimizer" && (
            <OptimizerPanel
              capital={capital}
              onRunOptimization={handleRunOptimization}
              onApplyWeights={handleApplyOptimizedWeights}
              lastOptimization={lastOptimization}
              loading={optLoading}
              error={optError}
            />
          )}

          {activeSection === "governance" && (
            <PolicyAuditPanel
              audit={audit}
              onRefreshAudit={handleRefreshAudit}
              loading={auditLoading}
            />
          )}

          {activeSection === "rebalance" && (
            <DefensiveRebalance
              rebalanceResult={rebalanceResult}
              onExecuteRebalance={handleExecuteRebalance}
              onApplyDefensiveWeights={handleApplyDefensiveWeights}
              loading={rebalLoading}
              isBreached={isBreached}
            />
          )}

          {activeSection === "stress" && (
            <StressWorkbench
              capital={capital}
              weights={weights}
              onRunSingleScenario={handleRunSingleScenario}
              onCompareScenarios={handleCompareScenarios}
              onAdoptDefensiveWeights={handleApplyDefensiveWeights}
              lastStressResult={lastStressResult}
              comparisonResult={comparisonResult}
              loading={stressLoading}
            />
          )}
        </div>
      </main>

      {/* Methodology & Disclosure Modal */}
      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
      />

      {/* Institutional Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-hairline)",
          padding: "16px var(--spacing-lg)",
          backgroundColor: "var(--surface)",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            maxWidth: "1480px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <strong>JERIFIN</strong> — Institutional Capital Allocation & Treasury Risk Platform
          </div>
          <div>
            Deterministic Synthetic Simulations • Conic Convex Solver (CVXPY) • Rockafellar-Uryasev CVaR
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AllocationTable } from "../components/AllocationTable";
import { CapitalSelector } from "../components/CapitalSelector";
import { DefensiveRebalance } from "../components/DefensiveRebalance";
import { DisclaimerModal } from "../components/DisclaimerModal";
import { Header } from "../components/Header";
import { MethodologyPanel } from "../components/MethodologyPanel";
import { MetricStrip } from "../components/MetricStrip";
import { OptimizerPanel } from "../components/OptimizerPanel";
import { OverviewPanel } from "../components/OverviewPanel";
import { PolicyAuditPanel } from "../components/PolicyAuditPanel";
import { StressWorkbench } from "../components/StressWorkbench";
import { api } from "../lib/api";
import {
  AssetItem,
  CustomScenarioInput,
  DefensiveRebalanceResponse,
  EarlyWarningResponse,
  LiquidityOutlookResponse,
  OptimizationConstraintsInput,
  OptimizationResponse,
  PortfolioAnalysisResponse,
  PortfolioProjectionResponse,
  RiskEvaluationResponse,
  StressCompareResponse,
  StressRunResponse,
} from "../lib/types";

export default function WorkstationPage() {
  // ---------------------------------------------------------------------------
  // Core Portfolio State (Default: ₹100 Cr / 1,000,000,000 INR)
  // ---------------------------------------------------------------------------
  const [capital, setCapital] = useState<number>(1_000_000_000.0);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  // ---------------------------------------------------------------------------
  // Calculation & Forward-Looking Engine Outputs
  // ---------------------------------------------------------------------------
  const [metrics, setMetrics] = useState<PortfolioAnalysisResponse | null>(null);
  const [audit, setAudit] = useState<RiskEvaluationResponse | null>(null);
  const [earlyWarning, setEarlyWarning] = useState<EarlyWarningResponse | null>(null);
  const [liquidityOutlook, setLiquidityOutlook] = useState<LiquidityOutlookResponse | null>(null);
  const [projection, setProjection] = useState<PortfolioProjectionResponse | null>(null);

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

  // Active Navigation Tab (7 Tabs: Overview, Allocation, Optimize, Risk & Alerts, Stress Lab, Rebalance, Methodology)
  const [activeSection, setActiveSection] = useState<
    "overview" | "allocation" | "optimizer" | "governance" | "stress" | "rebalance" | "methodology"
  >("overview");

  // ---------------------------------------------------------------------------
  // 1. Initial Data Fetching (Indian Institutional Universe)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setLoading(true);
        // Fetch curated Indian institutional treasury universe
        const universe = await api.getAssets("indian");
        if (!isMounted) return;

        setAssets(universe.assets);

        // Standard Indian Institutional baseline weights (100% Healthy Demo State)
        const initialWeights: Record<string, number> = {
          INR_CASH: 0.25,      // 25% Overnight Cash & TREPS (Tier 1)
          IN_TBILL_91D: 0.25,  // 25% 91-Day T-Bills (Tier 2)
          IN_CP_90D: 0.15,     // 15% Commercial Paper (Tier 2)
          IN_CD_3M: 0.10,      // 10% Certificates of Deposit (Tier 2)
          IN_GSEC_10Y: 0.15,   // 15% 10-Year Benchmark G-Secs (Tier 3)
          IN_CORP_AAA: 0.05,   // 5% AAA Corporate Bonds (Tier 3)
          IN_GOLD: 0.05,       // 5% Sovereign Gold (Tier 3)
        };

        setWeights(initialWeights);

        // Fetch core analytics and forward-looking engines in parallel
        const [analysisRes, riskRes, ewRes, loRes, projRes] = await Promise.allSettled([
          api.analyzePortfolio({ capital: 1_000_000_000.0, weights: initialWeights }),
          api.evaluateRisk({ capital: 1_000_000_000.0, weights: initialWeights }),
          api.evaluateEarlyWarning({ capital: 1_000_000_000.0, weights: initialWeights }),
          api.evaluateLiquidityOutlook({ capital: 1_000_000_000.0, weights: initialWeights }),
          api.projectPortfolio({ capital: 1_000_000_000.0, weights: initialWeights, selected_horizon_months: 12 }),
        ]);

        if (!isMounted) return;
        if (analysisRes.status === "fulfilled") setMetrics(analysisRes.value);
        if (riskRes.status === "fulfilled") setAudit(riskRes.value);
        if (ewRes.status === "fulfilled") setEarlyWarning(ewRes.value);
        if (loRes.status === "fulfilled") setLiquidityOutlook(loRes.value);
        if (projRes.status === "fulfilled") setProjection(projRes.value);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load institutional treasury data.";
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
        if (Math.abs(sum - 1.0) > 0.001) return; // Only evaluate valid weights summing to 100%

        const [analysisRes, riskRes, ewRes, loRes, projRes] = await Promise.allSettled([
          api.analyzePortfolio({ capital: newCapital, weights: newWeights }),
          api.evaluateRisk({ capital: newCapital, weights: newWeights }),
          api.evaluateEarlyWarning({ capital: newCapital, weights: newWeights }),
          api.evaluateLiquidityOutlook({ capital: newCapital, weights: newWeights }),
          api.projectPortfolio({ capital: newCapital, weights: newWeights, selected_horizon_months: 12 }),
        ]);

        if (analysisRes.status === "fulfilled") setMetrics(analysisRes.value);
        if (riskRes.status === "fulfilled") setAudit(riskRes.value);
        if (ewRes.status === "fulfilled") setEarlyWarning(ewRes.value);
        if (loRes.status === "fulfilled") setLiquidityOutlook(loRes.value);
        if (projRes.status === "fulfilled") setProjection(projRes.value);
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
    const newSum = Object.values(normalized).reduce((a, b) => a + b, 0);
    const diff = parseFloat((1.0 - newSum).toFixed(4));
    const firstKey = Object.keys(normalized)[0];
    if (firstKey) normalized[firstKey] = parseFloat((normalized[firstKey] + diff).toFixed(4));

    setWeights(normalized);
    refreshAnalysis(capital, normalized);
  };

  // ---------------------------------------------------------------------------
  // 3. Optimization Action (CVXPY Solver)
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
        universe: "indian",
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
    setActiveSection("overview");
  };

  // ---------------------------------------------------------------------------
  // 4. Policy Re-Audit Action
  // ---------------------------------------------------------------------------
  const handleRefreshAudit = async () => {
    try {
      setAuditLoading(true);
      const [riskRes, ewRes] = await Promise.allSettled([
        api.evaluateRisk({ weights, capital }),
        api.evaluateEarlyWarning({ weights, capital }),
      ]);
      if (riskRes.status === "fulfilled") setAudit(riskRes.value);
      if (ewRes.status === "fulfilled") setEarlyWarning(ewRes.value);
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
    setActiveSection("overview");
  };

  // Interactive Demo State Simulator (Requirement 14)
  const handleSimulateState = (type: "warning" | "breach" | "reset") => {
    if (type === "warning") {
      const warningWeights: Record<string, number> = {
        INR_CASH: 0.15,
        IN_TBILL_91D: 0.32, // In warning band (>29.75%, <35%)
        IN_CP_90D: 0.15,
        IN_CD_3M: 0.10,
        IN_GSEC_10Y: 0.15,
        IN_CORP_AAA: 0.08,
        IN_GOLD: 0.05,
      };
      setWeights(warningWeights);
      refreshAnalysis(capital, warningWeights);
    } else if (type === "breach") {
      const breachWeights: Record<string, number> = {
        INR_CASH: 0.05,
        IN_TBILL_91D: 0.42, // Breaches 35% cap
        IN_CP_90D: 0.15,
        IN_CD_3M: 0.10,
        IN_GSEC_10Y: 0.15,
        IN_CORP_AAA: 0.08,
        IN_GOLD: 0.05,
      };
      setWeights(breachWeights);
      refreshAnalysis(capital, breachWeights);
    } else {
      const healthyWeights: Record<string, number> = {
        INR_CASH: 0.25,
        IN_TBILL_91D: 0.25,
        IN_CP_90D: 0.15,
        IN_CD_3M: 0.10,
        IN_GSEC_10Y: 0.15,
        IN_CORP_AAA: 0.05,
        IN_GOLD: 0.05,
      };
      setWeights(healthyWeights);
      refreshAnalysis(capital, healthyWeights);
    }
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
  // Status Indicators
  // ---------------------------------------------------------------------------
  const isBreached = audit?.overall_status === "BREACH" || audit?.overall_status === "CRITICAL";
  const hasWarning = audit?.overall_status === "WARNING" || earlyWarning?.overall_status === "WATCH" || earlyWarning?.overall_status === "ELEVATED";

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

        {/* High-Density Metric Summary Strip (for analytical tabs; Overview and Allocation have dedicated authoritative summaries) */}
        {activeSection !== "overview" && activeSection !== "allocation" && (
          <MetricStrip
            metrics={metrics}
            overallStatus={audit?.overall_status || "NORMAL"}
            loading={loading || auditLoading}
          />
        )}

        {/* Workstation Navigation Tabs: 7 Simplified Tabs */}
        <nav className="workstation-tabs" aria-label="Workstation Sections">
          <button
            type="button"
            className={`tab-btn ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "allocation" ? "active" : ""}`}
            onClick={() => setActiveSection("allocation")}
          >
            Allocation
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "optimizer" ? "active" : ""}`}
            onClick={() => setActiveSection("optimizer")}
          >
            Optimize
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "governance" ? "active" : ""}`}
            onClick={() => setActiveSection("governance")}
          >
            Risk & Alerts {isBreached ? (
              <span style={{ color: "var(--status-breach-fg)", fontWeight: 700, marginLeft: "4px" }}>•</span>
            ) : hasWarning ? (
              <span style={{ color: "var(--status-warning-fg)", fontWeight: 700, marginLeft: "4px" }}>•</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "stress" ? "active" : ""}`}
            onClick={() => setActiveSection("stress")}
          >
            Stress Lab
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "rebalance" ? "active" : ""}`}
            onClick={() => setActiveSection("rebalance")}
          >
            Rebalance {isBreached && <span style={{ color: "var(--status-breach-fg)", fontWeight: 700, marginLeft: "4px" }}>!</span>}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeSection === "methodology" ? "active" : ""}`}
            onClick={() => setActiveSection("methodology")}
          >
            Methodology
          </button>
        </nav>

        {/* Workstation Tab Content Views */}
        <div style={{ marginTop: "var(--spacing-lg)" }}>
          {/* Tab 1: Executive Overview */}
          {activeSection === "overview" && (
            <OverviewPanel
              capital={capital}
              metrics={metrics}
              audit={audit}
              earlyWarning={earlyWarning}
              liquidityOutlook={liquidityOutlook}
              projection={projection}
              assets={assets}
              weights={weights}
              onNavigateToTab={(tab) => {
                if (tab === "optimizer") setActiveSection("optimizer");
                else if (tab === "governance") setActiveSection("governance");
                else if (tab === "allocation") setActiveSection("allocation");
                else if (tab === "rebalance") setActiveSection("rebalance");
                else if (tab === "stress") setActiveSection("stress");
                else if (tab === "methodology") setActiveSection("methodology");
                else setActiveSection(tab as any);
              }}
              onSimulateState={handleSimulateState}
              loading={loading}
            />
          )}

          {/* Tab 2: Holdings & Asset Universe */}
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

          {/* Tab 3: CVXPY Optimizer */}
          {activeSection === "optimizer" && (
            <OptimizerPanel
              capital={capital}
              currentWeights={weights}
              onRunOptimization={handleRunOptimization}
              onApplyWeights={handleApplyOptimizedWeights}
              lastOptimization={lastOptimization}
              loading={optLoading}
              error={optError}
            />
          )}

          {/* Tab 4: Risk & Alerts (Policy Audit + Early Warning) */}
          {activeSection === "governance" && (
            <PolicyAuditPanel
              audit={audit}
              onRefreshAudit={handleRefreshAudit}
              loading={auditLoading}
            />
          )}

          {/* Tab 5: Stress Lab */}
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

          {/* Tab 6: Defensive Rebalance */}
          {activeSection === "rebalance" && (
            <DefensiveRebalance
              rebalanceResult={rebalanceResult}
              onExecuteRebalance={handleExecuteRebalance}
              onApplyDefensiveWeights={handleApplyDefensiveWeights}
              loading={rebalLoading}
              isBreached={isBreached}
            />
          )}

          {/* Tab 7: Quantitative Methodology */}
          {activeSection === "methodology" && (
            <MethodologyPanel onOpenDisclaimer={() => setIsDisclaimerOpen(true)} />
          )}
        </div>
      </main>

      {/* Methodology & Disclosure Modal */}
      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
      />

      {/* Minimal Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-hairline)",
          padding: "14px var(--spacing-lg)",
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
            GitHub:{" "}
            <a
              href="https://github.com/M4yank09/JerichoFin"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                textDecoration: "underline",
                fontFamily: "var(--font-mono)",
              }}
            >
              https://github.com/M4yank09/JerichoFin
            </a>
          </div>
          <div>made with ♥ by Team Jericho</div>
        </div>
      </footer>
    </div>
  );
}

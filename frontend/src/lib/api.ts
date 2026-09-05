/**
 * Jerifin FastAPI Backend API Client.
 * Connects the Next.js institutional workstation to the Python quantitative engine.
 */

import {
  AssetUniverseResponse,
  DefensiveRebalanceRequest,
  DefensiveRebalanceResponse,
  OptimizationRequest,
  OptimizationResponse,
  PortfolioAnalysisRequest,
  PortfolioAnalysisResponse,
  RiskEvaluationRequest,
  RiskEvaluationResponse,
  StressCompareRequest,
  StressCompareResponse,
  StressRunRequest,
  StressRunResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  code: number;
  errorType: string;

  constructor(message: string, code: number, errorType = "ApiError") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.errorType = errorType;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        data?.detail || data?.message || data?.error || `HTTP error ${response.status}`;
      throw new ApiError(errorMsg, response.status, data?.error || "HttpError");
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message =
      err instanceof Error ? err.message : "Failed to connect to Jerifin backend engine.";
    throw new ApiError(message, 0, "NetworkError");
  }
}

export const api = {
  /**
   * Health probe
   */
  async checkHealth(): Promise<{ status: string; service: string; version: string }> {
    return request<{ status: string; service: string; version: string }>("/health");
  },

  /**
   * Fetch demo institutional asset universe
   */
  async getAssets(universe?: string): Promise<AssetUniverseResponse> {
    const query = universe ? `?universe=${encodeURIComponent(universe)}` : "";
    return request<AssetUniverseResponse>(`/api/v1/portfolio/assets${query}`);
  },

  /**
   * Analyze portfolio risk, return, VaR, CVaR, drawdown, and liquidity
   */
  async analyzePortfolio(req: PortfolioAnalysisRequest): Promise<PortfolioAnalysisResponse> {
    return request<PortfolioAnalysisResponse>("/api/v1/portfolio/analyze", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Run CVXPY constrained portfolio optimization
   */
  async optimizePortfolio(req: OptimizationRequest): Promise<OptimizationResponse> {
    return request<OptimizationResponse>("/api/v1/optimize", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Evaluate portfolio against institutional risk governance policy rules
   */
  async evaluateRisk(req: RiskEvaluationRequest): Promise<RiskEvaluationResponse> {
    return request<RiskEvaluationResponse>("/api/v1/risk/evaluate", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Evaluate forward-looking Early Warning signals and 30-day timeline
   */
  async evaluateEarlyWarning(req: {
    capital: number;
    weights: Record<string, number>;
    policy?: unknown;
  }): Promise<import("./types").EarlyWarningResponse> {
    return request<import("./types").EarlyWarningResponse>("/api/v1/risk/early-warning", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Simulate multi-horizon liquidity coverage (7D, 30D, 90D, 180D)
   */
  async evaluateLiquidityOutlook(req: {
    capital: number;
    weights: Record<string, number>;
    selected_horizon_days?: number;
    policy?: unknown;
  }): Promise<import("./types").LiquidityOutlookResponse> {
    return request<import("./types").LiquidityOutlookResponse>("/api/v1/risk/liquidity-outlook", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Generate scenario-based future portfolio projection ranges
   */
  async projectPortfolio(req: {
    capital: number;
    weights: Record<string, number>;
    selected_horizon_months?: number;
  }): Promise<import("./types").PortfolioProjectionResponse> {
    return request<import("./types").PortfolioProjectionResponse>("/api/v1/portfolio/projection", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Execute defensive rebalancing to restore policy compliance
   */
  async rebalanceDefensive(req: DefensiveRebalanceRequest): Promise<DefensiveRebalanceResponse> {
    return request<DefensiveRebalanceResponse>("/api/v1/risk/rebalance", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * List predefined stress scenarios
   */
  async getStressScenarios(): Promise<Record<string, {
    scenario_id: string;
    name: string;
    description: string;
    severity: string;
    assumptions: string;
    asset_class_shocks: Record<string, number>;
  }>> {
    return request<Record<string, {
      scenario_id: string;
      name: string;
      description: string;
      severity: string;
      assumptions: string;
      asset_class_shocks: Record<string, number>;
    }>>("/api/v1/stress/scenarios");
  },

  /**
   * Run single stress scenario
   */
  async runStressTest(req: StressRunRequest): Promise<StressRunResponse> {
    return request<StressRunResponse>("/api/v1/stress/run", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Run comparative multi-scenario matrix
   */
  async compareStressScenarios(req: StressCompareRequest): Promise<StressCompareResponse> {
    return request<StressCompareResponse>("/api/v1/stress/compare", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};

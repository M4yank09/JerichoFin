/**
 * Financial and institutional numeral formatters for Jerifin.
 * Adheres strictly to institutional treasury conventions and tabular numeral alignment.
 */

/**
 * Formats a monetary value in Indian Rupees (INR) with Crores (Cr) / Lakhs (L) shorthand
 * or full locale formatting.
 */
export function formatCurrencyINR(amount: number, compact = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "₹0.00";

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 10_000_000) {
      // 1 Crore = 10,000,000
      const cr = absAmount / 10_000_000;
      const formatted = cr >= 100 ? cr.toFixed(1) : cr.toFixed(2);
      return `${isNegative ? "-" : ""}₹${formatted} Cr`;
    }
    if (absAmount >= 100_000) {
      // 1 Lakh = 100,000
      const l = absAmount / 100_000;
      return `${isNegative ? "-" : ""}₹${l.toFixed(2)} L`;
    }
    return `${isNegative ? "-" : ""}₹${absAmount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${isNegative ? "-" : ""}₹${absAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a decimal as a percentage (e.g. 0.054 -> "5.40%").
 */
export function formatPercent(value: number, includeSign = false, decimals = 2): string {
  if (isNaN(value) || value === null || value === undefined) return "0.00%";
  const pct = value * 100;
  const sign = includeSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Formats a decimal as basis points (e.g. 0.015 -> "+150 bps").
 */
export function formatBasisPoints(value: number, includeSign = true): string {
  if (isNaN(value) || value === null || value === undefined) return "0 bps";
  const bps = Math.round(value * 10000);
  const sign = includeSign && bps > 0 ? "+" : "";
  return `${sign}${bps.toLocaleString()} bps`;
}

/**
 * Formats Macaulay/Modified duration in years.
 */
export function formatDuration(years: number): string {
  if (isNaN(years) || years === null || years === undefined) return "0.00 yrs";
  return `${years.toFixed(2)} yrs`;
}

/**
 * Formats raw float to fixed decimals with tabular spacing.
 */
export function formatDecimal(val: number, decimals = 2): string {
  if (isNaN(val) || val === null || val === undefined) return "0.00";
  return val.toFixed(decimals);
}

/**
 * Resolves semantic badge style tokens for risk governance states.
 */
export function getRiskStatusMeta(status: string): {
  label: string;
  badgeClass: string;
  color: string;
} {
  switch (status?.toUpperCase()) {
    case "NORMAL":
      return {
        label: "NORMAL",
        badgeClass: "badge-status-normal",
        color: "var(--status-normal-text)",
      };
    case "WARNING":
      return {
        label: "WARNING",
        badgeClass: "badge-status-warning",
        color: "var(--status-warning-text)",
      };
    case "BREACH":
      return {
        label: "BREACH",
        badgeClass: "badge-status-breach",
        color: "var(--status-breach-text)",
      };
    case "CRITICAL":
      return {
        label: "CRITICAL",
        badgeClass: "badge-status-critical",
        color: "var(--status-critical-text)",
      };
    default:
      return {
        label: status || "UNKNOWN",
        badgeClass: "badge-status-normal",
        color: "var(--text-secondary)",
      };
  }
}

export const FRIENDLY_ASSET_NAMES: Record<string, string> = {
  INR_CASH: "Overnight Cash & TREPS",
  IN_TBILL_91D: "91-Day Treasury Bills",
  IN_GSEC_10Y: "10-Year Benchmark G-Secs",
  IN_SDL_10Y: "State Development Loans",
  IN_CP_90D: "90-Day Commercial Paper",
  IN_CD_3M: "3-Month Certificates of Deposit",
  IN_CORP_AAA: "AAA Corporate Bonds",
  IN_GOLD: "Sovereign Gold Reserves",
  IN_EQUITY_LARGE: "Large-Cap Equity",
  USD_CASH: "USD Overnight Cash",
  US_TBILL_3M: "3-Month US Treasury Bills",
  COMM_PAPER_30D: "30-Day Commercial Paper",
  US_CORP_IG: "US Corporate Investment Grade",
  STRAT_YIELD_BUF: "Strategic Yield Buffer",
};

export function getAssetDisplayName(symbol: string): string {
  return FRIENDLY_ASSET_NAMES[symbol] || symbol.replace(/_/g, " ");
}

export function getTreasuryStatusLabel(status: string): {
  label: "HEALTHY" | "WATCH" | "AT RISK" | "CRITICAL";
  badgeClass: string;
  explanation: string;
} {
  switch (status?.toUpperCase()) {
    case "NORMAL":
    case "STABLE":
    case "HEALTHY":
      return {
        label: "HEALTHY",
        badgeClass: "badge-status-normal",
        explanation: "Everything is within policy.",
      };
    case "WARNING":
    case "WATCH":
      return {
        label: "WATCH",
        badgeClass: "badge-status-warning",
        explanation: "One or more areas need monitoring.",
      };
    case "BREACH":
    case "ELEVATED":
      return {
        label: "AT RISK",
        badgeClass: "badge-status-breach",
        explanation: "A policy limit has been breached.",
      };
    case "CRITICAL":
    case "DEFENSIVE":
      return {
        label: "AT RISK",
        badgeClass: "badge-status-critical",
        explanation: "A policy limit has been breached.",
      };
    default:
      return {
        label: "HEALTHY",
        badgeClass: "badge-status-normal",
        explanation: "Everything is within policy.",
      };
  }
}

export function formatMultiple(val: number, decimals = 2): string {
  if (isNaN(val) || val === null || val === undefined) return "1.00x";
  return `${val.toFixed(decimals)}x`;
}

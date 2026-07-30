import { EmployeeBand, RevenueBand } from "@/generated/prisma/enums";

/**
 * Tier is derived, never entered by hand.
 *
 *   Tier  Employees   Revenue        Label
 *   1     1–49        < $10M         Small
 *   2     50–249      $10M–$50M      Mid-Market
 *   3     250–999     $50M–$1B       Enterprise
 *   4     1,000+      $1B+           Strategic / Global Enterprise
 *
 * Rules:
 *  - Employee count and revenue are evaluated independently; the HIGHER of the
 *    two wins (favour the larger classification).
 *  - Exact revenue takes precedence over the revenue band when both are present.
 *  - Whichever signal is available is used; tier is null only when neither is.
 *  - Revenue boundaries are inclusive at the lower edge: exactly $10M is Tier 2,
 *    exactly $50M is Tier 3, exactly $1B is Tier 4.
 */

export type Tier = 1 | 2 | 3 | 4;

export const TIER_LABELS: Record<Tier, string> = {
  1: "Small",
  2: "Mid-Market",
  3: "Enterprise",
  4: "Strategic / Global Enterprise",
};

/** Short form for dense UI (table cells, badges). */
export const TIER_SHORT_LABELS: Record<Tier, string> = {
  1: "Small",
  2: "Mid-Market",
  3: "Enterprise",
  4: "Strategic",
};

export const REVENUE_THRESHOLDS = {
  TIER_2: 10_000_000,
  TIER_3: 50_000_000,
  TIER_4: 1_000_000_000,
} as const;

const EMPLOYEE_BAND_TIER: Record<EmployeeBand, Tier> = {
  [EmployeeBand.SIZE_1_49]: 1,
  [EmployeeBand.SIZE_50_249]: 2,
  [EmployeeBand.SIZE_250_999]: 3,
  [EmployeeBand.SIZE_1000_PLUS]: 4,
};

const REVENUE_BAND_TIER: Record<RevenueBand, Tier> = {
  [RevenueBand.UNDER_10M]: 1,
  [RevenueBand.FROM_10M_TO_50M]: 2,
  [RevenueBand.FROM_50M_TO_1B]: 3,
  [RevenueBand.OVER_1B]: 4,
};

export interface TierInputs {
  employeeBand?: EmployeeBand | null;
  /** Exact annual revenue in whole currency units. Wins over the band. */
  annualRevenueExact?: number | string | null;
  annualRevenueBand?: RevenueBand | null;
}

export function tierFromEmployeeBand(band: EmployeeBand | null | undefined): Tier | null {
  if (!band) return null;
  return EMPLOYEE_BAND_TIER[band] ?? null;
}

export function tierFromExactRevenue(revenue: number): Tier | null {
  if (!Number.isFinite(revenue) || revenue < 0) return null;
  if (revenue >= REVENUE_THRESHOLDS.TIER_4) return 4;
  if (revenue >= REVENUE_THRESHOLDS.TIER_3) return 3;
  if (revenue >= REVENUE_THRESHOLDS.TIER_2) return 2;
  return 1;
}

/**
 * Resolves the revenue signal to a tier, honouring "exact takes precedence".
 * A malformed or negative exact value falls back to the band rather than
 * discarding the revenue signal entirely.
 */
export function tierFromRevenue(
  exact: number | string | null | undefined,
  band: RevenueBand | null | undefined,
): Tier | null {
  if (exact !== null && exact !== undefined && exact !== "") {
    const parsed = typeof exact === "number" ? exact : Number(exact);
    const fromExact = tierFromExactRevenue(parsed);
    if (fromExact !== null) return fromExact;
  }
  if (!band) return null;
  return REVENUE_BAND_TIER[band] ?? null;
}

/** The one place tier is decided. Pure — no I/O, no clock, no DB. */
export function calculateTier(inputs: TierInputs): Tier | null {
  const byEmployees = tierFromEmployeeBand(inputs.employeeBand);
  const byRevenue = tierFromRevenue(inputs.annualRevenueExact, inputs.annualRevenueBand);

  if (byEmployees === null && byRevenue === null) return null;
  return Math.max(byEmployees ?? 0, byRevenue ?? 0) as Tier;
}

export function tierLabel(tier: number | null | undefined): string {
  if (tier === null || tier === undefined) return "Unclassified";
  return TIER_LABELS[tier as Tier] ?? "Unclassified";
}

export function tierShortLabel(tier: number | null | undefined): string {
  if (tier === null || tier === undefined) return "Unclassified";
  return TIER_SHORT_LABELS[tier as Tier] ?? "Unclassified";
}

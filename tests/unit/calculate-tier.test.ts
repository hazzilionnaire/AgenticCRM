import { describe, expect, it } from "vitest";
import { EmployeeBand, RevenueBand } from "@/generated/prisma/enums";
import {
  calculateTier,
  tierFromEmployeeBand,
  tierFromExactRevenue,
  tierFromRevenue,
  tierLabel,
} from "@/server/tiering/calculate-tier";

describe("tierFromEmployeeBand", () => {
  it("maps each band to its tier", () => {
    expect(tierFromEmployeeBand(EmployeeBand.SIZE_1_49)).toBe(1);
    expect(tierFromEmployeeBand(EmployeeBand.SIZE_50_249)).toBe(2);
    expect(tierFromEmployeeBand(EmployeeBand.SIZE_250_999)).toBe(3);
    expect(tierFromEmployeeBand(EmployeeBand.SIZE_1000_PLUS)).toBe(4);
  });

  it("returns null when there is no band", () => {
    expect(tierFromEmployeeBand(null)).toBeNull();
    expect(tierFromEmployeeBand(undefined)).toBeNull();
  });
});

describe("tierFromExactRevenue", () => {
  it("classifies revenue within each range", () => {
    expect(tierFromExactRevenue(0)).toBe(1);
    expect(tierFromExactRevenue(9_999_999)).toBe(1);
    expect(tierFromExactRevenue(25_000_000)).toBe(2);
    expect(tierFromExactRevenue(700_000_000)).toBe(3);
    expect(tierFromExactRevenue(5_000_000_000)).toBe(4);
  });

  it("treats each boundary as inclusive at the lower edge", () => {
    expect(tierFromExactRevenue(10_000_000)).toBe(2);
    expect(tierFromExactRevenue(50_000_000)).toBe(3);
    expect(tierFromExactRevenue(1_000_000_000)).toBe(4);
  });

  it("rejects negative and non-finite values", () => {
    expect(tierFromExactRevenue(-1)).toBeNull();
    expect(tierFromExactRevenue(Number.NaN)).toBeNull();
    expect(tierFromExactRevenue(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("tierFromRevenue", () => {
  it("prefers the exact value over the band", () => {
    // Band says Tier 1, exact says Tier 4 — exact wins.
    expect(tierFromRevenue(2_000_000_000, RevenueBand.UNDER_10M)).toBe(4);
  });

  it("accepts an exact value as a string, as Prisma Decimal serializes it", () => {
    expect(tierFromRevenue("82000000.00", null)).toBe(3);
  });

  it("falls back to the band when the exact value is absent or unusable", () => {
    expect(tierFromRevenue(null, RevenueBand.FROM_50M_TO_1B)).toBe(3);
    expect(tierFromRevenue("", RevenueBand.FROM_10M_TO_50M)).toBe(2);
    expect(tierFromRevenue("not a number", RevenueBand.OVER_1B)).toBe(4);
    expect(tierFromRevenue(-5, RevenueBand.UNDER_10M)).toBe(1);
  });

  it("returns null when neither signal is present", () => {
    expect(tierFromRevenue(null, null)).toBeNull();
  });
});

describe("calculateTier", () => {
  it("agrees with the spec when both signals point at the same tier", () => {
    const cases: [EmployeeBand, RevenueBand, number][] = [
      [EmployeeBand.SIZE_1_49, RevenueBand.UNDER_10M, 1],
      [EmployeeBand.SIZE_50_249, RevenueBand.FROM_10M_TO_50M, 2],
      [EmployeeBand.SIZE_250_999, RevenueBand.FROM_50M_TO_1B, 3],
      [EmployeeBand.SIZE_1000_PLUS, RevenueBand.OVER_1B, 4],
    ];
    for (const [employeeBand, annualRevenueBand, expected] of cases) {
      expect(calculateTier({ employeeBand, annualRevenueBand })).toBe(expected);
    }
  });

  it("takes the higher tier when the signals disagree", () => {
    // Small headcount, enormous revenue — a PE fund or trading desk.
    expect(
      calculateTier({
        employeeBand: EmployeeBand.SIZE_50_249,
        annualRevenueExact: 2_100_000_000,
      }),
    ).toBe(4);

    // Large headcount, small revenue — a school trust or nonprofit.
    expect(
      calculateTier({
        employeeBand: EmployeeBand.SIZE_250_999,
        annualRevenueBand: RevenueBand.UNDER_10M,
      }),
    ).toBe(3);
  });

  it("is symmetric — argument order can't change the result", () => {
    const a = calculateTier({
      employeeBand: EmployeeBand.SIZE_1_49,
      annualRevenueBand: RevenueBand.OVER_1B,
    });
    const b = calculateTier({
      employeeBand: EmployeeBand.SIZE_1000_PLUS,
      annualRevenueBand: RevenueBand.UNDER_10M,
    });
    expect(a).toBe(4);
    expect(b).toBe(4);
  });

  it("uses whichever single signal is available", () => {
    expect(calculateTier({ employeeBand: EmployeeBand.SIZE_250_999 })).toBe(3);
    expect(calculateTier({ annualRevenueExact: 15_000_000 })).toBe(2);
    expect(calculateTier({ annualRevenueBand: RevenueBand.OVER_1B })).toBe(4);
  });

  it("returns null only when no size signal exists at all", () => {
    expect(calculateTier({})).toBeNull();
    expect(
      calculateTier({
        employeeBand: null,
        annualRevenueExact: null,
        annualRevenueBand: null,
      }),
    ).toBeNull();
  });

  it("never returns a tier outside 1–4", () => {
    const bands = [null, ...Object.values(EmployeeBand)];
    const revenues = [null, ...Object.values(RevenueBand)];
    for (const employeeBand of bands) {
      for (const annualRevenueBand of revenues) {
        const tier = calculateTier({ employeeBand, annualRevenueBand });
        if (tier !== null) expect([1, 2, 3, 4]).toContain(tier);
      }
    }
  });
});

describe("tierLabel", () => {
  it("uses the labels from the spec", () => {
    expect(tierLabel(1)).toBe("Small");
    expect(tierLabel(2)).toBe("Mid-Market");
    expect(tierLabel(3)).toBe("Enterprise");
    expect(tierLabel(4)).toBe("Strategic / Global Enterprise");
    expect(tierLabel(null)).toBe("Unclassified");
  });
});

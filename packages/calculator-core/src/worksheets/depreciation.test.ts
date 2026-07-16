import { describe, it, expect } from 'vitest';
import {
  depreciate,
  depreciationSchedule,
  firstYearFraction,
  lastYear,
  nextYear,
  clearWork,
  nextMethod,
  availableMethods,
  DEPRECIATION_DEFAULTS,
  METHOD_CYCLE,
  type DepreciationState,
} from './depreciation.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const dep = (o: Partial<DepreciationState>): DepreciationState => ({ ...DEPRECIATION_DEFAULTS, ...o });
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

const threw = (fn: () => unknown): CalculatorError => {
  try {
    fn();
  } catch (e) {
    return e as CalculatorError;
  }
  return expect.unreachable('should have thrown') as never;
};

/**
 * The p. 58 example: a commercial building, 31.5-year life, no salvage, cost
 * $1,000,000, straight-line, depreciation beginning in mid-March. Every golden
 * case is contingent on DEC = 2.
 */
const BUILDING = dep({ method: 'SL', LIF: 31.5, M01: 3.5, CST: 1_000_000, SAL: 0, YR: 1 });

describe('guidebook worked example, straight-line (p. 58)', () => {
  it('opens showing the default method SL', () => {
    expect(DEPRECIATION_DEFAULTS.method).toBe('SL');
  });

  it('holds the entered values as displayed', () => {
    expect(shown(BUILDING.LIF)).toBe('31.50');
    expect(shown(BUILDING.M01)).toBe('3.50');
    expect(shown(BUILDING.CST)).toBe('1,000,000.00');
    expect(shown(BUILDING.SAL)).toBe('0.00');
    expect(shown(BUILDING.YR)).toBe('1.00');
  });

  it('leaves SAL and YR at their p. 56 defaults when scrolled past', () => {
    expect(shown(DEPRECIATION_DEFAULTS.SAL)).toBe('0.00');
    expect(shown(DEPRECIATION_DEFAULTS.YR)).toBe('1.00');
  });

  it('year 1: DEP, RBV and RDV', () => {
    const r = depreciate(BUILDING, 2);
    expect(shown(r.DEP)).toBe('25,132.28');
    expect(shown(r.RBV)).toBe('974,867.72');
    expect(shown(r.RDV)).toBe('974,867.72');
  });

  it('year 2: DEP, RBV and RDV', () => {
    const r = depreciate({ ...BUILDING, YR: 2 }, 2);
    expect(shown(r.DEP)).toBe('31,746.03');
    expect(shown(r.RBV)).toBe('943,121.69');
    expect(shown(r.RDV)).toBe('943,121.69');
  });

  it('year 1 is unsigned -- depreciation carries no cash-flow sign convention', () => {
    expect(depreciate(BUILDING, 2).DEP).toBeGreaterThan(0);
  });
});

describe('advancing YR (p. 57 prose vs p. 58 example)', () => {
  // The example prints [2nd] [ENTER]; the prose says CPT. Both reach YR = 2, and
  // both spellings route to nextYear -- the discrepancy is in the key column only.
  it('increments YR by one, whichever key the guidebook meant', () => {
    const y2 = nextYear(BUILDING);
    expect(shown(y2.YR)).toBe('2.00');
    expect(shown(nextYear(y2).YR)).toBe('3.00');
  });

  it('wrapping from RDV back to YR leaves the year untouched', () => {
    // The example prints YR = 1.00 on arriving back at the YR line, before CPT.
    expect(shown(BUILDING.YR)).toBe('1.00');
  });

  it('reaches the example year-2 figures through nextYear', () => {
    const r = depreciate(nextYear(BUILDING), 2);
    expect(shown(r.DEP)).toBe('31,746.03');
    expect(shown(r.RBV)).toBe('943,121.69');
  });
});

describe('FSTYR, reconstructed as (13 - M01) / 12', () => {
  it('matches the p. 58 example', () => {
    expect(firstYearFraction(BUILDING)).toBeCloseTo(9.5 / 12, 12);
  });

  it('is a full year when the asset is placed in service on 1 January', () => {
    expect(firstYearFraction(dep({ M01: 1 }))).toBe(1);
  });

  it('reads M01 = 1.5 as "half of January elapsed" (p. 56)', () => {
    expect(firstYearFraction(dep({ M01: 1.5 }))).toBeCloseTo(11.5 / 12, 12);
  });

  it('reads M01 = 4.25 as "a quarter into April" (p. 56)', () => {
    expect(firstYearFraction(dep({ M01: 4.25 }))).toBeCloseTo(8.75 / 12, 12);
  });
});

describe('rounding to the display setting is load-bearing (p. 9, p. 56, p. 78)', () => {
  it('changes the result when DEC changes', () => {
    expect(depreciate(BUILDING, 2).DEP).not.toBe(depreciate(BUILDING, 5).DEP);
  });

  it('rounds to whole units at DEC = 0', () => {
    const r = depreciate(BUILDING, 0);
    expect(Number.isInteger(r.DEP)).toBe(true);
    expect(Number.isInteger(r.RBV)).toBe(true);
  });

  it('reports year 2 RBV as the guidebook does', () => {
    // 1,000,000 - 25,132.28 - 31,746.03 = 943,121.69.
    //
    // NOTE: this does NOT prove charges are accumulated rounded rather than
    // exact. The two readings differ here only at the 3rd decimal (943,121.6900
    // vs 943,121.6931), and depreciation rounds every result to the display
    // setting, which collapses both to the same cent. See the year-7 test below
    // for where they actually part company.
    const r = depreciate({ ...BUILDING, YR: 2 }, 2);
    expect(r.RBV).toBe(1_000_000 - (25_132.28 + 31_746.03));
  });

  it('accumulates ROUNDED yearly charges -- but this reading is UNVERIFIED', () => {
    // The rounded and exact readings first disagree at year 7:
    //   accumulate rounded charges -> 784,391.54
    //   accumulate exact charges   -> 784,391.53
    //
    // We accumulate rounded, which is the natural reading of the rule that
    // depreciation results round to the displayed decimal places (pp. 9, 56, 78).
    // But the guidebook's only worked example stops at year 2, where both
    // readings agree to the cent -- so nothing in the source settles this.
    //
    // This assertion pins current behaviour so a change is deliberate rather
    // than accidental. It is NOT evidence of parity: only a physical BA II Plus
    // can decide it. Tracked in docs/OPEN-QUESTIONS.md.
    const r = depreciate({ ...BUILDING, YR: 7 }, 2);
    expect(r.RBV).toBe(784_391.54);
  });

  it('leaves the arithmetic unrounded under floating decimal (DEC = 9)', () => {
    const r = depreciate(BUILDING, 9);
    expect(r.DEP).toBeCloseTo((1_000_000 / 31.5) * (9.5 / 12), 6);
  });
});

describe('schedule termination at RDV = 0 (p. 57)', () => {
  it('runs one calendar year past LIF when M01 is fractional', () => {
    // 31.5-year life starting mid-March spans 32 calendar years.
    expect(lastYear(BUILDING)).toBe(32);
    expect(depreciationSchedule(BUILDING, 2)).toHaveLength(32);
  });

  it('runs exactly LIF years when the asset starts on 1 January', () => {
    expect(lastYear(dep({ LIF: 5, M01: 1 }))).toBe(5);
  });

  it('drives RDV to exactly zero and RBV to SAL', () => {
    const rows = depreciationSchedule(BUILDING, 2);
    const final = rows[rows.length - 1]!;
    expect(final.RDV).toBe(0);
    expect(final.RBV).toBe(0);
  });

  it('depreciates the full cost less salvage across the schedule', () => {
    const s = dep({ method: 'SL', LIF: 10, M01: 1, CST: 50_000, SAL: 5_000 });
    const rows = depreciationSchedule(s, 2);
    const total = rows.reduce((a, r) => a + r.DEP, 0);
    expect(shown(total)).toBe('45,000.00');
    expect(rows[rows.length - 1]!.RBV).toBe(5_000);
  });

  it('yields nothing past the last year', () => {
    const r = depreciate({ ...BUILDING, YR: 40 }, 2);
    expect(r.DEP).toBe(0);
    expect(r.RDV).toBe(0);
  });

  it('stops at the first year RDV reaches zero, not at the last calendar year', () => {
    // p. 57: "The schedule is complete when RDV equals zero." Under DB the p. 79
    // clamps can exhaust RDV years before lastYear(): here the first-year "unless
    // (CST x DB%)/(LIF x 100) > RDV, then use RDV x FSTYR" clause dumps the whole
    // depreciable value in year 1, so the schedule is one row -- not five rows with
    // four DEP = 0 tails.
    const s = dep({ method: 'DB', LIF: 5, M01: 1, CST: 10_000, SAL: 5_000, dbPercent: 400 });
    expect(lastYear(s)).toBe(5);
    const rows = depreciationSchedule(s, 2);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.DEP).toBe(5_000);
    expect(rows[0]!.RDV).toBe(0);
  });

  it('still answers for a YR past the end of a schedule that ended early', () => {
    // Truncating the schedule must not truncate depreciate(): "last year or more:
    // DEP = RDV" (p. 79) is a valid query for any YR the user keys.
    const s = dep({ method: 'DB', LIF: 5, M01: 1, CST: 10_000, SAL: 5_000, dbPercent: 400, YR: 4 });
    const r = depreciate(s, 2);
    expect(r.DEP).toBe(0);
    expect(r.RDV).toBe(0);
    expect(r.RBV).toBe(5_000);
  });

  it('collapses to a single year when the life expires inside its own first year', () => {
    // LIF = 0.5 starting mid-March: 0.5 years of service fits in the 0.79 years
    // left in the calendar year, so the whole depreciable value falls in year 1.
    const s = dep({ method: 'SL', LIF: 0.5, M01: 3.5, CST: 1_000, SAL: 0 });
    expect(lastYear(s)).toBe(1);
    expect(shown(depreciate(s, 2).DEP)).toBe('1,000.00');
  });
});

describe('RBV is not RDV -- the inference the example cannot settle', () => {
  it('coincides with RDV only because the p. 58 example has SAL = 0', () => {
    const r = depreciate(BUILDING, 2);
    expect(r.RBV).toBe(r.RDV);
  });

  it('separates by exactly SAL once salvage is non-zero', () => {
    const s = dep({ method: 'SL', LIF: 10, M01: 1, CST: 50_000, SAL: 5_000, YR: 1 });
    const r = depreciate(s, 2);
    // RBV = CST - accum (inferred); RDV = CST - SAL - accum (p. 78).
    expect(shown(r.DEP)).toBe('4,500.00');
    expect(shown(r.RBV)).toBe('45,500.00');
    expect(shown(r.RDV)).toBe('40,500.00');
    expect(r.RBV - r.RDV).toBe(5_000);
  });
});

describe('straight-line (p. 79)', () => {
  it('charges a flat rate in every full year', () => {
    const s = dep({ method: 'SL', LIF: 4, M01: 1, CST: 10_000, SAL: 2_000 });
    const rows = depreciationSchedule(s, 2);
    expect(rows.map((r) => r.DEP)).toEqual([2_000, 2_000, 2_000, 2_000]);
  });

  it('pro-rates the first year by FSTYR and the last by the remainder', () => {
    const s = dep({ method: 'SL', LIF: 4, M01: 7, CST: 10_000, SAL: 0 });
    const rows = depreciationSchedule(s, 2);
    expect(rows).toHaveLength(5);
    expect(shown(rows[0]!.DEP)).toBe('1,250.00'); // 2500 x 6/12
    expect(shown(rows[1]!.DEP)).toBe('2,500.00');
    expect(shown(rows[4]!.DEP)).toBe('1,250.00'); // the stub year
  });
});

describe('sum-of-the-years’-digits (p. 79)', () => {
  it('reproduces the classic LIF..1 over sum schedule with a full first year', () => {
    const s = dep({ method: 'SYD', LIF: 3, M01: 1, CST: 6_000, SAL: 0 });
    const rows = depreciationSchedule(s, 2);
    // digits = 6; charges are 3/6, 2/6, 1/6 of 6,000.
    expect(rows.map((r) => r.DEP)).toEqual([3_000, 2_000, 1_000]);
  });

  it('the general form at YR = 1, FSTYR = 1 equals the printed first-year form', () => {
    // This self-consistency is what settles the unbalanced parentheses on p. 79.
    const s = dep({ method: 'SYD', LIF: 5, M01: 1, CST: 15_000, SAL: 0 });
    const rows = depreciationSchedule(s, 2);
    expect(rows[0]!.DEP).toBe((5 * 15_000) / ((5 * 6) / 2));
  });

  it('shifts every year when the first year is partial, and still sums to CST - SAL', () => {
    const s = dep({ method: 'SYD', LIF: 3, M01: 3.5, CST: 6_000, SAL: 0 });
    const rows = depreciationSchedule(s, 2);
    expect(rows).toHaveLength(4);
    expect(shown(rows.reduce((a, r) => a + r.DEP, 0))).toBe('6,000.00');
  });

  it('accepts a fractional LIF, which p. 56 forbids but p. 84 names no error for', () => {
    const s = dep({ method: 'SYD', LIF: 3.5, M01: 1, CST: 6_000, SAL: 0 });
    expect(() => depreciate(s, 2)).not.toThrow();
  });
});

describe('declining balance (p. 79)', () => {
  it('reproduces a 5-year 200% schedule, dumping the remainder in the last year', () => {
    const s = dep({ method: 'DB', LIF: 5, M01: 1, CST: 100_000, SAL: 0, dbPercent: 200 });
    const rows = depreciationSchedule(s, 2);
    expect(rows.map((r) => r.DEP)).toEqual([40_000, 24_000, 14_400, 8_640, 12_960]);
    expect(rows[rows.length - 1]!.RDV).toBe(0);
  });

  it('takes the charge on RBV for YR - 1, so year 1 uses CST', () => {
    const s = dep({ method: 'DB', LIF: 5, M01: 1, CST: 100_000, SAL: 0, dbPercent: 150 });
    const rows = depreciationSchedule(s, 2);
    expect(rows[0]!.DEP).toBe((100_000 * 150) / (5 * 100));
    expect(rows[1]!.DEP).toBe((rows[0]!.RBV * 150) / (5 * 100));
  });

  it('honours the printed "unless ... then use RDV x FSTYR" clause', () => {
    // DB% large enough that the full-year charge exceeds the depreciable value.
    const s = dep({ method: 'DB', LIF: 2, M01: 7, CST: 10_000, SAL: 2_000, dbPercent: 400 });
    // (CST x 400)/(2 x 100) = 20,000 > RDV = 8,000, so year 1 = 8,000 x 0.5.
    expect(shown(depreciationSchedule(s, 2)[0]!.DEP)).toBe('4,000.00');
  });

  it('clamps DEP to RDV so book value never falls below salvage', () => {
    const s = dep({ method: 'DB', LIF: 5, M01: 1, CST: 100_000, SAL: 60_000, dbPercent: 200 });
    const rows = depreciationSchedule(s, 2);
    expect(rows.every((r) => r.RBV >= 60_000)).toBe(true);
    expect(rows[rows.length - 1]!.RDV).toBe(0);
  });

  it('pro-rates the first year by FSTYR', () => {
    const s = dep({ method: 'DB', LIF: 5, M01: 7, CST: 100_000, SAL: 0, dbPercent: 200 });
    expect(shown(depreciationSchedule(s, 2)[0]!.DEP)).toBe('20,000.00'); // 40,000 x 6/12
  });
});

describe('DBX crossover -- DERIVED, no published formula', () => {
  it('reproduces the textbook 5-year 200% crossover schedule', () => {
    // 40000/24000/14400/10800/10800: DB leads for three years, then the flat
    // straight-line charge on the remaining value overtakes it in year 4.
    const s = dep({ method: 'DBX', LIF: 5, M01: 1, CST: 100_000, SAL: 0, dbPercent: 200 });
    const rows = depreciationSchedule(s, 2);
    expect(rows.map((r) => r.DEP)).toEqual([40_000, 24_000, 14_400, 10_800, 10_800]);
  });

  it('never charges less than plain DB would', () => {
    const base = { LIF: 8, M01: 1, CST: 80_000, SAL: 0, dbPercent: 200 } as const;
    const db = depreciationSchedule(dep({ ...base, method: 'DB' }), 2);
    const dbx = depreciationSchedule(dep({ ...base, method: 'DBX' }), 2);
    for (let k = 0; k < Math.min(db.length, dbx.length) - 1; k++) {
      expect(dbx[k]!.DEP).toBeGreaterThanOrEqual(db[k]!.DEP);
    }
  });

  it('stays crossed over once it switches', () => {
    const s = dep({ method: 'DBX', LIF: 6, M01: 1, CST: 60_000, SAL: 0, dbPercent: 200 });
    const charges = depreciationSchedule(s, 2).map((r) => r.DEP);
    // After the switch the charge is flat, so the sequence never rises again.
    for (let k = 1; k < charges.length; k++) {
      expect(charges[k]!).toBeLessThanOrEqual(charges[k - 1]!);
    }
  });

  it('exhausts RDV exactly', () => {
    const s = dep({ method: 'DBX', LIF: 7, M01: 4.5, CST: 90_000, SAL: 10_000, dbPercent: 175 });
    const rows = depreciationSchedule(s, 2);
    expect(rows[rows.length - 1]!.RDV).toBe(0);
    expect(shown(rows.reduce((a, r) => a + r.DEP, 0))).toBe('80,000.00');
  });
});

describe('SLF -- DERIVED, no published formula', () => {
  it('reads the first-year fraction from DT1 on a 30/360 basis', () => {
    const s = dep({ method: 'SLF', LIF: 10, M01: 1, CST: 1_000, DT1: { year: 2024, month: 3, day: 16 } });
    // 16 March: 75 of 360 days elapsed, so 285/360 of the year remains.
    expect(firstYearFraction(s)).toBeCloseTo(285 / 360, 12);
  });

  it('agrees exactly with the M01 convention -- the argument for this reading', () => {
    // DT1 = 16 March and M01 = 3.5 both mean "half of March gone".
    const viaDate = dep({ method: 'SLF', LIF: 31.5, M01: 1, CST: 1_000_000, DT1: { year: 2024, month: 3, day: 16 } });
    expect(firstYearFraction(viaDate)).toBe(firstYearFraction(BUILDING));
    expect(shown(depreciate(viaDate, 2).DEP)).toBe('25,132.28');
  });

  it('falls back to M01 when DT1 is unset, since p. 56 gives DT1 no reset default', () => {
    const s = dep({ method: 'SLF', LIF: 31.5, M01: 3.5, CST: 1_000_000 });
    expect(shown(depreciate(s, 2).DEP)).toBe('25,132.28');
  });

  it('otherwise behaves exactly as SL', () => {
    const asSlf = dep({ method: 'SLF', LIF: 4, M01: 1, CST: 10_000, SAL: 2_000 });
    const asSl = dep({ ...asSlf, method: 'SL' });
    expect(depreciationSchedule(asSlf, 2)).toEqual(depreciationSchedule(asSl, 2));
  });

  it('raises Error 6 on a malformed DT1', () => {
    for (const bad of [
      { year: 2024, month: 13, day: 1 },
      { year: 2024, month: 0, day: 1 },
      { year: 2024, month: 6, day: 0 },
      { year: 2024, month: 6, day: 32 },
      { year: 2024, month: 6.5, day: 1 },
    ]) {
      const s = dep({ method: 'SLF', LIF: 5, CST: 1_000, DT1: bad });
      expect(threw(() => depreciate(s, 2)).code).toBe(ErrorCode.InvalidDate);
    }
  });
});

describe('DBF -- DERIVED and speculative, no published formula', () => {
  it('counts the first year in whole months, unlike DB', () => {
    // M01 = 3.5 -> the French convention prorates from 1 March, giving 10/12.
    expect(firstYearFraction(dep({ method: 'DBF', M01: 3.5 }))).toBeCloseTo(10 / 12, 12);
    expect(firstYearFraction(dep({ method: 'DB', M01: 3.5 }))).toBeCloseTo(9.5 / 12, 12);
  });

  it('crosses over to straight line like DBX', () => {
    const base = { LIF: 5, M01: 1, CST: 100_000, SAL: 0, dbPercent: 200 } as const;
    expect(depreciationSchedule(dep({ ...base, method: 'DBF' }), 2).map((r) => r.DEP)).toEqual(
      depreciationSchedule(dep({ ...base, method: 'DBX' }), 2).map((r) => r.DEP),
    );
  });

  it('exhausts RDV exactly', () => {
    const s = dep({ method: 'DBF', LIF: 6, M01: 5.75, CST: 30_000, SAL: 2_000, dbPercent: 200 });
    expect(depreciationSchedule(s, 2)[6]!.RDV).toBe(0);
  });
});

describe('error conditions (pp. 84-85)', () => {
  it('raises Error 2 when SAL > CST', () => {
    const s = dep({ method: 'SL', LIF: 5, CST: 1_000, SAL: 1_000.01 });
    expect(threw(() => depreciate(s, 2)).code).toBe(ErrorCode.InvalidArgument);
  });

  it('allows SAL == CST -- only strictly greater is an error', () => {
    const s = dep({ method: 'SL', LIF: 5, CST: 1_000, SAL: 1_000 });
    expect(depreciate(s, 2).DEP).toBe(0);
    expect(depreciate(s, 2).RDV).toBe(0);
  });

  it('raises Error 4 when LIF <= 0', () => {
    for (const LIF of [0, -1, -0.5]) {
      expect(threw(() => depreciate(dep({ LIF, CST: 1_000 }), 2)).code).toBe(ErrorCode.OutOfRange);
    }
  });

  it('raises Error 4 when YR <= 0', () => {
    for (const YR of [0, -1]) {
      expect(threw(() => depreciate(dep({ LIF: 5, CST: 1_000, YR }), 2)).code).toBe(
        ErrorCode.OutOfRange,
      );
    }
  });

  it('raises Error 4 on a fractional YR, which indexes the schedule', () => {
    expect(threw(() => depreciate(dep({ LIF: 5, CST: 1_000, YR: 1.5 }), 2)).code).toBe(
      ErrorCode.OutOfRange,
    );
  });

  it('raises Error 4 when CST < 0 or SAL < 0', () => {
    expect(threw(() => depreciate(dep({ LIF: 5, CST: -1 }), 2)).code).toBe(ErrorCode.OutOfRange);
    expect(threw(() => depreciate(dep({ LIF: 5, CST: 1_000, SAL: -1 }), 2)).code).toBe(
      ErrorCode.OutOfRange,
    );
  });

  it('raises Error 4 when M01 < 1 or M01 >= 13', () => {
    for (const M01 of [0, 0.99, 13, 13.5, -1]) {
      expect(threw(() => depreciate(dep({ LIF: 5, CST: 1_000, M01 }), 2)).code).toBe(
        ErrorCode.OutOfRange,
      );
    }
  });

  it('accepts the M01 boundaries the reconstructed operators admit', () => {
    // 1 <= M01 < 13: 1 is legal, 12.99 is legal, 13 is not.
    expect(() => depreciate(dep({ LIF: 5, CST: 1_000, M01: 1 }), 2)).not.toThrow();
    expect(() => depreciate(dep({ LIF: 5, CST: 1_000, M01: 12.99 }), 2)).not.toThrow();
  });

  it('raises Error 4 when the declining balance percent <= 0', () => {
    for (const method of ['DB', 'DBX', 'DBF'] as const) {
      for (const dbPercent of [0, -200]) {
        expect(threw(() => depreciate(dep({ method, LIF: 5, CST: 1_000, dbPercent }), 2)).code).toBe(
          ErrorCode.OutOfRange,
        );
      }
    }
  });

  it('ignores the percent for methods that do not use one', () => {
    // The percent is only enterable on the DB/DBX line, so SL must not police it.
    expect(() => depreciate(dep({ method: 'SL', LIF: 5, CST: 1_000, dbPercent: 0 }), 2)).not.toThrow();
  });

  it('raises Error 1 on overflow', () => {
    // SYD squares LIF to form the sum of digits, so a large enough life leaves the
    // calculator range even though every entered value is inside it. p. 84 lists no
    // depreciation-specific overflow trigger; Error 1 is reachable generically.
    const s = dep({ method: 'SYD', LIF: 1e60, M01: 1, CST: 1_000, SAL: 0, YR: 1 });
    expect(threw(() => depreciate(s, 9)).code).toBe(ErrorCode.Overflow);
  });

  it('checks entry-time bounds before the calculation-time SAL > CST', () => {
    // Both are wrong here; Error 4 wins because on the hardware it fires at entry.
    const s = dep({ method: 'SL', LIF: -1, CST: 100, SAL: 500 });
    expect(threw(() => depreciate(s, 2)).code).toBe(ErrorCode.OutOfRange);
  });
});

describe('clearing and reset (p. 56)', () => {
  it('CLR WORK resets exactly LIF, YR, CST and SAL', () => {
    const s = dep({ method: 'DBX', LIF: 31.5, M01: 3.5, CST: 1_000_000, SAL: 500, YR: 7, dbPercent: 150 });
    const cleared = clearWork(s);
    expect(cleared).toEqual(dep({ method: 'DBX', LIF: 1, M01: 3.5, CST: 0, SAL: 0, YR: 1, dbPercent: 150 }));
  });

  it('CLR WORK spares the method, M01 and the DB percent', () => {
    const cleared = clearWork(dep({ method: 'DB', M01: 9, dbPercent: 150 }));
    expect(cleared.method).toBe('DB');
    expect(cleared.M01).toBe(9);
    expect(cleared.dbPercent).toBe(150);
  });

  it('RESET restores the p. 56 default table', () => {
    expect(DEPRECIATION_DEFAULTS).toEqual({
      method: 'SL',
      LIF: 1,
      M01: 1,
      CST: 0,
      SAL: 0,
      YR: 1,
      dbPercent: 200,
    });
  });
});

describe('method selection (p. 55, p. 57)', () => {
  it('hides SLF and DBF outside the European formats', () => {
    expect(availableMethods(false)).toEqual(['SL', 'SYD', 'DB', 'DBX']);
    expect(availableMethods(true)).toEqual([...METHOD_CYCLE]);
  });

  it('cycles and wraps', () => {
    expect(nextMethod('SL', false)).toBe('SYD');
    expect(nextMethod('DBX', false)).toBe('SL');
    expect(nextMethod('SL', true)).toBe('SLF');
    expect(nextMethod('DBF', true)).toBe('SL');
  });

  it('restarts the cycle from a method that is no longer available', () => {
    expect(nextMethod('SLF', false)).toBe('SL');
  });
});

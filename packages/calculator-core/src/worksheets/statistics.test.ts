import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FREQUENCY,
  MAX_DATA_POINTS,
  METHOD_CYCLE,
  STATISTICS_DEFAULTS,
  clearData,
  clearStat,
  nextMethod,
  oneVariableResults,
  predictX,
  predictY,
  regression,
  statSums,
  transformedFit,
  twoVariableResults,
  visibleResults,
  type DataPoint,
  type StatisticsMethod,
  type StatisticsState,
} from './statistics.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/**
 * THERE IS NO GOLDEN CASE FOR THIS WORKSHEET.
 *
 * tests/golden/statistics.json is empty, and correctly so: Statistics is the only
 * worksheet chapter in the guidebook that carries no `Example:` subsection, so the
 * document publishes no result to check against. Every expected value below was
 * therefore derived by hand from the p. 80 appendix formulas, and the derivation
 * is written out at each use site. These tests prove the code matches the
 * formulas; they cannot prove the formulas match the hardware.
 */

const st = (points: readonly DataPoint[], method: StatisticsMethod): StatisticsState => ({
  points,
  method,
});
const pts = (pairs: readonly (readonly [number, number])[]): DataPoint[] =>
  pairs.map(([x, y]) => ({ x, y }));
const shown = (v: number, decimals: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 2): string =>
  formatValue(v, { decimals, separator: 'US' });

const expectError = (code: ErrorCode, fn: () => unknown): void => {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
  }
};

/**
 * Dataset A -- the LIN reference. Five points, all sums exact integers, so the
 * whole fit is checkable by hand with no rounding anywhere:
 *
 *   (1,2) (2,4) (3,5) (4,4) (5,5)
 *
 *   n  = 5     Σx  = 15    Σx² = 55
 *              Σy  = 20    Σy² = 86     Σxy = 66
 *   x̄  = 15/5 = 3          ȳ  = 20/5 = 4
 *   b  = (5*66 − 20*15) / (5*55 − 15²) = (330−300)/(275−225) = 30/50 = 0.6
 *   a  = (20 − 0.6*15)/5 = 11/5 = 2.2
 *   σx = √((55 − 15²/5)/5) = √(10/5) = √2   = 1.414213562…
 *   Sx = √(10/4) = √2.5                     = 1.581138830…
 *   σy = √((86 − 20²/5)/5) = √(6/5) = √1.2  = 1.095445115…
 *   Sy = √(6/4)  = √1.5                     = 1.224744871…
 *   r  = b·σx/σy = 0.6·√2/√1.2 = 0.6·√(5/3) = 0.774596669…
 *
 * Cross-checked against the Pearson identity, which the p. 80 form must equal:
 *   Sxy = Σxy − n·x̄·ȳ = 66 − 60 = 6;  Sxx = 10;  Syy = 6
 *   r = 6/√(10·6) = 6/√60 = 0.774596669…   ✓ agrees with b·σx/σy
 */
const A = st(pts([[1, 2], [2, 4], [3, 5], [4, 4], [5, 5]]), 'LIN');

describe('LIN reference dataset (hand-derived; no guidebook example exists)', () => {
  it('reports the sums the fit is built from', () => {
    const s = statSums(A);
    expect(shown(s.n)).toBe('5.00');
    expect(shown(s.sumX)).toBe('15.00');
    expect(shown(s.sumX2)).toBe('55.00');
    expect(shown(s.sumY)).toBe('20.00');
    expect(shown(s.sumY2)).toBe('86.00');
    expect(shown(s.sumXY)).toBe('66.00');
  });

  it('reports the means and both deviations', () => {
    const r = twoVariableResults(A);
    expect(shown(r.xbar)).toBe('3.00');
    expect(shown(r.ybar)).toBe('4.00');
    expect(shown(r.Sx)).toBe('1.58'); // √2.5
    expect(shown(r.sigmax)).toBe('1.41'); // √2
    expect(shown(r.Sy)).toBe('1.22'); // √1.5
    expect(shown(r.sigmay)).toBe('1.10'); // √1.2
  });

  it('reports a, b and r', () => {
    const r = twoVariableResults(A);
    expect(shown(r.a)).toBe('2.20');
    expect(shown(r.b)).toBe('0.60');
    expect(shown(r.r)).toBe('0.77');
  });

  it('matches the hand-derived values to full precision', () => {
    const r = twoVariableResults(A);
    expect(r.a).toBeCloseTo(2.2, 12);
    expect(r.b).toBeCloseTo(0.6, 12);
    expect(r.r).toBeCloseTo(0.7745966692414834, 12);
    expect(r.sigmax).toBeCloseTo(Math.SQRT2, 12);
    expect(r.Sx).toBeCloseTo(Math.sqrt(2.5), 12);
  });

  it('agrees with the Pearson identity r = Sxy/√(Sxx·Syy)', () => {
    // Independent route to r: the p. 80 form b·σx/σy must equal it.
    const r = twoVariableResults(A);
    expect(r.r).toBeCloseTo(6 / Math.sqrt(10 * 6), 12);
  });

  it("predicts Y' from X' and inverts back", () => {
    // Y'(6) = 2.2 + 0.6·6 = 5.8
    expect(shown(predictY(A, 6))).toBe('5.80');
    expect(shown(predictX(A, 5.8))).toBe('6.00');
  });

  it("predicts X' from Y' on a point of the fitted line", () => {
    // Y' = 2.2 is the intercept, so X' must be 0.
    expect(shown(predictX(A, 2.2))).toBe('0.00');
  });
});

/**
 * Dataset B -- one-variable data with frequencies (p. 60: Ynn is the number of
 * occurrences). Values 2, 5, 9 occurring 3, 2 and 1 times: the data set is
 * 2,2,2,5,5,9.
 *
 *   n   = 3+2+1 = 6
 *   ΣX  = 3·2 + 2·5 + 1·9  = 6+10+9   = 25
 *   ΣX² = 3·4 + 2·25 + 1·81 = 12+50+81 = 143
 *   x̄   = 25/6 = 4.166666667
 *   css = 143 − 25²/6 = 143 − 104.1666667 = 38.83333333
 *   σx  = √(38.83333333/6) = √6.472222222 = 2.544056254…
 *   Sx  = √(38.83333333/5) = √7.766666667 = 2.786873995…
 */
const B = st(pts([[2, 3], [5, 2], [9, 1]]), '1-V');

describe('one-variable statistics with frequencies (guidebook p. 60)', () => {
  it('weights the sums by frequency', () => {
    const r = oneVariableResults(B);
    expect(shown(r.n)).toBe('6.00');
    expect(shown(r.sumX)).toBe('25.00');
    expect(shown(r.sumX2)).toBe('143.00');
  });

  it('reports the mean and both deviations', () => {
    const r = oneVariableResults(B);
    expect(shown(r.xbar)).toBe('4.17'); // 25/6 = 4.1666…
    expect(shown(r.sigmax)).toBe('2.54');
    expect(shown(r.Sx)).toBe('2.79');
    expect(r.sigmax).toBeCloseTo(2.5440562537456244, 10);
    expect(r.Sx).toBeCloseTo(2.7868739954771304, 10);
  });

  it('matches the same data written out unweighted', () => {
    // 2,2,2,5,5,9 each at frequency 1 must produce identical statistics.
    const expanded = st(pts([[2, 1], [2, 1], [2, 1], [5, 1], [5, 1], [9, 1]]), '1-V');
    expect(oneVariableResults(expanded)).toEqual(oneVariableResults(B));
  });

  it('accepts a fractional frequency', () => {
    // p. 84 bounds the Cash Flow Fnn to 0.5-9,999 with Error 4; no analogous bound
    // is printed for Ynn, so no bound is invented here.
    const r = oneVariableResults(st(pts([[2, 0.5], [4, 1.5]]), '1-V'));
    expect(shown(r.n)).toBe('2.00');
    expect(shown(r.xbar)).toBe('3.50'); // (0.5·2 + 1.5·4)/2 = 7/2
  });

  it('shows only the six 1-V results (p. 60, p. 62)', () => {
    expect(visibleResults('1-V')).toEqual(['n', 'x̄', 'Sx', 'σx', 'ΣX', 'ΣX2']);
  });
});

/**
 * Dataset C -- EXP, fitted to data lying exactly on Y = 3·2^X.
 *
 *   (0,3) (1,6) (2,12) (3,24)
 *
 * EXP fits (X, ln Y), and ln Y = ln 3 + X·ln 2 exactly, so the transformed fit is
 * exact: intercept = ln 3 = 1.098612289, slope = ln 2 = 0.693147181, r = 1.
 *
 * This dataset is the whole argument for correction 4 in the module header. p. 80
 * read literally reports the fit's own intercept and slope, i.e. a = 1.0986 and
 * b = 0.6931 -- and then p. 61's model Y = a·b^X evaluates at X=0 to 1.0986, not
 * the 3 in the data. Reporting the model-form a = e^(ln 3) = 3 and b = e^(ln 2) = 2
 * reproduces every point exactly. The two pages cannot both be right; this is why
 * p. 61 wins.
 */
const C = st(pts([[0, 3], [1, 6], [2, 12], [3, 24]]), 'EXP');

describe('EXP regression (guidebook p. 61 model Y = a·b^X)', () => {
  it('recovers the model coefficients, not the transformed fit', () => {
    const r = regression(C);
    expect(shown(r.a)).toBe('3.00');
    expect(shown(r.b)).toBe('2.00');
    expect(r.a).toBeCloseTo(3, 10);
    expect(r.b).toBeCloseTo(2, 10);
  });

  it('exposes the literal p. 80 fit separately', () => {
    // The appendix's own a and b, before the p. 61 model conversion.
    const f = transformedFit(C);
    expect(f.intercept).toBeCloseTo(Math.log(3), 10);
    expect(f.slope).toBeCloseTo(Math.log(2), 10);
  });

  it('reproduces the data from the reported model', () => {
    // The point of correction 4: Y = a·b^X must regenerate the input.
    const { a, b } = regression(C);
    for (const p of C.points) {
      expect(a * Math.pow(b, p.x)).toBeCloseTo(p.y, 8);
    }
  });

  it('reports r = 1 for an exact fit', () => {
    expect(shown(regression(C).r)).toBe('1.00');
    // 10 places, not more: toInternal quantises every accumulated sum to 13
    // significant digits, and at ΣlnY ≈ 8.55 that is ~1e-12 of absolute room, so
    // r lands on 1.000000000001. A pure-double reference gives 1.0000000000000007.
    // The gap is the emulated 13-digit machine, not a defect -- and 10 places is
    // still finer than the LCD's 10-digit budget can show.
    expect(regression(C).r).toBeCloseTo(1, 10);
  });

  it("predicts Y' by extending the curve", () => {
    // Y'(4) = 3·2^4 = 48
    expect(shown(predictY(C, 4))).toBe('48.00');
  });

  it("inverts Y' back to X'", () => {
    // X'(48) = ln(48/3)/ln 2 = 4
    expect(shown(predictX(C, 48))).toBe('4.00');
  });

  it('computes its statistics on the transformed y (p. 61)', () => {
    // ΣY under EXP is Σln(Y), not ΣY: ln3+ln6+ln12+ln24 = 8.553332238
    const s = statSums(C);
    expect(s.sumY).toBeCloseTo(Math.log(3) + Math.log(6) + Math.log(12) + Math.log(24), 10);
  });
});

/**
 * Dataset D -- PWR, fitted to data lying exactly on Y = 2·X^3.
 *
 *   (1,2) (2,16) (3,54) (4,128)
 *
 * PWR fits (ln X, ln Y), and ln Y = ln 2 + 3·ln X exactly, so intercept = ln 2 and
 * slope = 3. The model is Y = a·X^b, so only `a` exponentiates: b multiplies ln X
 * and stays as fitted. a = e^(ln 2) = 2, b = 3.
 */
const D = st(pts([[1, 2], [2, 16], [3, 54], [4, 128]]), 'PWR');

describe('PWR regression (guidebook p. 61 model Y = a·X^b)', () => {
  it('exponentiates a but leaves b as fitted', () => {
    const r = regression(D);
    expect(shown(r.a)).toBe('2.00');
    expect(shown(r.b)).toBe('3.00');
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(3, 10);
  });

  it('reproduces the data from the reported model', () => {
    const { a, b } = regression(D);
    for (const p of D.points) {
      expect(a * Math.pow(p.x, b)).toBeCloseTo(p.y, 8);
    }
  });

  it('reports r = 1 for an exact fit', () => {
    expect(shown(regression(D).r)).toBe('1.00');
    expect(regression(D).r).toBeCloseTo(1, 10); // see the EXP note on precision
  });

  it("predicts Y' and inverts it", () => {
    // Y'(5) = 2·5³ = 250
    expect(shown(predictY(D, 5))).toBe('250.00');
    expect(shown(predictX(D, 250))).toBe('5.00');
  });
});

/**
 * Dataset E -- Ln, fitted to data lying exactly on Y = 5 + 2·ln X.
 *
 *   x = 1, 2, 4, 8 with y = 5+2ln1, 5+2ln2, 5+2ln4, 5+2ln8
 *
 * Ln fits (ln X, Y), which is already linear, so intercept = 5 and slope = 2 with
 * no back-conversion: p. 61's model Y = a + b·ln X uses the fitted pair directly.
 */
const E = st(
  pts([
    [1, 5 + 2 * Math.log(1)],
    [2, 5 + 2 * Math.log(2)],
    [4, 5 + 2 * Math.log(4)],
    [8, 5 + 2 * Math.log(8)],
  ]),
  'Ln',
);

describe('Ln regression (guidebook p. 61 model Y = a + b·ln X)', () => {
  it('reports the fitted intercept and slope unchanged', () => {
    const r = regression(E);
    expect(shown(r.a)).toBe('5.00');
    expect(shown(r.b)).toBe('2.00');
    expect(r.a).toBeCloseTo(5, 10);
    expect(r.b).toBeCloseTo(2, 10);
  });

  it("predicts Y' along the curve", () => {
    // Y'(16) = 5 + 2·ln 16 = 5 + 5.545177444 = 10.545177444
    expect(shown(predictY(E, 16))).toBe('10.55');
    expect(predictY(E, 16)).toBeCloseTo(5 + 2 * Math.log(16), 10);
  });

  it('computes its statistics on the transformed x (p. 61)', () => {
    // ΣX under Ln is Σln(X) = ln1+ln2+ln4+ln8 = 4.158883083
    const s = statSums(E);
    expect(s.sumX).toBeCloseTo(Math.log(1) + Math.log(2) + Math.log(4) + Math.log(8), 10);
    expect(s.sumX).not.toBe(15); // the raw ΣX would be 1+2+4+8
  });
});

describe('the four models are distinguished only by their transformation (p. 61)', () => {
  it('fits linear data exactly under LIN and inexactly under every other model', () => {
    // Y = 1 + X on x>0: LIN recovers it exactly, and Ln/EXP/PWR necessarily do not,
    // because each fits a different straightened space.
    const data = pts([[1, 2], [2, 3], [3, 4], [4, 5]]);
    expect(regression(st(data, 'LIN')).r).toBeCloseTo(1, 12);
    expect(regression(st(data, 'Ln')).r).toBeLessThan(1);
    expect(regression(st(data, 'EXP')).r).toBeLessThan(1);
    expect(regression(st(data, 'PWR')).r).toBeLessThan(1);
  });

  it('puts the same seventeen results on the scroll list for every regression method', () => {
    // p. 59 marks the 2-V-only rows once, for all four models alike.
    for (const m of ['LIN', 'Ln', 'EXP', 'PWR'] as const) {
      expect(visibleResults(m)).toEqual(visibleResults('LIN'));
    }
  });
});

describe('Error 1 -- X or Y values all the same (guidebook p. 84)', () => {
  it('raises when every X is identical, via the collapsed b denominator', () => {
    // n·Σx² − (Σx)² = 2·8 − 4² = 0, so b divides by zero.
    expectError(ErrorCode.Overflow, () => regression(st(pts([[2, 1], [2, 5]]), 'LIN')));
  });

  it('raises when every Y is identical, via σy = 0 in r', () => {
    // b is a perfectly good 0 here; it is r = b·σx/σy that divides by zero.
    expectError(ErrorCode.Overflow, () => regression(st(pts([[1, 7], [2, 7], [3, 7]]), 'LIN')));
  });

  it('raises for a single data point, which has no slope', () => {
    // One point is trivially "all X the same": the denominator collapses.
    expectError(ErrorCode.Overflow, () => regression(st(pts([[3, 4]]), 'LIN')));
  });

  it('does NOT raise for identical values under 1-V', () => {
    // p. 84's trigger is a divide by zero in b or r, and 1-V computes neither.
    // σx = 0 is a legitimate result for a constant data set.
    const r = oneVariableResults(st(pts([[5, 1], [5, 1], [5, 1]]), '1-V'));
    expect(shown(r.xbar)).toBe('5.00');
    expect(shown(r.sigmax)).toBe('0.00');
    expect(shown(r.Sx)).toBe('0.00');
  });

  it('does not let float cancellation turn a zero deviation into NaN', () => {
    // Σx² − (Σx)²/n for x = 0.1,0.1,0.1 cancels to a few units in the last place
    // either side of zero; unclamped, a negative reaches sqrt and yields NaN,
    // which toInternal would report as an Error 1 the hardware never raises.
    const r = oneVariableResults(st(pts([[0.1, 1], [0.1, 1], [0.1, 1]]), '1-V'));
    expect(shown(r.sigmax)).toBe('0.00');
    expect(Number.isNaN(r.sigmax)).toBe(false);
    expect(Number.isNaN(r.Sx)).toBe(false);
  });

  it('absorbs only cancellation debris, never a genuinely negative bracket', () => {
    // The clamp above must not become a blanket "negative -> 0". A NEGATIVE 1-V
    // frequency -- which this module accepts, since p. 60 prints no bound for Ynn
    // -- breaks the Cauchy-Schwarz guarantee that makes Σfx² − (Σfx)²/n
    // non-negative: x=5 at f=4 with x=7 at f=-2 gives n=2, Σfx=6, Σfx²=2 and a
    // bracket of 2 − 36/2 = −16. That is eight orders of magnitude past debris.
    // Reporting σx = 0 for it would fabricate a "zero dispersion" the data does
    // not have, so it must surface as Error 1 via sqrt's NaN instead.
    expectError(ErrorCode.Overflow, () => oneVariableResults(st(pts([[5, 4], [7, -2]]), '1-V')));
  });

  it('detects all-identical X on the DATA, not on the computed denominator', () => {
    // 0.1,0.1,0.1 built a denominator that need not be exactly 0.0 in floats. If
    // the guard tested `denominator === 0` alone it would slip through and return
    // an enormous finite slope instead of erroring.
    expectError(ErrorCode.Overflow, () =>
      regression(st(pts([[0.1, 1], [0.1, 2], [0.1, 3]]), 'LIN')),
    );
  });
});

describe('Error 1 -- no data entered (guidebook p. 60, unnamed there)', () => {
  it('raises when the results are accessed with an empty data set', () => {
    expectError(ErrorCode.Overflow, () => oneVariableResults(STATISTICS_DEFAULTS));
    expectError(ErrorCode.Overflow, () => twoVariableResults(STATISTICS_DEFAULTS));
    expectError(ErrorCode.Overflow, () => regression(STATISTICS_DEFAULTS));
  });

  it('raises for a 1-V set whose frequencies sum to zero', () => {
    // n = ΣYnn = 0, so x̄ = ΣX/n divides by zero.
    expectError(ErrorCode.Overflow, () => oneVariableResults(st(pts([[5, 0], [7, 0]]), '1-V')));
  });
});

describe('Error 1 -- Sx with n = 1 (n-1 divisor, guidebook p. 80/p. 84)', () => {
  it('raises because the sample deviation divides by n-1 = 0', () => {
    expectError(ErrorCode.Overflow, () => oneVariableResults(st(pts([[5, 1]]), '1-V')));
  });

  it('but n, x̄ and σx are computable for that same single point', () => {
    // Only Sx is degenerate. The hardware computes each result as it is scrolled
    // to (p. 60, p. 62), so it would show these three and error only on Sx.
    const s = statSums(st(pts([[5, 1]]), '1-V'));
    expect(shown(s.n)).toBe('1.00');
    expect(shown(s.sumX)).toBe('5.00');
  });
});

describe('Error 2 -- LN of a non-positive value (guidebook p. 84)', () => {
  // Error 2, not Error 5: p. 84's Error 5 LN bullet names "TVM, Cash Flow, and
  // Bond" and omits Statistics, while its Error 2 LN bullet is unqualified.
  it('raises for Ln with an X <= 0 (p. 61: all X > zero)', () => {
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[0, 1], [2, 3]]), 'Ln')));
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[-1, 1], [2, 3]]), 'Ln')));
  });

  it('raises for EXP with a Y <= 0 (p. 61: all Y > zero)', () => {
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[1, -1], [2, 3]]), 'EXP')));
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[1, 0], [2, 3]]), 'EXP')));
  });

  it('raises for PWR with either an X <= 0 or a Y <= 0 (p. 61: all X and Y > zero)', () => {
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[-1, 2], [2, 3]]), 'PWR')));
    expectError(ErrorCode.InvalidArgument, () => regression(st(pts([[1, 0], [2, 3]]), 'PWR')));
  });

  it('does NOT raise for the same data under a model that does not need that ln', () => {
    // The restriction belongs to the transformation, not to the data. A negative Y
    // is fine under LIN and Ln, which never take ln(Y).
    const data = pts([[1, -4], [2, -2], [3, 1]]);
    expect(() => regression(st(data, 'LIN'))).not.toThrow();
    expect(() => regression(st(data, 'Ln'))).not.toThrow();
    expectError(ErrorCode.InvalidArgument, () => regression(st(data, 'EXP')));
  });

  it('raises only when a result is accessed, never on entry', () => {
    // p. 61 gives the restrictions and p. 84 gives the LN rule, but the guidebook
    // never joins them. Holding an out-of-domain point is harmless until a result
    // needs its logarithm -- which must be so, since the method can be changed
    // after the data is entered.
    const bad = st(pts([[0, 1], [2, 3]]), 'Ln');
    expect(bad.points).toHaveLength(2); // constructing the state is fine
    expectError(ErrorCode.InvalidArgument, () => statSums(bad));
  });

  it("raises for a prediction whose own X' or Y' is out of domain", () => {
    expectError(ErrorCode.InvalidArgument, () => predictY(E, 0)); // Ln needs ln(X')
    expectError(ErrorCode.InvalidArgument, () => predictY(D, -1)); // PWR needs ln(X')
    expectError(ErrorCode.InvalidArgument, () => predictX(C, 0)); // EXP needs ln(Y')
    expectError(ErrorCode.InvalidArgument, () => predictX(D, -5)); // PWR needs ln(Y')
  });
});

describe("Error 1 -- degenerate and overflowing predictions (guidebook p. 84)", () => {
  /**
   * Dataset F -- a zero slope that is NOT an all-Y-identical set.
   *
   *   (1,1) (2,3) (3,1):  n=3, Σx=6, Σx²=14, Σy=5, Σxy=10
   *   b = (3·10 − 5·6)/(3·14 − 6²) = (30−30)/(42−36) = 0/6 = 0
   *   a = (5 − 0·6)/3 = 1.666666667,  r = b·σx/σy = 0
   *
   * So a, b and r all compute cleanly -- only the inversion is undefined.
   */
  const F = st(pts([[1, 1], [2, 3], [3, 1]]), 'LIN');

  it('computes a, b and r fine when the slope is zero', () => {
    const r = regression(F);
    expect(shown(r.a)).toBe('1.67');
    expect(shown(r.b)).toBe('0.00');
    expect(shown(r.r)).toBe('0.00');
  });

  it("raises when X' inverts a zero slope", () => {
    expectError(ErrorCode.Overflow, () => predictX(F, 2));
  });

  it("still predicts Y' from a zero slope", () => {
    // The forward direction is well defined: every X' maps to ȳ.
    expect(shown(predictY(F, 99))).toBe('1.67');
  });

  it("raises when an EXP Y' overflows the calculator range", () => {
    // Y'(400) on Y = 3·2^X is 7.7E120, past ±9.9999999999999E99.
    expectError(ErrorCode.Overflow, () => predictY(C, 400));
  });

  it('raises when ΣX2 itself overflows the calculator range', () => {
    // The other route p. 84 names for Error 1: a result outside ±9.9999999999999E99.
    // ΣX2 squares each X, so an X of 1E60 alone puts the sum at 1E120.
    expectError(ErrorCode.Overflow, () => statSums(st(pts([[1e60, 1], [2e60, 2]]), 'LIN')));
    // ...and just inside the boundary it is a plain result: 9E49² + 1E49² = 8.2E99.
    expect(statSums(st(pts([[9e49, 1], [1e49, 2]]), 'LIN')).sumX2).toBe(8.2e99);
  });
});

describe('the 2-V results are not available under 1-V (guidebook p. 60)', () => {
  it('refuses the request as a caller bug, not a calculator error', () => {
    // Those variables are not on the 1-V scroll list at all, so the hardware has
    // no way to express this request; it is not one of the eight error conditions.
    expect(() => twoVariableResults(B)).toThrow(/not displayed for one-variable/);
    expect(() => regression(B)).toThrow(/not displayed for one-variable/);
    expect(() => predictY(B, 1)).toThrow(/not displayed for one-variable/);
    expect(() => predictX(B, 1)).toThrow(/not displayed for one-variable/);
    expect(() => transformedFit(B)).toThrow(/not displayed for one-variable/);
  });

  it('refuses with a plain Error, never a CalculatorError', () => {
    // The distinction is load-bearing: a CalculatorError would latch "Error n" on
    // the LCD, but the hardware cannot even express this request -- those
    // variables are absent from the 1-V scroll list.
    expect(() => regression(B)).not.toThrow(CalculatorError);
  });

  it('lists all seventeen variables for a regression method (p. 59 order)', () => {
    expect(visibleResults('LIN')).toEqual([
      'n', 'x̄', 'Sx', 'σx', 'ȳ', 'Sy', 'σy', 'a', 'b', 'r', "X'", "Y'",
      'ΣX', 'ΣX2', 'ΣY', 'ΣY2', 'ΣXY',
    ]);
  });
});

describe('method selection (guidebook p. 59, p. 62)', () => {
  it('defaults to LIN', () => {
    expect(STATISTICS_DEFAULTS.method).toBe('LIN');
    expect(STATISTICS_DEFAULTS.points).toEqual([]);
  });

  it('cycles LIN -> Ln -> EXP -> PWR -> 1-V -> LIN', () => {
    expect(METHOD_CYCLE).toEqual(['LIN', 'Ln', 'EXP', 'PWR', '1-V']);
    let m: StatisticsMethod = 'LIN';
    const seen: StatisticsMethod[] = [];
    for (let i = 0; i < 5; i++) {
      m = nextMethod(m);
      seen.push(m);
    }
    expect(seen).toEqual(['Ln', 'EXP', 'PWR', '1-V', 'LIN']);
  });
});

describe('clearing (guidebook p. 60)', () => {
  it('CLR WORK in the data portion drops the data and keeps the method', () => {
    const s = clearData(st(pts([[1, 2]]), 'PWR'));
    expect(s.points).toEqual([]);
    expect(s.method).toBe('PWR');
  });

  it('CLR WORK in the stat portion resets the method and keeps the data', () => {
    const s = clearStat(st(pts([[1, 2], [3, 4]]), 'PWR'));
    expect(s.points).toHaveLength(2);
    expect(s.method).toBe('LIN');
  });

  it('leaves the results recomputable after a stat-portion clear', () => {
    // p. 60 says CLR WORK there "clears all values except X and Y", but every
    // result is recomputed from X and Y on access, so scrolling repopulates them.
    const cleared = clearStat(A);
    expect(shown(twoVariableResults({ ...cleared, method: 'LIN' }).b)).toBe('0.60');
  });

  it('RESET clears the data and the method together', () => {
    expect(STATISTICS_DEFAULTS).toEqual({ points: [], method: 'LIN' });
  });
});

describe('capacity (guidebook p. 60)', () => {
  it('states the documented 50-point limit', () => {
    expect(MAX_DATA_POINTS).toBe(50);
  });

  it('defaults Ynn to 1 (p. 60)', () => {
    // p. 60: "When you enter a value for Xnn, the value for Ynn defaults to 1."
    // Stated without restricting it to 1-V, so it holds in 2-V mode too -- keying
    // an X and scrolling past Y silently contributes a Y of 1.
    expect(DEFAULT_FREQUENCY).toBe(1);
    // A 1-V point carrying the default frequency counts once.
    expect(oneVariableResults(st(pts([[4, DEFAULT_FREQUENCY], [6, DEFAULT_FREQUENCY]]), '1-V')).n)
      .toBe(2);
  });

  it('computes a full 50-point data set', () => {
    // y = 2x + 1 on x = 1..50, an exact fit: b = 2, a = 1, r = 1.
    const full = st(
      Array.from({ length: 50 }, (_, i) => ({ x: i + 1, y: 2 * (i + 1) + 1 })),
      'LIN',
    );
    const r = twoVariableResults(full);
    expect(shown(r.n)).toBe('50.00');
    expect(shown(r.a)).toBe('1.00');
    expect(shown(r.b)).toBe('2.00');
    expect(shown(r.r)).toBe('1.00');
    // ΣX = 50·51/2 = 1275
    expect(shown(r.sumX)).toBe('1,275.00');
  });
});

describe('display settings do not touch the arithmetic (guidebook p. 9)', () => {
  it('renders one internal value at several DEC settings', () => {
    // Unlike amortization, statistics never rounds to the display.
    const r = twoVariableResults(A);
    expect(shown(r.r, 0)).toBe('1');
    expect(shown(r.r, 2)).toBe('0.77');
    expect(shown(r.r, 4)).toBe('0.7746');
    expect(shown(r.r, 9)).toBe('0.7745966692');
  });
});

/**
 * Statistics worksheet.
 *
 * Up to 50 (X,Y) data points, analysed either as one-variable data (Y is a
 * frequency) or as two-variable data under one of four regression models
 * (guidebook pp. 59-62; formulas p. 80; errors p. 84).
 *
 * WARNING -- THIS MODULE HAS NO PARITY ORACLE. Statistics is the only worksheet
 * chapter in the guidebook with no worked example, so tests/golden/statistics.json
 * is legitimately empty. Every expected value in statistics.test.ts was derived
 * by hand from the p. 80 appendix formulas and is documented at its use site.
 * This is therefore the weakest-verified worksheet in the engine: the arithmetic
 * is checked against the formulas, not against the hardware.
 *
 * The four models (p. 61) and the transformation each one fits on (p. 61):
 *
 *     LIN   Y = a + b*X        fits (X,      Y)        no restriction
 *     Ln    Y = a + b*ln(X)    fits (ln X,   Y)        all X > 0
 *     EXP   Y = a * b^X        fits (X,      ln Y)     all Y > 0
 *     PWR   Y = a * X^b        fits (ln X,   ln Y)     all X > 0 and Y > 0
 *
 * The fit itself, on the transformed data (p. 80):
 *
 *     b = [ n*Σ(xy) - (Σy)(Σx) ] / [ n*Σ(x²) - (Σx)² ]
 *     a = [ Σy - b*Σx ] / n
 *     r = b * σx / σy
 *
 * and the descriptive statistics, which p. 80 notes apply to both x and y:
 *
 *     x̄  = Σx / n
 *     σx = [ (Σx² - (Σx)²/n) / n     ]^(1/2)     population, n weighting
 *     Sx = [ (Σx² - (Σx)²/n) / (n-1) ]^(1/2)     sample, n-1 weighting
 *
 * FOUR CORRECTIONS TO THE PRINTED SOURCE. The first three are typesetting damage
 * in the PDF and are settled by reading pages/page61.png and pages/page80.png
 * directly; the fourth is a genuine conflict between two pages.
 *
 *  1. p. 61 prints the EXP model as `Y = a bx` and PWR as `Y = a Xb`, with the
 *     trailing glyph typeset as a lowered pseudo-subscript. Both are EXPONENTS:
 *     `Y = a*b^X` and `Y = a*X^b`. The page proves this against itself six lines
 *     below, where it states EXP fits (X, ln Y) -- a model linear in (X, ln Y) is
 *     ln Y = ln a + X*ln b, i.e. Y = a*b^X. A subscript reading is meaningless.
 *
 *  2. p. 80 prints the slope denominator as `n(Σ x2) − Σ x)2` -- an unbalanced
 *     parenthesis with the opening `(` missing, and `2` flattened out of the
 *     exponent position. As printed it does not parse. It reads `n*Σx² − (Σx)²`.
 *
 *  3. p. 80 prints `r = b δx / δy` with a delta where the symbol is sigma -- a
 *     symbol-font substitution. Confirmed by rearranging the standard identity
 *     b = r*σy/σx into r = b*σx/σy, which is exactly the printed shape.
 *
 *  4. `a` and `b` are reported in MODEL form, not as the transformed fit's raw
 *     intercept and slope. p. 80 says its formulas use transformed data, which
 *     read literally makes the reported `b` the transformed slope; but p. 61
 *     prints the models with those same two letters, as `Y = a*b^X`. Both cannot
 *     hold. p. 61 is the user-facing contract for what `a` and `b` MEAN, so it
 *     wins: where the fit is on ln Y, the fitted intercept is ln(a), so
 *
 *         EXP:  a = e^(fitted intercept),  b = e^(fitted slope)
 *         PWR:  a = e^(fitted intercept),  b = fitted slope   (b multiplies ln X)
 *         LIN, Ln: a and b are the fitted intercept and slope unchanged
 *
 *     Under the literal p. 80 reading, a perfect fit of Y = 3*2^X would report
 *     a = 1.0986 (= ln 3) and b = 0.6931 (= ln 2), and p. 61's own model equation
 *     would not reproduce the data. Reporting a = 3, b = 2 makes it reproduce
 *     exactly. `transformedFit` exposes the literal p. 80 quantities for anyone
 *     who needs them. This is an inference, not a verified fact -- there is no
 *     worked example to settle it. See docs/OPEN-QUESTIONS.md.
 *
 * `r` is always computed from the TRANSFORMED fit (p. 80's header says so), so it
 * measures the fit of the straightened data, not of the curve in original units.
 *
 * Source: guidebook pp. 59-62 (behaviour), p. 80 (formulas), p. 84 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/** Capacity of the data-entry portion (guidebook p. 60). */
export const MAX_DATA_POINTS = 50;

/** Ynn defaults to 1 when an Xnn is keyed in (guidebook p. 60). */
export const DEFAULT_FREQUENCY = 1;

export type RegressionMethod = 'LIN' | 'Ln' | 'EXP' | 'PWR';
export type StatisticsMethod = RegressionMethod | '1-V';

/** The order 2ND SET cycles the method in (guidebook p. 59, p. 62). */
export const METHOD_CYCLE: readonly StatisticsMethod[] = Object.freeze([
  'LIN',
  'Ln',
  'EXP',
  'PWR',
  '1-V',
]);

/** Display labels, in the p. 59 scroll order. */
export type StatisticsVariable =
  | 'n'
  | 'x̄'
  | 'Sx'
  | 'σx'
  | 'ȳ'
  | 'Sy'
  | 'σy'
  | 'a'
  | 'b'
  | 'r'
  | "X'"
  | "Y'"
  | 'ΣX'
  | 'ΣX2'
  | 'ΣY'
  | 'ΣY2'
  | 'ΣXY';

export interface DataPoint {
  readonly x: number;
  /**
   * Two-variable data: the dependent Y value. One-variable data: the number of
   * times x occurs -- a frequency (guidebook p. 60). Same storage either way;
   * only the selected method decides how it is read.
   */
  readonly y: number;
}

export interface StatisticsState {
  readonly points: readonly DataPoint[];
  readonly method: StatisticsMethod;
}

/**
 * State after 2ND RESET ENTER (guidebook p. 60).
 *
 * X' and Y' are absent by design: they are the only non-auto-computed variables
 * (p. 60), and modelling them as arguments to `predictY`/`predictX` rather than
 * as stored state keeps every function here pure and total.
 */
export const STATISTICS_DEFAULTS: StatisticsState = Object.freeze({
  points: Object.freeze([]),
  method: 'LIN',
});

/** Which transformation each model fits on (guidebook p. 61). */
const TRANSFORMS: Readonly<Record<RegressionMethod, { readonly lnX: boolean; readonly lnY: boolean }>> =
  Object.freeze({
    LIN: { lnX: false, lnY: false },
    Ln: { lnX: true, lnY: false },
    EXP: { lnX: false, lnY: true },
    PWR: { lnX: true, lnY: true },
  });

/**
 * Error 1 for the two degenerate data conditions p. 84 names as
 * "a calculation included X or Y values that are all the same".
 */
function allSameError(which: 'X' | 'Y', why: string): CalculatorError {
  return new CalculatorError(ErrorCode.Overflow, `${which} values are all the same: ${why}`);
}

/**
 * p. 60: scrolling into the results portion with no data points entered "will
 * display an error", but the guidebook never names it. Every result starts with a
 * division by n, so Error 1 is the mechanism p. 84 supplies ("Tried to divide by
 * zero (can occur internally)"). Inferred, not stated. See docs/OPEN-QUESTIONS.md.
 */
function noDataError(): CalculatorError {
  return new CalculatorError(ErrorCode.Overflow, 'no statistics data points entered');
}

/**
 * ln with the guidebook's domain rule attached.
 *
 * Error 2, not Error 5. Both errors carry an LN bullet on p. 84, but Error 5's
 * enumerates the worksheets it covers -- "TVM, Cash Flow, and Bond" -- and
 * Statistics is not among them, while Error 2's bullet is unqualified: "Tried to
 * compute LN of x when x is not > 0". This is the mechanism behind p. 61's model
 * restrictions, which p. 61 states without naming an error.
 */
function lnChecked(v: number, label: 'X' | 'Y', method: RegressionMethod): number {
  if (!(v > 0)) {
    throw new CalculatorError(
      ErrorCode.InvalidArgument,
      `${method} requires all ${label} values > 0; got ${v}`,
    );
  }
  return toInternal(Math.log(v));
}

/**
 * The 2-V outputs are not on the 1-V scroll list at all (p. 60), so asking for
 * them under 1-V is a caller bug rather than a calculator error condition -- the
 * hardware has no way to express the request. Deliberately not a CalculatorError.
 */
function requireRegression(method: StatisticsMethod): RegressionMethod {
  if (method === '1-V') {
    throw new Error('two-variable results are not displayed for one-variable statistics (p. 60)');
  }
  return method;
}

/** Cycle the calculation method, as 2ND SET does (guidebook p. 62). */
export function nextMethod(method: StatisticsMethod): StatisticsMethod {
  const i = METHOD_CYCLE.indexOf(method);
  return METHOD_CYCLE[(i + 1) % METHOD_CYCLE.length] ?? 'LIN';
}

/**
 * The variables the selected method puts on the scroll list, in p. 59's order.
 * For 1-V exactly six results exist (p. 60, p. 62).
 */
export function visibleResults(method: StatisticsMethod): readonly StatisticsVariable[] {
  if (method === '1-V') return ['n', 'x̄', 'Sx', 'σx', 'ΣX', 'ΣX2'];
  return ['n', 'x̄', 'Sx', 'σx', 'ȳ', 'Sy', 'σy', 'a', 'b', 'r', "X'", "Y'", 'ΣX', 'ΣX2', 'ΣY', 'ΣY2', 'ΣXY'];
}

/**
 * 2ND CLR WORK inside the data-entry portion: clears every X and Y, keeps the
 * calculation method (guidebook p. 60).
 */
export function clearData(state: StatisticsState): StatisticsState {
  return { points: [], method: state.method };
}

/**
 * 2ND CLR WORK inside the calculation portion: method back to LIN, data kept
 * (guidebook p. 60).
 *
 * p. 60 says this "clears all values except X and Y", which is self-contradictory
 * on a machine that recomputes every result from X and Y on access (p. 60, p. 62)
 * -- with the data retained, scrolling repopulates them immediately. The only
 * observable effects are the method reset and X'/Y' clearing, and X'/Y' are not
 * stored here. Worth pinning against hardware; see docs/OPEN-QUESTIONS.md.
 */
export function clearStat(state: StatisticsState): StatisticsState {
  return { points: state.points, method: 'LIN' };
}

export interface StatSums {
  /** 1-V: Σ of the frequencies. 2-V: the number of pairs. */
  readonly n: number;
  readonly sumX: number;
  readonly sumX2: number;
  /** Not on the 1-V scroll list (p. 60); zero there. */
  readonly sumY: number;
  readonly sumY2: number;
  readonly sumXY: number;
}

function accumulate(xs: readonly number[], ys: readonly number[]): StatSums {
  let sumX = 0;
  let sumX2 = 0;
  let sumY = 0;
  let sumY2 = 0;
  let sumXY = 0;

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    sumX = toInternal(sumX + x);
    sumX2 = toInternal(sumX2 + x * x);
    sumY = toInternal(sumY + y);
    sumY2 = toInternal(sumY2 + y * y);
    sumXY = toInternal(sumXY + x * y);
  }
  return { n: xs.length, sumX, sumX2, sumY, sumY2, sumXY };
}

/** The transformed (x,y) the selected model actually fits (guidebook p. 61). */
function transformPoints(
  points: readonly DataPoint[],
  method: RegressionMethod,
): { xs: number[]; ys: number[] } {
  const { lnX, lnY } = TRANSFORMS[method];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    xs.push(lnX ? lnChecked(p.x, 'X', method) : p.x);
    ys.push(lnY ? lnChecked(p.y, 'Y', method) : p.y);
  }
  return { xs, ys };
}

/**
 * The sums behind every displayed result.
 *
 * For a regression method these are sums of the TRANSFORMED data: p. 61 says the
 * calculator "computes the statistical results using these transformed values",
 * without restricting that to a and b. So under Ln, ΣX displays Σln(X) and x̄
 * displays the mean of ln(X). Inferred from that sentence; no worked example
 * confirms it. See docs/OPEN-QUESTIONS.md.
 *
 * For 1-V the sums are frequency-weighted: n = ΣYnn, ΣX = Σ(Ynn*Xnn),
 * ΣX2 = Σ(Ynn*Xnn²). p. 60 calls Ynn a frequency but the p. 80 formulas carry no
 * weight term, so the weighting is required for the feature to mean anything yet
 * is nowhere stated. No bound is printed for Ynn either -- unlike the Cash Flow
 * Fnn, which p. 84 bounds 0.5-9,999 with Error 4 -- so fractional, zero and
 * negative frequencies are accepted here rather than rejected on an invented rule.
 */
export function statSums(state: StatisticsState): StatSums {
  if (state.method !== '1-V') {
    const { xs, ys } = transformPoints(state.points, state.method);
    return accumulate(xs, ys);
  }

  let n = 0;
  let sumX = 0;
  let sumX2 = 0;
  for (const p of state.points) {
    const f = p.y;
    n = toInternal(n + f);
    sumX = toInternal(sumX + f * p.x);
    sumX2 = toInternal(sumX2 + f * p.x * p.x);
  }
  return { n, sumX, sumX2, sumY: 0, sumY2: 0, sumXY: 0 };
}

/**
 * How far below zero `correctedSumOfSquares` treats a value as cancellation
 * debris rather than a real negative, as a fraction of the terms it came from.
 *
 * The debris is bounded by the rounding of the two 13-digit quantities that were
 * subtracted, so it lives near 1e-13 relative. 1e-10 sits decades above that
 * noise floor and decades below any genuinely negative result.
 */
const CANCELLATION_TOLERANCE = 1e-10;

/**
 * Σx² - (Σx)²/n, the bracket numerator shared by both deviations (p. 80).
 *
 * Clamped at zero, but only within rounding noise. For non-negative frequencies
 * the quantity is a sum of squared deviations and so cannot be negative
 * mathematically, yet computing it by this cancellation form drives it a few
 * units in the last place below zero when the values are identical or nearly so
 * -- e.g. x = 0.1, 0.1, 0.1 lands around -3e-18. Left unclamped that reaches
 * Math.sqrt as a negative and returns NaN, which toInternal would report as an
 * Error 1 that the hardware does not raise: p. 84's Error 1 covers X values "all
 * the same" only where a calculation divides by zero, and neither deviation does.
 *
 * The clamp is deliberately NOT unconditional. `statSums` accepts negative 1-V
 * frequencies -- p. 60 prints no bound for Ynn, so none is invented -- and a
 * negative weight breaks the Cauchy-Schwarz guarantee that makes this quantity
 * non-negative: x = 5 at frequency 4 with x = 7 at frequency -2 gives n = 2,
 * Σfx = 6, Σfx² = 2 and a corrected sum of squares of -16. Swallowing that into
 * a reported σx = 0 would fabricate a result -- it would claim zero dispersion
 * for a data set that has no such property. Only debris is absorbed; a genuine
 * negative falls through to Math.sqrt, whose NaN toInternal turns into Error 1.
 */
function correctedSumOfSquares(sum: number, sumSq: number, n: number): number {
  const shift = (sum * sum) / n;
  const css = toInternal(sumSq - shift);
  if (css >= 0) return css;
  const noise = CANCELLATION_TOLERANCE * Math.max(Math.abs(sumSq), Math.abs(shift));
  return css > -noise ? 0 : css;
}

/** x̄ = Σx / n (guidebook p. 80). */
export function mean(sum: number, n: number): number {
  if (n === 0) throw noDataError();
  return toInternal(sum / n);
}

/** σ = [ (Σx² - (Σx)²/n) / n ]^(1/2) -- population, n weighting (guidebook p. 80). */
export function populationStdDev(sum: number, sumSq: number, n: number): number {
  if (n === 0) throw noDataError();
  return toInternal(Math.sqrt(correctedSumOfSquares(sum, sumSq, n) / n));
}

/**
 * S = [ (Σx² - (Σx)²/n) / (n-1) ]^(1/2) -- sample, n-1 weighting (guidebook p. 80).
 *
 * n = 1 divides by zero, so Error 1 (p. 84, "Tried to divide by zero (can occur
 * internally)"). The guidebook does not discuss a single-point data set; this is
 * the formula's mechanical consequence, not a stated behaviour.
 *
 * The Appendix writes this `sx` in lowercase while the p. 59 display label is
 * capital `Sx`; the two are the same quantity. Selection is by weighting, never
 * by letter case.
 */
export function sampleStdDev(sum: number, sumSq: number, n: number): number {
  if (n === 0) throw noDataError();
  if (n <= 1) {
    throw new CalculatorError(ErrorCode.Overflow, `Sx needs n > 1 for its n-1 divisor, got n = ${n}`);
  }
  return toInternal(Math.sqrt(correctedSumOfSquares(sum, sumSq, n) / (n - 1)));
}

export interface OneVariableResults {
  readonly n: number;
  readonly xbar: number;
  readonly Sx: number;
  readonly sigmax: number;
  readonly sumX: number;
  readonly sumX2: number;
}

export interface TwoVariableResults extends OneVariableResults {
  readonly ybar: number;
  readonly Sy: number;
  readonly sigmay: number;
  readonly a: number;
  readonly b: number;
  readonly r: number;
  readonly sumY: number;
  readonly sumY2: number;
  readonly sumXY: number;
}

/**
 * The six results shown for every method (guidebook p. 60, p. 62).
 *
 * Valid under a regression method too, where p. 59 keeps n, x̄, Sx, σx, ΣX and
 * ΣX2 on the list -- there computed on the transformed x, per `statSums`.
 */
export function oneVariableResults(state: StatisticsState): OneVariableResults {
  const s = statSums(state);
  if (s.n === 0) throw noDataError();
  return {
    n: s.n,
    xbar: mean(s.sumX, s.n),
    Sx: sampleStdDev(s.sumX, s.sumX2, s.n),
    sigmax: populationStdDev(s.sumX, s.sumX2, s.n),
    sumX: s.sumX,
    sumX2: s.sumX2,
  };
}

/** The p. 80 fit exactly as printed: intercept and slope on the transformed data. */
export interface TransformedFit {
  /** `a` of p. 80. For EXP and PWR this is ln(a) of the p. 61 model. */
  readonly intercept: number;
  /** `b` of p. 80. For EXP this is ln(b) of the p. 61 model. */
  readonly slope: number;
  readonly sums: StatSums;
}

/**
 * Least-squares fit on the transformed data (guidebook p. 80).
 *
 *     b = [ n*Σ(xy) - (Σy)(Σx) ] / [ n*Σ(x²) - (Σx)² ]
 *     a = [ Σy - b*Σx ] / n
 *
 * Exported because it is the literal reading of the printed appendix, and `a` and
 * `b` deliberately depart from it -- see the module header, correction 4.
 *
 * Error 1 when every transformed x is identical: the denominator collapses to
 * zero and b divides by zero (p. 84). The check is on the data rather than on the
 * computed denominator because a float denominator built from identical values
 * need not land on exactly 0.0, and a near-zero one would yield an enormous
 * finite slope instead of the error the hardware raises. n = 1 is caught by the
 * same test, which is correct: one point has no slope.
 */
export function transformedFit(state: StatisticsState): TransformedFit {
  const method = requireRegression(state.method);
  const { xs, ys } = transformPoints(state.points, method);
  if (xs.length === 0) throw noDataError();

  const first = xs[0]!;
  if (xs.every((v) => v === first)) {
    throw allSameError('X', 'the slope denominator n*Σx² - (Σx)² collapses to zero');
  }

  const s = accumulate(xs, ys);
  const denominator = toInternal(s.n * s.sumX2 - s.sumX * s.sumX);
  if (denominator === 0) {
    throw allSameError('X', 'the slope denominator n*Σx² - (Σx)² is zero');
  }

  const slope = toInternal((s.n * s.sumXY - s.sumY * s.sumX) / denominator);
  const intercept = toInternal((s.sumY - slope * s.sumX) / s.n);
  return { intercept, slope, sums: s };
}

export interface RegressionResult {
  /** y-intercept / coefficient of the p. 61 model. */
  readonly a: number;
  /** Slope / base / power of the p. 61 model. */
  readonly b: number;
  /** Correlation of the TRANSFORMED fit (guidebook p. 80, p. 61). */
  readonly r: number;
}

/**
 * a, b and r for the selected regression model.
 *
 * a and b are returned in p. 61's model form -- see the module header, correction
 * 4 -- so that Y = a + b*X, Y = a + b*ln(X), Y = a*b^X and Y = a*X^b each
 * reproduce the fitted curve directly.
 *
 * r = b*σx/σy uses the TRANSFORMED slope, never the model-form one: exponentiating
 * the slope for EXP and feeding that to r would produce a meaningless number. p. 80
 * heads these formulas as applying to transformed data, so r describes the fit of
 * the straightened data (p. 61's goodness-of-fit reading is unaffected: r near ±1
 * is a good fit, near 0 a poor one).
 *
 * Error 1 when every Y is identical: σy = 0 and r divides by zero (p. 84). Note
 * that a and b are perfectly computable in that case -- b is simply 0 -- and the
 * hardware, which computes each result only as it is scrolled to (p. 60, p. 62),
 * would show a and b before erroring on r. This function returns all three
 * together and so raises for the set. Note also that σx sits in r's NUMERATOR, so
 * σx = 0 does not make r divide by zero; the all-X-identical trigger fails earlier,
 * in the b denominator, which is why the two conditions p. 84 lumps into one
 * bullet are raised from two different places here.
 */
export function regression(state: StatisticsState): RegressionResult {
  const method = requireRegression(state.method);
  const { intercept, slope, sums } = transformedFit(state);
  const { lnY } = TRANSFORMS[method];

  const { ys } = transformPoints(state.points, method);
  const firstY = ys[0]!;
  if (ys.every((v) => v === firstY)) {
    throw allSameError('Y', 'σy = 0 and r = b*σx/σy divides by zero');
  }

  const sigmax = populationStdDev(sums.sumX, sums.sumX2, sums.n);
  const sigmay = populationStdDev(sums.sumY, sums.sumY2, sums.n);
  if (sigmay === 0) {
    throw allSameError('Y', 'σy = 0 and r = b*σx/σy divides by zero');
  }

  return {
    a: lnY ? toInternal(Math.exp(intercept)) : intercept,
    // Only EXP carries b in an exponent (Y = a*b^X), so only EXP exponentiates the
    // slope. PWR's b multiplies ln X (Y = a*X^b) and is the fitted slope as-is.
    b: method === 'EXP' ? toInternal(Math.exp(slope)) : slope,
    r: toInternal((slope * sigmax) / sigmay),
  };
}

/** Every result on the 2-V scroll list (guidebook p. 59). */
export function twoVariableResults(state: StatisticsState): TwoVariableResults {
  requireRegression(state.method);
  const s = statSums(state);
  if (s.n === 0) throw noDataError();
  const { a, b, r } = regression(state);

  return {
    n: s.n,
    xbar: mean(s.sumX, s.n),
    Sx: sampleStdDev(s.sumX, s.sumX2, s.n),
    sigmax: populationStdDev(s.sumX, s.sumX2, s.n),
    ybar: mean(s.sumY, s.n),
    Sy: sampleStdDev(s.sumY, s.sumY2, s.n),
    sigmay: populationStdDev(s.sumY, s.sumY2, s.n),
    a,
    b,
    r,
    sumX: s.sumX,
    sumX2: s.sumX2,
    sumY: s.sumY,
    sumY2: s.sumY2,
    sumXY: s.sumXY,
  };
}

/**
 * Y' from X' (guidebook p. 62).
 *
 * Worked in transformed space and mapped back, which is the same arithmetic as
 * evaluating the p. 61 model directly but keeps the domain rules in one place:
 *
 *     y' = fyInv( a_t + b_t * fx(X') )
 *
 * Error 2 when the model needs ln(X') and X' <= 0 (Ln, PWR). Error 1 when the
 * result overflows, which EXP and PWR reach easily -- Y = 3*2^X at X' = 400 is
 * about 7.7E120, past the ±9.9999999999999E99 range (p. 84).
 */
export function predictY(state: StatisticsState, xPrime: number): number {
  const method = requireRegression(state.method);
  const { intercept, slope } = transformedFit(state);
  const { lnX, lnY } = TRANSFORMS[method];

  const xt = lnX ? lnChecked(xPrime, 'X', method) : xPrime;
  const yt = toInternal(intercept + slope * xt);
  return toInternal(lnY ? Math.exp(yt) : yt);
}

/**
 * X' from Y' (guidebook p. 62).
 *
 *     x' = fxInv( (fy(Y') - a_t) / b_t )
 *
 * Error 2 when the model needs ln(Y') and Y' <= 0 (EXP, PWR). Error 1 when the
 * fitted slope is zero -- the inversion divides by it (p. 84, divide by zero).
 * pp. 59-62 do not address inverting a degenerate model; this is the mechanical
 * consequence. A zero slope does not imply the Y values are all identical, so
 * this is reachable on data that `regression` handles without complaint.
 */
export function predictX(state: StatisticsState, yPrime: number): number {
  const method = requireRegression(state.method);
  const { intercept, slope } = transformedFit(state);
  const { lnX, lnY } = TRANSFORMS[method];

  const yt = lnY ? lnChecked(yPrime, 'Y', method) : yPrime;
  if (slope === 0) {
    throw new CalculatorError(ErrorCode.Overflow, "fitted slope is zero; X' divides by zero");
  }
  const xt = toInternal((yt - intercept) / slope);
  return toInternal(lnX ? Math.exp(xt) : xt);
}

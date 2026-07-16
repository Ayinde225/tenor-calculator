/**
 * Cash Flow worksheet.
 *
 * An uneven stream over equal-length periods: an initial CFo, then up to 24
 * groups, each an amount Cnn repeated Fnn consecutive times (guidebook p. 42-43).
 * Grouping is what fits long streams into 24 slots -- the p. 49 lease covers 36
 * months in six. Sign convention: inflows positive, outflows negative (p. 42).
 *
 * NPV (guidebook p. 76):
 *
 *     NPV = CF_0 + SUM(j=1..N) CF_j x (1+i)^(-S_{j-1}) x [(1 - (1+i)^(-n_j)) / i]
 *
 *     S_j = SUM(k=1..j) n_k   for j >= 1;   S_0 = 0
 *
 * Each group is discounted by the periods that PRECEDE it, then multiplied by an
 * ordinary-annuity factor covering its own n_j periods. Group 1 is therefore
 * undiscounted (S_0 = 0) and its flows land at periods 1..n_1.
 *
 * DEVIATION FROM THE PRINTED APPENDIX -- the discount exponent. Page 76 renders it
 * as (1+i)^(-S_j-1): negative-S-sub-j, minus one. Read literally it is wrong. For
 * the guidebook's own machine example (CFo=-7000; C01=3000 F01=1; C02=4000 F02=1;
 * C03=5000 F03=4; I=20) the literal form returns 277.46, while p. 48 states the
 * answer is $7,266.44. Indexing S_{j-1} instead returns 7266.4394718, which is the
 * printed result. Two things settle it beyond the arithmetic: the appendix's own
 * `where:` block bothers to define S_j = 0 for j = 0, a case the summation j = 1..N
 * can only ever reach if the exponent indexes S_{j-1}; and the p. 49 lease
 * independently reproduces to -138,088.44 under the same reading. This is a
 * subscript that lost its nesting in typesetting -- the same class of defect as the
 * missing leading minus sign in the appendix PMT formula.
 *
 * IRR (guidebook p. 77): IRR = 100 x i, where i satisfies npv() = 0. The appendix
 * prints `i = I/Y / 100` immediately below, naming the TVM worksheet's rate
 * variable; this worksheet's rate is I (p. 42), so it reads i = I / 100. IRR
 * consumes no discount rate -- I is ignored by the solve.
 *
 * THE LN BOUNDARY (p. 84, Error 5). The error table lists, under Error 5: "TVM,
 * Cash Flow, and Bond worksheets: the LN (logarithm) input is not > 0 during
 * calculations." It does not say which Cash Flow computation takes an LN, but the
 * NPV expression contains exactly one transcendental -- the power (1+i)^(-n),
 * evaluated as e^(-n x ln(1+i)) -- so the LN input is (1+i) and the clause bites at
 * 1 + i <= 0, i.e. I <= -100. See `assertRateInLogDomain`.
 *
 * Source: guidebook pp. 42-49 (behaviour and worked examples), pp. 76-77
 * (formulas), pp. 84-85 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/** Amount and frequency of one cash-flow group (Cnn / Fnn). */
export interface CashFlowGroup {
  /** Cnn: the amount. Positive = inflow, negative = outflow (p. 42). */
  readonly C: number;
  /** Fnn: consecutive occurrences of C. Range 0.5-9,999 (p. 84, Error 4). */
  readonly F: number;
}

export interface CashFlowState {
  /** Initial cash flow. Mandatory, occurs exactly once, has no frequency (p. 43). */
  readonly CFo: number;
  /** C01/F01 .. C24/F24 in order. Length is the group count; there is no N variable. */
  readonly groups: readonly CashFlowGroup[];
  /** Discount rate per cash-flow period, as a percent. Not the TVM worksheet's I/Y. */
  readonly I: number;
}

/** Hard ceiling on GROUPS, not on periods -- frequencies stretch these across up to 24 x 9,999 periods (p. 44). */
export const MAX_CASH_FLOWS = 24;

/** Fnn bounds. Guidebook p. 84, Error 4: "the Fnn value is outside the range 0.5-9,999". */
export const MIN_FREQUENCY = 0.5;
export const MAX_FREQUENCY = 9999;

/**
 * Fnn default.
 *
 * Never printed as a default, but demonstrated twice on p. 47: F01 and F03 both
 * read 1.00 with nothing keyed into them, and the flow inserted at C02 takes
 * F02 = 1.00 unkeyed.
 */
export const DEFAULT_FREQUENCY = 1;

/** A slot the list has not reached: amount 0, frequency 1. */
const VACANT: CashFlowGroup = Object.freeze({ C: 0, F: DEFAULT_FREQUENCY });

/**
 * The whole worksheet at its defaults -- what 2ND RESET ENTER leaves behind (p. 42,
 * and the p. 49 lease opens with exactly this).
 *
 * NOT the right value to spread wholesale for `CF` `2ND CLR WORK`: that bullet
 * resets only CFo, Cnn and Fnn and leaves I alone (p. 42), so a caller
 * implementing it must preserve the current I rather than take the 0 here.
 */
export const CASH_FLOW_DEFAULTS: CashFlowState = Object.freeze({
  CFo: 0,
  groups: Object.freeze([]) as readonly CashFlowGroup[],
  I: 0,
});

/**
 * Below this the annuity factor's 0/0 is resolved by its limit. Matches the
 * threshold tvm.ts uses for the same indeterminacy.
 */
const ZERO_RATE_EPSILON = 1e-15;

/** Bisection budget per bracket. Error 7 if a bracket will not resolve (p. 46, p. 85). */
const MAX_ITERATIONS = 200;

/** Two roots nearer than this are the same root found from two brackets. */
const ROOT_DEDUPE_TOLERANCE = 1e-9;

function assertFrequency(F: number): void {
  if (!Number.isFinite(F) || F < MIN_FREQUENCY || F > MAX_FREQUENCY) {
    throw new CalculatorError(
      ErrorCode.OutOfRange,
      `Fnn must be ${MIN_FREQUENCY}-${MAX_FREQUENCY}, got ${F}`,
    );
  }
}

/**
 * Error 5 when the NPV summation would take the logarithm of a non-positive
 * number (p. 84: "TVM, Cash Flow, and Bond worksheets: the LN (logarithm) input
 * is not > 0 during calculations").
 *
 * The only transcendental in the p. 76 expression is the power (1+i)^(-n_j),
 * which a decimal machine evaluates as e^(-n_j x ln(1+i)). Its LN input is
 * therefore (1+i), and the clause bites at 1 + i <= 0 -- that is, I <= -100.
 *
 * The guard fires only when the summation actually reaches that power: an empty
 * stream, or one whose every amount is zero, evaluates no term at all and is
 * plain CFo at any rate. That is what "during calculations" reads as, and it
 * matches this module's own evaluation order in npvAtRate.
 *
 * WHY THIS IS NOT LEFT TO FALL THROUGH. Without the guard, log1p(i <= -1) returns
 * NaN (or -Infinity at exactly i = -1) and toInternal converts it into Error 1,
 * "Overflow -- result is not a number". Nothing overflowed, and NaN is not a state
 * the hardware can be in; Error 1's own causes (p. 84) do not cover it. Error 5 is
 * the condition the guidebook names for this worksheet at this boundary.
 *
 * UNSPECIFIED: no worked example enters I <= -100, and p. 84 does not say which
 * Cash Flow computation takes the LN. The identification above is an inference
 * from the sole transcendental in the printed formula, not a stated fact. IRR is
 * unaffected either way -- its probe grid stops at i = -0.9999 and never reaches
 * the boundary. See docs/OPEN-QUESTIONS.md.
 */
function assertRateInLogDomain(i: number, groups: readonly CashFlowGroup[]): void {
  if (1 + i > 0) return;
  if (!groups.some((g) => g.C !== 0)) return;
  throw new CalculatorError(
    ErrorCode.NoSolution,
    `LN input must be > 0; discount rate gives 1 + i = ${1 + i}`,
  );
}

/**
 * The hardware cannot navigate past C24, so an out-of-range slot is unreachable
 * from the keypad. Guarded anyway because this module is called directly too.
 */
function assertSlot(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > MAX_CASH_FLOWS) {
    throw new CalculatorError(ErrorCode.OutOfRange, `cash-flow slot must be 1-${MAX_CASH_FLOWS}, got ${n}`);
  }
}

/** Read slot n (1-based). Slots past the end of the list read as vacant (p. 47: C03 = 0.00 after a delete). */
export function flowAt(state: CashFlowState, n: number): CashFlowGroup {
  assertSlot(n);
  return state.groups[n - 1] ?? VACANT;
}

/** Number of groups currently held. */
export function flowCount(state: CashFlowState): number {
  return state.groups.length;
}

/**
 * Grow the list so slot n exists, filling any gap with vacant slots.
 *
 * Entry is documented as a sequential walk (p. 43-44), so a gap cannot open from
 * the keypad; this only matters when the module is driven directly.
 */
function extendTo(groups: readonly CashFlowGroup[], n: number): CashFlowGroup[] {
  const next = groups.slice();
  while (next.length < n) next.push(VACANT);
  return next;
}

export function setCFo(state: CashFlowState, value: number): CashFlowState {
  return { ...state, CFo: toInternal(value) };
}

/** Enter the discount rate, in percent per period. Stored unrounded -- see solveNPV. */
export function setI(state: CashFlowState, value: number): CashFlowState {
  return { ...state, I: toInternal(value) };
}

/** Key an amount into Cnn, leaving its frequency as-is. */
export function setFlow(state: CashFlowState, n: number, amount: number): CashFlowState {
  assertSlot(n);
  const groups = extendTo(state.groups, n);
  const current = groups[n - 1] ?? VACANT;
  groups[n - 1] = { C: toInternal(amount), F: current.F };
  return { ...state, groups };
}

/** Key a frequency into Fnn, leaving its amount as-is. Error 4 outside 0.5-9,999. */
export function setFrequency(state: CashFlowState, n: number, F: number): CashFlowState {
  assertSlot(n);
  assertFrequency(F);
  const groups = extendTo(state.groups, n);
  const current = groups[n - 1] ?? VACANT;
  groups[n - 1] = { C: current.C, F: toInternal(F) };
  return { ...state, groups };
}

/**
 * 2ND DEL: remove flow n and its frequency together, shifting every later flow
 * down one slot (p. 44). The list shortens -- position n is consumed, not blanked,
 * so the vacated tail slot reads 0.00.
 *
 * Deleting a slot past the end is a no-op: there is nothing there to remove.
 * CFo has no delete -- it is structurally required and 2ND DEL is documented only
 * for Cnn (p. 44).
 */
export function deleteFlow(state: CashFlowState, n: number): CashFlowState {
  assertSlot(n);
  if (n > state.groups.length) return state;
  const groups = state.groups.slice();
  groups.splice(n - 1, 1);
  return { ...state, groups };
}

/**
 * 2ND INS: the new flow lands AT slot n and everything from there renumbers
 * upward, "up to the maximum of 24" (p. 44). An inserted flow takes the Fnn
 * default of 1, and the displaced amounts carry their own frequencies with them
 * (p. 47: old C02=5,000/F02=4 reappears as C03=5,000/F03=4).
 *
 * UNSPECIFIED: the guidebook does not say what a 2ND INS on a full list does --
 * whether the 24th flow is silently discarded or the insert is refused. "Increases
 * the number of the following cash flows, up to the maximum of 24" reads as the
 * list saturating rather than erroring, so the overflowing tail is dropped. No
 * worked example exercises it. See docs/OPEN-QUESTIONS.md.
 */
export function insertFlow(state: CashFlowState, n: number, amount: number): CashFlowState {
  assertSlot(n);
  const groups = extendTo(state.groups, n - 1);
  groups.splice(n - 1, 0, { C: toInternal(amount), F: DEFAULT_FREQUENCY });
  if (groups.length > MAX_CASH_FLOWS) groups.length = MAX_CASH_FLOWS;
  return { ...state, groups };
}

/**
 * Count sign changes across the stream.
 *
 * CFo participates: the p. 45 "no sign change" diagram draws CFo and C01-C05 all
 * as inflows, and the one-sign-change diagram flips only CFo. Zero flows are
 * skipped rather than counted as a change -- implied by the p. 49 lease, which
 * carries CFo=0, C01=0, C03=0 and C05=0 alongside negative flows and is treated as
 * an ordinary problem. Frequencies are irrelevant: repeating a flow cannot flip
 * its sign.
 */
export function signChanges(state: CashFlowState): number {
  const signs = [state.CFo, ...state.groups.map((g) => g.C)]
    .filter((v) => v !== 0)
    .map(Math.sign);

  let changes = 0;
  for (let k = 1; k < signs.length; k++) {
    if (signs[k] !== signs[k - 1]) changes++;
  }
  return changes;
}

/**
 * The ordinary-annuity factor (1 - (1+i)^(-n)) / i.
 *
 * Evaluated as -expm1(-n x log1p(i)) / i rather than transcribed literally. The
 * literal form subtracts two doubles that agree to nearly every significant digit
 * once i is small: at i = 1e-11 it returns 4.00000033 for n = 4, an absolute error
 * of 3e-7 against a true 3.9999999999, and NPV drifts by cents at rates a long way
 * from zero. log1p/expm1 hold full precision across the range and agree with the
 * literal form to within a few ulps at the rates the guidebook's examples use, so
 * this is a numerical-stability choice and not a change of formula.
 *
 * At i = 0 the factor is 0/0. The guidebook gives no i = 0 variant; the limit is
 * n_j, which makes NPV the plain undiscounted sum. I = 0 is the default, so
 * NPV DOWN CPT straight after a reset lands here.
 */
function annuityFactor(i: number, n: number): number {
  if (Math.abs(i) < ZERO_RATE_EPSILON) return n;
  return -Math.expm1(-n * Math.log1p(i)) / i;
}

/**
 * The NPV expression at an arbitrary periodic rate, in raw doubles.
 *
 * Kept unrounded because it is the residual the IRR iteration drives to zero;
 * only stored results pass through toInternal.
 *
 * Zero-amount groups are skipped: they contribute nothing but still advance the
 * period counter S_j, and skipping them also avoids a 0 x Infinity NaN when the
 * probe rate sits near -100%.
 */
function npvAtRate(i: number, CFo: number, groups: readonly CashFlowGroup[]): number {
  let S = 0;
  let total = CFo;

  for (const g of groups) {
    if (g.C !== 0) {
      total += g.C * Math.pow(1 + i, -S) * annuityFactor(i, g.F);
    }
    S += g.F;
  }
  return total;
}

/**
 * Compute NPV at the stored rate I.
 *
 * I is used exactly as stored, never at the display setting. The p. 49 lease keys
 * `10 / 12 ENTER`, displays I = 0.83 and retains 0.8333333333333; computing with a
 * literal 0.83 gives -138,181.32 against the published -138,088.44, off by $92.89.
 * Rounding the stored rate to DEC would fail that example.
 *
 * Error 4 for an out-of-range Fnn; Error 5 at or below I = -100, where the LN
 * input goes non-positive (p. 84). See assertRateInLogDomain.
 */
export function solveNPV(state: CashFlowState): number {
  for (const g of state.groups) assertFrequency(g.F);
  const i = state.I / 100;
  assertRateInLogDomain(i, state.groups);
  return toInternal(npvAtRate(i, state.CFo, state.groups));
}

/**
 * Rates probed for sign changes before bisecting.
 *
 * Dense just above -100%, where the discount factors blow up, and out to +1,000,000%
 * to catch the steep short streams. The grid exists to bracket every root the
 * hardware could plausibly report; anything it misses surfaces as Error 7, which is
 * precisely the documented outcome when the calculator cannot find IRR (p. 46).
 */
function probeRates(): number[] {
  const probes = [-0.9999, -0.999, -0.99, -0.95, -0.9, -0.85, -0.8, -0.75, -0.7, -0.65, -0.6,
    -0.55, -0.5, -0.45, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, -0.02, -0.01,
    -0.005, -0.001, 0];
  for (let v = 0.005; v <= 2.0001; v += 0.005) probes.push(v);
  for (let v = 2.05; v <= 20.0001; v += 0.05) probes.push(v);
  for (const v of [25, 30, 40, 50, 75, 100, 250, 500, 1000, 5000, 10000]) probes.push(v);
  return probes;
}

/** Bisect a bracketed root to machine precision. */
function bisect(f: (i: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const mid = (a + b) / 2;
    const fmid = f(mid);
    if (fmid === 0 || (b - a) / 2 <= Math.max(Math.abs(mid), 1) * 1e-16) return mid;
    if (Math.sign(fmid) === Math.sign(fa)) {
      a = mid;
      fa = fmid;
    } else {
      b = mid;
    }
  }
  throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'IRR did not converge');
}

/**
 * Solve for IRR, in percent.
 *
 * Error 5 when the stream has no sign change -- "the calculator computed IRR
 * without at least one sign change in the cash-flow list" (p. 84). With no sign
 * change no rate can balance the flows.
 *
 * Error 7 when the iteration cannot land a root, which the guidebook explicitly
 * allows even when a solution exists (p. 46).
 *
 * MULTIPLE ROOTS: with two or more sign changes there can be as many roots as
 * sign changes, and the calculator "displays the one closest to zero" (p. 46).
 * Every bracketed root is collected and the one of smallest magnitude returned.
 *
 * UNSPECIFIED: p. 46 does not say closest to zero in what sense, whether negative
 * roots are candidates, or what the hardware seeds from, and no worked example
 * exercises a multi-root stream. Smallest |IRR| is the plain reading, but TI's
 * exact choice is not recoverable from this documentation -- and the guidebook is
 * blunt that such a root has no financial meaning anyway. See
 * docs/OPEN-QUESTIONS.md.
 */
export function solveIRR(state: CashFlowState): number {
  for (const g of state.groups) assertFrequency(g.F);

  if (signChanges(state) === 0) {
    throw new CalculatorError(
      ErrorCode.NoSolution,
      'IRR needs at least one sign change in the cash-flow list',
    );
  }

  const f = (i: number): number => npvAtRate(i, state.CFo, state.groups);
  const roots: number[] = [];
  let prev: { i: number; y: number } | null = null;

  for (const i of probeRates()) {
    const y = f(i);
    if (!Number.isFinite(y)) {
      prev = null;
      continue;
    }
    if (y === 0) {
      roots.push(i);
    } else if (prev && Math.sign(y) !== Math.sign(prev.y)) {
      roots.push(bisect(f, prev.i, i));
    }
    prev = { i, y };
  }

  if (roots.length === 0) {
    throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'IRR did not converge');
  }

  // Distinct roots only: adjacent brackets can resolve to the same point.
  const distinct = roots
    .slice()
    .sort((a, b) => a - b)
    .filter((r, k, all) => k === 0 || Math.abs(r - (all[k - 1] ?? r)) > ROOT_DEDUPE_TOLERANCE);

  const closest = distinct.reduce((best, r) => (Math.abs(r) < Math.abs(best) ? r : best), distinct[0] ?? 0);
  return toInternal(100 * closest);
}

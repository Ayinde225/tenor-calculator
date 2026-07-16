/**
 * Time-Value-of-Money engine.
 *
 * Everything here derives from the single fundamental equation (guidebook p. 74):
 *
 *     0 = PV + PMT x G(i) x [(1 - (1+i)^-N) / i] + FV x (1+i)^-N
 *
 * where G(i) = 1 + i*k, with k=0 for END and k=1 for BGN (p. 75).
 *
 * WHY NOT THE PRINTED CLOSED FORMS: the appendix also prints an explicit formula
 * per variable, but the printed PMT form omits a leading negative sign. Evaluated
 * literally it returns +729.13 for the guidebook's own mortgage example, which
 * the hardware displays as -729.13. Deriving every solve from the fundamental
 * equation instead keeps the sign convention self-consistent and matches the
 * worked examples. See docs/OPEN-QUESTIONS.md.
 *
 * Sign convention (p. 26): money paid out is negative, money received positive.
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

export type PaymentMode = 'END' | 'BGN';

export interface TvmState {
  /** Number of payment periods. */
  readonly N: number;
  /** Nominal annual interest rate, as a percentage (e.g. 6.125). */
  readonly IY: number;
  readonly PV: number;
  readonly PMT: number;
  readonly FV: number;
  /** Payment periods per year. Must be > 0 (Error 4). */
  readonly PY: number;
  /** Compounding periods per year. Must be > 0 (Error 4). */
  readonly CY: number;
  readonly mode: PaymentMode;
}

export type TvmVariable = 'N' | 'IY' | 'PV' | 'PMT' | 'FV';

/** Defaults after 2ND CLR TVM (guidebook p. 25). */
export const TVM_DEFAULTS: TvmState = Object.freeze({
  N: 0,
  IY: 0,
  PV: 0,
  PMT: 0,
  FV: 0,
  PY: 12,
  CY: 12,
  mode: 'END',
});

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-12;

function assertPeriods(PY: number, CY: number): void {
  // Guidebook p. 84: Error 4 when P/Y or C/Y <= 0.
  if (PY <= 0) throw new CalculatorError(ErrorCode.OutOfRange, `P/Y must be > 0, got ${PY}`);
  if (CY <= 0) throw new CalculatorError(ErrorCode.OutOfRange, `C/Y must be > 0, got ${CY}`);
}

/**
 * Convert the nominal annual rate I/Y into the effective rate per PAYMENT period.
 *
 *     x = (0.01 x I/Y) / C/Y      nominal rate per compounding period
 *     y = C/Y / P/Y               compounding periods per payment period
 *     i = (1 + x)^y - 1
 *
 * Guidebook p. 74. When C/Y = P/Y this collapses to i = I/Y / (100 x P/Y).
 */
export function periodicRate(IY: number, PY: number, CY: number): number {
  assertPeriods(PY, CY);
  const x = (0.01 * IY) / CY;
  const y = CY / PY;
  if (x <= -1) {
    // ln of a non-positive number: Error 5 per p. 84.
    throw new CalculatorError(ErrorCode.NoSolution, 'interest rate produces ln of non-positive');
  }
  return toInternal(Math.pow(1 + x, y) - 1);
}

/**
 * Inverse of `periodicRate`: per-payment-period rate back to nominal annual.
 *
 *     I/Y = 100 x C/Y x [(1 + i)^(P/Y / C/Y) - 1]
 *
 * Guidebook p. 74.
 */
export function nominalRate(i: number, PY: number, CY: number): number {
  assertPeriods(PY, CY);
  if (1 + i <= 0) {
    throw new CalculatorError(ErrorCode.NoSolution, 'rate produces ln of non-positive');
  }
  return toInternal(100 * CY * (Math.pow(1 + i, PY / CY) - 1));
}

/** G(i) = 1 + i*k. BGN shifts every payment one period earlier (p. 75). */
function gFactor(i: number, mode: PaymentMode): number {
  return mode === 'BGN' ? 1 + i : 1;
}

/**
 * The fundamental equation's left-hand side. Zero when the five variables are
 * mutually consistent. This is the residual the I/Y solve drives to zero.
 */
export function tvmResidual(
  i: number,
  N: number,
  PV: number,
  PMT: number,
  FV: number,
  mode: PaymentMode,
): number {
  const G = gFactor(i, mode);
  if (Math.abs(i) < 1e-15) {
    // Limit as i -> 0: the annuity factor tends to N.
    return PV + PMT * N + FV;
  }
  const disc = Math.pow(1 + i, -N);
  return PV + PMT * G * ((1 - disc) / i) + FV * disc;
}

/** Solve for FV. */
export function solveFV(s: TvmState): number {
  const i = periodicRate(s.IY, s.PY, s.CY);
  if (Math.abs(i) < 1e-15) {
    return toInternal(-(s.PV + s.PMT * s.N));
  }
  const G = gFactor(i, s.mode);
  const compound = Math.pow(1 + i, s.N);
  const annuity = (1 - Math.pow(1 + i, -s.N)) / i;
  return toInternal(-(s.PV + s.PMT * G * annuity) * compound);
}

/** Solve for PV. */
export function solvePV(s: TvmState): number {
  const i = periodicRate(s.IY, s.PY, s.CY);
  if (Math.abs(i) < 1e-15) {
    return toInternal(-(s.FV + s.PMT * s.N));
  }
  const G = gFactor(i, s.mode);
  const disc = Math.pow(1 + i, -s.N);
  const annuity = (1 - disc) / i;
  return toInternal(-(s.PMT * G * annuity + s.FV * disc));
}

/** Solve for PMT. */
export function solvePMT(s: TvmState): number {
  const i = periodicRate(s.IY, s.PY, s.CY);
  if (Math.abs(i) < 1e-15) {
    if (s.N === 0) throw new CalculatorError(ErrorCode.NoSolution, 'N is zero');
    return toInternal(-(s.PV + s.FV) / s.N);
  }
  const G = gFactor(i, s.mode);
  const disc = Math.pow(1 + i, -s.N);
  const annuity = (1 - disc) / i;
  if (annuity === 0 || G === 0) {
    throw new CalculatorError(ErrorCode.NoSolution, 'degenerate annuity factor');
  }
  return toInternal(-(s.PV + s.FV * disc) / (G * annuity));
}

/** Solve for N. */
export function solveN(s: TvmState): number {
  const i = periodicRate(s.IY, s.PY, s.CY);
  if (Math.abs(i) < 1e-15) {
    if (s.PMT === 0) throw new CalculatorError(ErrorCode.NoSolution, 'PMT is zero with i = 0');
    return toInternal(-(s.PV + s.FV) / s.PMT);
  }
  const G = gFactor(i, s.mode);

  // From the fundamental equation:
  //   N = ln[(PMT*G - FV*i) / (PMT*G + PV*i)] / ln(1+i)
  const numerator = s.PMT * G - s.FV * i;
  const denominator = s.PMT * G + s.PV * i;

  if (denominator === 0 || numerator / denominator <= 0) {
    // ln of a non-positive value: Error 5 (guidebook p. 84).
    throw new CalculatorError(ErrorCode.NoSolution, 'no N satisfies these values');
  }
  return toInternal(Math.log(numerator / denominator) / Math.log(1 + i));
}

/**
 * Solve for I/Y.
 *
 * The fundamental equation is transcendental in i, so this iterates. Newton's
 * method converges quickly for well-posed problems; a bracketing bisection
 * fallback catches the cases where Newton wanders (flat derivative, bad seed).
 *
 * Error 5 when FV, N x PMT and PV all share a sign -- with no sign change there
 * is no rate at which the cash flows balance (guidebook p. 84).
 * Error 7 if the iteration limit is hit (p. 85).
 */
export function solveIY(s: TvmState): number {
  assertPeriods(s.PY, s.CY);

  const signs = [s.FV, s.N * s.PMT, s.PV].filter((v) => v !== 0).map(Math.sign);
  if (signs.length > 0 && signs.every((v) => v === signs[0])) {
    throw new CalculatorError(
      ErrorCode.NoSolution,
      'FV, N x PMT and PV share a sign; cash inflows and outflows must differ',
    );
  }
  if (s.N === 0) {
    throw new CalculatorError(ErrorCode.NoSolution, 'N is zero');
  }

  const f = (i: number): number => tvmResidual(i, s.N, s.PV, s.PMT, s.FV, s.mode);
  const i = findRate(f);
  return nominalRate(i, s.PY, s.CY);
}

/**
 * Root-find on the TVM residual.
 *
 * Newton first (fast, quadratic), then bisection over a bracketed interval if
 * Newton fails to land. Rates below -100% per period are not meaningful, so the
 * search is bounded there.
 */
function findRate(f: (i: number) => number): number {
  // Newton with a numerical derivative.
  let i = 0.01;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const y = f(i);
    if (Math.abs(y) < TOLERANCE) return i;

    const h = Math.max(Math.abs(i) * 1e-7, 1e-10);
    const dy = (f(i + h) - f(i - h)) / (2 * h);
    if (!Number.isFinite(dy) || dy === 0) break;

    const next = i - y / dy;
    if (!Number.isFinite(next)) break;
    if (next <= -1) {
      i = (i - 1) / 2; // stay inside the domain
      continue;
    }
    if (Math.abs(next - i) < TOLERANCE) return next;
    i = next;
  }

  // Bisection fallback: scan outward for a sign change, then bisect.
  const bracket = findBracket(f);
  if (!bracket) {
    throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'I/Y did not converge');
  }
  let [lo, hi] = bracket;
  for (let iter = 0; iter < MAX_ITERATIONS * 4; iter++) {
    const mid = (lo + hi) / 2;
    const y = f(mid);
    if (Math.abs(y) < TOLERANCE || (hi - lo) / 2 < TOLERANCE) return mid;
    if (Math.sign(y) === Math.sign(f(lo))) lo = mid;
    else hi = mid;
  }
  throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'I/Y did not converge');
}

function findBracket(f: (i: number) => number): [number, number] | null {
  const probes = [
    -0.999, -0.9, -0.5, -0.25, -0.1, -0.01, -1e-6, 1e-6, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10,
  ];
  let prev: { i: number; y: number } | null = null;
  for (const i of probes) {
    const y = f(i);
    if (!Number.isFinite(y)) {
      prev = null;
      continue;
    }
    if (y === 0) return [i, i];
    if (prev && Math.sign(y) !== Math.sign(prev.y)) return [prev.i, i];
    prev = { i, y };
  }
  return null;
}

/** Compute the requested unknown, leaving the other four untouched. */
export function computeTvm(state: TvmState, unknown: TvmVariable): number {
  switch (unknown) {
    case 'N':
      return solveN(state);
    case 'IY':
      return solveIY(state);
    case 'PV':
      return solvePV(state);
    case 'PMT':
      return solvePMT(state);
    case 'FV':
      return solveFV(state);
  }
}

/**
 * Breakeven worksheet.
 *
 * Five variables around one linear identity (guidebook p. 81):
 *
 *     PFT = PQ - (FC + VCQ)
 *
 * NOTHING IS CORRECTED HERE, AND THAT IS WORTH SAYING OUT LOUD. Most of this
 * appendix reached us damaged -- flattened exponents, dropped parentheses, a
 * missing leading minus on TVM's PMT. This equation survived the vector export
 * intact. The p. 72 example is the arbiter: FC=3,000, VC=15, P=20, PFT=0 gives
 * Q = (3,000 + 0)/(20 - 15) = 600, which is exactly what the hardware displays.
 * Read literally, the printed formula reproduces that. Recorded as verified
 * rather than corrected.
 *
 * Sign convention: unlike TVM (p. 26), there isn't one. FC and VC are entered as
 * positive magnitudes and the equation subtracts them; nothing is negated on the
 * way in or on the way out. The p. 72 example confirms it -- a cash-flow reading
 * of FC would flip the sign of Q.
 *
 * Solved forms, each a straight rearrangement of the printed equation:
 *
 *     Q   = (FC + PFT) / (P - VC)
 *     P   = (PFT + FC + VC x Q) / Q
 *     VC  = (P x Q - FC - PFT) / Q
 *     FC  = P x Q - VC x Q - PFT
 *     PFT = P x Q - (FC + VC x Q)
 *
 * Source: guidebook pp. 71-72 (behaviour, worked example), p. 81 (formula),
 * p. 84 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

export interface BreakevenState {
  /** Fixed cost, as a positive magnitude. */
  readonly FC: number;
  /** Variable cost per unit, as a positive magnitude. */
  readonly VC: number;
  /** Unit price. `P = VC` is a pole when solving Q. */
  readonly P: number;
  /** Profit. Set to 0 to make the computed Q a breakeven quantity (p. 71). */
  readonly PFT: number;
  /** Quantity. */
  readonly Q: number;
}

export type BreakevenVariable = 'FC' | 'VC' | 'P' | 'PFT' | 'Q';

/** Defaults after 2ND CLR WORK inside the Breakeven worksheet (guidebook p. 71). */
export const BREAKEVEN_DEFAULTS: BreakevenState = Object.freeze({
  FC: 0,
  VC: 0,
  P: 0,
  PFT: 0,
  Q: 0,
});

/**
 * Contribution margin per unit, P - VC.
 *
 * toInternal normalises the divisor to the machine's 13 digits before the
 * division, so the quotient matches what a decimal machine would produce, and it
 * surfaces an overflow in the subtraction itself.
 *
 * It is NOT what decides the P = VC pole, and it should not be mistaken for a
 * float-tolerance guard. Stored values are already internal, and subtracting two
 * of them never rounds a genuine difference away to zero. The pole is decided
 * upstream by the store: two keystroke sequences that land on the same 13-digit
 * value are the same value by the time they reach here, and their margin is
 * exactly zero. A margin that survives as nonzero is a real one.
 */
function contributionMargin(s: BreakevenState): number {
  return toInternal(s.P - s.VC);
}

/**
 * Why Error 1 and not Error 5.
 *
 * "No quantity satisfies these values" is a fair English description of the
 * P = VC case, but Error 5 is not the code for it. Page 84 enumerates Error 5's
 * causes exhaustively -- TVM computing I/Y when FV, N x PMT and PV share a sign;
 * an LN input not > 0; IRR without a sign change -- and the Breakeven worksheet
 * appears in none of them. Error 1 explicitly covers "tried to divide by zero
 * (can occur internally)", which is precisely what the solve does here.
 */
function divideByZero(detail: string): never {
  throw new CalculatorError(ErrorCode.Overflow, detail);
}

/** Solve for PFT. Total revenue less total cost; never degenerate. */
export function solvePFT(s: BreakevenState): number {
  return toInternal(s.P * s.Q - (s.FC + s.VC * s.Q));
}

/** Solve for FC. Contribution less the profit taken out; never degenerate. */
export function solveFC(s: BreakevenState): number {
  return toInternal(s.P * s.Q - s.VC * s.Q - s.PFT);
}

/**
 * Solve for Q.
 *
 *     Q = (FC + PFT) / (P - VC)
 *
 * At P = VC each unit sold contributes nothing toward the fixed cost, so the
 * divisor vanishes. Both branches of that pole land on Error 1: with FC + PFT
 * nonzero the division is x/0, and with FC + PFT zero it is 0/0 -- the case the
 * spec notes every quantity satisfies. The guidebook discusses neither, but a
 * decimal machine dividing by a zero divisor raises Error 1 either way, so the
 * distinction never becomes observable.
 *
 * The result is deliberately not rounded to an integer. Fractional quantities
 * are reachable and the guidebook offers no rounding rule (p. 72 shows only the
 * exact case), so inventing one here would be a parity risk, not a courtesy.
 */
export function solveQ(s: BreakevenState): number {
  const margin = contributionMargin(s);
  if (margin === 0) {
    divideByZero(`P (${s.P}) equals VC (${s.VC}); contribution margin is zero`);
  }
  return toInternal((s.FC + s.PFT) / margin);
}

/**
 * Solve for P.
 *
 *     P = (PFT + FC + VC x Q) / Q
 *
 * Q = 0 divides by zero (p. 84): with nothing sold there is no per-unit price
 * that recovers a fixed cost.
 */
export function solveP(s: BreakevenState): number {
  if (s.Q === 0) {
    divideByZero('Q is zero; no unit price is implied by zero units');
  }
  return toInternal((s.PFT + s.FC + s.VC * s.Q) / s.Q);
}

/**
 * Solve for VC.
 *
 *     VC = (P x Q - FC - PFT) / Q
 *
 * Q = 0 divides by zero, for the same reason as `solveP`.
 */
export function solveVC(s: BreakevenState): number {
  if (s.Q === 0) {
    divideByZero('Q is zero; no unit variable cost is implied by zero units');
  }
  return toInternal((s.P * s.Q - s.FC - s.PFT) / s.Q);
}

/** Compute the requested unknown, leaving the other four untouched. */
export function computeBreakeven(state: BreakevenState, unknown: BreakevenVariable): number {
  switch (unknown) {
    case 'FC':
      return solveFC(state);
    case 'VC':
      return solveVC(state);
    case 'P':
      return solveP(state);
    case 'PFT':
      return solvePFT(state);
    case 'Q':
      return solveQ(state);
  }
}

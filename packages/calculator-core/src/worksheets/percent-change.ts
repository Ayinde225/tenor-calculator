/**
 * Percent Change / Compound Interest worksheet.
 *
 * Three problem shapes, one equation (guidebook p. 63): percent change,
 * compound interest, and cost-sell-markup. The worksheet holds four variables
 * and solves for whichever one the user leaves unkeyed:
 *
 *     NEW = OLD x (1 + %CH/100)^#PD
 *
 * THE PRINTED FORMULA LOSES ITS EXPONENT. p. 81 renders it as
 *
 *     NEW = OLD(1 + %CH/100)#PD
 *
 * with #PD flattened onto the baseline immediately right of the closing
 * parenthesis -- typographically indistinguishable from a trailing factor. It
 * is an exponent. The compound-interest example (p. 65) settles it: OLD=500,
 * NEW=750, #PD=5 displays %CH = 8.45, which is 100 x ((750/500)^(1/5) - 1) =
 * 8.4472. Read #PD as a factor and the same inputs give
 * 100 x (750/(500 x 5) - 1) = -70. The example wins.
 *
 * Role mapping, all off the one equation (p. 64):
 *   percent change      OLD = old value,      NEW = new value,      #PD = 1
 *   compound interest   OLD = present value,  NEW = future value,   %CH = rate
 *                       per period,           #PD = number of periods
 *   cost-sell-markup    OLD = cost,           NEW = selling price,  #PD = 1
 *
 * Markup lives here rather than in Profit Margin because it is measured against
 * COST; Profit Margin's MAR is measured against the selling price (p. 70). The
 * same 100/125 pair gives %CH = 25 here and MAR = 20 there.
 *
 * Exponentiation goes through math/operators.js `power` rather than Math.pow,
 * because raising to #PD is the same y^x the keyboard exposes and carries the
 * same p. 84 domain rule: with y < 0, x must be an integer or the inverse of an
 * integer. That rule is load-bearing here -- a negative NEW/OLD under a
 * fractional #PD is Error 2, and (-8)^(1/3) = -2 is a real root Math.pow returns
 * NaN for. `power` also settles what an even root of a negative does (Error 2,
 * an inference: p. 84 permits the exponent form but no real value exists).
 * Keeping that in one place stops the worksheet drifting from the keyboard.
 * `power` applies its own toInternal, so the compounding factor is rounded to
 * 13 digits before being multiplied out -- which is what a decimal machine does.
 *
 * Source: guidebook pp. 63-66 (behaviour, examples), p. 81 (formula),
 * p. 84 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { power } from '../math/operators.js';
import { naturalLog } from '../math/functions.js';
import { CalculatorError, ErrorCode } from '../errors.js';

export interface PercentChangeState {
  /** Old value / cost / present value. */
  readonly OLD: number;
  /** New value / selling price / future value. */
  readonly NEW: number;
  /** Displayed as %CH. A percentage, not a fraction: 6.38 means 6.38%. */
  readonly CH: number;
  /** Displayed as #PD. Number of periods; the exponent in the governing equation. */
  readonly PD: number;
}

export type PercentChangeVariable = 'OLD' | 'NEW' | 'CH' | 'PD';

/**
 * Defaults after 2ND CLR WORK inside this worksheet.
 *
 * #PD CLEARS TO 1, NOT 0. The reset table on p. 63 prints 0, but it disagrees
 * with the rest of the chapter and with the hardware. The cost-sell-markup
 * example (pp. 65-66) presses 2ND CLR WORK, keys only OLD=100 and NEW=125, then
 * computes %CH = 25.00 -- unreachable unless #PD is 1 after the clear, since
 * #PD = 0 makes the 1/#PD in the %CH solve a divide by zero. The p. 64 prose
 * independently says to "leave #PD set to 1" for percent-change and markup work.
 * The printed table is the outlier.
 */
export const PERCENT_CHANGE_DEFAULTS: PercentChangeState = Object.freeze({
  OLD: 0,
  NEW: 0,
  CH: 0,
  PD: 1,
});

/** The per-period compounding factor, (1 + %CH/100). */
function growthFactor(CH: number): number {
  return 1 + CH / 100;
}

/** Solve for NEW. */
export function solveNEW(s: PercentChangeState): number {
  return toInternal(s.OLD * power(growthFactor(s.CH), s.PD));
}

/** Solve for OLD. */
export function solveOLD(s: PercentChangeState): number {
  const factor = power(growthFactor(s.CH), s.PD);
  if (factor === 0) {
    // %CH = -100 collapses the factor to zero. p. 84: an internal divide by
    // zero is Error 1. The guidebook never calls this case out.
    throw new CalculatorError(
      ErrorCode.Overflow,
      'divide by zero: (1 + %CH/100)^#PD is zero',
    );
  }
  return toInternal(s.NEW / factor);
}

/**
 * Solve for %CH.
 *
 *     %CH = 100 x ( (NEW/OLD)^(1/#PD) - 1 )
 */
export function solveCH(s: PercentChangeState): number {
  if (s.OLD === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'divide by zero: OLD is zero');
  }
  if (s.PD === 0) {
    // #PD = 0 degenerates the equation to NEW = OLD, leaving %CH undetermined.
    // The guidebook is silent; the arithmetic reaches 1/#PD first, so Error 1
    // (internal divide by zero, p. 84) is what falls out. Inferred, not printed.
    throw new CalculatorError(ErrorCode.Overflow, 'divide by zero: #PD is zero');
  }
  return toInternal(100 * (power(s.NEW / s.OLD, 1 / s.PD) - 1));
}

/**
 * Solve for #PD.
 *
 *     #PD = ln(NEW/OLD) / ln(1 + %CH/100)
 *
 * Both logs go through math/functions.js `naturalLog` rather than Math.log, for
 * the same reason the exponentiation goes through `power`: that helper already
 * carries the p. 84 domain rule (Error 2 when the argument is not > 0) and
 * applies its own toInternal, so each log is rounded to 13 digits before the
 * division -- what a decimal machine does. Hand-rolling the guard here would
 * fork the rule away from the LN key.
 *
 * Those guards raise Error 2, NOT the Error 5 that tvm.ts raises for the same
 * shape of failure. p. 84 scopes Error 5's "LN input is not > 0" clause to the
 * TVM, Cash Flow and Bond worksheets specifically; everywhere else a
 * non-positive LN argument is the general Error 2. The divergence from tvm.ts
 * is deliberate.
 */
export function solvePD(s: PercentChangeState): number {
  if (s.OLD === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'divide by zero: OLD is zero');
  }

  // Order matters only cosmetically: both are Error 2. NEW/OLD is checked first
  // because it is the first quantity the printed formula names.
  const numerator = naturalLog(s.NEW / s.OLD);
  const denominator = naturalLog(growthFactor(s.CH));

  if (denominator === 0) {
    // %CH = 0 gives ln(1) = 0. No growth reaches any NEW other than OLD, and
    // when NEW = OLD every #PD satisfies the equation. Divide by zero, Error 1.
    throw new CalculatorError(
      ErrorCode.Overflow,
      'divide by zero: %CH is zero, so ln(1 + %CH/100) is zero',
    );
  }

  return toInternal(numerator / denominator);
}

/** Compute the requested unknown, leaving the other three untouched. */
export function computePercentChange(
  state: PercentChangeState,
  unknown: PercentChangeVariable,
): number {
  switch (unknown) {
    case 'OLD':
      return solveOLD(state);
    case 'NEW':
      return solveNEW(state);
    case 'CH':
      return solveCH(state);
    case 'PD':
      return solvePD(state);
  }
}

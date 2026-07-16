/**
 * Profit Margin worksheet.
 *
 * Three variables tied by a single equation (guidebook p. 81):
 *
 *     GrossProfit Margin = (SellingPrice - Cost) / SellingPrice x 100
 *
 * that is, MAR = (SEL - CST) / SEL x 100, solved for whichever of the three the
 * user leaves unkeyed (p. 70).
 *
 * This is the one equation in the chapter that survives the guidebook's vector
 * export intact -- no flattened exponent, no dropped parenthesis, no missing
 * sign. The p. 71 worked example (SEL=125, MAR=20 => CST=100.00) reproduces the
 * printed formula exactly, so unlike TVM's PMT there is nothing to correct here.
 *
 * MARGIN IS NOT MARKUP. Gross profit margin is the spread expressed as a
 * percentage OF THE SELLING PRICE. Markup is the same spread over COST, and it
 * lives in the Percent Change/Compound Interest worksheet -- p. 70 opens with a
 * note redirecting markup work there. The distinction is not pedantry: the
 * guidebook runs the same 100/125 pair through both worksheets and gets MAR = 20
 * here (p. 71) against %CH = 25 there (p. 66). Conflating them silently returns
 * the wrong number for a plausible-looking input, so the two stay separate.
 *
 * THE NAME MAPPING IS INFERRED. The p. 81 formula spells its variables `Cost`
 * and `SellingPrice`, and alone among the appendix formulas it carries no
 * `where:` block. The correspondence to the CST/SEL/MAR display labels is taken
 * from the worksheet variable table on p. 70, not from the formula page itself.
 *
 * Sign convention: none. All three quantities are plain magnitudes in normal use
 * and no cash-flow sign rule applies, unlike TVM (p. 26). Negative results are
 * arithmetically reachable (MAR > 100 yields a negative CST) and are returned
 * as-is; the guidebook neither blesses nor forbids them.
 *
 * INTERMEDIATES ARE NOT ROUNDED, DELIBERATELY. Only the returned value passes
 * through `toInternal`; the transient `1 - MAR/100` does not. Breakeven's
 * `contributionMargin` makes the opposite choice, so the divergence is called out
 * rather than left to look like an oversight. Two reasons it does not follow here.
 * First, breakeven rounds its divisor partly to surface an overflow in the
 * subtraction itself -- `P - VC` can overflow, whereas `1 - MAR/100` cannot for
 * any in-range MAR. Second, rounding this intermediate would not buy decimal
 * fidelity: `toInternal(20/100)` is still the nearest double to 0.2, not an exact
 * decimal 0.2, so both spellings are approximations of the same decimal machine.
 * Measured, the two differ in the 13th significant digit on roughly 14% of random
 * in-range inputs and never at any display setting, and no golden case separates
 * them. Neither is provably closer to the hardware, so the simpler one stands.
 * The pole test is unaffected: stored MAR is already a 13-digit value, so only an
 * exact 100 reaches `1 - MAR/100 === 0`.
 *
 * Source: guidebook p. 70 (variables, behaviour, margin-vs-markup), p. 71
 * (worked example), p. 81 (formula), p. 84 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

export interface ProfitMarginState {
  /** Cost. Any real. */
  readonly CST: number;
  /** Selling price. Any real; SEL = 0 leaves MAR undefined. */
  readonly SEL: number;
  /** Gross profit margin, as a percentage of SEL (e.g. 20 for 20%). */
  readonly MAR: number;
}

export type ProfitMarginVariable = 'CST' | 'SEL' | 'MAR';

/**
 * Defaults after 2ND CLR WORK inside the worksheet (p. 70): all three to zero.
 *
 * No asymmetry to preserve here -- unlike Interest Conversion, whose CLR WORK is
 * defined to leave C/Y alone, this worksheet's clear takes everything.
 */
export const PROFIT_MARGIN_DEFAULTS: ProfitMarginState = Object.freeze({
  CST: 0,
  SEL: 0,
  MAR: 0,
});

/**
 * Solve for MAR.
 *
 *     MAR = (SEL - CST) / SEL x 100
 *
 * Evaluated in the printed order (divide, then scale by 100) rather than the
 * algebraically identical 100 x (SEL - CST) / SEL, so the arithmetic follows the
 * page. At 13 internal digits the two are indistinguishable anyway.
 */
export function solveMAR(s: ProfitMarginState): number {
  // SEL is the divisor: margin is a percentage OF the selling price, so a zero
  // selling price has no margin to speak of. Error 1 covers internal divide by
  // zero (p. 84). Checked explicitly rather than left to fall out as Inf/NaN so
  // the failure carries a reason.
  if (s.SEL === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'SEL is zero; MAR is a percentage of SEL');
  }
  return toInternal(((s.SEL - s.CST) / s.SEL) * 100);
}

/**
 * Solve for CST.
 *
 *     CST = SEL x (1 - MAR/100)
 *
 * Total: no divisor, so no error path. SEL = 0 simply gives CST = 0.
 */
export function solveCST(s: ProfitMarginState): number {
  return toInternal(s.SEL * (1 - s.MAR / 100));
}

/**
 * Solve for SEL.
 *
 *     SEL = CST / (1 - MAR/100)
 *
 * MAR = 100 is a pole: a margin of 100% means the cost is zero at any selling
 * price, so no finite SEL is determined. The guidebook does not discuss it, but
 * it is the divide-by-zero of Error 1 (p. 84).
 */
export function solveSEL(s: ProfitMarginState): number {
  const costFraction = 1 - s.MAR / 100;
  if (costFraction === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'MAR is 100; the divisor 1 - MAR/100 vanishes');
  }
  return toInternal(s.CST / costFraction);
}

/** Compute the requested unknown, leaving the other two untouched. */
export function computeProfitMargin(
  state: ProfitMarginState,
  unknown: ProfitMarginVariable,
): number {
  switch (unknown) {
    case 'CST':
      return solveCST(state);
    case 'SEL':
      return solveSEL(state);
    case 'MAR':
      return solveMAR(state);
  }
}

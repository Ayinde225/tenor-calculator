/**
 * Interest Conversion worksheet.
 *
 * Converts a nominal annual rate (NOM) to an annual effective rate (EFF), or
 * back, at C/Y compounding periods per year (guidebook pp. 66-67). Both rates
 * are annual figures in percent; C/Y is enter-only and never a CPT target.
 *
 * BOTH PRINTED FORMULAS ARE UNUSABLE AS RENDERED (p. 80). The vector art drops
 * each exponent onto the baseline and loses a closing parenthesis. Verbatim:
 *
 *     EFF = 100 x (eC/Y x In(x / 1) - 1          where: x = .01 x NOM / CY
 *     NOM = 100 x C/Y x (e1 / C/Y x IN(x + 1) - 1    where: x = .01 x EFF
 *
 * Three corrections, in order of how firmly each is pinned down:
 *
 *  1. `In(x / 1)` must be `ln(x + 1)`. The p. 67 example -- NOM=15, C/Y=4 =>
 *     EFF=15.87 -- settles it. Reading `+ 1` gives 100 x (1.0375^4 - 1) =
 *     15.8650..., which displays 15.87. Reading `/ 1` gives ln(0.0375), i.e.
 *     EFF ~ -100. The example wins. Independent corroboration: the NOM equation
 *     two lines down prints the very same subexpression correctly as `IN(x + 1)`,
 *     so the `/` in the EFF line is a mangled `+`, not a different operator.
 *  2. The `e...` prefixes are exponents: the whole `C/Y x ln(x+1)` product is
 *     the exponent of e, likewise `(1/C/Y) x ln(x+1)`. On the baseline neither
 *     equation is dimensionally sane.
 *  3. Each outer parenthesis closes before the `- 1`, so `100 x` scales the
 *     entire bracket rather than just the exponential. Round-tripping confirms
 *     it: EFF=15.8650... back through the NOM equation at C/Y=4 returns 15.00.
 *
 * `CY` in the first `where:` clause is `C/Y`; there is no separate variable.
 *
 * Since e^(k x ln(1+x)) = (1+x)^k, the corrected pair reduces to:
 *
 *     EFF = 100 x ((1 + 0.01 x NOM/C/Y)^C/Y - 1)
 *     NOM = 100 x C/Y x ((1 + 0.01 x EFF)^(1/C/Y) - 1)
 *
 * which is exactly TVM's nominal<->periodic rate conversion (p. 74) evaluated at
 * P/Y = 1. Both solves therefore delegate to tvm.ts rather than carry a second
 * copy of the same algebra: a rate converted here and a rate converted through
 * the TVM worksheet's P/Y-C/Y machinery must not disagree in the last digit.
 *
 * Source: guidebook p. 66 (variables, defaults), p. 67 (behaviour, worked
 * example, the CLR WORK asymmetry), p. 80 (formulas), p. 84 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';
import { periodicRate, nominalRate } from './tvm.js';

export interface InterestConversionState {
  /** Nominal annual rate, as a percentage (e.g. 15 for 15%). */
  readonly NOM: number;
  /** Annual effective rate, as a percentage. */
  readonly EFF: number;
  /** Compounding periods per year. Must be > 0 (Error 4). */
  readonly CY: number;
}

/**
 * The two computable variables. C/Y is absent by construction: p. 66 types it
 * Enter-only, so `CPT` on it is not a solve this worksheet can express.
 */
export type InterestConversionVariable = 'NOM' | 'EFF';

/**
 * Defaults after 2ND RESET ENTER (pp. 66-67).
 *
 * Note this is NOT what 2ND CLR WORK restores -- that clear deliberately spares
 * C/Y. See `clearInterestConversionWork`.
 */
export const INTEREST_CONVERSION_DEFAULTS: InterestConversionState = Object.freeze({
  NOM: 0,
  EFF: 0,
  CY: 1,
});

/**
 * Both NOM and EFF are quoted annually (p. 67), so the TVM conversion this
 * worksheet reduces to runs with one payment period per year.
 */
const PAYMENTS_PER_YEAR = 1;

/**
 * Error 4 on C/Y <= 0.
 *
 * p. 84 lists "Interest Conversion worksheet: the C/Y value <?> 0" with the
 * relational glyph dropped -- absent from the rendered image, not merely from
 * the text layer. It is nevertheless recoverable from this source by elimination
 * on the glyph class, which the Error 4 block settles on its own:
 *
 *   - The Depreciation row prints, on one line, "declining balance percent _ 0;
 *     LIF _ 0; YR _ _ 0; CST < 0; SAL < 0". The `<` in `CST < 0` and `SAL < 0`
 *     RENDERS. The neighbouring glyphs, same line and same font, DROP.
 *   - So the export loses only the composite relational glyphs (`<=` / `>=`) and
 *     carries plain `<` / `>` through intact. A dropped glyph therefore cannot
 *     be `<`.
 *
 * That leaves `<= 0`, which is also the only arithmetically sensible reading:
 * C/Y sits in a divisor and in an exponent, so 0 divides by zero and a negative
 * inverts the conversion. The TVM P/Y-or-C/Y row loses the identical glyph and
 * tvm.ts reads it as `<= 0`, keeping the two C/Y variables consistent.
 *
 * So: sourced by glyph-class elimination, not guessed. The `<=` vs `<` reading
 * is observable exactly at C/Y = 0, and the test "raises Error 4 when C/Y is
 * zero" is what pins it -- under a `< 0` reading that case would not throw.
 */
function assertCompoundingPeriods(CY: number): void {
  if (CY <= 0) {
    throw new CalculatorError(ErrorCode.OutOfRange, `C/Y must be > 0, got ${CY}`);
  }
}

/**
 * Error 2 when ln(x + 1) has a non-positive argument.
 *
 * This guard is load-bearing, not defensive padding. The reduced form (1 + x)^k
 * is perfectly well-defined for 1 + x < 0 whenever k is an integer -- NOM=-500
 * at C/Y=4 would quietly return EFF=-99.6 -- but the hardware evaluates the ln
 * first and errors out. Guarding restores the printed formula's domain, which is
 * the whole reason Error 2 is reachable on this worksheet.
 *
 * WHY ERROR 2 AND NOT ERROR 5: p. 84 scopes its Error 5 LN clause to "TVM, Cash
 * Flow, and Bond worksheets". Interest Conversion is not among them, so an
 * LN-domain failure here falls to the general Error 2 clause, "tried to compute
 * LN of x when x is not > 0". That is also why the domain is checked here rather
 * than left to tvm.ts, whose guard raises Error 5 on the identical condition.
 */
function assertLogDomain(x: number, detail: string): void {
  if (!(1 + x > 0)) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `${detail}: ln(x + 1) needs x > -1, got x = ${x}`);
  }
}

/**
 * Solve for EFF.
 *
 *     EFF = 100 x ((1 + 0.01 x NOM/C/Y)^C/Y - 1)
 */
export function solveEFF(s: InterestConversionState): number {
  assertCompoundingPeriods(s.CY);
  assertLogDomain((0.01 * s.NOM) / s.CY, `NOM ${s.NOM} at C/Y ${s.CY}`);

  // periodicRate returns a decimal rate per payment period; at P/Y = 1 that
  // period is the year, so it is the effective annual rate. EFF is a percent.
  //
  // This rounds to 13 digits twice -- once on periodicRate's way out, once after
  // the x100. That is not a concession made to reuse tvm.ts; it is what the
  // machine model in precision.ts prescribes ("call this on the result of every
  // arithmetic operation"). A 13-digit decimal machine rounds at each step, so
  // per-step rounding is the faithful reading and a single rounding of the whole
  // expression would be the deviation.
  //
  // Measured against a hypothetical single-rounding of the whole expression, a
  // sweep of 11,801 valid NOM/C/Y pairs disagrees on 6 of them (e.g. NOM=74.5
  // C/Y=0.5, by 1e-11 in the 13th digit) and on NONE at display precision. The
  // exact count tracks the sweep grid, so treat it as a magnitude, not a
  // constant.
  return toInternal(100 * periodicRate(s.NOM, PAYMENTS_PER_YEAR, s.CY));
}

/**
 * Solve for NOM.
 *
 *     NOM = 100 x C/Y x ((1 + 0.01 x EFF)^(1/C/Y) - 1)
 */
export function solveNOM(s: InterestConversionState): number {
  assertCompoundingPeriods(s.CY);
  assertLogDomain(0.01 * s.EFF, `EFF ${s.EFF}`);

  // No scaling on the way out: nominalRate returns TVM's I/Y, which is already a
  // nominal annual rate in percent -- the same quantity and unit as NOM.
  return nominalRate(0.01 * s.EFF, PAYMENTS_PER_YEAR, s.CY);
}

/** Compute the requested unknown, leaving the other variables untouched. */
export function computeInterestConversion(
  state: InterestConversionState,
  unknown: InterestConversionVariable,
): number {
  switch (unknown) {
    case 'NOM':
      return solveNOM(state);
    case 'EFF':
      return solveEFF(state);
  }
}

/**
 * 2ND CLR WORK inside this worksheet.
 *
 * Clears NOM and EFF but leaves C/Y exactly as it was (p. 67, stated
 * explicitly). This is the one asymmetric clear in the chapter -- every other
 * worksheet's CLR WORK restores all of its variables -- and it is why C/Y cannot
 * simply be reset from INTEREST_CONVERSION_DEFAULTS. It also implies this C/Y is
 * separate storage from the TVM worksheet's C/Y: a clear that is defined to not
 * touch a variable cannot be sharing it with a worksheet that does.
 */
export function clearInterestConversionWork(
  state: InterestConversionState,
): InterestConversionState {
  return { NOM: 0, EFF: 0, CY: state.CY };
}

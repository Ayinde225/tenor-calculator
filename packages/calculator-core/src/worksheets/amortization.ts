/**
 * Amortization worksheet.
 *
 * This is the one place in the calculator where the DISPLAY setting reaches into
 * the arithmetic. Everywhere else, changing DEC is cosmetic and the internal
 * 13-digit value is untouched (guidebook p. 9). Amortization and depreciation are
 * the stated exceptions: they round to the displayed decimal places as they go,
 * so the same loan amortized at DEC=2 and DEC=5 produces genuinely different
 * numbers. That is not a bug to paper over -- it is the specified behaviour, and
 * it is why `decimals` is a required input here.
 *
 * The schedule (guidebook p. 76):
 *
 *     bal(0) = RND(PV)
 *     for m = 1..pmt2:
 *         I_m    = RND[ RND12( -i x bal(m-1) ) ]
 *         bal(m) = bal(m-1) - I_m + RND(PMT)
 *
 *     BAL = bal(pmt2)
 *     PRN = bal(pmt2) - bal(pmt1 - 1)
 *     INT = (pmt2 - pmt1 + 1) x RND(PMT) - PRN
 *
 * where RND rounds to the displayed decimal places and RND12 to 12 decimals.
 *
 * TWO DEVIATIONS FROM THE PRINTED APPENDIX, both forced by the guidebook's own
 * worked examples (pp. 40-41):
 *
 *  1. PRN. The appendix prints `bal(pmt2) - bal(pmt1)`, which reproduces none of
 *     the guidebook's results -- it reports -954.74 where the guidebook shows
 *     -1,071.37. Principal must be measured from the balance standing BEFORE
 *     payment pmt1, hence `bal(pmt1 - 1)`.
 *
 *  2. Per-period rounding. The printed iteration does not say in so many words
 *     that the running balance is re-rounded every period, but it follows from
 *     RND(I_m) + RND(PMT), and it is load-bearing: carrying an unrounded balance
 *     yields 117,421.61 and 115,819.64 against the guidebook's 117,421.60 and
 *     115,819.62. Two cents, and it is the difference between parity and not.
 *
 * RND(PMT) also explains the documented BAL/FV divergence (p. 26): the schedule
 * is driven by the payment a borrower actually makes, rounded to cents, not by
 * the unrounded PMT the TVM solver produced.
 *
 * Source: guidebook p. 76 (formula), pp. 27-28 (behaviour), pp. 40-41 (examples).
 */
import { CalculatorError, ErrorCode } from '../errors.js';
import { roundToSignificantDigits, INTERNAL_DIGITS } from '../numeric/precision.js';
import { periodicRate, type TvmState } from './tvm.js';
import { FLOATING_DECIMAL, type DecimalSetting } from '../display/format.js';

/** Lowest and highest payment number P1/P2 accept (guidebook p. 84, Error 4). */
export const MIN_PAYMENT_NUMBER = 1;
export const MAX_PAYMENT_NUMBER = 9999;

export interface AmortizationRange {
  /** First payment in the range. */
  readonly P1: number;
  /** Last payment in the range. */
  readonly P2: number;
}

export interface AmortizationResult {
  /** Remaining balance after payment P2. */
  readonly BAL: number;
  /** Principal paid across P1..P2 inclusive. */
  readonly PRN: number;
  /** Interest paid across P1..P2 inclusive. */
  readonly INT: number;
}

/** Defaults after 2ND CLR WORK inside the Amortization worksheet (p. 26). */
export const AMORTIZATION_DEFAULTS: AmortizationRange = Object.freeze({ P1: 1, P2: 1 });

/**
 * RND: round to the displayed number of decimal places.
 *
 * With floating decimal (DEC=9) there is no fixed decimal count to round to, and
 * the guidebook does not say what RND means in that case. We fall back to the
 * internal 13-digit precision, i.e. no additional rounding, which is the reading
 * that leaves the arithmetic untouched. Tracked in docs/OPEN-QUESTIONS.md.
 */
function rnd(x: number, decimals: DecimalSetting): number {
  if (decimals === FLOATING_DECIMAL) {
    return roundToSignificantDigits(x, INTERNAL_DIGITS);
  }
  return Number(x.toFixed(decimals));
}

/** RND12: round to 12 decimal places (guidebook p. 76). */
function rnd12(x: number): number {
  return Number(x.toFixed(12));
}

function assertRange(range: AmortizationRange): void {
  for (const [label, v] of [
    ['P1', range.P1],
    ['P2', range.P2],
  ] as const) {
    if (!Number.isInteger(v) || v < MIN_PAYMENT_NUMBER || v > MAX_PAYMENT_NUMBER) {
      throw new CalculatorError(
        ErrorCode.OutOfRange,
        `${label} must be an integer ${MIN_PAYMENT_NUMBER}-${MAX_PAYMENT_NUMBER}, got ${v}`,
      );
    }
  }
  // Guidebook p. 84: Error 2 when computing BAL/PRN/INT with P2 < P1.
  if (range.P2 < range.P1) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `P2 (${range.P2}) is less than P1 (${range.P1})`);
  }
}

/**
 * Walk the balance forward from period 0, capturing the two balances the
 * amortization results need.
 *
 * The iteration always starts at m = 1 regardless of P1: reaching bal(P1 - 1)
 * requires walking from the origin, since each balance depends on the last.
 */
function runSchedule(
  tvm: TvmState,
  range: AmortizationRange,
  decimals: DecimalSetting,
): { balBeforeP1: number; balAtP2: number; roundedPmt: number } {
  const i = periodicRate(tvm.IY, tvm.PY, tvm.CY);
  const roundedPmt = rnd(tvm.PMT, decimals);

  let bal = rnd(tvm.PV, decimals);
  let balBeforeP1 = bal; // bal(P1 - 1); correct as-is when P1 = 1

  for (let m = 1; m <= range.P2; m++) {
    const interest = rnd(rnd12(-i * bal), decimals);
    bal = rnd(bal - interest + roundedPmt, decimals);
    if (m === range.P1 - 1) balBeforeP1 = bal;
  }

  return { balBeforeP1, balAtP2: bal, roundedPmt };
}

/**
 * Compute BAL, PRN and INT for the payment range P1..P2.
 *
 * @param decimals the current DEC setting -- it changes the result, by design.
 */
export function amortize(
  tvm: TvmState,
  range: AmortizationRange,
  decimals: DecimalSetting,
): AmortizationResult {
  assertRange(range);

  const { balBeforeP1, balAtP2, roundedPmt } = runSchedule(tvm, range, decimals);

  const BAL = balAtP2;
  const PRN = rnd(balAtP2 - balBeforeP1, decimals);
  const INT = rnd((range.P2 - range.P1 + 1) * roundedPmt - PRN, decimals);

  return { BAL, PRN, INT };
}

/**
 * Advance to the next payment window, preserving its width (guidebook p. 28).
 * Pressing CPT on P1 after viewing a range rolls both bounds forward.
 */
export function nextRange(range: AmortizationRange): AmortizationRange {
  const width = range.P2 - range.P1;
  const P1 = range.P2 + 1;
  const P2 = P1 + width;
  return { P1, P2: Math.min(P2, MAX_PAYMENT_NUMBER) };
}

/**
 * Full per-payment schedule. Not a hardware feature -- the calculator shows one
 * range at a time -- but the same iteration, exposed for guided mode and export.
 */
export function schedule(
  tvm: TvmState,
  through: number,
  decimals: DecimalSetting,
): { period: number; interest: number; principal: number; balance: number }[] {
  const i = periodicRate(tvm.IY, tvm.PY, tvm.CY);
  const roundedPmt = rnd(tvm.PMT, decimals);
  const rows: { period: number; interest: number; principal: number; balance: number }[] = [];

  let bal = rnd(tvm.PV, decimals);
  for (let m = 1; m <= through; m++) {
    const interest = rnd(rnd12(-i * bal), decimals);
    const next = rnd(bal - interest + roundedPmt, decimals);
    rows.push({ period: m, interest, principal: rnd(next - bal, decimals), balance: next });
    bal = next;
  }
  return rows;
}

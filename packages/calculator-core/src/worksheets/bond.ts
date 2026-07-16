/**
 * Bond worksheet.
 *
 * Prices a bond from a yield, solves the yield from a price, and always reports
 * the accrued interest owed to the seller. Every money amount here is quoted per
 * $100 of par -- never in the bond's face amount (guidebook pp. 50, 52) -- and
 * unlike TVM there is no cash-flow sign convention: PRI, AI, RV and CPN are all
 * positive magnitudes.
 *
 * The appendix formulas (pp. 77-78) are transcribed here as printed. Unusually
 * for this appendix, they are CORRECT: recomputing the pp. 53-54 example from the
 * multi-period price formula gives 98.56275 -> displays 98.56, and AI = 3.15,
 * both matching the printed results. No counterpart to the TVM PMT sign defect
 * exists in this section, so nothing below deviates from the printed algebra.
 *
 * Price (given yield), one coupon period or less to redemption (p. 77):
 *
 *     PRI = [ (RV + 100R/M) / (1 + (DSR/E) x (Y/M)) ] - [ (A/E) x (100R/M) ]
 *
 * Yield (given price), one coupon period or less to redemption (p. 78):
 *
 *     Y = [ ((RV/100 + R/M) - Q) / Q ] x [ (M x E) / DSR ],  Q = PRI/100 + (A/E)(R/M)
 *
 * Price (given yield), more than one coupon period to redemption (p. 78):
 *
 *     PRI = RV / (1 + Y/M)^(N-1+DSC/E)
 *         + SUM(K=1..N) [ (100R/M) / (1 + Y/M)^(K-1+DSC/E) ]
 *         - 100 x (R/M) x (A/E)
 *
 * Accrued interest (p. 78):
 *
 *     AI = PAR x (R/M) x (A/E),  with PAR = 100 because everything is per $100 par.
 *
 * Yield given price with more than one coupon remaining has no closed form; the
 * calculator searches for it iteratively on the price formula (p. 78), which is
 * why YLD alone can raise Error 7 and Error 8.
 *
 * Source: guidebook pp. 50-54 (behaviour, worked example), pp. 77-78 (formulas),
 * pp. 84-85 (errors). Formula source of record for the appendix itself is Lynch &
 * Mayle, "Standard Securities Calculation Methods" (1986), per the p. 77 footnote.
 */
import { toInternal, isIntegerAtInternalPrecision } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/** ACT is actual/actual; 360 is 30/360 (guidebook p. 51). */
export type DayCountMethod = 'ACT' | '360';

/** Coupons per year. The display strings are the toggle's two states (p. 50). */
export type CouponFrequency = '2/Y' | '1/Y';

/**
 * Date entry/display convention. This duplicates the Date worksheet's own
 * setting; see the note on `parseDateEntry`.
 */
export type DateFormat = 'US' | 'EUR';

export interface BondDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Earliest and latest dates the calculator accepts (guidebook p. 51). */
export const BOND_MIN_YEAR = 1980;
export const BOND_MAX_YEAR = 2079;

export interface BondState {
  /** Settlement date. */
  readonly SDT: BondDate;
  /** Annual coupon rate as a PERCENTAGE of par -- a 7% bond is 7, not 3.5 (p. 51). */
  readonly CPN: number;
  /** Redemption date. Assumed to fall on a coupon date (p. 51). */
  readonly RDT: BondDate;
  /** Redemption value as a percentage of par: 100 to maturity, call price to call (p. 51). */
  readonly RV: number;
  readonly dayCount: DayCountMethod;
  readonly frequency: CouponFrequency;
  /** Annual nominal yield to redemption, in percent. Y = YLD / 100 (p. 77). */
  readonly YLD: number;
  /** Dollar price per $100 of par. */
  readonly PRI: number;
}

/** The two computable positions. AI is auto-compute and never takes a CPT (p. 50). */
export type BondVariable = 'YLD' | 'PRI';

const DEFAULT_DATE: BondDate = Object.freeze({ year: 1990, month: 12, day: 31 });

/**
 * Defaults after 2ND CLR WORK inside the Bond worksheet (guidebook pp. 50-51).
 *
 * SDT and RDT share a default, which is why arrowing through a freshly-reset
 * worksheet raises Error 6 (p. 50): the very first calculation runs with RDT not
 * later than SDT, the exact condition p. 85 documents.
 *
 * Note that the reset state trips TWO rules at once, since CPN defaults to 0 and
 * the p. 84 Error 4 bound is `<= 0` (see `assertBondRanges`). p. 50 prints which
 * one the user sees -- Error 6 -- so the date check runs first. A default is
 * installed by CLR WORK, which does not run entry validation; these zeros are the
 * un-entered state, not entered values.
 */
export const BOND_DEFAULTS: BondState = Object.freeze({
  SDT: DEFAULT_DATE,
  CPN: 0,
  RDT: DEFAULT_DATE,
  RV: 100,
  dayCount: 'ACT',
  frequency: '2/Y',
  YLD: 0,
  PRI: 0,
});

export interface BondSolveOptions {
  /**
   * Polled during the YLD search. Returning true aborts with Error 8, which is
   * the guidebook's "ON/OFF pressed to cancel an iterative calculation" (p. 85).
   * The key press itself belongs to the state machine; this is the seam it uses.
   */
  readonly shouldCancel?: () => boolean;
}

/**
 * Days from the settlement/coupon geometry that every bond formula is written in
 * terms of (p. 77-78). Exposed because it is the only way to check parity on the
 * intermediate quantities the guidebook quotes (A/E = 0.9, DSC/E = 0.1, N = 4).
 */
export interface BondFactors {
  /** Coupons payable between settlement and redemption (p. 78). */
  readonly N: number;
  /** Days from the start of the settlement coupon period to settlement (accrued days). */
  readonly A: number;
  /** Days in the coupon period in which settlement falls. */
  readonly E: number;
  /** Days from settlement to the next coupon date (p. 78). */
  readonly DSC: number;
  /** Days from settlement to redemption. */
  readonly DSR: number;
  /** Coupon date opening the period settlement falls in. */
  readonly previousCoupon: BondDate;
  /** Coupon date closing it. */
  readonly nextCoupon: BondDate;
}

const YIELD_MAX_ITERATIONS = 200;
const YIELD_TOLERANCE = 1e-13;

/**
 * Hard ceiling on the coupon back-count. The legal date window spans 100 years
 * (p. 51) and the densest schedule is semiannual, so 200 coupons is the true
 * maximum; the slack is there so a bug shows up as an error rather than a hang.
 */
const MAX_COUPON_PERIODS = 256;

// ---------------------------------------------------------------------------
// Calendar helpers
//
// DUPLICATED ON PURPOSE, FOR NOW. date.ts carries the same arithmetic under
// different names -- CalendarDate/BondDate, and its own isLeapYear, daysInMonth,
// dayNumber/serialDay, daysBetween, parseDateEntry, formatDate, all over the same
// 1980-2079 window. Both worksheets were built in parallel, so neither could
// depend on the other; these are kept local rather than reaching across a module
// boundary that was still moving.
//
// The two implementations were written independently and agree exactly: 308,898
// date pairs across both day-count methods, and every mm.ddyy entry, checked
// against date.ts. That makes the merge mechanical rather than risky -- one
// shared calendar module, both worksheets importing it. Flagged for follow-up;
// see docs/OPEN-QUESTIONS.md.
// ---------------------------------------------------------------------------

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** True if the fields describe a real calendar date inside the legal window. */
export function isValidBondDate(d: BondDate): boolean {
  if (!Number.isInteger(d.year) || !Number.isInteger(d.month) || !Number.isInteger(d.day)) {
    return false;
  }
  if (d.year < BOND_MIN_YEAR || d.year > BOND_MAX_YEAR) return false;
  if (d.month < 1 || d.month > 12) return false;
  return d.day >= 1 && d.day <= daysInMonth(d.year, d.month);
}

function assertValidDate(d: BondDate, label: string): void {
  if (!isValidBondDate(d)) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `${label} is not a valid date in ${BOND_MIN_YEAR}-${BOND_MAX_YEAR}: ${d.year}-${d.month}-${d.day}`,
    );
  }
}

/**
 * Serial day number (proleptic Gregorian, epoch 1970-01-01). Only differences
 * are ever used, so the epoch is arbitrary.
 */
function serialDay(d: BondDate): number {
  const y = d.month <= 2 ? d.year - 1 : d.year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (d.month + (d.month > 2 ? -3 : 9)) + 2) / 5) + d.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/**
 * 30/360 day count:
 *
 *     DBD = 360(Y2-Y1) + 30(M2-M1) + (DT2-DT1)
 *     "If DT1 is 31, change DT1 to 30. If DT2 is 31 and DT1 is 30 or 31, change
 *      DT2 to 30; otherwise, leave it at 31."
 *
 * Pages 50-54 name the method (p. 51) but never state its rules, and the worked
 * example cannot discriminate the SIA convention from the European 30E/360: the
 * example's only 31st is a DT1 (12-31-2005), which both conventions map to 30.
 * The two differ solely in whether a DT2 of 31 is pulled back when DT1 is not 30.
 *
 * p. 82 settles it. The Date worksheet's appendix prints the rule verbatim (quoted
 * above) and footnotes it to Lynch & Mayle, "Standard Securities Calculation
 * Methods" (SIA, 1986) -- the SAME source the Bond appendix cites on p. 77. One
 * 30/360 method, stated once, shared by both worksheets. So this is transcribed,
 * not inferred.
 *
 * The clamp below tests D1 AFTER its own adjustment, where the printed rule tests
 * DT1 before it. The two select identical dates -- post-clamp `d1 === 30` holds
 * exactly when the original day was 30 or 31 -- and this agrees with the Date
 * worksheet's independent transcription over all 308,898 date pairs in the legal
 * window, both methods.
 */
function days360(from: BondDate, to: BondDate): number {
  let d1 = from.day;
  let d2 = to.day;
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  return 360 * (to.year - from.year) + 30 * (to.month - from.month) + (d2 - d1);
}

/** Days between two dates under the worksheet's current day-count setting. */
export function daysBetween(from: BondDate, to: BondDate, method: DayCountMethod): number {
  return method === '360' ? days360(from, to) : serialDay(to) - serialDay(from);
}

/**
 * Shift a date by whole months, clamping the day to the target month's length.
 *
 * Every coupon date is measured from RDT rather than from the previous coupon, so
 * the clamp cannot ratchet: 12-31 steps to 6-30 and back to 12-31, not to 6-30
 * then 12-30. This reproduces the example's schedule on p. 53 exactly
 * (12-31-2007, 6-30-2007, 12-31-2006, 6-30-2006, 12-31-2005).
 */
function addMonths(d: BondDate, delta: number): BondDate {
  const index = d.year * 12 + (d.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

function compareDates(a: BondDate, b: BondDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Read a date keyed in the calculator's mm.ddyy (US) or dd.mmyy (European)
 * convention (guidebook p. 51).
 *
 * Two-digit years resolve 80-99 -> 1980-1999 and 00-79 -> 2000-2079. The
 * guidebook never states this pivot; it is inferred from the legal window
 * (January 1 1980 - December 31 2079, p. 51) together with the worked example,
 * where 06 displays as 2006 while the 90 default displays as 1990. The pivot and
 * the window are the same fact stated twice, so no entered date can land outside
 * the window -- which is why there is no range check on this path.
 *
 * A date carrying more than four fractional digits (the mm.ddyyyy mistake the
 * p. 85 error table calls out) raises Error 6 rather than silently truncating.
 */
export function parseDateEntry(entry: number, format: DateFormat = 'US'): BondDate {
  if (!Number.isFinite(entry) || entry < 0) {
    throw new CalculatorError(ErrorCode.InvalidDate, `date entry out of range: ${entry}`);
  }
  const scaled = entry * 10000;
  if (!isIntegerAtInternalPrecision(scaled)) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `date must be keyed as mm.ddyy or dd.mmyy, got ${entry}`,
    );
  }

  const digits = Math.round(toInternal(scaled));
  const leading = Math.floor(digits / 10000);
  const trailing = Math.floor(digits / 100) % 100;
  const yy = digits % 100;

  const month = format === 'US' ? leading : trailing;
  const day = format === 'US' ? trailing : leading;
  const year = yy >= 80 ? 1900 + yy : 2000 + yy;

  const date: BondDate = { year, month, day };
  assertValidDate(date, `date entry ${entry}`);
  return date;
}

/**
 * Render a date the way the LCD does: the leading field unpadded, the trailing
 * field zero-padded, then the full year (`6-12-2006`, `12-31-1990`).
 *
 * The European ordering is the US rule with the fields swapped. The guidebook
 * prints no European-format date, so the padding there is inferred.
 */
export function formatDate(d: BondDate, format: DateFormat = 'US'): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return format === 'US'
    ? `${d.month}-${pad(d.day)}-${d.year}`
    : `${d.day}-${pad(d.month)}-${d.year}`;
}

// ---------------------------------------------------------------------------
// Worksheet settings
// ---------------------------------------------------------------------------

/** M in the appendix formulas: the 2/Y | 1/Y toggle as a number (p. 77). */
export function couponsPerYear(frequency: CouponFrequency): number {
  return frequency === '2/Y' ? 2 : 1;
}

/** 2ND SET on the ACT/360 position (guidebook p. 51). */
export function toggleDayCount(state: BondState): BondState {
  return { ...state, dayCount: state.dayCount === 'ACT' ? '360' : 'ACT' };
}

/** 2ND SET on the 2/Y | 1/Y position (guidebook p. 51). */
export function toggleCouponFrequency(state: BondState): BondState {
  return { ...state, frequency: state.frequency === '2/Y' ? '1/Y' : '2/Y' };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Error 4 on a non-positive RV, CPN or PRI (guidebook p. 84).
 *
 * THE DROPPED GLYPH IS `<=`, AND THAT IS RECOVERABLE FROM THE PAGE, NOT GUESSED.
 * p. 84 renders as "the RV, CPN, or PRI value <gap> 0" -- the relational glyph
 * fails to draw in the PDF itself, not merely in its text layer. The Error 4
 * block settles it on its own, by elimination on the glyph class:
 *
 *   - The Depreciation row prints, ON ONE LINE, IN ONE FONT: "declining balance
 *     percent _ 0; LIF _ 0; YR _ _ 0; CST < 0; SAL < 0". The `<` of `CST < 0` and
 *     `SAL < 0` RENDERS. The neighbouring glyphs, same line, same size, same
 *     weight, DROP. `<` also renders throughout Error 2 (`y < 0`, `x < 0`,
 *     `P2 < P1`).
 *   - So the export drops only the composite relational glyphs (`<=` / `>=`) and
 *     carries plain `<` / `>` through intact. A DROPPED GLYPH THEREFORE CANNOT
 *     BE `<`. That leaves `<= 0`.
 *   - The TVM row loses the identical glyph in "the P/Y or C/Y value _ 0", where
 *     `< 0` would legalise P/Y = 0 -- a division by zero. Only `<= 0` is
 *     arithmetically possible there, and it is the same glyph as this row.
 *
 * tvm.ts, interest-conversion.ts and depreciation.ts each read this same dropped
 * glyph as `<= 0`. One glyph, one reading, four worksheets.
 *
 * The two arguments that look like they favour `< 0` do not survive contact:
 *
 *   - "CPN and PRI DEFAULT to 0 (p. 51), so `<= 0` would make the worksheet's own
 *     reset state illegal." The reset state IS illegal, by design and by print:
 *     p. 50 says navigating a freshly-reset worksheet raises Error 6, because SDT
 *     and RDT share a default. A default is installed by CLR WORK, which does not
 *     run entry validation; nothing is "entered" at 0.
 *   - "`<= 0` would forbid pricing a zero-coupon bond." It does forbid it, and
 *     that is the documented behaviour: p. 84 names CPN in this row. A zero is
 *     priced on the TVM worksheet, not here.
 *
 * SCOPE. Error 4 is entry-time validation, so a stored value is only checkable
 * where the compute actually reads it:
 *
 *   - RV and CPN are "Enter only" (p. 50). Every stored value passed entry, so a
 *     non-positive one is unreachable and checking is a faithful proxy.
 *   - PRI is "Enter/compute" and DEFAULTS to 0 (p. 51), so a stored 0 is the
 *     un-entered state, not an entered one. The pp. 53-54 worked example computes
 *     PRI with PRI still at that 0 default, which is decisive: the price path must
 *     not test PRI. It is checked only on the yield path, where it is an input.
 */
function assertBondRanges(state: BondState, checkPRI: boolean): void {
  const fields: readonly (readonly [string, number])[] = [
    ['RV', state.RV],
    ['CPN', state.CPN],
    ...(checkPRI ? ([['PRI', state.PRI]] as const) : []),
  ];

  for (const [label, value] of fields) {
    if (value <= 0) {
      throw new CalculatorError(ErrorCode.OutOfRange, `${label} must be > 0, got ${value}`);
    }
  }
}

/**
 * Error 6 unless both dates are real and RDT is strictly later than SDT
 * (guidebook p. 85).
 */
function assertBondDates(state: BondState): void {
  assertValidDate(state.SDT, 'SDT');
  assertValidDate(state.RDT, 'RDT');
  if (compareDates(state.RDT, state.SDT) <= 0) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `RDT (${formatDate(state.RDT)}) must be later than SDT (${formatDate(state.SDT)})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Coupon geometry
// ---------------------------------------------------------------------------

/**
 * Locate settlement within the coupon schedule and measure the four day counts.
 *
 * Coupon dates are back-counted from RDT, which the calculator takes on faith to
 * be one (p. 51). An RDT that is not a coupon date shifts the whole schedule
 * rather than erroring -- the guidebook states the assumption but never says what
 * happens if it fails, so nothing here enforces it.
 *
 * N falls out as a count rather than a division. The appendix defines it as the
 * coupons payable between settlement and redemption and says to raise a
 * fractional result to the next whole number (2.4 -> 3, p. 78); counting the
 * coupon dates strictly after SDT gives that ceiling directly, with no rounding
 * step to get wrong.
 */
export function bondFactors(state: BondState): BondFactors {
  assertBondDates(state);

  const monthsPerCoupon = 12 / couponsPerYear(state.frequency);

  // Walk back from RDT to the first coupon date at or before settlement. That
  // date opens the period settlement falls in; the one before it in the walk
  // closes it. The index reached is N: every coupon skipped past is still payable.
  let previousCoupon: BondDate | null = null;
  let nextCoupon: BondDate = state.RDT;
  let N = 0;

  for (let j = 1; j <= MAX_COUPON_PERIODS; j++) {
    const candidate = addMonths(state.RDT, -j * monthsPerCoupon);
    if (compareDates(candidate, state.SDT) <= 0) {
      previousCoupon = candidate;
      N = j;
      break;
    }
    nextCoupon = candidate;
  }

  if (previousCoupon === null) {
    // Unreachable while both dates sit inside the validated window; a guard, not
    // a behaviour.
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      'settlement date precedes the coupon schedule derivable from RDT',
    );
  }

  const A = daysBetween(previousCoupon, state.SDT, state.dayCount);
  const E = daysBetween(previousCoupon, nextCoupon, state.dayCount);
  const DSC = daysBetween(state.SDT, nextCoupon, state.dayCount);
  const DSR = daysBetween(state.SDT, state.RDT, state.dayCount);

  if (E <= 0) {
    throw new CalculatorError(ErrorCode.InvalidDate, 'coupon period has no length');
  }

  return { N, A, E, DSC, DSR, previousCoupon, nextCoupon };
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/**
 * The printed price formulas, evaluated raw -- no `toInternal`, because the YLD
 * search calls this thousands of times and only the value it finally returns is
 * a stored result. Callers that return a price must pass it through `toInternal`.
 */
function priceAtYield(state: BondState, f: BondFactors, Y: number): number {
  const M = couponsPerYear(state.frequency);
  const R = state.CPN / 100;
  const coupon = (100 * R) / M;
  const accrued = coupon * (f.A / f.E);

  if (f.N <= 1) {
    // One coupon period or less: simple interest over the invested period (p. 77).
    return (state.RV + coupon) / (1 + (f.DSR / f.E) * (Y / M)) - accrued;
  }

  const base = 1 + Y / M;
  if (base <= 0) {
    // The exponents are fractional whenever settlement is mid-period, so a
    // non-positive base is a logarithm of a non-positive number: Error 5 (p. 84).
    throw new CalculatorError(ErrorCode.NoSolution, `1 + Y/M must be > 0, got ${base}`);
  }

  const redemption = state.RV / Math.pow(base, f.N - 1 + f.DSC / f.E);

  let coupons = 0;
  for (let K = 1; K <= f.N; K++) {
    coupons += coupon / Math.pow(base, K - 1 + f.DSC / f.E);
  }

  return redemption + coupons - accrued;
}

/**
 * PRI from YLD (guidebook p. 53, step 3). Closed-form in both branches.
 * Errors 7 and 8 are structurally unreachable here -- they belong to YLD.
 */
export function computePrice(state: BondState): number {
  // Dates first. On the freshly-reset worksheet BOTH rules bite -- RDT equals SDT
  // (Error 6) and CPN is 0 (Error 4) -- and p. 50 prints which one wins: "Pressing
  // [down] or [up] to navigate through the Bond worksheet before you enter values
  // causes an error (Error 6)." So Error 6 precedes Error 4.
  const f = bondFactors(state);
  assertBondRanges(state, false); // PRI is this path's output, not an input.
  return toInternal(priceAtYield(state, f, state.YLD / 100));
}

// ---------------------------------------------------------------------------
// Accrued interest
// ---------------------------------------------------------------------------

/**
 * AI = PAR x (R/M) x (A/E) with PAR = 100 (p. 78).
 *
 * Auto-compute: the worksheet produces it on display, with no CPT step (p. 50,
 * p. 53). It is numerically the third term of the multi-period price formula.
 */
export function accruedInterest(state: BondState): number {
  const f = bondFactors(state); // Error 6 precedes Error 4 (p. 50); see computePrice.
  assertBondRanges(state, false); // AI reads CPN, never PRI.
  const M = couponsPerYear(state.frequency);
  const R = state.CPN / 100;
  return toInternal(100 * (R / M) * (f.A / f.E));
}

// ---------------------------------------------------------------------------
// Yield
// ---------------------------------------------------------------------------

/**
 * YLD from PRI (guidebook p. 53).
 *
 * With one coupon period or less the p. 78 formula inverts the p. 77 price
 * formula exactly, so it is used as printed. With more than one coupon the
 * appendix gives no closed form and directs an iterative search on the
 * multi-period price formula (p. 78).
 */
export function computeYield(state: BondState, options?: BondSolveOptions): number {
  const f = bondFactors(state); // Error 6 precedes Error 4 (p. 50); see computePrice.
  assertBondRanges(state, true); // PRI is an input here, so it is in range.
  const M = couponsPerYear(state.frequency);
  const R = state.CPN / 100;

  if (f.N <= 1) {
    // Y = [((RV/100 + R/M) - Q) / Q] x [(M x E) / DSR],  Q = PRI/100 + (A/E)(R/M)
    const Q = state.PRI / 100 + (f.A / f.E) * (R / M);
    if (Q === 0) {
      // Unreachable now that PRI > 0 is enforced above; retained as a guard on the
      // printed formula's own divisor rather than as a behaviour.
      throw new CalculatorError(ErrorCode.Overflow, 'price plus accrued interest is zero');
    }
    const P = state.RV / 100 + R / M;
    const Y = ((P - Q) / Q) * ((M * f.E) / f.DSR);
    return toInternal(Y * 100);
  }

  return toInternal(searchYield(state, f, options) * 100);
}

/**
 * Bisection on price(Y) - PRI.
 *
 * Plain bisection rather than TVM's Newton-with-fallback because this residual is
 * strictly decreasing in Y over its whole domain (every term is a positive amount
 * discounted at a rate rising with Y, and the accrued term is constant in Y). A
 * bracket therefore contains exactly one root and bisection cannot miss it, so
 * the extra machinery buys nothing here.
 *
 * The domain is Y > -M, where the per-period discount base 1 + Y/M stays positive.
 */
function searchYield(state: BondState, f: BondFactors, options?: BondSolveOptions): number {
  const M = couponsPerYear(state.frequency);
  const residual = (Y: number): number => priceAtYield(state, f, Y) - state.PRI;

  let [lo, hi] = bracketYield(residual, M);
  let fLo = residual(lo);

  for (let iter = 0; iter < YIELD_MAX_ITERATIONS; iter++) {
    if (options?.shouldCancel?.() === true) {
      throw new CalculatorError(ErrorCode.CanceledIterativeCalculation, 'YLD search canceled');
    }

    const mid = (lo + hi) / 2;
    const fMid = residual(mid);

    if (fMid === 0 || (hi - lo) / 2 <= YIELD_TOLERANCE * Math.max(1, Math.abs(mid))) {
      return mid;
    }
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }

  throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'YLD did not converge');
}

/**
 * Find a sign change to bisect inside.
 *
 * Error 7 when there is none, which p. 85 fits well once Error 4 is read
 * correctly. With PRI > 0 enforced (p. 84), a root always EXISTS: price(Y) falls
 * continuously and strictly from +infinity as Y -> -M+ down to -AI as Y -> +infinity,
 * so it crosses every positive PRI exactly once. The only way to miss it is to
 * fail to bracket it inside the probe ladder below, which needs a yield past
 * 100,000% -- precisely p. 85's "the calculator computed YLD for a very complex
 * problem". So Error 7 here is a genuine iteration failure, not a no-root failure
 * dressed up as one, and Bond's Error 5 stays what p. 84 says it is: an LN-domain
 * failure. (Under the refuted `< 0` reading of Error 4, PRI = 0 was admissible and
 * had no root at all, which is what previously forced Error 7 to double as a
 * no-solution code.)
 */
function bracketYield(residual: (Y: number) => number, M: number): [number, number] {
  const probes = [
    -M * 0.999999,
    -M * 0.9,
    -M * 0.5,
    -M * 0.25,
    -0.1,
    -0.01,
    0,
    0.01,
    0.05,
    0.1,
    0.25,
    0.5,
    1,
    2,
    5,
    10,
    25,
    100,
    1000,
  ]
    .filter((Y) => Y > -M)
    .sort((a, b) => a - b);

  let previous: { Y: number; value: number } | null = null;
  for (const Y of probes) {
    let value: number;
    try {
      value = residual(Y);
    } catch {
      // Outside the discount base's domain; keep scanning.
      previous = null;
      continue;
    }
    if (!Number.isFinite(value)) {
      previous = null;
      continue;
    }
    if (value === 0) return [Y, Y];
    if (previous && Math.sign(value) !== Math.sign(previous.value)) return [previous.Y, Y];
    previous = { Y, value };
  }

  throw new CalculatorError(ErrorCode.IterationLimitExceeded, 'no yield brackets the entered PRI');
}

// ---------------------------------------------------------------------------

/** Compute the requested unknown, leaving every other variable untouched. */
export function computeBond(
  state: BondState,
  unknown: BondVariable,
  options?: BondSolveOptions,
): number {
  switch (unknown) {
    case 'PRI':
      return computePrice(state);
    case 'YLD':
      return computeYield(state, options);
  }
}

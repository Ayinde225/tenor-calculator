/**
 * Date worksheet.
 *
 * Counts days between two dates (DBD), or projects a date from a start date and
 * a day count. Two day-count methods share one setting slot: ACT (actual/actual)
 * and 360 (30/360). Guidebook pp. 68-69 (behaviour), pp. 81-82 (formulas).
 *
 * The supported window is January 1 1980 through December 31 2079 (p. 81).
 * Outside it, Error 4. An impossible date (February 30) or a mis-keyed format is
 * Error 6 (p. 85).
 *
 * THE PRINTED ACTUAL/ACTUAL FORMULA (pp. 81-82), transcribed:
 *
 *     DBD = number of days II - number of days I
 *
 *     Number of Days I = (Y1 - YB) x 365
 *                      + (number of days MB to M1)
 *                      + DT1
 *                      + (Y1 - YB)/4
 *
 * with the same shape for Days II. `MB` is January, `YB` is "base year (first
 * year after leap year)" -- the constant itself is never printed. 1980 is a leap
 * year, so YB = 1981 is the natural choice and is the one used here.
 *
 * THREE CORRECTIONS, none of them optional:
 *
 *  1. The multiplication sign in `(Y1 - YB) x 365` on p. 81 is drawn as a glyph
 *     that extracts as `Q`. The identical line for Days II on p. 82 renders it as
 *     a proper `x`, which settles it.
 *
 *  2. `(Y1 - YB)/4` is printed as a bare fraction with no floor or truncation
 *     notation. A fractional day count is meaningless, and the term is only
 *     correct as an integer count of leap days already elapsed, so it is FLOORED.
 *     Floor, not truncate: Jan 1 1980 sits one year before YB, and floor(-1/4) =
 *     -1 correctly cancels 1980's own leap day, where truncation's 0 would put
 *     the earliest supported date one day late.
 *
 *  3. `number of days MB to M1` must count the CURRENT year's leap day when M1 is
 *     March or later. p. 69 states ACT "uses the actual number of days in each
 *     month and each year, including adjustments for leap years"; reading the
 *     term as a fixed non-leap table instead would report 28 days from Feb 1 2004
 *     to Mar 1 2004. With the leap day inside this term and only completed years'
 *     leap days in term (2), the formula is an exact serial day number.
 *
 * WHY THE /4 TERM IS SAFE HERE: it has no century exception, so read literally it
 * would call 2100 a leap year. Every multiple of 4 between 1980 and 2079 really
 * is a leap year -- 2000 is divisible by 400 -- so the printed term is exact
 * across the entire supported window, and dates outside it are Error 4 regardless.
 * `isLeapYear` below carries the full Gregorian rule (2000 leap, 1900 not) because
 * month lengths depend on it; date.test.ts cross-checks the two agree year by year.
 *
 * THE PRINTED 30/360 FORMULA (p. 82) drops its closing parenthesis:
 *
 *     DBD = (Y2 - Y1) x 360 + (M2 - M1) x 30 + (DT2 - DT1
 *
 * Balanced, it is the standard Lynch-and-Mayle form, with p. 82's day clamping
 * applied before the subtraction.
 *
 * PARITY CHECK (p. 69): September 4 2003 to November 1 2003 under ACT is 58 days.
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/** ACT = actual/actual, 360 = 30/360. One setting slot, toggled by 2ND SET (p. 68). */
export type DayCountMethod = 'ACT' | '360';

/**
 * DATE format setting: US keys and displays mm-dd-yyyy, EUR dd-mm-yyyy (p. 68).
 * Deliberately separate from `SeparatorFormat` in display/format.ts -- that one
 * governs the thousands separator and is a different setting on the hardware.
 */
export type DateFormatSetting = 'US' | 'EUR';

export interface CalendarDate {
  /** Four-digit year. */
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31, bounded by the month's real length. */
  readonly day: number;
}

export interface DateState {
  readonly DT1: CalendarDate;
  readonly DT2: CalendarDate;
  /** Days between DT1 and DT2. */
  readonly DBD: number;
  readonly method: DayCountMethod;
}

export type DateVariable = 'DT1' | 'DT2' | 'DBD';

/** Weekday abbreviation shown alongside a computed DT1/DT2 (p. 68). */
export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

/** Earliest and latest enterable or computable date (guidebook p. 81). */
export const MIN_DATE: CalendarDate = Object.freeze({ year: 1980, month: 1, day: 1 });
export const MAX_DATE: CalendarDate = Object.freeze({ year: 2079, month: 12, day: 31 });

/** Defaults after 2ND RESET ENTER (guidebook p. 68). */
export const DATE_DEFAULTS: DateState = Object.freeze({
  DT1: Object.freeze({ year: 1990, month: 12, day: 31 }),
  DT2: Object.freeze({ year: 1990, month: 12, day: 31 }),
  DBD: 0,
  method: 'ACT',
});

/**
 * YB. The guidebook defines it only as "base year (first year after leap year)"
 * (p. 82) and never prints a value; 1980 is a leap year and anchors the supported
 * window, so its successor is the intended constant.
 */
const BASE_YEAR = 1981;

const MONTH_LENGTHS: readonly number[] = Object.freeze([
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]);

/** Days in the months strictly before each month, ignoring leap day. */
const DAYS_BEFORE_MONTH: readonly number[] = Object.freeze([
  0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
]);

/**
 * Weekday of day number 0, then forward. Day number 1 is January 1 1981, a
 * Thursday, which pins the whole cycle.
 */
const WEEKDAYS: readonly Weekday[] = Object.freeze([
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
  'MON',
  'TUE',
]);

/**
 * Full Gregorian leap rule: divisible by 4, except centuries, except multiples of
 * 400. Within 1980-2079 only the "divisible by 4" clause ever fires (2000 is a
 * multiple of 400), but the century exceptions are the rule and are implemented
 * rather than assumed away.
 */
export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 100 !== 0) return true;
  return year % 400 === 0;
}

/** Real length of a month, leap February included. */
export function daysInMonth(year: number, month: number): number {
  const length = MONTH_LENGTHS[month - 1];
  if (length === undefined) {
    throw new CalculatorError(ErrorCode.InvalidDate, `month ${month} is not 1-12`);
  }
  return month === 2 && isLeapYear(year) ? 29 : length;
}

/**
 * The guidebook's `number of days MB to M`: January 1 to the first of month M,
 * in the year's own calendar. Leap-aware -- see correction (3) in the header.
 */
function daysBeforeMonth(year: number, month: number): number {
  const cumulative = DAYS_BEFORE_MONTH[month - 1];
  if (cumulative === undefined) {
    throw new CalculatorError(ErrorCode.InvalidDate, `month ${month} is not 1-12`);
  }
  return cumulative + (month > 2 && isLeapYear(year) ? 1 : 0);
}

/**
 * Reject a date that is not a date (Error 6), then one outside the supported
 * window (Error 4).
 *
 * Order matters and the guidebook does not fix it: February 30 1979 is both
 * impossible and out of range. Impossibility is checked first, on the grounds
 * that a non-date has no position to be out of range of.
 */
export function assertValidDate(d: CalendarDate): void {
  if (!Number.isInteger(d.year) || !Number.isInteger(d.month) || !Number.isInteger(d.day)) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `${d.year}-${d.month}-${d.day} has a non-integer field`,
    );
  }
  if (d.month < 1 || d.month > 12) {
    throw new CalculatorError(ErrorCode.InvalidDate, `month ${d.month} is not 1-12`);
  }
  const length = daysInMonth(d.year, d.month);
  if (d.day < 1 || d.day > length) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `day ${d.day} is not 1-${length} for month ${d.month} of ${d.year}`,
    );
  }
  if (d.year < MIN_DATE.year || d.year > MAX_DATE.year) {
    throw new CalculatorError(
      ErrorCode.OutOfRange,
      `${d.year}-${d.month}-${d.day} is outside ${MIN_DATE.year}-${MAX_DATE.year}`,
    );
  }
}

/**
 * `Number of Days` from pp. 81-82, corrected: a serial day number with day 1 at
 * January 1 of the base year. DBD is the difference of two of these.
 *
 * Deliberately unvalidated: `fromDayNumber` probes years just outside the
 * supported window while inverting, and the range check belongs at the worksheet
 * boundary, not inside the arithmetic.
 */
export function dayNumber(d: CalendarDate): number {
  const elapsedYears = d.year - BASE_YEAR;
  return (
    elapsedYears * 365 +
    daysBeforeMonth(d.year, d.month) +
    d.day +
    // (Y - YB)/4 as printed, floored -- correction (2) in the header.
    Math.floor(elapsedYears / 4)
  );
}

const MIN_DAY_NUMBER = dayNumber(MIN_DATE);
const MAX_DAY_NUMBER = dayNumber(MAX_DATE);

/** Inverse of `dayNumber`. Error 4 outside the supported window (p. 84). */
export function fromDayNumber(n: number): CalendarDate {
  if (!Number.isInteger(n)) {
    throw new CalculatorError(ErrorCode.InvalidDate, `day number ${n} is not a whole day`);
  }
  if (n < MIN_DAY_NUMBER || n > MAX_DAY_NUMBER) {
    throw new CalculatorError(
      ErrorCode.OutOfRange,
      `computed date is outside January 1 ${MIN_DATE.year} - December 31 ${MAX_DATE.year}`,
    );
  }

  // 365.25 lands within one year; the two walks settle the boundary exactly.
  let year = BASE_YEAR + Math.floor((n - 1) / 365.25);
  while (dayNumber({ year, month: 1, day: 1 }) > n) year--;
  while (dayNumber({ year: year + 1, month: 1, day: 1 }) <= n) year++;

  let remaining = n - dayNumber({ year, month: 1, day: 1 }) + 1;
  let month = 1;
  while (month < 12 && remaining > daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month++;
  }
  return Object.freeze({ year, month, day: remaining });
}

/** Three-letter weekday, shown with a computed DT1/DT2 (p. 68). */
export function weekdayOf(d: CalendarDate): Weekday {
  assertValidDate(d);
  const index = ((dayNumber(d) % 7) + 7) % 7;
  const weekday = WEEKDAYS[index];
  if (weekday === undefined) {
    throw new CalculatorError(ErrorCode.InvalidDate, `no weekday for ${d.year}-${d.month}-${d.day}`);
  }
  return weekday;
}

/**
 * 30/360, p. 82. Clamping is applied before the subtraction, exactly as printed:
 * "If DT1 is 31, change DT1 to 30. If DT2 is 31 and DT1 is 30 or 31, change DT2
 * to 30; otherwise, leave it at 31."
 */
function daysBetween360(dt1: CalendarDate, dt2: CalendarDate): number {
  const day1 = dt1.day === 31 ? 30 : dt1.day;
  // Tested against the ORIGINAL DT1 as the note words it; after the clamp above
  // "30 or 31" and "is 30" select the same dates, so the two readings agree.
  const day2 = dt2.day === 31 && (dt1.day === 30 || dt1.day === 31) ? 30 : dt2.day;

  return toInternal(
    (dt2.year - dt1.year) * 360 + (dt2.month - dt1.month) * 30 + (day2 - day1),
  );
}

/**
 * DBD under the selected method.
 *
 * The guidebook assumes DT1 is earlier than DT2 (p. 68) but never says what
 * happens when it is not. Both printed formulas are signed subtractions, so a
 * reversed pair returns a negative count rather than an error.
 */
export function daysBetween(
  dt1: CalendarDate,
  dt2: CalendarDate,
  method: DayCountMethod,
): number {
  assertValidDate(dt1);
  assertValidDate(dt2);
  if (method === '360') return daysBetween360(dt1, dt2);
  return toInternal(dayNumber(dt2) - dayNumber(dt1));
}

/**
 * 30/360 discards real month lengths, so a day count under it does not identify a
 * calendar date -- p. 69: "You can compute DBD using this day-count method, but
 * not DT1 or DT2."
 *
 * The guidebook does not say whether the hardware errors or is silently inert
 * here. Error 5 is used: the request is well-formed, no solution exists for it.
 * See docs/OPEN-QUESTIONS.md.
 */
function requireActual(method: DayCountMethod, variable: DateVariable): void {
  if (method === '360') {
    throw new CalculatorError(
      ErrorCode.NoSolution,
      `${variable} cannot be computed under the 30/360 day-count method`,
    );
  }
}

/** A day count that is not a whole number cannot land on a date. */
function assertWholeDays(dbd: number): void {
  if (!Number.isInteger(dbd)) {
    throw new CalculatorError(ErrorCode.InvalidDate, `DBD ${dbd} is not a whole number of days`);
  }
}

/** DT2 = DT1 + DBD. ACT only. */
export function solveDT2(state: DateState): CalendarDate {
  requireActual(state.method, 'DT2');
  assertValidDate(state.DT1);
  assertWholeDays(state.DBD);
  return fromDayNumber(dayNumber(state.DT1) + state.DBD);
}

/** DT1 = DT2 - DBD. ACT only. */
export function solveDT1(state: DateState): CalendarDate {
  requireActual(state.method, 'DT1');
  assertValidDate(state.DT2);
  assertWholeDays(state.DBD);
  return fromDayNumber(dayNumber(state.DT2) - state.DBD);
}

/** DBD from DT1 and DT2 under the selected method. */
export function solveDBD(state: DateState): number {
  return daysBetween(state.DT1, state.DT2, state.method);
}

/** Compute the requested unknown, leaving the rest of the state untouched. */
export function computeDate(state: DateState, unknown: 'DBD'): number;
export function computeDate(state: DateState, unknown: 'DT1' | 'DT2'): CalendarDate;
export function computeDate(state: DateState, unknown: DateVariable): CalendarDate | number;
export function computeDate(state: DateState, unknown: DateVariable): CalendarDate | number {
  switch (unknown) {
    case 'DT1':
      return solveDT1(state);
    case 'DT2':
      return solveDT2(state);
    case 'DBD':
      return solveDBD(state);
  }
}

/**
 * Parse a keyed date entry.
 *
 * US keys MM.DDYY, EUR keys DD.MMYY (p. 68). `9.0403 ENTER` gives 9-04-2003 on
 * p. 69, which fixes both the field order and the two-digit year.
 *
 * WHY THE DIGITS ARE READ AS A STRING: the keyed token is a number, and 9.0403 as
 * a double is 9.040299999999999. Scaling the fractional part by 10000 leaves
 * 402.99999999999 -- the format check would then have to guess at a tolerance.
 * Rendering at the machine's own 13 significant digits reproduces the decimal
 * digits the user actually pressed, which is what the format rule is about.
 *
 * Trailing zeros are restored, not required: `1.01` and `1.0100` are the same
 * number and both mean January 1 2000. More than four fractional digits means the
 * year was keyed in full (MM.DDYYYY), which is Error 6 per p. 85.
 */
export function parseDateEntry(entry: number, format: DateFormatSetting = 'US'): CalendarDate {
  if (!Number.isFinite(entry) || entry < 0 || entry >= 100) {
    throw new CalculatorError(ErrorCode.InvalidDate, `${entry} is not a MM.DDYY date entry`);
  }

  const [intPart = '0', fractionRaw = ''] = entry.toPrecision(13).split('.');
  const fraction = fractionRaw.replace(/0+$/, '');
  if (fraction.length > 4) {
    throw new CalculatorError(
      ErrorCode.InvalidDate,
      `${entry} has ${fraction.length} fractional digits; the format is MM.DDYY, not MM.DDYYYY`,
    );
  }

  const padded = fraction.padEnd(4, '0');
  const lead = Number(intPart);
  const second = Number(padded.slice(0, 2));
  const yy = Number(padded.slice(2, 4));

  const month = format === 'EUR' ? second : lead;
  const day = format === 'EUR' ? lead : second;

  const date: CalendarDate = Object.freeze({ year: expandYear(yy), month, day });
  assertValidDate(date);
  return date;
}

/**
 * Two-digit year into the 1980-2079 window (p. 81). The mapping is never spelled
 * out; it is forced by the window being exactly 100 years wide, and confirmed by
 * `03` reading as 2003 on p. 69 and the 12-31-1990 default on p. 68.
 */
function expandYear(yy: number): number {
  return yy >= 80 ? 1900 + yy : 2000 + yy;
}

/**
 * Render a date for the LCD: US mm-dd-yyyy, EUR dd-mm-yyyy (p. 68).
 *
 * The leading field is unpadded and the middle field zero-padded -- `9-04-2003`,
 * `11-01-2003`, `12-31-1990` (p. 69). The guidebook prints no EUR example, so the
 * same leading-field rule is carried over to it. See docs/OPEN-QUESTIONS.md.
 */
export function formatDate(d: CalendarDate, format: DateFormatSetting = 'US'): string {
  assertValidDate(d);
  const [lead, middle] = format === 'EUR' ? [d.day, d.month] : [d.month, d.day];
  return `${lead}-${String(middle).padStart(2, '0')}-${d.year}`;
}

/**
 * 2ND CLR WORK inside the Date worksheet: DT1, DT2 and DBD to defaults, day-count
 * method deliberately untouched (p. 68). 2ND RESET ENTER restores ACT as well,
 * which is what DATE_DEFAULTS already carries.
 */
export function clearWork(state: DateState): DateState {
  return {
    DT1: DATE_DEFAULTS.DT1,
    DT2: DATE_DEFAULTS.DT2,
    DBD: DATE_DEFAULTS.DBD,
    method: state.method,
  };
}

/** 2ND SET on the ACT/360 slot: the two share one setting (p. 68). */
export function toggleMethod(method: DayCountMethod): DayCountMethod {
  return method === 'ACT' ? '360' : 'ACT';
}

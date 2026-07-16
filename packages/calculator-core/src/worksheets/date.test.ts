import { describe, it, expect } from 'vitest';
import {
  DATE_DEFAULTS,
  MAX_DATE,
  MIN_DATE,
  clearWork,
  computeDate,
  dayNumber,
  daysBetween,
  daysInMonth,
  formatDate,
  fromDayNumber,
  isLeapYear,
  parseDateEntry,
  solveDBD,
  solveDT1,
  solveDT2,
  toggleMethod,
  weekdayOf,
  type CalendarDate,
  type DateState,
} from './date.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const ws = (o: Partial<DateState>): DateState => ({ ...DATE_DEFAULTS, ...o });
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });
const d = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

/** Assert a CalculatorError with the expected code, and that something threw at all. */
function expectError(code: ErrorCode, fn: () => unknown): void {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
  }
}

const SEP_4_2003 = d(2003, 9, 4);
const NOV_1_2003 = d(2003, 11, 1);

/**
 * The guidebook's only Date example (p. 69): a loan made September 4 2003 defers
 * its first payment to November 1 2003. Every Date golden case is a step of it,
 * and its answer -- 58 -- is the project's stated parity target.
 */
describe('guidebook days-between-dates example (p. 69)', () => {
  // other-worksheets-date-default-dt1
  it('opens on the default DT1 = 12-31-1990', () => {
    expect(formatDate(DATE_DEFAULTS.DT1, 'US')).toBe('12-31-1990');
  });

  // other-worksheets-date-enter-dt1
  it('reads 9.0403 as 9-04-2003', () => {
    expect(formatDate(parseDateEntry(9.0403, 'US'), 'US')).toBe('9-04-2003');
  });

  // other-worksheets-date-enter-dt2
  it('reads 11.0103 as 11-01-2003', () => {
    expect(formatDate(parseDateEntry(11.0103, 'US'), 'US')).toBe('11-01-2003');
  });

  // other-worksheets-date-act-setting-displayed
  it('shows the day-count setting as the bare method name', () => {
    // A setting, not a number: no "=" and no value (p. 68). ACT is the default,
    // which is why the example never presses 2ND SET.
    expect(DATE_DEFAULTS.method).toBe('ACT');
  });

  // other-worksheets-date-dbd-act -- the project's parity example.
  it('computes DBD = 58.00 for September 4 2003 to November 1 2003 under ACT', () => {
    const state = ws({ DT1: SEP_4_2003, DT2: NOV_1_2003, method: 'ACT' });
    expect(shown(solveDBD(state))).toBe('58.00');
  });

  it('agrees with the guidebook arithmetic: 26 + 31 + 1', () => {
    // 26 remaining days in September, 31 in October, 1 in November.
    expect(daysBetween(SEP_4_2003, NOV_1_2003, 'ACT')).toBe(26 + 31 + 1);
  });

  it('displays DBD at the current DEC setting, hence 58.00 and not 58', () => {
    expect(shown(58)).toBe('58.00');
    expect(formatValue(58, { decimals: 0, separator: 'US' })).toBe('58');
  });
});

describe('solving for each unknown', () => {
  it('solves DBD from DT1 and DT2', () => {
    expect(shown(solveDBD(ws({ DT1: SEP_4_2003, DT2: NOV_1_2003 })))).toBe('58.00');
  });

  it('solves DT2 from DT1 and DBD', () => {
    const state = ws({ DT1: SEP_4_2003, DBD: 58, method: 'ACT' });
    expect(formatDate(solveDT2(state))).toBe('11-01-2003');
  });

  it('solves DT1 from DT2 and DBD', () => {
    const state = ws({ DT2: NOV_1_2003, DBD: 58, method: 'ACT' });
    expect(formatDate(solveDT1(state))).toBe('9-04-2003');
  });

  it('dispatches through computeDate', () => {
    expect(shown(computeDate(ws({ DT1: SEP_4_2003, DT2: NOV_1_2003 }), 'DBD'))).toBe('58.00');
    expect(formatDate(computeDate(ws({ DT1: SEP_4_2003, DBD: 58 }), 'DT2'))).toBe('11-01-2003');
    expect(formatDate(computeDate(ws({ DT2: NOV_1_2003, DBD: 58 }), 'DT1'))).toBe('9-04-2003');
  });

  it('leaves the rest of the state untouched', () => {
    const state = ws({ DT1: SEP_4_2003, DT2: NOV_1_2003, DBD: 0 });
    computeDate(state, 'DBD');
    expect(state).toEqual({ DT1: SEP_4_2003, DT2: NOV_1_2003, DBD: 0, method: 'ACT' });
  });

  it('round-trips: projecting DBD forward and back returns the endpoints', () => {
    const dbd = daysBetween(SEP_4_2003, NOV_1_2003, 'ACT');
    expect(solveDT2(ws({ DT1: SEP_4_2003, DBD: dbd }))).toEqual(NOV_1_2003);
    expect(solveDT1(ws({ DT2: NOV_1_2003, DBD: dbd }))).toEqual(SEP_4_2003);
  });

  it('projects a date forward across a year boundary', () => {
    // Dec 31 1990 + 1 day. The default DT1 is a convenient anchor.
    expect(formatDate(solveDT2(ws({ DT1: d(1990, 12, 31), DBD: 1 })))).toBe('1-01-1991');
  });

  it('DBD = 0 leaves the date where it is', () => {
    expect(solveDT2(ws({ DT1: SEP_4_2003, DBD: 0 }))).toEqual(SEP_4_2003);
    expect(daysBetween(SEP_4_2003, SEP_4_2003, 'ACT')).toBe(0);
    expect(daysBetween(SEP_4_2003, SEP_4_2003, '360')).toBe(0);
  });
});

/**
 * p. 69: "the calculator assumes 30 days per month (360 days per year). You can
 * compute DBD using this day-count method, but not DT1 or DT2."
 */
describe('30/360 day-count method (p. 82)', () => {
  it('gives 57 for the September 4 to November 1 2003 pair', () => {
    // (0 x 360) + (2 x 30) + (1 - 4) = 57. The guidebook prints no 30/360
    // comparison for its own example; this is the implementation check the spec
    // records, and it is one day short of the ACT answer.
    expect(shown(solveDBD(ws({ DT1: SEP_4_2003, DT2: NOV_1_2003, method: '360' })))).toBe('57.00');
    expect(daysBetween(SEP_4_2003, NOV_1_2003, '360')).toBe(57);
    expect(daysBetween(SEP_4_2003, NOV_1_2003, 'ACT')).toBe(58);
  });

  it('counts a full year as exactly 360 days', () => {
    expect(daysBetween(d(2003, 1, 1), d(2004, 1, 1), '360')).toBe(360);
    // Even across a leap year -- real month lengths play no part.
    expect(daysBetween(d(2004, 1, 1), d(2005, 1, 1), '360')).toBe(360);
    expect(daysBetween(d(2004, 1, 1), d(2005, 1, 1), 'ACT')).toBe(366);
  });

  it('counts every whole month as exactly 30 days', () => {
    expect(daysBetween(d(2003, 1, 1), d(2003, 2, 1), '360')).toBe(30);
    expect(daysBetween(d(2003, 2, 1), d(2003, 3, 1), '360')).toBe(30);
    // February really is 28 days in 2003.
    expect(daysBetween(d(2003, 2, 1), d(2003, 3, 1), 'ACT')).toBe(28);
  });

  it('clamps DT1 = 31 to 30', () => {
    // Jan 31 -> Feb 28 2003: (0) + 30 + (28 - 30) = 28.
    expect(daysBetween(d(2003, 1, 31), d(2003, 2, 28), '360')).toBe(28);
  });

  it('clamps DT2 = 31 to 30 when DT1 is 30 or 31', () => {
    // DT1 = 30: (0) + 60 + (30 - 30) = 60.
    expect(daysBetween(d(2003, 1, 30), d(2003, 3, 31), '360')).toBe(60);
    // DT1 = 31 -> 30, so DT2 clamps too: (0) + 60 + (30 - 30) = 60.
    expect(daysBetween(d(2003, 1, 31), d(2003, 3, 31), '360')).toBe(60);
  });

  it('leaves DT2 = 31 alone when DT1 is neither 30 nor 31', () => {
    // (0) + 60 + (31 - 15) = 76.
    expect(daysBetween(d(2003, 1, 15), d(2003, 3, 31), '360')).toBe(76);
  });

  it('cannot compute DT1 or DT2 (p. 69)', () => {
    // The guidebook says only that you "cannot"; it does not print an error
    // number. Error 5 is our reading -- see docs/OPEN-QUESTIONS.md.
    expectError(ErrorCode.NoSolution, () => solveDT2(ws({ DT1: SEP_4_2003, DBD: 57, method: '360' })));
    expectError(ErrorCode.NoSolution, () => solveDT1(ws({ DT2: NOV_1_2003, DBD: 57, method: '360' })));
    expectError(ErrorCode.NoSolution, () => computeDate(ws({ method: '360' }), 'DT2'));
  });

  it('still computes DBD under 360 -- only the dates are barred', () => {
    expect(() => solveDBD(ws({ DT1: SEP_4_2003, DT2: NOV_1_2003, method: '360' }))).not.toThrow();
  });
});

/**
 * p. 69: ACT "uses the actual number of days in each month and each year,
 * including adjustments for leap years".
 */
describe('leap years', () => {
  it('applies the full Gregorian rule', () => {
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(1900)).toBe(false); // century, not divisible by 400
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2004)).toBe(true);
    expect(isLeapYear(2003)).toBe(false);
    expect(isLeapYear(1980)).toBe(true);
  });

  it('gives February 29 days in a leap year and 28 otherwise', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2004, 2)).toBe(29);
    expect(daysInMonth(2003, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2003, 1)).toBe(31);
    expect(daysInMonth(2003, 4)).toBe(30);
  });

  it('counts 366 days across the year 2000 and 365 across 1999', () => {
    expect(daysBetween(d(2000, 1, 1), d(2001, 1, 1), 'ACT')).toBe(366);
    expect(daysBetween(d(1999, 1, 1), d(2000, 1, 1), 'ACT')).toBe(365);
  });

  it('counts February 29 in a leap year that a naive 365-day formula would miss', () => {
    // This is the case that forces the leap day into the "days MB to M" term
    // rather than a fixed non-leap month table: a table would report 28.
    expect(daysBetween(d(2004, 2, 1), d(2004, 3, 1), 'ACT')).toBe(29);
    expect(daysBetween(d(2003, 2, 1), d(2003, 3, 1), 'ACT')).toBe(28);
  });

  it('accepts February 29 2000 and rejects February 29 2003', () => {
    expect(formatDate(parseDateEntry(2.29, 'US'))).toBe('2-29-2000');
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(2.2903, 'US'));
  });

  it('spans the whole supported window at the right length', () => {
    // 1980-2079 holds 25 leap years (every multiple of 4; 2000 is one because it
    // is divisible by 400). 100 x 365 + 25 - 1 = 36,524.
    expect(daysBetween(MIN_DATE, MAX_DATE, 'ACT')).toBe(36524);
  });
});

/**
 * The appendix prints the leap-day term as a bare `(Y1 - YB)/4` with no century
 * exception. It survives only because of the window it is used in.
 */
describe('the printed (Y - YB)/4 leap term (pp. 81-82)', () => {
  const BASE_YEAR = 1981;

  /** Leap years in [1, y] under the full Gregorian rule. */
  const leapCount = (y: number): number =>
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);

  /** Leap years elapsed between January 1 BASE_YEAR and January 1 y. */
  const gregorianLeapDays = (y: number): number => leapCount(y - 1) - leapCount(BASE_YEAR - 1);

  it('floored, equals the true Gregorian leap-day count for every supported year', () => {
    for (let year = MIN_DATE.year; year <= MAX_DATE.year + 1; year++) {
      expect(Math.floor((year - BASE_YEAR) / 4)).toBe(gregorianLeapDays(year));
    }
  });

  it('breaks at 2100 -- which is why the window is load-bearing, not decoration', () => {
    // The printed /4 rule calls 2100 a leap year. It is not one, so the term
    // over-counts by a day from 2101 onward. Every such date is Error 4 here.
    expect(Math.floor((2101 - BASE_YEAR) / 4)).toBe(30);
    expect(gregorianLeapDays(2101)).toBe(29);
  });

  it('must be floored, not truncated: January 1 1980 sits below the base year', () => {
    // (1980 - 1981)/4 = -0.25. Floor gives -1, cancelling 1980's own leap day;
    // truncation gives 0 and puts the earliest supported date a day late.
    expect(Math.floor((1980 - BASE_YEAR) / 4)).toBe(-1);
    // Compared loosely: truncating -0.25 yields -0, and the claim under test is
    // that it is zero rather than -1, not what sign that zero carries.
    expect(Math.trunc((1980 - BASE_YEAR) / 4) === 0).toBe(true);
    expect(gregorianLeapDays(1980)).toBe(-1);

    // The observable consequence: with truncation this count would be 36,523.
    expect(daysBetween(MIN_DATE, MAX_DATE, 'ACT')).toBe(36524);
  });

  it('numbers the base year from 1: January 1 1981 is day 1', () => {
    expect(dayNumber(d(1981, 1, 1))).toBe(1);
  });
});

describe('date entry (p. 68-69)', () => {
  it('reads US entries as MM.DDYY', () => {
    expect(parseDateEntry(9.0403, 'US')).toEqual(d(2003, 9, 4));
    expect(parseDateEntry(11.0103, 'US')).toEqual(d(2003, 11, 1));
    expect(parseDateEntry(12.3190, 'US')).toEqual(d(1990, 12, 31));
  });

  it('reads EUR entries as DD.MMYY', () => {
    expect(parseDateEntry(4.0903, 'EUR')).toEqual(d(2003, 9, 4));
    expect(parseDateEntry(1.1103, 'EUR')).toEqual(d(2003, 11, 1));
    expect(parseDateEntry(31.1290, 'EUR')).toEqual(d(1990, 12, 31));
  });

  it('defaults to US when no format is given', () => {
    expect(parseDateEntry(9.0403)).toEqual(d(2003, 9, 4));
  });

  it('restores trailing zeros the keyed number cannot carry', () => {
    // 1.01 and 1.0100 are the same double. Both mean January 1 2000.
    expect(parseDateEntry(1.01, 'US')).toEqual(d(2000, 1, 1));
    expect(parseDateEntry(1.0100, 'US')).toEqual(d(2000, 1, 1));
    // 12.319 is 12.3190: December 31 1990.
    expect(parseDateEntry(12.319, 'US')).toEqual(d(1990, 12, 31));
    // 1.018 is 1.0180: January 1 1980.
    expect(parseDateEntry(1.018, 'US')).toEqual(d(1980, 1, 1));
  });

  it('survives the binary representation of the keyed decimal', () => {
    // 9.0403 as a double is 9.040299999999999. Scaling the fraction by 10,000
    // gives 402.99999999999 -- reading the decimal digits instead is what makes
    // the four-digit format rule decidable at all.
    expect(9.0403 - 9).not.toBe(0.0403);
    expect(parseDateEntry(9.0403, 'US')).toEqual(d(2003, 9, 4));
  });

  it('maps two-digit years into the 1980-2079 window (p. 81)', () => {
    expect(parseDateEntry(1.018, 'US').year).toBe(1980); // 80 -> 1980
    expect(parseDateEntry(12.3199, 'US').year).toBe(1999); // 99 -> 1999
    expect(parseDateEntry(1.0100, 'US').year).toBe(2000); // 00 -> 2000
    expect(parseDateEntry(9.0403, 'US').year).toBe(2003); // 03 -> 2003
    expect(parseDateEntry(12.3179, 'US').year).toBe(2079); // 79 -> 2079
  });
});

describe('date display (p. 69)', () => {
  it('renders US dates mm-dd-yyyy with an unpadded month and a padded day', () => {
    expect(formatDate(d(2003, 9, 4), 'US')).toBe('9-04-2003');
    expect(formatDate(d(2003, 11, 1), 'US')).toBe('11-01-2003');
    expect(formatDate(d(1990, 12, 31), 'US')).toBe('12-31-1990');
  });

  it('renders EUR dates dd-mm-yyyy', () => {
    // The guidebook prints no EUR example; the leading-field padding rule is
    // carried over from US. See docs/OPEN-QUESTIONS.md.
    expect(formatDate(d(2003, 9, 4), 'EUR')).toBe('4-09-2003');
    expect(formatDate(d(2003, 11, 1), 'EUR')).toBe('1-11-2003');
    expect(formatDate(d(1990, 12, 31), 'EUR')).toBe('31-12-1990');
  });

  it('defaults to US when no format is given', () => {
    expect(formatDate(d(2003, 9, 4))).toBe('9-04-2003');
  });
});

/** p. 68: computing DT1 or DT2 also shows a three-letter weekday, e.g. WED. */
describe('weekday of a computed date (p. 68)', () => {
  it('names the weekday for known dates', () => {
    expect(weekdayOf(d(2003, 9, 4))).toBe('THU');
    expect(weekdayOf(d(2003, 11, 1))).toBe('SAT');
    expect(weekdayOf(d(1990, 12, 31))).toBe('MON'); // the default DT1
    expect(weekdayOf(d(2000, 1, 1))).toBe('SAT');
    expect(weekdayOf(d(1980, 1, 1))).toBe('TUE'); // earliest supported date
    expect(weekdayOf(d(2079, 12, 31))).toBe('SUN'); // latest supported date
  });

  it('advances one weekday per day and wraps every seven', () => {
    expect(weekdayOf(d(2003, 9, 5))).toBe('FRI');
    expect(weekdayOf(d(2003, 9, 11))).toBe('THU');
  });

  it('steps correctly across February 29', () => {
    expect(weekdayOf(d(2000, 2, 28))).toBe('MON');
    expect(weekdayOf(d(2000, 2, 29))).toBe('TUE');
    expect(weekdayOf(d(2000, 3, 1))).toBe('WED');
  });
});

describe('error conditions', () => {
  it('raises Error 6 for an impossible date (p. 85)', () => {
    // The guidebook's own example is January 32.
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(1.3203, 'US'));
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(2.3003, 'US')); // February 30
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(4.3103, 'US')); // April 31
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(13.0103, 'US')); // month 13
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(0.0103, 'US')); // month 0
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(9.0003, 'US')); // day 0
  });

  it('raises Error 6 for the wrong entry format, MM.DDYYYY (p. 85)', () => {
    // Six fractional digits: the year was keyed in full.
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(9.042003, 'US'));
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(12.311990, 'US'));
    // Five is just as wrong as six.
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(9.04031, 'US'));
  });

  it('raises Error 6 for an entry that is not a MM.DDYY token at all', () => {
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(-9.0403, 'US'));
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(100.0403, 'US'));
  });

  it('raises Error 6 on an impossible date given directly to the engine', () => {
    expectError(ErrorCode.InvalidDate, () => daysBetween(d(2003, 2, 30), NOV_1_2003, 'ACT'));
    expectError(ErrorCode.InvalidDate, () => daysBetween(SEP_4_2003, d(2003, 13, 1), 'ACT'));
    expectError(ErrorCode.InvalidDate, () => daysBetween(SEP_4_2003, d(2003, 2, 29), '360'));
  });

  it('raises Error 4 for a date outside January 1 1980 - December 31 2079 (p. 84)', () => {
    expectError(ErrorCode.OutOfRange, () => daysBetween(d(1979, 12, 31), NOV_1_2003, 'ACT'));
    expectError(ErrorCode.OutOfRange, () => daysBetween(SEP_4_2003, d(2080, 1, 1), 'ACT'));
    expectError(ErrorCode.OutOfRange, () => formatDate(d(1979, 12, 31)));
  });

  it('raises Error 4 when a COMPUTED date leaves the window (p. 84)', () => {
    // One day before the earliest supported date.
    expectError(ErrorCode.OutOfRange, () => solveDT1(ws({ DT2: MIN_DATE, DBD: 1 })));
    // One day after the latest.
    expectError(ErrorCode.OutOfRange, () => solveDT2(ws({ DT1: MAX_DATE, DBD: 1 })));
    // The boundaries themselves are fine.
    expect(solveDT2(ws({ DT1: MIN_DATE, DBD: 0 }))).toEqual(MIN_DATE);
    expect(solveDT2(ws({ DT1: MIN_DATE, DBD: 36524 }))).toEqual(MAX_DATE);
  });

  it('prefers Error 6 over Error 4 when a date is both impossible and out of range', () => {
    // Unstated by the guidebook: a non-date has no position to be out of range
    // of, so impossibility is reported first. See docs/OPEN-QUESTIONS.md.
    expectError(ErrorCode.InvalidDate, () => formatDate(d(1979, 2, 30)));
  });

  it('raises Error 6 for a fractional DBD, which cannot land on a date', () => {
    // Unstated by the guidebook. See docs/OPEN-QUESTIONS.md.
    expectError(ErrorCode.InvalidDate, () => solveDT2(ws({ DT1: SEP_4_2003, DBD: 58.5 })));
    expectError(ErrorCode.InvalidDate, () => solveDT1(ws({ DT2: NOV_1_2003, DBD: 0.5 })));
  });
});

describe('edge cases the guidebook does not resolve', () => {
  it('returns a negative DBD when DT1 is later than DT2', () => {
    // p. 68 assumes DT1 is earlier and never says otherwise. Both printed
    // formulas are signed subtractions, so the sign is carried, not rejected.
    expect(daysBetween(NOV_1_2003, SEP_4_2003, 'ACT')).toBe(-58);
    expect(daysBetween(NOV_1_2003, SEP_4_2003, '360')).toBe(-57);
  });

  it('projects backwards from a negative DBD', () => {
    expect(solveDT2(ws({ DT1: NOV_1_2003, DBD: -58 }))).toEqual(SEP_4_2003);
  });

  it('inverts dayNumber across the whole supported window', () => {
    for (const date of [
      MIN_DATE,
      d(1980, 2, 29),
      d(1990, 12, 31),
      d(2000, 2, 29),
      d(2000, 3, 1),
      SEP_4_2003,
      NOV_1_2003,
      d(2004, 12, 31),
      d(2079, 1, 1),
      MAX_DATE,
    ]) {
      expect(fromDayNumber(dayNumber(date))).toEqual(date);
    }
  });

  it('walks every day of a leap year and a common year without drift', () => {
    for (const year of [2000, 2003, 2004]) {
      const start = dayNumber(d(year, 1, 1));
      const length = isLeapYear(year) ? 366 : 365;
      expect(dayNumber(d(year + 1, 1, 1)) - start).toBe(length);
      for (let offset = 0; offset < length; offset++) {
        const date = fromDayNumber(start + offset);
        expect(dayNumber(date)).toBe(start + offset);
        expect(date.year).toBe(year);
      }
    }
  });
});

describe('clearing and settings (p. 68)', () => {
  it('CLR WORK restores DT1, DT2 and DBD but not the day-count method', () => {
    const dirty = ws({ DT1: SEP_4_2003, DT2: NOV_1_2003, DBD: 58, method: '360' });
    const cleared = clearWork(dirty);
    expect(formatDate(cleared.DT1)).toBe('12-31-1990');
    expect(formatDate(cleared.DT2)).toBe('12-31-1990');
    expect(shown(cleared.DBD)).toBe('0.00');
    expect(cleared.method).toBe('360');
  });

  it('RESET restores the method to ACT as well', () => {
    expect(DATE_DEFAULTS).toEqual({
      DT1: d(1990, 12, 31),
      DT2: d(1990, 12, 31),
      DBD: 0,
      method: 'ACT',
    });
  });

  it('2ND SET toggles between the two methods sharing the slot', () => {
    expect(toggleMethod('ACT')).toBe('360');
    expect(toggleMethod('360')).toBe('ACT');
  });

  it('freezes the defaults, nested dates included', () => {
    expect(Object.isFrozen(DATE_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(DATE_DEFAULTS.DT1)).toBe(true);
    expect(Object.isFrozen(DATE_DEFAULTS.DT2)).toBe(true);
    expect(Object.isFrozen(MIN_DATE)).toBe(true);
    expect(Object.isFrozen(MAX_DATE)).toBe(true);
  });

  it('computes DBD = 0.00 between the two default dates', () => {
    expect(shown(solveDBD(DATE_DEFAULTS))).toBe('0.00');
  });
});

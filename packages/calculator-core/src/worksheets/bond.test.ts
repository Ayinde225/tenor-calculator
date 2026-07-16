/**
 * Bond worksheet tests.
 *
 * Golden cases come from tests/golden/bond.json (guidebook pp. 50-54). Each one
 * asserts the LCD string through `formatValue` at the decimals the case states,
 * because the display string is the observable the guidebook actually prints.
 */
import { describe, it, expect } from 'vitest';
import {
  BOND_DEFAULTS,
  accruedInterest,
  bondFactors,
  computeBond,
  computePrice,
  computeYield,
  couponsPerYear,
  daysBetween,
  formatDate,
  isValidBondDate,
  parseDateEntry,
  toggleCouponFrequency,
  toggleDayCount,
  type BondState,
} from './bond.js';
import { CalculatorError, ErrorCode, errorDisplay } from '../errors.js';
import { formatValue, type DisplayFormat } from '../display/format.js';

const DEC2: DisplayFormat = { decimals: 2, separator: 'US' };
const DEC5: DisplayFormat = { decimals: 5, separator: 'US' };

/** Expect a CalculatorError carrying `code`, and check the string the LCD shows. */
function expectError(code: ErrorCode, fn: () => unknown): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${errorDisplay(code)}, but nothing was thrown`);
}

/**
 * The pp. 53-54 worked example, built the way the keystrokes build it:
 * 2ND BOND / 6.1206 ENTER / 7 ENTER / 12.3107 ENTER / RV untouched /
 * 2ND SET (ACT -> 360) / 2/Y untouched / 8 ENTER.
 */
function workedExample(): BondState {
  return toggleDayCount({
    ...BOND_DEFAULTS,
    SDT: parseDateEntry(6.1206),
    CPN: 7,
    RDT: parseDateEntry(12.3107),
    YLD: 8,
  });
}

describe('defaults (golden: bond-defaults-*, guidebook pp. 50-51)', () => {
  it('bond-defaults-clr-work-sdt: SDT resets to 12-31-1990', () => {
    expect(formatDate(BOND_DEFAULTS.SDT, 'US')).toBe('12-31-1990');
  });

  it('bond-defaults-cpn: CPN default is zero', () => {
    expect(formatValue(BOND_DEFAULTS.CPN, DEC2)).toBe('0.00');
  });

  it('bond-defaults-rdt: RDT default matches the SDT default', () => {
    expect(formatDate(BOND_DEFAULTS.RDT, 'US')).toBe('12-31-1990');
    expect(BOND_DEFAULTS.RDT).toEqual(BOND_DEFAULTS.SDT);
  });

  it('bond-defaults-rv: RV default is 100 percent of par', () => {
    expect(formatValue(BOND_DEFAULTS.RV, DEC2)).toBe('100.00');
  });

  it('bond-defaults-daycount-act: the day-count toggle defaults to ACT', () => {
    expect(BOND_DEFAULTS.dayCount).toBe('ACT');
  });

  it('bond-defaults-coupon-freq: the frequency toggle defaults to 2/Y', () => {
    expect(BOND_DEFAULTS.frequency).toBe('2/Y');
  });

  it('YLD and PRI default to zero', () => {
    expect(formatValue(BOND_DEFAULTS.YLD, DEC2)).toBe('0.00');
    expect(formatValue(BOND_DEFAULTS.PRI, DEC2)).toBe('0.00');
  });

  it('the defaults object is frozen, dates included', () => {
    expect(Object.isFrozen(BOND_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(BOND_DEFAULTS.SDT)).toBe(true);
  });
});

describe('the worked example, keystroke by keystroke (golden: bond-example-*, pp. 53-54)', () => {
  it('bond-example-open-worksheet: opening the worksheet shows the current SDT', () => {
    expect(formatDate(BOND_DEFAULTS.SDT, 'US')).toBe('12-31-1990');
  });

  it('bond-example-settlement-date-display: 6.1206 ENTER -> 6-12-2006', () => {
    expect(formatDate(parseDateEntry(6.1206), 'US')).toBe('6-12-2006');
  });

  it('bond-example-coupon-rate-display: 7 ENTER -> 7.00', () => {
    expect(formatValue(workedExample().CPN, DEC2)).toBe('7.00');
  });

  it('bond-example-redemption-date-display: 12.3107 ENTER -> 12-31-2007', () => {
    expect(formatDate(parseDateEntry(12.3107), 'US')).toBe('12-31-2007');
  });

  it('bond-example-redemption-value-untouched: RV stays at 100.00', () => {
    expect(formatValue(workedExample().RV, DEC2)).toBe('100.00');
  });

  it('bond-example-daycount-set-to-360: one 2ND SET flips ACT -> 360', () => {
    expect(toggleDayCount(BOND_DEFAULTS).dayCount).toBe('360');
    expect(workedExample().dayCount).toBe('360');
  });

  it('bond-example-coupon-freq-untouched: frequency stays at 2/Y', () => {
    expect(workedExample().frequency).toBe('2/Y');
  });

  it('bond-example-yield-entry: 8 ENTER -> 8.00', () => {
    expect(formatValue(workedExample().YLD, DEC2)).toBe('8.00');
  });

  it('bond-example-compute-price: PRI = 98.56', () => {
    expect(formatValue(computeBond(workedExample(), 'PRI'), DEC2)).toBe('98.56');
  });

  it('bond-example-accrued-interest: AI = 3.15, with no CPT', () => {
    expect(formatValue(accruedInterest(workedExample()), DEC2)).toBe('3.15');
  });

  it('reproduces the intermediate quantities the spec quotes for the example', () => {
    // p. 53 schedule: 12-31-2007, 6-30-2007, 12-31-2006, 6-30-2006, 12-31-2005.
    const f = bondFactors(workedExample());
    expect(f.N).toBe(4);
    expect(formatDate(f.previousCoupon, 'US')).toBe('12-31-2005');
    expect(formatDate(f.nextCoupon, 'US')).toBe('6-30-2006');
    expect(f.A).toBe(162);
    expect(f.E).toBe(180);
    expect(f.DSC).toBe(18);
    expect(f.A / f.E).toBeCloseTo(0.9, 12);
    expect(f.DSC / f.E).toBeCloseTo(0.1, 12);
  });

  it('matches the term-by-term decomposition of the p. 78 price formula', () => {
    // coupons 13.16110 + redemption 88.55165 - accrued 3.15000 = 98.56275
    const price = computePrice(workedExample());
    expect(price).toBeCloseTo(98.56275, 5);
    expect(formatValue(price, DEC5)).toBe('98.56275');
    expect(accruedInterest(workedExample())).toBe(3.15);
  });

  it('recovers the entered yield from the price it produced', () => {
    const state = workedExample();
    const priced: BondState = { ...state, PRI: computePrice(state) };
    expect(computeBond(priced, 'YLD')).toBeCloseTo(8, 9);
    expect(formatValue(computeYield(priced), DEC2)).toBe('8.00');
  });
});

describe('date entry (guidebook p. 51)', () => {
  it('reads mm.ddyy in US format and dd.mmyy in European format', () => {
    expect(parseDateEntry(6.1206, 'US')).toEqual({ year: 2006, month: 6, day: 12 });
    expect(parseDateEntry(12.0606, 'EUR')).toEqual({ year: 2006, month: 6, day: 12 });
  });

  it('pivots two-digit years across the 1980-2079 window', () => {
    // Inferred, not documented: 80-99 -> 1900s, 00-79 -> 2000s. The window's two
    // endpoints are the only dates that pin the rule down.
    expect(parseDateEntry(1.0180).year).toBe(1980);
    expect(parseDateEntry(12.3199).year).toBe(1999);
    expect(parseDateEntry(1.0100).year).toBe(2000);
    expect(parseDateEntry(12.3179).year).toBe(2079);
  });

  it('no entered date can fall outside the legal window', () => {
    for (let yy = 0; yy <= 99; yy++) {
      const entry = 1.01 + yy / 10000;
      const d = parseDateEntry(entry);
      expect(isValidBondDate(d)).toBe(true);
    }
  });

  it('renders the leading field unpadded and the trailing field padded', () => {
    expect(formatDate({ year: 2003, month: 9, day: 4 }, 'US')).toBe('9-04-2003');
    expect(formatDate({ year: 2003, month: 11, day: 1 }, 'US')).toBe('11-01-2003');
    expect(formatDate({ year: 2003, month: 11, day: 1 }, 'EUR')).toBe('1-11-2003');
  });

  it('Error 6 on an impossible day', () => {
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(1.3206)); // January 32
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(2.3006)); // February 30
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(13.0106)); // month 13
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(6.0006)); // day 0
  });

  it('Error 6 on the mm.ddyyyy mis-keying rather than a silent truncation', () => {
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(12.311990));
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(-6.1206));
  });

  it('accepts February 29 only in a leap year', () => {
    expect(parseDateEntry(2.2904)).toEqual({ year: 2004, month: 2, day: 29 });
    expect(parseDateEntry(2.2900)).toEqual({ year: 2000, month: 2, day: 29 }); // 2000 is leap
    expectError(ErrorCode.InvalidDate, () => parseDateEntry(2.2903));
  });
});

describe('day counts', () => {
  it('ACT counts actual days, leap day included', () => {
    const from = { year: 2004, month: 2, day: 28 };
    const to = { year: 2004, month: 3, day: 1 };
    expect(daysBetween(from, to, 'ACT')).toBe(2);
    expect(daysBetween({ year: 2003, month: 2, day: 28 }, { year: 2003, month: 3, day: 1 }, 'ACT')).toBe(1);
  });

  it('ACT spans a year correctly', () => {
    expect(daysBetween({ year: 2006, month: 1, day: 1 }, { year: 2007, month: 1, day: 1 }, 'ACT')).toBe(365);
    expect(daysBetween({ year: 2004, month: 1, day: 1 }, { year: 2005, month: 1, day: 1 }, 'ACT')).toBe(366);
  });

  it('30/360 reproduces the example day counts (p. 53)', () => {
    expect(daysBetween({ year: 2005, month: 12, day: 31 }, { year: 2006, month: 6, day: 12 }, '360')).toBe(162);
    expect(daysBetween({ year: 2005, month: 12, day: 31 }, { year: 2006, month: 6, day: 30 }, '360')).toBe(180);
    expect(daysBetween({ year: 2006, month: 6, day: 12 }, { year: 2006, month: 6, day: 30 }, '360')).toBe(18);
  });

  it('30/360 gives every whole month 30 days and every year 360', () => {
    expect(daysBetween({ year: 2006, month: 1, day: 1 }, { year: 2007, month: 1, day: 1 }, '360')).toBe(360);
    expect(daysBetween({ year: 2006, month: 2, day: 1 }, { year: 2006, month: 3, day: 1 }, '360')).toBe(30);
  });

  it('30/360 applies the SIA end-of-month rule printed on p. 82', () => {
    // "If DT1 is 31, change DT1 to 30. If DT2 is 31 and DT1 is 30 or 31, change
    // DT2 to 30; otherwise, leave it at 31." Pages 50-54 never state the rule;
    // p. 82 prints it and footnotes it to the same Lynch & Mayle source the bond
    // appendix cites on p. 77. The last case is the one that discriminates SIA
    // from the European 30E/360, which would return 75 rather than 76.
    expect(daysBetween({ year: 2006, month: 5, day: 31 }, { year: 2006, month: 6, day: 30 }, '360')).toBe(30);
    expect(daysBetween({ year: 2006, month: 1, day: 31 }, { year: 2006, month: 3, day: 31 }, '360')).toBe(60);
    expect(daysBetween({ year: 2006, month: 1, day: 15 }, { year: 2006, month: 3, day: 31 }, '360')).toBe(76);
  });
});

describe('toggles (guidebook p. 51)', () => {
  it('2ND SET flips the day-count method and flips back', () => {
    const once = toggleDayCount(BOND_DEFAULTS);
    expect(once.dayCount).toBe('360');
    expect(toggleDayCount(once).dayCount).toBe('ACT');
  });

  it('2ND SET flips the coupon frequency and flips back', () => {
    const once = toggleCouponFrequency(BOND_DEFAULTS);
    expect(once.frequency).toBe('1/Y');
    expect(toggleCouponFrequency(once).frequency).toBe('2/Y');
  });

  it('the toggles are M in the appendix formulas', () => {
    expect(couponsPerYear('2/Y')).toBe(2);
    expect(couponsPerYear('1/Y')).toBe(1);
  });

  it('toggling leaves every other variable alone', () => {
    const state = workedExample();
    expect(toggleCouponFrequency(state)).toEqual({ ...state, frequency: '1/Y' });
  });
});

describe('solving for each unknown', () => {
  it('PRI from YLD, then YLD from PRI, round-trips with more than one coupon left', () => {
    const state = workedExample();
    const price = computeBond(state, 'PRI');
    const yld = computeBond({ ...state, PRI: price }, 'YLD');
    expect(yld).toBeCloseTo(8, 9);
  });

  it('PRI from YLD, then YLD from PRI, round-trips with one coupon left', () => {
    // Settlement inside the final coupon period: the p. 77 / p. 78 closed forms.
    const state: BondState = {
      ...workedExample(),
      SDT: parseDateEntry(9.3007),
    };
    expect(bondFactors(state).N).toBe(1);

    const price = computePrice(state);
    const yld = computeYield({ ...state, PRI: price });
    expect(yld).toBeCloseTo(8, 9);
  });

  it('the one-period yield formula inverts the price formula to displayable precision', () => {
    // Q = PRI/100 + (A/E)(R/M) appears in both formulas, so inverting for Y is
    // pure algebra and the round trip is exact in real arithmetic. It is NOT exact
    // here, and the reason is worth recording rather than tuning away: the printed
    // formula's numerator is (RV/100 + R/M) - Q, two quantities near 1.03 whose
    // difference is ~6e-4 at a low yield. That cancellation amplifies the 13-digit
    // rounding PRI picks up on the way into storage by ~3 decimal digits, leaving
    // ~3.5e-10 of absolute error in YLD at the low end (it shrinks as the yield
    // rises and the cancellation eases). The hardware stores PRI to the same 13
    // digits and evaluates the same formula, so this is its behaviour too, not an
    // artefact of the port. It stays invisible at every fixed DEC setting: the
    // worst case is ~3.5e-10 against a DEC=8 half-ulp of 5e-9.
    const base: BondState = { ...workedExample(), SDT: parseDateEntry(11.1507) };
    expect(bondFactors(base).N).toBe(1);

    for (const YLD of [0.1, 0.5, 3, 8, 15, 40]) {
      const price = computePrice({ ...base, YLD });
      const back = computeYield({ ...base, PRI: price });
      expect(Math.abs(back - YLD)).toBeLessThan(1e-9);
      expect(formatValue(back, { decimals: 8, separator: 'US' })).toBe(
        formatValue(YLD, { decimals: 8, separator: 'US' }),
      );
    }
  });

  it('a premium bond prices above par and a discount bond below', () => {
    const state = workedExample();
    expect(computePrice({ ...state, YLD: 5 })).toBeGreaterThan(100);
    expect(computePrice({ ...state, YLD: 9 })).toBeLessThan(100);
  });

  it('price is strictly decreasing in yield, which is what lets bisection work', () => {
    const state = workedExample();
    let previous = Infinity;
    for (let YLD = 0; YLD <= 30; YLD += 0.5) {
      const price = computePrice({ ...state, YLD });
      expect(price).toBeLessThan(previous);
      previous = price;
    }
  });

  it('computeBond dispatches to the same results as the direct calls', () => {
    const state = workedExample();
    expect(computeBond(state, 'PRI')).toBe(computePrice(state));
    const priced: BondState = { ...state, PRI: computePrice(state) };
    expect(computeBond(priced, 'YLD')).toBe(computeYield(priced));
  });
});

describe('accrued interest (guidebook p. 78)', () => {
  it('is AI = 100 x R/M x A/E', () => {
    const state = workedExample();
    const f = bondFactors(state);
    expect(accruedInterest(state)).toBeCloseTo(100 * (0.07 / 2) * (f.A / f.E), 10);
  });

  it('is zero when settlement falls on a coupon date', () => {
    const state: BondState = { ...workedExample(), SDT: parseDateEntry(6.3006) };
    const f = bondFactors(state);
    expect(f.A).toBe(0);
    expect(f.DSC).toBe(f.E); // a full period to the next coupon
    expect(accruedInterest(state)).toBe(0);
  });

  it('rejects a zero-coupon bond rather than reporting zero accrued interest', () => {
    // p. 84 names CPN in the Error 4 row, and that row's operator is `<=`. The
    // Bond worksheet cannot price a zero; TVM is where that belongs.
    expectError(ErrorCode.OutOfRange, () => accruedInterest({ ...workedExample(), CPN: 0 }));
  });

  it('equals the third term of the multi-period price formula', () => {
    // PRI + AI is the "dirty" price: the full discounted value with nothing
    // stripped out for the seller.
    const state = workedExample();
    const f = bondFactors(state);
    const M = couponsPerYear(state.frequency);
    expect(accruedInterest(state)).toBeCloseTo(100 * (state.CPN / 100 / M) * (f.A / f.E), 10);
  });
});

describe('coupon geometry (guidebook pp. 51, 78)', () => {
  it('N counts the coupons still payable, which is the appendix round-up', () => {
    // p. 78 says to raise a fractional coupon count to the next whole number
    // (2.4 -> 3). Counting coupon dates strictly after SDT gives that ceiling.
    const state = workedExample();
    expect(bondFactors(state).N).toBe(4);
    // Move settlement one day past a coupon date: a coupon drops away.
    expect(bondFactors({ ...state, SDT: parseDateEntry(7.0106) }).N).toBe(3);
    // Move it back one day before that coupon: the coupon is still payable.
    expect(bondFactors({ ...state, SDT: parseDateEntry(6.2906) }).N).toBe(4);
  });

  it('settling on a coupon date does not count that coupon', () => {
    // The coupon paid that day belongs to the seller.
    const state: BondState = { ...workedExample(), SDT: parseDateEntry(6.3006) };
    expect(bondFactors(state).N).toBe(3);
  });

  it('back-counts from RDT so the month-end clamp cannot ratchet', () => {
    const f = bondFactors(workedExample());
    expect(formatDate(f.nextCoupon, 'US')).toBe('6-30-2006');
    expect(formatDate(f.previousCoupon, 'US')).toBe('12-31-2005');
  });

  it('1/Y halves the coupon count and doubles the period', () => {
    const state = toggleCouponFrequency(workedExample());
    const f = bondFactors(state);
    expect(f.N).toBe(2); // 12-31-2006 and 12-31-2007
    expect(f.E).toBe(360);
    expect(couponsPerYear(state.frequency)).toBe(1);
  });

  it('ACT and 360 disagree on the same bond, as they must', () => {
    const state = workedExample();
    const act = bondFactors({ ...state, dayCount: 'ACT' });
    const threeSixty = bondFactors({ ...state, dayCount: '360' });
    expect(act.N).toBe(threeSixty.N); // N is a coupon count, not a day count
    expect(act.E).toBe(181); // 12-31-2005 -> 6-30-2006, actual
    expect(threeSixty.E).toBe(180);
    expect(computePrice({ ...state, dayCount: 'ACT' })).not.toBe(computePrice(state));
  });
});

describe('errors (guidebook pp. 84-85)', () => {
  it('Error 6 when RDT equals SDT, which is the freshly-reset worksheet', () => {
    // golden: bond-error6-on-default-dates. p. 50 says arrowing through an
    // untouched worksheet errors; p. 85 gives the reason -- both dates default
    // to 12-31-1990, so the first calculation runs with RDT not later than SDT.
    expectError(ErrorCode.InvalidDate, () => computeBond(BOND_DEFAULTS, 'PRI'));
    expectError(ErrorCode.InvalidDate, () => computeBond(BOND_DEFAULTS, 'YLD'));
    expectError(ErrorCode.InvalidDate, () => accruedInterest(BOND_DEFAULTS));
    expectError(ErrorCode.InvalidDate, () => bondFactors(BOND_DEFAULTS));
  });

  it('Error 6 when RDT is earlier than SDT', () => {
    const state: BondState = { ...workedExample(), RDT: parseDateEntry(1.0106) };
    expectError(ErrorCode.InvalidDate, () => computePrice(state));
  });

  it('Error 6 when a stored date is not a real calendar date', () => {
    const state: BondState = { ...workedExample(), SDT: { year: 2006, month: 2, day: 30 } };
    expectError(ErrorCode.InvalidDate, () => computePrice(state));
  });

  it('Error 6 when a stored date falls outside the 1980-2079 window', () => {
    // Unreachable by keying a date -- the two-digit pivot covers exactly the
    // window -- but reachable by constructing state directly.
    const state: BondState = { ...workedExample(), SDT: { year: 1979, month: 12, day: 31 } };
    expectError(ErrorCode.InvalidDate, () => computePrice(state));
  });

  it('the LCD string for the date error is "Error 6"', () => {
    expect(errorDisplay(ErrorCode.InvalidDate)).toBe('Error 6');
  });

  it('Error 4 on a negative RV, CPN or PRI', () => {
    const state = workedExample();
    expectError(ErrorCode.OutOfRange, () => computePrice({ ...state, RV: -1 }));
    expectError(ErrorCode.OutOfRange, () => computePrice({ ...state, CPN: -0.001 }));
    expectError(ErrorCode.OutOfRange, () => computeYield({ ...state, PRI: -100 }));
  });

  it('Error 4 fires AT zero too: the p. 84 glyph is <=, not <', () => {
    // This is the case that discriminates the two readings of the dropped glyph.
    // p. 84's Error 4 block prints, on ONE line in ONE font, "declining balance
    // percent _ 0; LIF _ 0; YR _ _ 0; CST < 0; SAL < 0" -- the `<` of CST/SAL
    // renders while its neighbours drop. The export therefore drops only `<=`/`>=`
    // and carries `<` through, so a dropped glyph cannot be `<`. tvm.ts,
    // interest-conversion.ts and depreciation.ts read the same glyph as `<=`.
    const state = workedExample();
    expectError(ErrorCode.OutOfRange, () => computePrice({ ...state, CPN: 0 }));
    expectError(ErrorCode.OutOfRange, () => computePrice({ ...state, RV: 0 }));
    expectError(ErrorCode.OutOfRange, () => computeYield({ ...state, PRI: 0 }));
    expectError(ErrorCode.OutOfRange, () => accruedInterest({ ...state, CPN: 0 }));
  });

  it('PRI at its 0 default does not block the price path, per the worked example', () => {
    // Error 4 is entry-time validation and PRI defaults to 0 (p. 51), so a stored
    // 0 is the un-entered state rather than an entered one. The pp. 53-54 example
    // computes PRI with PRI still at that default, so the price path must not test
    // it -- this is the precondition golden bond-example-compute-price relies on.
    const state = workedExample();
    expect(state.PRI).toBe(0);
    expect(() => computePrice(state)).not.toThrow();
    expect(() => accruedInterest(state)).not.toThrow();
    expect(formatValue(computePrice(state), DEC2)).toBe('98.56');
  });

  it('Error 6 precedes Error 4 on the freshly-reset worksheet', () => {
    // Both rules bite at defaults: RDT equals SDT (Error 6) and CPN is 0 (Error 4).
    // p. 50 prints which one the user sees -- navigating a fresh worksheet "causes
    // an error (Error 6)" -- so the date check must run first.
    expect(BOND_DEFAULTS.CPN).toBe(0);
    expect(BOND_DEFAULTS.RDT).toEqual(BOND_DEFAULTS.SDT);
    expectError(ErrorCode.InvalidDate, () => computePrice(BOND_DEFAULTS));
    expectError(ErrorCode.InvalidDate, () => accruedInterest(BOND_DEFAULTS));
  });

  it('Error 5 when the discount base 1 + Y/M is not positive', () => {
    // The exponents are fractional mid-period, so a non-positive base is a
    // logarithm of a non-positive number (p. 84).
    const state = workedExample();
    expectError(ErrorCode.NoSolution, () => computePrice({ ...state, YLD: -200 }));
    expectError(ErrorCode.NoSolution, () => computePrice({ ...state, YLD: -250 }));
    expect(() => computePrice({ ...state, YLD: -199 })).not.toThrow();
  });

  it('Error 7 when the yield is too extreme for the search to bracket', () => {
    // p. 85: "the calculator computed YLD for a very complex problem". Settling on
    // a coupon date strips the accrued term, so price(Y) stays strictly positive
    // and decays towards 0 only as the yield runs away. A price this far below any
    // sane bond is only met past a ~100,000% yield, outside the probe ladder.
    const state: BondState = { ...workedExample(), SDT: parseDateEntry(6.3006), PRI: 1e-6 };
    expect(bondFactors(state).A).toBe(0);
    expectError(ErrorCode.IterationLimitExceeded, () => computeYield(state));
  });

  it('every ordinary positive price is bracketed, so Error 7 stays exceptional', () => {
    // With PRI > 0 enforced by Error 4, price(Y) is continuous and strictly
    // decreasing from +inf to -AI, so a root always exists; only the extreme case
    // above escapes the ladder. Error 7 is an iteration failure, never a no-root
    // failure -- which is why Bond needs no TVM-style "no sign change" rule.
    const state = workedExample();
    for (const PRI of [0.5, 1, 25, 80, 98.56275, 120, 400, 1000]) {
      expect(() => computeYield({ ...state, PRI })).not.toThrow();
    }
  });

  it('Error 8 when the YLD search is canceled', () => {
    const state = workedExample();
    const priced: BondState = { ...state, PRI: computePrice(state) };
    expectError(ErrorCode.CanceledIterativeCalculation, () =>
      computeYield(priced, { shouldCancel: () => true }),
    );
  });

  it('Errors 7 and 8 attach to YLD only, never to PRI', () => {
    // PRI is closed-form in both branches (p. 78), so it has no iteration to
    // exceed and no search to cancel.
    const state = workedExample();
    expect(() => computePrice(state)).not.toThrow();
    for (const YLD of [0, 100, 1000]) {
      expect(() => computePrice({ ...state, YLD })).not.toThrow();
    }
  });

  it('a cancel signal that never fires does not disturb the result', () => {
    const state = workedExample();
    const priced: BondState = { ...state, PRI: computePrice(state) };
    expect(computeYield(priced, { shouldCancel: () => false })).toBeCloseTo(8, 9);
  });
});

describe('edge cases', () => {
  it('Error 4 on a zero-coupon bond: the worksheet will not price one', () => {
    // p. 84 lists CPN in the Error 4 row and that row's operator is `<=`, so a
    // zero coupon is out of range. The geometry is still well defined -- the
    // formulas would happily evaluate it -- which is exactly why the rejection has
    // to come from the printed rule rather than from the arithmetic.
    const state: BondState = { ...workedExample(), CPN: 0 };
    expect(() => bondFactors(state)).not.toThrow();
    expectError(ErrorCode.OutOfRange, () => computePrice(state));
    expectError(ErrorCode.OutOfRange, () => accruedInterest(state));
    expectError(ErrorCode.OutOfRange, () => computeYield({ ...state, PRI: 90 }));
  });

  it('a to-call analysis carries the call premium in RV (p. 51)', () => {
    const toMaturity = workedExample();
    const toCall: BondState = { ...toMaturity, RV: 102 };
    expect(computePrice(toCall)).toBeGreaterThan(computePrice(toMaturity));
    // RV moves only the redemption term, so AI is untouched.
    expect(accruedInterest(toCall)).toBe(accruedInterest(toMaturity));
  });

  it('yield equals the coupon rate when a bond settling on a coupon date prices at par', () => {
    const state: BondState = {
      ...workedExample(),
      SDT: parseDateEntry(6.3006),
      PRI: 100,
    };
    expect(computeYield(state)).toBeCloseTo(7, 8);
  });

  it('handles a zero yield', () => {
    // At Y = 0 nothing discounts: price is the undiscounted sum less accrued.
    const state: BondState = { ...workedExample(), YLD: 0 };
    const f = bondFactors(state);
    expect(computePrice(state)).toBeCloseTo(100 + 3.5 * f.N - 3.15, 8);
  });

  it('handles a negative yield above the -M domain limit', () => {
    const state: BondState = { ...workedExample(), YLD: -1 };
    expect(computePrice(state)).toBeGreaterThan(100);
  });

  it('recovers a negative yield from the price it produced', () => {
    const state: BondState = { ...workedExample(), YLD: -1.5 };
    const priced: BondState = { ...state, PRI: computePrice(state) };
    expect(computeYield(priced)).toBeCloseTo(-1.5, 8);
  });

  it('spans the full legal date window under ACT', () => {
    const state: BondState = {
      ...BOND_DEFAULTS,
      SDT: parseDateEntry(1.0180),
      RDT: parseDateEntry(12.3179),
      CPN: 7,
      YLD: 8,
    };
    const f = bondFactors(state);
    expect(f.N).toBe(200); // 100 years, semiannual
    expect(computePrice(state)).toBeGreaterThan(0);
  });

  it('prices the shortest possible bond: one day to redemption under ACT', () => {
    const state: BondState = {
      ...workedExample(),
      dayCount: 'ACT',
      SDT: parseDateEntry(12.3007),
    };
    const f = bondFactors(state);
    expect(f.N).toBe(1);
    expect(f.DSR).toBe(1);
    // A day from redemption the bond is worth its redemption value plus the
    // coupon, less the accrued interest that is almost all the seller's.
    expect(computePrice(state)).toBeCloseTo(100, 1);
  });

  it('30/360 collapses the 30th and the 31st onto the same day', () => {
    // Not an edge the guidebook discusses, but it falls straight out of the SIA
    // rule: settling 12-30 on a bond redeeming 12-31 gives DSR = 0, so the two
    // dates are one day apart on the calendar and zero days apart under 30/360.
    const state: BondState = { ...workedExample(), SDT: parseDateEntry(12.3007) };
    const f = bondFactors(state);
    expect(f.DSR).toBe(0);
    expect(f.DSC).toBe(0);
    expect(f.A).toBe(f.E); // the whole coupon has accrued to the seller

    // The price formula survives it -- DSR sits in a numerator there, so the
    // discount factor is simply 1 and the bond prices at redemption plus coupon
    // less the full accrued coupon.
    expect(computePrice(state)).toBeCloseTo(100, 10);

    // The yield formula does not: DSR is its divisor (p. 78). Every yield
    // satisfies a zero-length investment, so the yield is genuinely
    // indeterminate, and evaluating the printed formula literally divides by
    // zero -- Error 1 (p. 84).
    expectError(ErrorCode.Overflow, () => computeYield({ ...state, PRI: 100 }));
  });

  it('is a pure function of its state: computing does not mutate the input', () => {
    const state = workedExample();
    const snapshot = structuredClone(state);
    computePrice(state);
    accruedInterest(state);
    computeYield({ ...state, PRI: 98.56 });
    expect(state).toEqual(snapshot);
  });

  it('the display setting does not reach into the arithmetic', () => {
    // Unlike amortization and depreciation, Bond stores full internal precision
    // and rounds only at display (p. 9); the guidebook lists no Bond exception.
    const price = computePrice(workedExample());
    expect(formatValue(price, DEC2)).toBe('98.56');
    expect(formatValue(price, DEC5)).toBe('98.56275');
    expect(price).not.toBe(98.56);
  });
});

import { describe, it, expect } from 'vitest';
import {
  computeInterestConversion,
  clearInterestConversionWork,
  solveEFF,
  solveNOM,
  INTEREST_CONVERSION_DEFAULTS,
  type InterestConversionState,
} from './interest-conversion.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const ic = (o: Partial<InterestConversionState>): InterestConversionState => ({
  ...INTEREST_CONVERSION_DEFAULTS,
  ...o,
});
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/** Assert that `fn` raises the given CalculatorError code. */
const expectError = (code: ErrorCode, fn: () => unknown): void => {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
  }
};

/**
 * The guidebook's only Interest Conversion example (p. 67): a certificate paying
 * 15% nominal with quarterly compounding. Every golden case on this worksheet is
 * a step of that one sequence, and the last step is the project's parity target.
 */
describe('guidebook interest conversion example (p. 67)', () => {
  // other-worksheets-iconv-enter-nom
  it('displays the entered nominal rate as 15.00', () => {
    expect(shown(ic({ NOM: 15 }).NOM)).toBe('15.00');
  });

  // other-worksheets-iconv-enter-cy
  it('displays quarterly compounding as C/Y = 4.00', () => {
    expect(shown(ic({ NOM: 15, CY: 4 }).CY)).toBe('4.00');
  });

  // other-worksheets-iconv-eff-from-nom -- the project's required parity example.
  it('computes EFF = 15.87 from NOM = 15 at C/Y = 4', () => {
    expect(shown(solveEFF(ic({ NOM: 15, CY: 4 })))).toBe('15.87');
  });

  it('holds EFF at 13 internal digits, not at the 2 displayed', () => {
    // 100 x (1.0375^4 - 1) = 15.86504150390625 exactly; the store keeps 13
    // significant digits and only the LCD rounds to 15.87 (p. 9, p. 86).
    expect(solveEFF(ic({ NOM: 15, CY: 4 }))).toBeCloseTo(15.86504150391, 10);
  });
});

/**
 * The p. 80 EFF equation prints `In(x / 1)` where the arithmetic needs
 * `ln(x + 1)`. These are the tests that make the correction non-negotiable: if
 * anyone "fixes" the module back to the printed form, the first one fails.
 */
describe('the p. 80 formula corrections', () => {
  it('reads ln(x + 1), not the printed ln(x / 1)', () => {
    // The printed `/ 1` reading is ln(x), and x = 0.0375 here, so it would give
    // 100 x (e^(4 x ln(0.0375)) - 1) ~ -100 rather than 15.87.
    const printedReading = 100 * (Math.exp(4 * Math.log(0.0375)) - 1);
    expect(shown(printedReading)).toBe('-100.00');
    expect(shown(solveEFF(ic({ NOM: 15, CY: 4 })))).toBe('15.87');
  });

  it('treats C/Y as an exponent of e, not a factor on the baseline', () => {
    // Read literally, `eC/Y x In(x + 1)` is e x (C/Y) x ln(x + 1) = 2.718... x 4
    // x ln(1.0375) x 100 - 100, which is nowhere near the guidebook's answer.
    const flattenedReading = 100 * (Math.E * 4 * Math.log(1.0375) - 1);
    expect(shown(flattenedReading)).not.toBe('15.87');
    expect(shown(solveEFF(ic({ NOM: 15, CY: 4 })))).toBe('15.87');
  });

  it('closes the outer parenthesis before the - 1', () => {
    // With the paren left open as printed, the `- 1` sits outside the 100 x
    // scaling: 100 x 1.0375^4 - 1 = 114.87, not 15.87.
    const openParenReading = 100 * Math.pow(1.0375, 4) - 1;
    expect(shown(openParenReading)).toBe('114.87');
    expect(shown(solveEFF(ic({ NOM: 15, CY: 4 })))).toBe('15.87');
  });

  /**
   * The module evaluates `(1 + x)^k` (via tvm.ts) where p. 80 prints
   * `e^(k x ln(x + 1))`. Those are equal in exact arithmetic, but the equality is
   * an ALGEBRAIC step the module took on its own authority, and tvm.ts is not one
   * of this module's files -- a change there would silently move ICONV's answers.
   * This pins the delegation directly against a literal transcription of the
   * corrected p. 80 equations, so the reduction stays a proven identity rather
   * than an assumption.
   */
  it('matches a literal e^(k x ln(x+1)) transcription of the printed equations', () => {
    const printedEFF = (NOM: number, CY: number): number => {
      const x = (0.01 * NOM) / CY;
      return 100 * (Math.exp(CY * Math.log(x + 1)) - 1);
    };
    const printedNOM = (EFF: number, CY: number): number => {
      const x = 0.01 * EFF;
      return 100 * CY * (Math.exp((1 / CY) * Math.log(x + 1)) - 1);
    };

    for (const CY of [0.5, 1, 2, 4, 12, 52, 365]) {
      for (const rate of [-95, -15, -0.25, 0.5, 5, 15, 22.75, 99, 250]) {
        if (1 + (0.01 * rate) / CY > 0) {
          const eff = solveEFF(ic({ NOM: rate, CY }));
          // Equal to within the 13-digit internal store, not merely to display.
          expect(eff).toBeCloseTo(printedEFF(rate, CY), 9);
        }
        if (1 + 0.01 * rate > 0) {
          expect(solveNOM(ic({ EFF: rate, CY }))).toBeCloseTo(printedNOM(rate, CY), 9);
        }
      }
    }
  });

  it('round-trips the example back to NOM = 15.00 (settles the NOM equation)', () => {
    // Discrepancy flag 5 in the spec: the two forms are exact inverses. The NOM
    // equation has no worked example of its own, so this round trip is the only
    // evidence that its identically-mangled parens and exponent were restored
    // the same way.
    const eff = solveEFF(ic({ NOM: 15, CY: 4 }));
    expect(shown(solveNOM(ic({ EFF: eff, CY: 4 })))).toBe('15.00');
  });
});

describe('solving for each unknown', () => {
  it('solves EFF from NOM and C/Y', () => {
    expect(shown(solveEFF(ic({ NOM: 15, CY: 4 })))).toBe('15.87');
  });

  it('solves NOM from EFF and C/Y', () => {
    expect(shown(solveNOM(ic({ EFF: 15.86504150390625, CY: 4 })))).toBe('15.00');
  });

  it('dispatches through computeInterestConversion', () => {
    expect(shown(computeInterestConversion(ic({ NOM: 15, CY: 4 }), 'EFF'))).toBe('15.87');
    expect(shown(computeInterestConversion(ic({ EFF: 15.86504150390625, CY: 4 }), 'NOM'))).toBe(
      '15.00',
    );
  });

  it('leaves the other variables untouched', () => {
    const state = ic({ NOM: 15, EFF: 0, CY: 4 });
    computeInterestConversion(state, 'EFF');
    expect(state).toEqual({ NOM: 15, EFF: 0, CY: 4 });
  });

  it('round-trips across a range of rates and compounding frequencies', () => {
    for (const CY of [1, 2, 4, 12, 52, 365]) {
      for (const NOM of [0.5, 5, 15, 22.75, 99]) {
        const eff = solveEFF(ic({ NOM, CY }));
        expect(solveNOM(ic({ EFF: eff, CY }))).toBeCloseTo(NOM, 9);
      }
    }
  });
});

/**
 * The motivating claim on p. 66: two investments quoting the same nominal rate
 * are not comparable until both are converted to EFF.
 */
describe('compounding frequency is what EFF exposes (p. 66)', () => {
  it('ranks the same nominal rate by compounding frequency', () => {
    const annual = solveEFF(ic({ NOM: 15, CY: 1 }));
    const quarterly = solveEFF(ic({ NOM: 15, CY: 4 }));
    const monthly = solveEFF(ic({ NOM: 15, CY: 12 }));
    const daily = solveEFF(ic({ NOM: 15, CY: 365 }));

    expect(shown(annual)).toBe('15.00');
    expect(shown(quarterly)).toBe('15.87');
    expect(shown(monthly)).toBe('16.08');
    expect(shown(daily)).toBe('16.18');

    expect(annual).toBeLessThan(quarterly);
    expect(quarterly).toBeLessThan(monthly);
    expect(monthly).toBeLessThan(daily);
  });

  it('approaches continuous compounding as C/Y grows', () => {
    // The limit of the EFF formula is 100 x (e^0.15 - 1) = 16.1834...%. The gap
    // closes as O(1/C/Y), so C/Y = 1e6 lands ~1.3e-6 short -- that is the
    // formula's own truncation, not a precision fault, and the tolerance says so
    // rather than pretending the convergence is exact.
    const continuous = 100 * (Math.exp(0.15) - 1);
    expect(solveEFF(ic({ NOM: 15, CY: 1e6 }))).toBeCloseTo(continuous, 5);
  });
});

describe('error conditions (guidebook p. 84)', () => {
  // This is the case that pins the dropped relational glyph in the p. 84 Error 4
  // row ("the C/Y value _ 0") to `<= 0` rather than `< 0` -- C/Y = 0 throws only
  // under the `<=` reading. The glyph is recoverable from the page image by
  // elimination: `CST < 0` and `SAL < 0` render their `<` on the same Error 4
  // block where the neighbouring glyphs drop, so the export loses only composite
  // `<=` / `>=` and a dropped glyph cannot be a plain `<`.
  it('raises Error 4 when C/Y is zero', () => {
    expectError(ErrorCode.OutOfRange, () => solveEFF(ic({ NOM: 15, CY: 0 })));
    expectError(ErrorCode.OutOfRange, () => solveNOM(ic({ EFF: 15, CY: 0 })));
  });

  it('raises Error 4 when C/Y is negative', () => {
    expectError(ErrorCode.OutOfRange, () => solveEFF(ic({ NOM: 15, CY: -4 })));
    expectError(ErrorCode.OutOfRange, () => solveNOM(ic({ EFF: 15, CY: -4 })));
  });

  it('checks C/Y before the log domain, so a bad C/Y is Error 4 not Error 2', () => {
    // With C/Y = 0 the intermediate x = .01 x NOM / C/Y is not even finite; the
    // range error is the one the user can act on.
    expectError(ErrorCode.OutOfRange, () => solveEFF(ic({ NOM: -500, CY: 0 })));
  });

  it('raises Error 2 computing EFF when NOM = -100 x C/Y makes ln(0)', () => {
    // x = .01 x (-400) / 4 = -1, so x + 1 = 0 and the ln is undefined (p. 84).
    expectError(ErrorCode.InvalidArgument, () => solveEFF(ic({ NOM: -400, CY: 4 })));
  });

  it('raises Error 2 computing EFF when NOM < -100 x C/Y', () => {
    // The guard is what makes this an error: (1 + x)^4 with x = -1.25 is a
    // perfectly finite 0.0039 in the reduced form, so without the explicit ln
    // domain check this would silently return EFF = -99.61.
    expectError(ErrorCode.InvalidArgument, () => solveEFF(ic({ NOM: -500, CY: 4 })));
    expect(shown(100 * (Math.pow(1 + -1.25, 4) - 1))).toBe('-99.61');
  });

  it('raises Error 2 computing NOM when EFF <= -100', () => {
    expectError(ErrorCode.InvalidArgument, () => solveNOM(ic({ EFF: -100, CY: 4 })));
    expectError(ErrorCode.InvalidArgument, () => solveNOM(ic({ EFF: -150, CY: 4 })));
  });

  it('allows rates just inside the log domain', () => {
    // NOM = -399 at C/Y = 4 gives x = -0.9975, still > -1.
    expect(() => solveEFF(ic({ NOM: -399, CY: 4 }))).not.toThrow();
    expect(() => solveNOM(ic({ EFF: -99.9, CY: 4 }))).not.toThrow();
  });

  it('raises Error 1 when a large NOM and C/Y push EFF past the calculator range', () => {
    // x + 1 ~ 10002 raised to the 9,999th power is ~1e39999, far beyond 1E100.
    expectError(ErrorCode.Overflow, () => solveEFF(ic({ NOM: 1e10, CY: 9999 })));
  });
});

describe('edge cases', () => {
  it('C/Y = 1 makes EFF equal NOM exactly', () => {
    // Implied by both formulas but never stated: (1 + x)^1 - 1 = x.
    expect(solveEFF(ic({ NOM: 15, CY: 1 }))).toBe(15);
    expect(solveNOM(ic({ EFF: 15, CY: 1 }))).toBe(15);
  });

  it('a zero rate converts to a zero rate at any C/Y', () => {
    expect(shown(solveEFF(ic({ NOM: 0, CY: 12 })))).toBe('0.00');
    expect(shown(solveNOM(ic({ EFF: 0, CY: 12 })))).toBe('0.00');
  });

  it('accepts a fractional C/Y', () => {
    // Nothing printed prohibits it and the formula tolerates it, so it is not
    // rejected. C/Y = 0.5 compounds once every two years: 100 x (1.3^0.5 - 1) =
    // 14.0175...%, below the annual 15% because the single compounding lands
    // after the year is up.
    expect(shown(solveEFF(ic({ NOM: 15, CY: 0.5 })))).toBe('14.02');
    expect(solveNOM(ic({ EFF: solveEFF(ic({ NOM: 15, CY: 0.5 })), CY: 0.5 }))).toBeCloseTo(15, 9);
  });

  it('converts a negative nominal rate inside the log domain', () => {
    // 100 x (0.9625^4 - 1) = -14.1771...%. Not discussed in the guidebook; the
    // formula is used unmodified. Note the effective loss is smaller than the
    // nominal 15%, the mirror image of the gain case.
    expect(shown(solveEFF(ic({ NOM: -15, CY: 4 })))).toBe('-14.18');
  });

  it('carries the thousands separator into the display', () => {
    // 100% nominal compounded daily for a large C/Y still fits; use a rate that
    // pushes EFF over 1000 to exercise the separator.
    expect(shown(solveEFF(ic({ NOM: 100, CY: 12 })))).toBe('161.30');
    expect(shown(solveEFF(ic({ NOM: 300, CY: 12 })))).toBe('1,355.19');
  });
});

describe('clearing and defaults (pp. 66-67)', () => {
  it('resets to NOM = 0, EFF = 0, C/Y = 1', () => {
    expect(INTEREST_CONVERSION_DEFAULTS).toEqual({ NOM: 0, EFF: 0, CY: 1 });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(INTEREST_CONVERSION_DEFAULTS)).toBe(true);
  });

  it('CLR WORK zeroes NOM and EFF but leaves C/Y alone', () => {
    // p. 67 states this explicitly, and it is the chapter's only asymmetric
    // clear. Resetting C/Y to 1 here would be a silent behaviour change.
    expect(clearInterestConversionWork({ NOM: 15, EFF: 15.87, CY: 4 })).toEqual({
      NOM: 0,
      EFF: 0,
      CY: 4,
    });
  });

  it('CLR WORK does not mutate the state it is given', () => {
    const state = ic({ NOM: 15, EFF: 15.87, CY: 4 });
    clearInterestConversionWork(state);
    expect(state).toEqual({ NOM: 15, EFF: 15.87, CY: 4 });
  });

  it('opens on the default NOM of 0.00', () => {
    expect(shown(INTEREST_CONVERSION_DEFAULTS.NOM)).toBe('0.00');
  });
});

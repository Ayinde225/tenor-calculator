import { describe, it, expect } from 'vitest';
import {
  PERCENT_CHANGE_DEFAULTS,
  computePercentChange,
  solveCH,
  solveNEW,
  solveOLD,
  solvePD,
  type PercentChangeState,
} from './percent-change.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const pct = (o: Partial<PercentChangeState>): PercentChangeState => ({
  ...PERCENT_CHANGE_DEFAULTS,
  ...o,
});
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

function expectError(code: ErrorCode, fn: () => unknown): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(CalculatorError);
  expect((thrown as CalculatorError).code).toBe(code);
}

/**
 * Golden: tests/golden/other-worksheets.json, the Percent Change cases.
 * Every display assertion goes through formatValue at the case's stated DEC=2.
 */
describe('golden: computing percent change, 658 -> 700 (p. 65)', () => {
  // The example does NOT press CLR WORK; it relies on #PD already being 1,
  // which is exactly what PERCENT_CHANGE_DEFAULTS provides.
  it('other-worksheets-pct-change-enter-old: OLD displays 658.00', () => {
    expect(shown(pct({ OLD: 658 }).OLD)).toBe('658.00');
  });

  it('other-worksheets-pct-change-enter-new: NEW displays 700.00', () => {
    expect(shown(pct({ OLD: 658, NEW: 700 }).NEW)).toBe('700.00');
  });

  it('other-worksheets-pct-change-compute-pct: %CH displays 6.38', () => {
    // The project brief's required parity example.
    const CH = computePercentChange(pct({ OLD: 658, NEW: 700 }), 'CH');
    expect(shown(CH)).toBe('6.38');
    // Exact real value is 6.382978723404255...; the machine stores 13 digits,
    // and rounds 700/658 to 13 before scaling, hence the trailing ...234.
    expect(CH).toBe(6.3829787234);
  });

  it('other-worksheets-pct-change-enter-negative-pct: %CH displays -7.00', () => {
    // Keying over the just-computed 6.38 re-marks %CH as entered.
    expect(shown(pct({ OLD: 658, NEW: 700, CH: -7 }).CH)).toBe('-7.00');
  });

  it('other-worksheets-pct-change-compute-new-from-negative: NEW displays 611.94', () => {
    // 658 x (1 - 0.07)^1, overwriting the previously entered NEW = 700.
    // In binary 658 * 0.93 lands on 611.9399999999999; the 13-digit internal
    // rounding in toInternal is what recovers the exact 611.94.
    const NEW = computePercentChange(pct({ OLD: 658, NEW: 700, CH: -7 }), 'NEW');
    expect(shown(NEW)).toBe('611.94');
    expect(NEW).toBe(611.94);
  });

  it('walks the full p. 65 key sequence in order', () => {
    let s = pct({ OLD: 658 });
    s = { ...s, NEW: 700 };
    const computedCH = computePercentChange(s, 'CH');
    expect(shown(computedCH)).toBe('6.38');

    s = { ...s, CH: -7 }; // 7 +/- ENTER
    expect(shown(computePercentChange(s, 'NEW'))).toBe('611.94');
  });
});

describe('golden: computing compound interest, 500 -> 750 over 5 years (p. 65)', () => {
  it('other-worksheets-compound-interest-enter-old: OLD displays 500.00', () => {
    expect(shown(pct({ OLD: 500 }).OLD)).toBe('500.00');
  });

  it('other-worksheets-compound-interest-enter-new: NEW displays 750.00', () => {
    expect(shown(pct({ OLD: 500, NEW: 750 }).NEW)).toBe('750.00');
  });

  it('other-worksheets-compound-interest-enter-periods: #PD displays 5.00', () => {
    expect(shown(pct({ OLD: 500, NEW: 750, PD: 5 }).PD)).toBe('5.00');
  });

  it('other-worksheets-compound-interest-growth-rate: %CH displays 8.45', () => {
    const CH = computePercentChange(pct({ OLD: 500, NEW: 750, PD: 5 }), 'CH');
    expect(shown(CH)).toBe('8.45');
    // Exact real value is 8.44717711976989...; stored to 13 digits.
    expect(CH).toBe(8.4471771198);
  });
});

describe('golden: cost-sell-markup, 100 -> 125 (pp. 65-66)', () => {
  it('other-worksheets-clr-work-zeroes-old: OLD displays 0.00 after CLR WORK', () => {
    expect(shown(PERCENT_CHANGE_DEFAULTS.OLD)).toBe('0.00');
  });

  it('other-worksheets-cost-sell-markup-enter-cost: OLD displays 100.00', () => {
    expect(shown(pct({ OLD: 100 }).OLD)).toBe('100.00');
  });

  it('other-worksheets-cost-sell-markup-enter-sell: NEW displays 125.00', () => {
    expect(shown(pct({ OLD: 100, NEW: 125 }).NEW)).toBe('125.00');
  });

  it('other-worksheets-cost-sell-markup: %CH displays 25.00', () => {
    // Markup is measured against COST. The Profit Margin worksheet's MAR on the
    // same pair is 20.00, because it measures against the selling price (p. 70).
    expect(shown(computePercentChange(pct({ OLD: 100, NEW: 125 }), 'CH'))).toBe('25.00');
  });

  it('reaches 25.00 starting from CLR WORK with only OLD and NEW keyed', () => {
    // This is the whole #PD-defaults argument in one assertion: the example
    // clears, keys two variables, and computes. Nothing sets #PD.
    const cleared = { ...PERCENT_CHANGE_DEFAULTS };
    const s = { ...cleared, OLD: 100, NEW: 125 };
    expect(shown(computePercentChange(s, 'CH'))).toBe('25.00');
  });
});

describe('#PD clears to 1, not to the 0 printed on p. 63', () => {
  it('defaults #PD to 1', () => {
    expect(PERCENT_CHANGE_DEFAULTS).toEqual({ OLD: 0, NEW: 0, CH: 0, PD: 1 });
  });

  it('would make the p. 66 markup example unanswerable if #PD were 0', () => {
    // The printed default of 0 puts a divide by zero in the %CH solve, so the
    // guidebook's own example could not display 25.00. The table is wrong.
    expectError(ErrorCode.Overflow, () => solveCH(pct({ OLD: 100, NEW: 125, PD: 0 })));
  });

  it('freezes the defaults', () => {
    expect(Object.isFrozen(PERCENT_CHANGE_DEFAULTS)).toBe(true);
  });
});

describe('#PD is an exponent, not a trailing factor (p. 81 defect)', () => {
  it('reproduces 8.45 only under the exponent reading', () => {
    const exponentReading = 100 * (Math.pow(750 / 500, 1 / 5) - 1);
    const factorReading = 100 * (750 / (500 * 5) - 1); // as literally printed
    expect(shown(solveCH(pct({ OLD: 500, NEW: 750, PD: 5 })))).toBe('8.45');
    expect(shown(exponentReading)).toBe('8.45');
    expect(shown(factorReading)).toBe('-70.00'); // nonsense, and not what p. 65 prints
  });

  it('compounds NEW forward across periods', () => {
    // 500 x 1.0844717...^5 returns to 750, which a trailing factor could not do.
    const CH = solveCH(pct({ OLD: 500, NEW: 750, PD: 5 }));
    expect(shown(solveNEW(pct({ OLD: 500, CH, PD: 5 })))).toBe('750.00');
  });
});

describe('solving for each of the four unknowns', () => {
  const consistent = pct({ OLD: 500, NEW: 750, CH: 8.44717711977, PD: 5 });

  it('solves NEW', () => {
    expect(shown(computePercentChange(consistent, 'NEW'))).toBe('750.00');
  });

  it('solves OLD', () => {
    expect(shown(computePercentChange(consistent, 'OLD'))).toBe('500.00');
  });

  it('solves %CH', () => {
    expect(shown(computePercentChange(consistent, 'CH'))).toBe('8.45');
  });

  it('solves #PD', () => {
    expect(shown(computePercentChange(consistent, 'PD'))).toBe('5.00');
  });

  it('round-trips every variable through its own solve', () => {
    expect(solveNEW(consistent)).toBeCloseTo(750, 6);
    expect(solveOLD(consistent)).toBeCloseTo(500, 6);
    expect(solveCH(consistent)).toBeCloseTo(8.44717711977, 6);
    expect(solvePD(consistent)).toBeCloseTo(5, 6);
  });

  it('leaves the other three variables untouched', () => {
    const before = { ...consistent };
    computePercentChange(consistent, 'CH');
    expect(consistent).toEqual(before);
  });
});

describe('percent change is the #PD = 1 special case of the compound equation', () => {
  it('uses one code path for both', () => {
    // No separate two-variable path exists; 658 -> 700 is just #PD = 1.
    expect(solveCH(pct({ OLD: 658, NEW: 700, PD: 1 }))).toBe(
      solveCH(pct({ OLD: 658, NEW: 700 })),
    );
  });

  it('treats positive %CH as an increase and negative as a decrease (p. 64)', () => {
    expect(solveCH(pct({ OLD: 658, NEW: 700 }))).toBeGreaterThan(0);
    expect(solveCH(pct({ OLD: 700, NEW: 658 }))).toBeLessThan(0);
    expect(shown(solveNEW(pct({ OLD: 658, CH: -7 })))).toBe('611.94');
    expect(shown(solveNEW(pct({ OLD: 658, CH: 7 })))).toBe('704.06');
  });
});

describe('error conditions (p. 84)', () => {
  it('raises Error 1 computing %CH with OLD = 0', () => {
    expectError(ErrorCode.Overflow, () => solveCH(pct({ OLD: 0, NEW: 700 })));
  });

  it('raises Error 1 computing #PD with OLD = 0', () => {
    expectError(ErrorCode.Overflow, () => solvePD(pct({ OLD: 0, NEW: 700, CH: 5 })));
  });

  it('raises Error 1 computing %CH with #PD = 0', () => {
    expectError(ErrorCode.Overflow, () => solveCH(pct({ OLD: 500, NEW: 750, PD: 0 })));
  });

  it('raises Error 1 computing OLD with %CH = -100', () => {
    // 1 + %CH/100 = 0, so the divisor vanishes.
    expectError(ErrorCode.Overflow, () => solveOLD(pct({ NEW: 750, CH: -100, PD: 5 })));
  });

  it('raises Error 2 computing #PD with %CH = -100', () => {
    // ln(0) rather than a divide by zero -- a different failure on the same input.
    expectError(ErrorCode.InvalidArgument, () => solvePD(pct({ OLD: 500, NEW: 750, CH: -100 })));
  });

  it('raises Error 1 computing #PD with %CH = 0', () => {
    // ln(1) = 0 in the denominator.
    expectError(ErrorCode.Overflow, () => solvePD(pct({ OLD: 500, NEW: 750, CH: 0 })));
  });

  it('raises Error 2 computing #PD when NEW/OLD is not > 0', () => {
    expectError(ErrorCode.InvalidArgument, () => solvePD(pct({ OLD: 500, NEW: -750, CH: 5 })));
    expectError(ErrorCode.InvalidArgument, () => solvePD(pct({ OLD: 500, NEW: 0, CH: 5 })));
  });

  it('raises Error 2 computing #PD when 1 + %CH/100 is not > 0', () => {
    expectError(ErrorCode.InvalidArgument, () => solvePD(pct({ OLD: 500, NEW: 750, CH: -150 })));
  });

  it('raises Error 2 computing %CH when NEW/OLD < 0 and #PD is fractional', () => {
    // y^x with y < 0 and x = 1/2.5 = 0.4, neither an integer nor 1/integer.
    expectError(ErrorCode.InvalidArgument, () => solveCH(pct({ OLD: 500, NEW: -750, PD: 2.5 })));
  });

  it('raises Error 2 computing NEW when %CH < -100 and #PD is fractional', () => {
    expectError(ErrorCode.InvalidArgument, () => solveNEW(pct({ OLD: 500, CH: -200, PD: 2.5 })));
  });

  it('raises Error 1 on a compound projection large enough to overflow', () => {
    expectError(ErrorCode.Overflow, () => solveNEW(pct({ OLD: 1e50, CH: 900, PD: 100 })));
  });
});

describe('the y^x domain rule (p. 84)', () => {
  it('permits a negative base under an integer exponent', () => {
    // %CH = -200 -> factor -1; an integer #PD is fine.
    expect(shown(solveNEW(pct({ OLD: 100, CH: -200, PD: 3 })))).toBe('-100.00');
    expect(shown(solveNEW(pct({ OLD: 100, CH: -200, PD: 2 })))).toBe('100.00');
  });

  it('permits a negative base under the inverse of an ODD integer', () => {
    // (-100/100)^(1/3) = -1 -> %CH = -200. Math.pow alone returns NaN here.
    expect(shown(solveCH(pct({ OLD: 100, NEW: -100, PD: 3 })))).toBe('-200.00');
  });

  it('inverts: that %CH and #PD reproduce the negative NEW', () => {
    expect(shown(solveNEW(pct({ OLD: 100, CH: -200, PD: 3 })))).toBe('-100.00');
  });

  it('rejects a negative base under the inverse of an EVEN integer', () => {
    // No real square root of a negative exists, though p. 84's rule allows 1/2.
    expectError(ErrorCode.InvalidArgument, () => solveCH(pct({ OLD: 100, NEW: -100, PD: 2 })));
  });
});

describe('edge cases the guidebook leaves open', () => {
  it('permits fractional #PD when the base is positive', () => {
    // Nothing printed prohibits it and the exponent form admits it.
    const CH = solveCH(pct({ OLD: 100, NEW: 200, PD: 2.5 }));
    expect(shown(CH)).toBe('31.95');
    expect(shown(solveNEW(pct({ OLD: 100, CH, PD: 2.5 })))).toBe('200.00');
  });

  it('degenerates to NEW = OLD when #PD = 0', () => {
    expect(shown(solveNEW(pct({ OLD: 658, CH: 42, PD: 0 })))).toBe('658.00');
    expect(shown(solveOLD(pct({ NEW: 658, CH: 42, PD: 0 })))).toBe('658.00');
  });

  it('computes NEW = 0 from %CH = -100', () => {
    // The pole only bites the OLD and #PD solves; NEW is well defined.
    expect(shown(solveNEW(pct({ OLD: 658, CH: -100, PD: 1 })))).toBe('0.00');
  });

  it('computes %CH = -100 when NEW is 0', () => {
    expect(shown(solveCH(pct({ OLD: 658, NEW: 0 })))).toBe('-100.00');
  });

  it('computes %CH = 0 when NEW equals OLD', () => {
    expect(shown(solveCH(pct({ OLD: 658, NEW: 658, PD: 5 })))).toBe('0.00');
  });

  it('handles a negative OLD', () => {
    // Not discussed anywhere in the chapter, but the equation is sign-agnostic.
    expect(shown(solveCH(pct({ OLD: -100, NEW: -125 })))).toBe('25.00');
  });

  it('discards precision beyond the machine 13 digits', () => {
    // 658 * 0.93 in IEEE-754 is 611.9399999999999; the hardware stores 611.94.
    expect(solveNEW(pct({ OLD: 658, CH: -7 }))).toBe(611.94);
    expect(658 * (1 + -7 / 100)).not.toBe(611.94); // the raw double, for contrast
  });
});

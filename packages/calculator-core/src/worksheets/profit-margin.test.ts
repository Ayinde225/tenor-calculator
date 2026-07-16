import { describe, it, expect } from 'vitest';
import {
  computeProfitMargin,
  solveCST,
  solveMAR,
  solveSEL,
  PROFIT_MARGIN_DEFAULTS,
  type ProfitMarginState,
} from './profit-margin.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const pm = (o: Partial<ProfitMarginState>): ProfitMarginState => ({ ...PROFIT_MARGIN_DEFAULTS, ...o });
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/**
 * The guidebook's only Profit Margin example (p. 71): a $125 item at a 20% gross
 * profit margin, find the original cost. Every golden case on the worksheet is a
 * step of this one sequence.
 */
describe('guidebook profit margin example (p. 71)', () => {
  // other-worksheets-profit-margin-open-cst
  it('opens on CST = 0.00 -- there is no auto-clear on entry', () => {
    // The example shows 0.00 rather than "Current value", so it assumes a freshly
    // reset machine; the worksheet itself does not clear when opened (p. 70).
    expect(shown(PROFIT_MARGIN_DEFAULTS.CST)).toBe('0.00');
  });

  // other-worksheets-profit-margin-enter-sel
  it('displays the entered selling price as 125.00', () => {
    expect(shown(pm({ SEL: 125 }).SEL)).toBe('125.00');
  });

  // other-worksheets-profit-margin-enter-mar
  it('displays the entered margin as 20.00', () => {
    expect(shown(pm({ SEL: 125, MAR: 20 }).MAR)).toBe('20.00');
  });

  // other-worksheets-profit-margin-compute-cost -- the project's parity example.
  it('computes CST = 100.00 from SEL = 125 and MAR = 20', () => {
    expect(shown(solveCST(pm({ SEL: 125, MAR: 20 })))).toBe('100.00');
  });

  // appendix-formulas-profit-margin-solve-cost -- the SAME keystroke sequence and
  // the same 100.00, filed a second time under the appendix's formula section
  // (tests/golden/appendix-formulas.json) rather than the worksheet chapter's.
  // Asserted explicitly so the id is not silently uncovered: that golden's point
  // is that CST = 100 is the solution of the PRINTED p. 81 equation, so it is
  // pinned here through solveMAR -- the printed direction -- and not only through
  // solveCST, which is a rearrangement this module derived.
  it('is the solution of the printed p. 81 equation, not just of the rearrangement', () => {
    expect(shown(solveCST(pm({ SEL: 125, MAR: 20 })))).toBe('100.00');
    // 20 = ((125 - 100)/125) x 100: the identity the golden's note spells out,
    // evaluated in the printed left-to-right order.
    expect(solveMAR(pm({ CST: 100, SEL: 125 }))).toBe(20);
  });
});

describe('solving for each unknown', () => {
  it('solves MAR from CST and SEL', () => {
    expect(shown(solveMAR(pm({ CST: 100, SEL: 125 })))).toBe('20.00');
  });

  it('solves SEL from CST and MAR', () => {
    expect(shown(solveSEL(pm({ CST: 100, MAR: 20 })))).toBe('125.00');
  });

  it('solves CST from SEL and MAR', () => {
    expect(shown(solveCST(pm({ SEL: 125, MAR: 20 })))).toBe('100.00');
  });

  it('dispatches through computeProfitMargin', () => {
    expect(shown(computeProfitMargin(pm({ SEL: 125, MAR: 20 }), 'CST'))).toBe('100.00');
    expect(shown(computeProfitMargin(pm({ CST: 100, MAR: 20 }), 'SEL'))).toBe('125.00');
    expect(shown(computeProfitMargin(pm({ CST: 100, SEL: 125 }), 'MAR'))).toBe('20.00');
  });

  it('round-trips: each solve inverts the others', () => {
    const state = pm({ CST: 100, SEL: 125, MAR: 20 });
    expect(solveCST(state)).toBe(100);
    expect(solveSEL(state)).toBe(125);
    expect(solveMAR(state)).toBe(20);
  });

  it('leaves the other two variables untouched', () => {
    const state = pm({ CST: 0, SEL: 125, MAR: 20 });
    computeProfitMargin(state, 'CST');
    expect(state).toEqual({ CST: 0, SEL: 125, MAR: 20 });
  });
});

/**
 * The guidebook redirects markup work to the Percent Change worksheet (p. 70)
 * precisely because the same numbers mean different things in the two places.
 */
describe('margin is not markup (p. 70)', () => {
  it('measures the spread against SEL, not against CST', () => {
    // Cost 100, selling price 125. Margin is 25/125 = 20% of the SELLING PRICE.
    expect(shown(solveMAR(pm({ CST: 100, SEL: 125 })))).toBe('20.00');

    // The markup on the same pair is 25/100 = 25% of COST -- the answer the
    // Percent Change worksheet gives for this pair on p. 66. If this worksheet
    // ever returns 25.00, the two have been conflated.
    const markup = ((125 - 100) / 100) * 100;
    expect(shown(markup)).toBe('25.00');
    expect(solveMAR(pm({ CST: 100, SEL: 125 }))).not.toBe(markup);
  });
});

describe('error conditions (guidebook p. 84)', () => {
  it('raises Error 1 computing MAR with SEL = 0', () => {
    try {
      solveMAR(pm({ CST: 100, SEL: 0 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 computing MAR with SEL = 0 even when CST is also 0', () => {
    // 0/0 would be NaN rather than a divide-by-zero infinity; both are Error 1,
    // but the explicit guard means the reason is the same either way.
    try {
      solveMAR(PROFIT_MARGIN_DEFAULTS);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 computing SEL with MAR = 100', () => {
    try {
      solveSEL(pm({ CST: 100, MAR: 100 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 when SEL overflows the calculator range', () => {
    // A margin a hair under 100% divides by ~1e-13 and pushes past 1E100.
    try {
      solveSEL(pm({ CST: 1e99, MAR: 99.99999999999 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('does not error computing CST with SEL = 0 -- there is no divisor', () => {
    expect(shown(solveCST(pm({ SEL: 0, MAR: 20 })))).toBe('0.00');
  });
});

describe('edge cases the guidebook does not discuss', () => {
  it('MAR = 0 makes cost equal the selling price', () => {
    expect(shown(solveCST(pm({ SEL: 125, MAR: 0 })))).toBe('125.00');
    expect(shown(solveSEL(pm({ CST: 125, MAR: 0 })))).toBe('125.00');
  });

  it('MAR > 100 implies a negative cost', () => {
    // 125 x (1 - 1.20) = -25. Arithmetically fine, commercially nonsense; the
    // guidebook prints no valid range for MAR, so it is returned as-is.
    expect(shown(solveCST(pm({ SEL: 125, MAR: 120 })))).toBe('-25.00');
  });

  it('a cost above the selling price gives a negative MAR', () => {
    // Sold at a loss: (100 - 125)/100 x 100 = -25%.
    expect(shown(solveMAR(pm({ CST: 125, SEL: 100 })))).toBe('-25.00');
  });

  it('a negative MAR solves back to a selling price below cost', () => {
    expect(shown(solveSEL(pm({ CST: 125, MAR: -25 })))).toBe('100.00');
  });

  it('handles a negative selling price without special-casing', () => {
    // No sign convention applies here, so the formula is used unmodified.
    expect(shown(solveMAR(pm({ CST: -100, SEL: -125 })))).toBe('20.00');
  });

  it('carries the thousands separator into the display', () => {
    expect(shown(solveCST(pm({ SEL: 12500, MAR: 20 })))).toBe('10,000.00');
  });

  it('rounds the display without disturbing the internal value', () => {
    // MAR = (3 - 1)/3 x 100 = 66.666...%, held at 13 digits, shown at 2.
    const mar = solveMAR(pm({ CST: 1, SEL: 3 }));
    expect(shown(mar)).toBe('66.67');
    expect(mar).toBeCloseTo(66.66666666667, 10);
  });
});

describe('defaults (p. 70)', () => {
  it('CLR WORK zeroes all three variables', () => {
    expect(PROFIT_MARGIN_DEFAULTS).toEqual({ CST: 0, SEL: 0, MAR: 0 });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PROFIT_MARGIN_DEFAULTS)).toBe(true);
  });
});

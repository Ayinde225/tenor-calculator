/**
 * Required verification examples -- project brief section 12.
 *
 * These nine cases are the project's stated acceptance criteria. They are
 * asserted here as displayed STRINGS, not as numbers within a tolerance: the
 * calculator's contract is what appears on the LCD, and a result that is right
 * to twelve places but formats wrong is still a parity defect.
 *
 * Everything is driven through the package's public entry point rather than by
 * reaching into modules, so this also proves the barrel export is wired up.
 */
import { describe, it, expect } from 'vitest';
import {
  formatValue,
  createExpressionState,
  pressOperator,
  pressEquals,
  tvm,
  percentChange,
  interestConversion,
  profitMargin,
  breakeven,
  dateWorksheet,
  type CalculationMethod,
  type BinaryOp,
} from './index.js';

/** The guidebook assumes two decimal places throughout (p. 9). */
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

function chain(method: CalculationMethod, tokens: (number | BinaryOp)[]): number {
  let state = createExpressionState(method);
  let display = 0;
  for (const t of tokens) {
    if (typeof t === 'number') {
      display = t;
    } else {
      const r = pressOperator(state, display, t);
      state = r.state;
      display = r.display;
    }
  }
  return pressEquals(state, display).display;
}

describe('project brief section 12: required verification examples', () => {
  it('1. 3 + 2 x 4 in CHN mode displays 20', () => {
    expect(chain('CHN', [3, 'add', 2, 'mul', 4])).toBe(20);
  });

  it('2. 3 + 2 x 4 in AOS mode displays 11', () => {
    expect(chain('AOS', [3, 'add', 2, 'mul', 4])).toBe(11);
  });

  it('3. $120,000 mortgage, 360 payments, 6.125%, P/Y 12 -> PMT -729.13', () => {
    const pmt = tvm.solvePMT({
      ...tvm.TVM_DEFAULTS,
      N: 360,
      IY: 6.125,
      PV: 120000,
      FV: 0,
      PY: 12,
      CY: 12,
      mode: 'END',
    });
    expect(shown(pmt)).toBe('-729.13');
  });

  it('4. $25,000 savings target -> PMT -203.13', () => {
    // Guidebook pp. 38-39: deposits at the BEGINNING of each month for 10 years,
    // 0.5% annual with QUARTERLY compounding, so P/Y = 12 but C/Y = 4.
    const pmt = tvm.solvePMT({
      ...tvm.TVM_DEFAULTS,
      N: 120,
      IY: 0.5,
      PV: 0,
      FV: 25000,
      PY: 12,
      CY: 4,
      mode: 'BGN',
    });
    expect(shown(pmt)).toBe('-203.13');
  });

  it('5. percent change from 658 to 700 -> 6.38 at two decimals', () => {
    const ch = percentChange.solveCH({
      ...percentChange.PERCENT_CHANGE_DEFAULTS,
      OLD: 658,
      NEW: 700,
      PD: 1,
    });
    expect(shown(ch)).toBe('6.38');
  });

  it('6. 15% nominal, quarterly compounding -> EFF 15.87', () => {
    const eff = interestConversion.solveEFF({
      ...interestConversion.INTEREST_CONVERSION_DEFAULTS,
      NOM: 15,
      CY: 4,
    });
    expect(shown(eff)).toBe('15.87');
  });

  it('7. selling price 125 and margin 20% -> Cost 100.00', () => {
    const cst = profitMargin.solveCST({
      ...profitMargin.PROFIT_MARGIN_DEFAULTS,
      SEL: 125,
      MAR: 20,
    });
    expect(shown(cst)).toBe('100.00');
  });

  it('8. FC 3,000, VC 15, price 20, profit 0 -> Quantity 600', () => {
    const q = breakeven.solveQ({
      ...breakeven.BREAKEVEN_DEFAULTS,
      FC: 3000,
      VC: 15,
      P: 20,
      PFT: 0,
    });
    expect(shown(q)).toBe('600.00');
    expect(q).toBe(600);
  });

  it('9. September 4, 2003 to November 1, 2003 under ACT -> 58 days', () => {
    const dbd = dateWorksheet.solveDBD({
      ...dateWorksheet.DATE_DEFAULTS,
      DT1: { year: 2003, month: 9, day: 4 },
      DT2: { year: 2003, month: 11, day: 1 },
      method: 'ACT',
    });
    expect(dbd).toBe(58);
  });
});

describe('the required examples discriminate what they claim to', () => {
  it('CHN and AOS genuinely disagree on the same keystrokes', () => {
    expect(chain('CHN', [3, 'add', 2, 'mul', 4])).not.toBe(chain('AOS', [3, 'add', 2, 'mul', 4]));
  });

  it('the date example spans a month boundary and both day counts differ', () => {
    const base = {
      ...dateWorksheet.DATE_DEFAULTS,
      DT1: { year: 2003, month: 9, day: 4 },
      DT2: { year: 2003, month: 11, day: 1 },
    };
    const act = dateWorksheet.solveDBD({ ...base, method: 'ACT' });
    const thirty = dateWorksheet.solveDBD({ ...base, method: '360' });
    // ACT counts real days (58); 30/360 assumes 30-day months (57). If these
    // ever agree, the day-count switch has stopped doing anything.
    expect(act).toBe(58);
    expect(thirty).not.toBe(act);
  });

  it('the margin example is a margin, not a markup', () => {
    // 20% margin on SEL=125 gives CST=100. A 20% *markup* on cost would instead
    // put cost at 104.17 -- conflating the two is the classic error here.
    const margin = profitMargin.solveCST({
      ...profitMargin.PROFIT_MARGIN_DEFAULTS,
      SEL: 125,
      MAR: 20,
    });
    expect(margin).toBe(100);
    expect(shown(125 / 1.2)).toBe('104.17');
  });
});

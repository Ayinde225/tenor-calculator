import { describe, it, expect } from 'vitest';
import { amortize, nextRange, schedule, MAX_PAYMENT_NUMBER } from './amortization.js';
import { TVM_DEFAULTS, solvePMT, type TvmState } from './tvm.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const tvm = (o: Partial<TvmState>): TvmState => ({ ...TVM_DEFAULTS, ...o });
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/**
 * The guidebook's 30-year mortgage schedule (pp. 40-41): $120,000 at 6.125% APR,
 * P/Y = 12. PMT is the *computed* value, deliberately kept unrounded here -- the
 * amortization is what rounds it, and that rounding is the whole point.
 */
const MORTGAGE = tvm({ N: 360, IY: 6.125, PV: 120000, PMT: -729.132647, FV: 0, PY: 12, CY: 12 });

describe('guidebook mortgage schedule (pp. 40-41)', () => {
  // The loan's first payment falls in April, so year 1 covers only 9 periods.
  it('year 1, payments 1-9', () => {
    const r = amortize(MORTGAGE, { P1: 1, P2: 9 }, 2);
    expect(shown(r.BAL)).toBe('118,928.63');
    expect(shown(r.PRN)).toBe('-1,071.37');
    expect(shown(r.INT)).toBe('-5,490.80');
  });

  it('year 2, payments 10-21', () => {
    const r = amortize(MORTGAGE, { P1: 10, P2: 21 }, 2);
    expect(shown(r.BAL)).toBe('117,421.60');
    expect(shown(r.PRN)).toBe('-1,507.03');
    expect(shown(r.INT)).toBe('-7,242.53');
  });

  it('year 3, payments 22-33', () => {
    const r = amortize(MORTGAGE, { P1: 22, P2: 33 }, 2);
    expect(shown(r.BAL)).toBe('115,819.62');
    expect(shown(r.PRN)).toBe('-1,601.98');
    expect(shown(r.INT)).toBe('-7,147.58');
  });
});

describe('balloon-payment example (guidebook p. 41)', () => {
  const loan = tvm({ N: 360, IY: 7, PV: 82000, PMT: -545.5474, FV: 0, PY: 12, CY: 12 });

  it('balance and interest after 60 payments', () => {
    const r = amortize(loan, { P1: 1, P2: 60 }, 2);
    expect(shown(r.BAL)).toBe('77,187.72');
    // The guidebook's prose says $27,790.72 here, transposing two digits against
    // its own table, which prints -27,920.72. The table is arithmetically correct.
    expect(shown(r.INT)).toBe('-27,920.72');
  });
});

describe('the corrected PRN formula', () => {
  it('measures principal from the balance BEFORE P1', () => {
    // PRN(1-9) = bal(9) - bal(0). The appendix's printed bal(pmt2) - bal(pmt1)
    // would instead give bal(9) - bal(1) = -954.74.
    const r = amortize(MORTGAGE, { P1: 1, P2: 9 }, 2);
    const printedFormula = amortize(MORTGAGE, { P1: 2, P2: 9 }, 2); // bal(9)-bal(1)
    expect(shown(r.PRN)).toBe('-1,071.37');
    expect(shown(printedFormula.PRN)).toBe('-954.74'); // what the printed form yields
  });

  it('keeps PRN and INT summing to the total paid', () => {
    const r = amortize(MORTGAGE, { P1: 10, P2: 21 }, 2);
    const totalPaid = 12 * -729.13;
    expect(r.PRN + r.INT).toBeCloseTo(totalPaid, 6);
  });

  it('chains: consecutive ranges reconstruct the whole balance change', () => {
    const y1 = amortize(MORTGAGE, { P1: 1, P2: 9 }, 2);
    const y2 = amortize(MORTGAGE, { P1: 10, P2: 21 }, 2);
    expect(y1.PRN + y2.PRN).toBeCloseTo(y2.BAL - 120000, 6);
  });
});

describe('per-period rounding is mandatory', () => {
  it('rounds the running balance every period, not just at the end', () => {
    // Carrying an unrounded balance yields 117,421.61 / 115,819.64 -- both wrong
    // by a cent or two. These assertions are the regression guard.
    expect(shown(amortize(MORTGAGE, { P1: 10, P2: 21 }, 2).BAL)).toBe('117,421.60');
    expect(shown(amortize(MORTGAGE, { P1: 22, P2: 33 }, 2).BAL)).toBe('115,819.62');
  });

  it('uses the ROUNDED payment to drive the schedule', () => {
    // Rounding PMT to cents is what a borrower actually pays. Feeding the
    // unrounded -729.132647 through instead drifts the balance.
    const rounded = tvm({ ...MORTGAGE, PMT: -729.13 });
    expect(shown(amortize(rounded, { P1: 1, P2: 9 }, 2).BAL)).toBe('118,928.63');
  });
});

describe('the DEC setting changes the arithmetic (guidebook p. 9)', () => {
  it('produces different balances at different decimal settings', () => {
    // Unlike every other worksheet, amortization is not display-independent.
    const at2 = amortize(MORTGAGE, { P1: 1, P2: 9 }, 2).BAL;
    const at5 = amortize(MORTGAGE, { P1: 1, P2: 9 }, 5).BAL;
    expect(at2).not.toBe(at5);
  });

  it('rounds to whole units at DEC = 0', () => {
    const r = amortize(MORTGAGE, { P1: 1, P2: 9 }, 0);
    expect(Number.isInteger(r.BAL)).toBe(true);
  });
});

describe('BAL diverges from FV, by design (guidebook p. 26)', () => {
  it('because the schedule uses the rounded payment', () => {
    const pmt = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, FV: 0, PY: 12, CY: 12 }));
    const loan = tvm({ N: 360, IY: 6.125, PV: 120000, PMT: pmt, FV: 0, PY: 12, CY: 12 });
    const finalBal = amortize(loan, { P1: 1, P2: 360 }, 2).BAL;
    // FV is 0, but the amortized balance lands slightly off it.
    expect(finalBal).not.toBe(0);
    expect(Math.abs(finalBal)).toBeLessThan(5); // small, but real
  });
});

describe('auto-advance (guidebook p. 28)', () => {
  it('rolls the window forward preserving its width', () => {
    expect(nextRange({ P1: 10, P2: 21 })).toEqual({ P1: 22, P2: 33 });
    expect(nextRange({ P1: 1, P2: 9 })).toEqual({ P1: 10, P2: 18 });
  });

  it('clamps at the maximum payment number', () => {
    expect(nextRange({ P1: 9990, P2: 9999 }).P2).toBe(MAX_PAYMENT_NUMBER);
  });
});

describe('error conditions (guidebook pp. 84-85)', () => {
  it('raises Error 2 when P2 < P1', () => {
    try {
      amortize(MORTGAGE, { P1: 10, P2: 5 }, 2);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.InvalidArgument);
    }
  });

  it('raises Error 4 when P1 or P2 is outside 1-9999', () => {
    for (const bad of [{ P1: 0, P2: 5 }, { P1: 1, P2: 10000 }, { P1: -1, P2: 5 }]) {
      try {
        amortize(MORTGAGE, bad, 2);
        expect.unreachable('should have thrown');
      } catch (e) {
        expect((e as CalculatorError).code).toBe(ErrorCode.OutOfRange);
      }
    }
  });
});

describe('per-payment schedule', () => {
  it('matches the range results it is derived from', () => {
    const rows = schedule(MORTGAGE, 9, 2);
    expect(rows).toHaveLength(9);
    expect(shown(rows[8]!.balance)).toBe('118,928.63');

    const totalPrincipal = rows.reduce((a, r) => a + r.principal, 0);
    expect(shown(totalPrincipal)).toBe('-1,071.37');
  });

  it('first payment splits into the expected interest and principal', () => {
    const rows = schedule(MORTGAGE, 1, 2);
    // 120,000 x 6.125%/12 = 612.50 interest; the rest reduces principal.
    expect(shown(rows[0]!.interest)).toBe('-612.50');
    expect(shown(rows[0]!.principal)).toBe('-116.63');
  });
});

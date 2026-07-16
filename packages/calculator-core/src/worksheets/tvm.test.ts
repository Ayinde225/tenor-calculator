import { describe, it, expect } from 'vitest';
import {
  TVM_DEFAULTS,
  periodicRate,
  nominalRate,
  solveN,
  solveIY,
  solvePV,
  solvePMT,
  solveFV,
  tvmResidual,
  type TvmState,
} from './tvm.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const tvm = (o: Partial<TvmState>): TvmState => ({ ...TVM_DEFAULTS, ...o });

/** Format at the guidebook's standing assumption of two decimal places (p. 9). */
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

describe('required parity example: mortgage payment (project brief §12)', () => {
  it('$120,000 over 360 payments at 6.125%, P/Y 12 -> PMT -729.13', () => {
    const pmt = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, FV: 0, PY: 12, CY: 12 }));
    expect(shown(pmt)).toBe('-729.13');
  });
});

describe('required parity example: $25,000 savings target (guidebook pp. 38-39)', () => {
  it('PMT -203.13', () => {
    // Deposit the same amount at the BEGINNING of each month; after 10 years hold
    // $25,000; annual rate 0.5% with QUARTERLY compounding.
    //
    // This case is valuable precisely because P/Y != C/Y: entering P/Y = 12 sets
    // C/Y = 12 too, and the example then changes C/Y to 4 separately. It also
    // exercises BGN. Getting -203.13 requires both to be handled correctly.
    const pmt = solvePMT(
      tvm({ N: 120, IY: 0.5, PV: 0, FV: 25000, PY: 12, CY: 4, mode: 'BGN' }),
    );
    expect(shown(pmt)).toBe('-203.13');
  });

  it('would not produce -203.13 in END mode', () => {
    // BGN is load-bearing here: END gives -203.21, which is visibly different.
    const wrong = solvePMT(tvm({ N: 120, IY: 0.5, PV: 0, FV: 25000, PY: 12, CY: 4, mode: 'END' }));
    expect(shown(wrong)).toBe('-203.21');
  });

  it('does NOT discriminate C/Y at two decimals -- do not rely on it to prove C/Y', () => {
    // At a 0.5% rate, leaving C/Y at 12 instead of 4 moves PMT by only ~0.002,
    // which vanishes at the displayed precision. This example therefore passes
    // even with C/Y handling broken. The difference is real but sub-display, so
    // C/Y correctness is asserted at full precision instead, below.
    const right = solvePMT(tvm({ N: 120, IY: 0.5, PV: 0, FV: 25000, PY: 12, CY: 4, mode: 'BGN' }));
    const wrong = solvePMT(tvm({ N: 120, IY: 0.5, PV: 0, FV: 25000, PY: 12, CY: 12, mode: 'BGN' }));
    expect(shown(right)).toBe(shown(wrong)); // both -203.13
    expect(right).not.toBeCloseTo(wrong, 3); // but genuinely different values
  });

  it('applies C/Y separately from P/Y at full precision', () => {
    const cy4 = solvePMT(tvm({ N: 120, IY: 0.5, PV: 0, FV: 25000, PY: 12, CY: 4, mode: 'BGN' }));
    expect(cy4).toBeCloseTo(-203.129304, 5);
  });

  it('discriminates C/Y clearly at a realistic rate', () => {
    // A stronger C/Y guard than the guidebook example provides: at 12% the
    // quarterly-vs-monthly compounding difference is plainly visible.
    const cy4 = solvePMT(tvm({ N: 120, IY: 12, PV: 0, FV: 25000, PY: 12, CY: 4, mode: 'BGN' }));
    const cy12 = solvePMT(tvm({ N: 120, IY: 12, PV: 0, FV: 25000, PY: 12, CY: 12, mode: 'BGN' }));
    expect(shown(cy4)).not.toBe(shown(cy12));
  });
});

/**
 * Cases transcribed from the guidebook's worked examples during Phase 0 spec
 * extraction (tests/golden/tvm-and-amortization.json). They were captured by
 * reading the guidebook independently of this implementation, so agreement here
 * is genuine cross-validation rather than self-confirmation.
 *
 * These are asserted directly for now. Once the keypad state machine lands they
 * will be driven from their recorded key sequences instead, which will also
 * exercise xP/Y, 2ND SET and the worksheet navigation those cases encode.
 */
describe('guidebook worked examples (golden corpus)', () => {
  it('monthly loan payment, 30y @ 5.5%, PV 75,000 (p. 29)', () => {
    expect(shown(solvePMT(tvm({ N: 360, IY: 5.5, PV: 75000, FV: 0, PY: 12, CY: 12 })))).toBe(
      '-425.84',
    );
  });

  it('quarterly loan payment, 30y @ 5.5%, PV 75,000 (p. 29)', () => {
    expect(shown(solvePMT(tvm({ N: 120, IY: 5.5, PV: 75000, FV: 0, PY: 4, CY: 4 })))).toBe(
      '-1,279.82',
    );
  });

  it('savings future value, 20 periods @ 0.5%, PV -5,000 (p. 30)', () => {
    expect(shown(solveFV(tvm({ N: 20, IY: 0.5, PV: -5000, PMT: 0, PY: 1, CY: 1 })))).toBe(
      '5,524.48',
    );
  });

  it('savings present value, 20 periods @ 0.5%, FV 10,000 (p. 30)', () => {
    expect(shown(solvePV(tvm({ N: 20, IY: 0.5, PMT: 0, FV: 10000, PY: 1, CY: 1 })))).toBe(
      '-9,050.63',
    );
  });

  it('present value of an ordinary annuity, 10y @ 10%, PMT -20,000 (p. 31)', () => {
    expect(
      shown(solvePV(tvm({ N: 10, IY: 10, PMT: -20000, FV: 0, PY: 1, CY: 1, mode: 'END' }))),
    ).toBe('122,891.34');
  });

  it('present value of an annuity due, same terms in BGN (p. 31)', () => {
    expect(
      shown(solvePV(tvm({ N: 10, IY: 10, PMT: -20000, FV: 0, PY: 1, CY: 1, mode: 'BGN' }))),
    ).toBe('135,180.48');
  });

  it('present value of a single year-1 cash flow @ 10% (p. 33)', () => {
    expect(shown(solvePV(tvm({ N: 1, IY: 10, PMT: 0, FV: -5000, PY: 1, CY: 1 })))).toBe('4,545.45');
  });
});

describe('rate conversion (guidebook p. 74)', () => {
  it('collapses to I/Y / (100 x P/Y) when C/Y = P/Y', () => {
    expect(periodicRate(6.125, 12, 12)).toBeCloseTo(0.06125 / 12, 12);
    expect(periodicRate(12, 12, 12)).toBeCloseTo(0.01, 12);
  });

  it('compounds correctly when C/Y differs from P/Y', () => {
    // 12% nominal, monthly payments, quarterly compounding.
    // x = 0.12/4 = 0.03 per quarter; y = 4/12 = 1/3 quarters per month.
    const i = periodicRate(12, 12, 4);
    expect(i).toBeCloseTo(Math.pow(1.03, 1 / 3) - 1, 12);
  });

  it('round-trips through nominalRate', () => {
    for (const [iy, py, cy] of [
      [6.125, 12, 12],
      [7, 12, 4],
      [15, 4, 1],
      [5.5, 1, 12],
    ] as const) {
      const i = periodicRate(iy, py, cy);
      expect(nominalRate(i, py, cy)).toBeCloseTo(iy, 9);
    }
  });
});

describe('the five solves are mutually consistent', () => {
  const base = tvm({ N: 360, IY: 6.125, PV: 120000, FV: 0, PY: 12, CY: 12 });

  it('each solved variable satisfies the fundamental equation', () => {
    const pmt = solvePMT(base);
    const i = periodicRate(base.IY, base.PY, base.CY);
    expect(tvmResidual(i, base.N, base.PV, pmt, base.FV, base.mode)).toBeCloseTo(0, 6);
  });

  it('solving back for each variable recovers the original', () => {
    const pmt = solvePMT(base);
    const full = { ...base, PMT: pmt };

    expect(solvePV(full)).toBeCloseTo(base.PV, 4);
    expect(solveN(full)).toBeCloseTo(base.N, 4);
    expect(solveIY(full)).toBeCloseTo(base.IY, 6);
    expect(solveFV(full)).toBeCloseTo(base.FV, 4);
  });
});

describe('END vs BGN (guidebook p. 26)', () => {
  it('an annuity due payment is smaller than an ordinary annuity payment', () => {
    const end = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, PY: 12, CY: 12, mode: 'END' }));
    const bgn = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, PY: 12, CY: 12, mode: 'BGN' }));
    // Paying at the start of each period means less interest accrues.
    expect(Math.abs(bgn)).toBeLessThan(Math.abs(end));
  });

  it('BGN differs from END by exactly one period of interest', () => {
    const i = periodicRate(6.125, 12, 12);
    const end = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, PY: 12, CY: 12, mode: 'END' }));
    const bgn = solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, PY: 12, CY: 12, mode: 'BGN' }));
    expect(bgn).toBeCloseTo(end / (1 + i), 8);
  });
});

describe('zero interest (guidebook p. 75)', () => {
  it('PMT is a simple division when i = 0', () => {
    expect(solvePMT(tvm({ N: 10, IY: 0, PV: 1000, FV: 0, PY: 1, CY: 1 }))).toBe(-100);
  });

  it('FV is a simple sum when i = 0', () => {
    expect(solveFV(tvm({ N: 10, IY: 0, PV: 0, PMT: -100, PY: 1, CY: 1 }))).toBe(1000);
  });

  it('N is a simple division when i = 0', () => {
    expect(solveN(tvm({ IY: 0, PV: 1000, PMT: -100, FV: 0, PY: 1, CY: 1 }))).toBe(10);
  });
});

describe('sign convention (guidebook p. 26)', () => {
  it('borrowing yields a negative payment', () => {
    // Receive 120,000 now (inflow, +PV) -> pay it back (outflow, -PMT).
    expect(solvePMT(tvm({ N: 360, IY: 6.125, PV: 120000, PY: 12, CY: 12 }))).toBeLessThan(0);
  });

  it('saving yields a positive future value from negative deposits', () => {
    expect(solveFV(tvm({ N: 120, IY: 6, PV: 0, PMT: -100, PY: 12, CY: 12 }))).toBeGreaterThan(0);
  });
});

describe('error conditions (guidebook pp. 84-85)', () => {
  it('raises Error 5 when FV, N x PMT and PV all share a sign', () => {
    try {
      solveIY(tvm({ N: 10, PV: 100, PMT: 100, FV: 100, PY: 1, CY: 1 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.NoSolution);
    }
  });

  it('raises Error 4 when P/Y or C/Y is not positive', () => {
    for (const bad of [{ PY: 0 }, { CY: 0 }, { PY: -1 }]) {
      try {
        solvePMT(tvm({ N: 10, IY: 5, PV: 100, ...bad }));
        expect.unreachable('should have thrown');
      } catch (e) {
        expect((e as CalculatorError).code).toBe(ErrorCode.OutOfRange);
      }
    }
  });

  it('raises Error 5 when the N solve would take ln of a non-positive value', () => {
    // Depositing +100/period while also receiving +100,000 is not a coherent set
    // of cash flows, so the log argument goes negative and no N exists.
    try {
      solveN(tvm({ IY: 5, PV: 0, PMT: 100, FV: 100000, PY: 1, CY: 1 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.NoSolution);
    }
  });

  it('permits a negative N where one legitimately exists', () => {
    // Not every awkward combination is an error: this one has a real (negative)
    // solution and the hardware returns it rather than complaining.
    expect(solveN(tvm({ IY: 5, PV: 100, PMT: 100, FV: 100, PY: 1, CY: 1 }))).toBeLessThan(0);
  });
});

describe('I/Y iterative solve', () => {
  it('recovers a known rate from a loan', () => {
    const iy = solveIY(tvm({ N: 360, PV: 120000, PMT: -729.13, FV: 0, PY: 12, CY: 12 }));
    expect(iy).toBeCloseTo(6.125, 3);
  });

  it('handles a high rate', () => {
    const pmt = solvePMT(tvm({ N: 12, IY: 24, PV: 1000, PY: 12, CY: 12 }));
    const iy = solveIY(tvm({ N: 12, PV: 1000, PMT: pmt, FV: 0, PY: 12, CY: 12 }));
    expect(iy).toBeCloseTo(24, 6);
  });

  it('handles annual compounding', () => {
    const iy = solveIY(tvm({ N: 10, PV: -1000, PMT: 0, FV: 2000, PY: 1, CY: 1 }));
    expect(iy).toBeCloseTo(7.177346254, 6); // 2^(1/10) - 1
  });
});

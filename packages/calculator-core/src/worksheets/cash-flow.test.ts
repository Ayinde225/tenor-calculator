import { describe, it, expect } from 'vitest';
import {
  CASH_FLOW_DEFAULTS,
  DEFAULT_FREQUENCY,
  MAX_CASH_FLOWS,
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  deleteFlow,
  flowAt,
  flowCount,
  insertFlow,
  setCFo,
  setFlow,
  setFrequency,
  setI,
  signChanges,
  solveIRR,
  solveNPV,
  type CashFlowState,
} from './cash-flow.js';
import { formatValue } from '../display/format.js';
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/** Cnn as the LCD would show it. */
const shownC = (s: CashFlowState, n: number): string => shown(flowAt(s, n).C);
/** Fnn as the LCD would show it -- frequencies render at the DEC setting too, hence 4.00 not 4. */
const shownF = (s: CashFlowState, n: number): string => shown(flowAt(s, n).F);

/**
 * The machine example, pp. 46-48: a company pays $7,000 for a machine and expects
 * 3,000 in year 1, 5,000 in years 2-5, and 4,000 in year 6.
 *
 * Built to the keystrokes of the p. 47 "Entering Cash-Flow Data" table. This is the
 * PRE-EDIT stream; the guidebook then edits it and computes against the result.
 */
const enteredMachine = (): CashFlowState => {
  let s = CASH_FLOW_DEFAULTS; // CF -> CFo
  s = setCFo(s, -7000); // 7000 +/- ENTER
  s = setFlow(s, 1, 3000); // DOWN 3000 ENTER   (F01 left at its default)
  s = setFlow(s, 2, 5000); // DOWN DOWN 5000 ENTER
  s = setFrequency(s, 2, 4); // DOWN 4 ENTER
  s = setFlow(s, 3, 4000); // DOWN 4000 ENTER   (F03 left at its default)
  return s;
};

/**
 * The p. 47 "Editing Cash-Flow Data" table: the $4,000 belongs in year 2, not
 * year 6. Delete it from C03, insert it at C02.
 */
const editedMachine = (): CashFlowState => {
  let s = enteredMachine();
  s = deleteFlow(s, 3); // UP, 2ND DEL
  s = insertFlow(s, 2, 4000); // UP UP, 2ND INS 4000 ENTER
  return s;
};

describe('entering cash-flow data (guidebook p. 47)', () => {
  it('CF opens on CFo at its 0 default', () => {
    expect(shown(CASH_FLOW_DEFAULTS.CFo)).toBe('0.00');
  });

  it('enters an initial cash flow of -7,000 as an outflow', () => {
    expect(shown(setCFo(CASH_FLOW_DEFAULTS, -7000).CFo)).toBe('-7,000.00');
  });

  it('enters the year-1 inflow at C01', () => {
    expect(shownC(enteredMachine(), 1)).toBe('3,000.00');
  });

  it('shows F01 = 1.00 with nothing keyed into it', () => {
    // The evidence that the Fnn default is 1: no value was ever entered here.
    expect(shownF(enteredMachine(), 1)).toBe('1.00');
  });

  it('enters 5,000 for years two through five at C02', () => {
    expect(shownC(enteredMachine(), 2)).toBe('5,000.00');
  });

  it('groups the four equal 5,000 flows into one slot via F02 = 4', () => {
    // Frequencies display at the DEC setting, so 4.00 rather than 4.
    expect(shownF(enteredMachine(), 2)).toBe('4.00');
  });

  it('enters the year-6 inflow at C03', () => {
    expect(shownC(enteredMachine(), 3)).toBe('4,000.00');
  });

  it('shows F03 = 1.00 with nothing keyed into it', () => {
    expect(shownF(enteredMachine(), 3)).toBe('1.00');
  });
});

describe('editing cash-flow data (guidebook p. 47)', () => {
  it('UP from F03 returns to C03', () => {
    // Navigation is the state machine's job; what this module owns is that the
    // slot still holds 4,000.00 when the walk arrives back at it.
    expect(shownC(enteredMachine(), 3)).toBe('4,000.00');
  });

  it('2ND DEL removes the third flow, leaving C03 a vacant slot reading 0.00', () => {
    const s = deleteFlow(enteredMachine(), 3);
    expect(shownC(s, 3)).toBe('0.00');
    expect(flowCount(s)).toBe(2);
  });

  it('2ND DEL removes the amount AND its frequency together', () => {
    // C03/F03 were 4,000 and 1. Deleting consumes position 3 rather than blanking
    // it, so the vacated slot reads back at the documented defaults.
    const s = deleteFlow(enteredMachine(), 3);
    expect(shownF(s, 3)).toBe('1.00');
  });

  it('two UP presses reach C02, still holding 5,000', () => {
    const s = deleteFlow(enteredMachine(), 3);
    expect(shownC(s, 2)).toBe('5,000.00');
  });

  it('2ND INS lands the new flow AT C02', () => {
    expect(shownC(editedMachine(), 2)).toBe('4,000.00');
  });

  it('the inserted flow takes the Fnn default of 1 without it being keyed', () => {
    // F02 was 4 before the insert; the fresh slot does not inherit it.
    expect(shownF(editedMachine(), 2)).toBe('1.00');
  });

  it('the displaced 5,000 renumbers up to C03', () => {
    expect(shownC(editedMachine(), 3)).toBe('5,000.00');
  });

  it('the displaced frequency 4 travels with its amount to F03', () => {
    // The guidebook prints "4.0" here -- the only one-decimal display in a table
    // that is otherwise uniformly two-decimal (4,000.00 / 1.00 / 5,000.00) at the
    // DEC=2 default in force throughout. A typesetting slip; 4.00 is what the LCD
    // shows.
    expect(shownF(editedMachine(), 3)).toBe('4.00');
  });

  it('leaves the edited stream as CFo=-7000; 3000x1; 4000x1; 5000x4', () => {
    const s = editedMachine();
    expect(flowCount(s)).toBe(3);
    expect(s.groups).toEqual([
      { C: 3000, F: 1 },
      { C: 4000, F: 1 },
      { C: 5000, F: 4 },
    ]);
  });
});

describe('computing NPV and IRR for the machine (guidebook p. 48)', () => {
  it('NPV opens on I at its 0 default', () => {
    expect(shown(editedMachine().I)).toBe('0.00');
  });

  it('enters a 20% per-period discount rate', () => {
    expect(shown(setI(editedMachine(), 20).I)).toBe('20.00');
  });

  it('computes NPV = 7,266.44 at 20%', () => {
    // ARBITER CASE for the NPV exponent. Guidebook: "NPV is $7,266.44".
    const s = setI(editedMachine(), 20);
    expect(shown(solveNPV(s))).toBe('7,266.44');
    expect(solveNPV(s)).toBeCloseTo(7266.4394718793, 8);
  });

  it('computes IRR = 52.71%', () => {
    // ARBITER CASE for IRR. Guidebook: "IRR is 52.71%". Reported in percent.
    const s = setI(editedMachine(), 20);
    expect(shown(solveIRR(s))).toBe('52.71');
    expect(solveIRR(s)).toBeCloseTo(52.7053745072, 8);
  });

  it('ignores the discount rate when solving IRR', () => {
    // No rate is consumed: IRR is what is being solved for. I=20 must not leak in.
    const base = editedMachine();
    expect(solveIRR(setI(base, 20))).toBe(solveIRR(setI(base, 0)));
    expect(solveIRR(setI(base, 999))).toBe(solveIRR(base));
  });

  it('drives NPV to zero at the IRR', () => {
    const s = editedMachine();
    const atIrr = setI(s, solveIRR(s));
    expect(solveNPV(atIrr)).toBeCloseTo(0, 6);
  });

  it('computes against the EDITED stream, not the entered one', () => {
    // Guard against a run that skips the edit steps: the pre-edit stream discounts
    // the same amounts over different periods and gives 7,625.99 instead.
    const preEdit = setI(enteredMachine(), 20);
    expect(shown(solveNPV(preEdit))).toBe('7,625.99');
  });
});

describe('the corrected NPV discount exponent (guidebook p. 76)', () => {
  /**
   * The appendix exactly as rendered: (1+i)^(-S_j-1), with S_j the CUMULATIVE
   * count through group j. Reproduced here only to show what it yields.
   */
  const printedForm = (s: CashFlowState): number => {
    const i = s.I / 100;
    let S = 0;
    let total = s.CFo;
    for (const g of s.groups) {
      S += g.F;
      total += g.C * Math.pow(1 + i, -S - 1) * ((1 - Math.pow(1 + i, -g.F)) / i);
    }
    return total;
  };

  it('reproduces the guidebook answer where the printed exponent does not', () => {
    const s = setI(editedMachine(), 20);
    expect(shown(solveNPV(s))).toBe('7,266.44'); // S_{j-1}: what p. 48 states
    expect(shown(printedForm(s))).toBe('277.46'); // -S_j-1 read literally
  });

  it('leaves group 1 undiscounted, since S_0 = 0', () => {
    // A single group of one flow at rate i is worth exactly CF/(1+i): it lands at
    // period 1, not period 2. The literal exponent would discount it twice.
    let s = setCFo(CASH_FLOW_DEFAULTS, 0);
    s = setFlow(s, 1, 1100);
    s = setI(s, 10);
    expect(solveNPV(s)).toBeCloseTo(1000, 9);
  });
});

describe('lease with uneven payments (guidebook p. 49)', () => {
  /**
   * A 36-month lease, beginning-of-period payments: 4 months $0, 8 at $5000,
   * 3 at $0, 9 at $6000, 2 at $0, 10 at $7000.
   *
   * Beginning-of-period timing is modelled structurally -- month 1 of the opening
   * $0 group is promoted into CFo and the rest shift back a slot -- because the
   * TVM worksheet's BGN/END setting does not reach this worksheet.
   */
  const lease = (): CashFlowState => {
    let s = CASH_FLOW_DEFAULTS; // 2ND RESET ENTER, CF -> CFo = 0, left alone
    s = setFrequency(s, 1, 3); // DOWN (C01 left at 0) DOWN 3 ENTER
    s = setFlow(s, 2, -5000); // DOWN 5000 +/- ENTER
    s = setFrequency(s, 2, 8); // DOWN 8 ENTER
    s = setFrequency(s, 3, 3); // DOWN (C03 left at 0) DOWN 3 ENTER
    s = setFlow(s, 4, -6000); // DOWN 6000 +/- ENTER
    s = setFrequency(s, 4, 9); // DOWN 9 ENTER
    s = setFrequency(s, 5, 2); // DOWN (C05 left at 0) DOWN 2 ENTER
    s = setFlow(s, 6, -7000); // DOWN 7000 +/- ENTER
    s = setFrequency(s, 6, 10); // DOWN 10 ENTER
    return s;
  };

  it('resets CFo to 0 and leaves it there', () => {
    expect(shown(CASH_FLOW_DEFAULTS.CFo)).toBe('0.00');
  });

  it('steps past C01, leaving it at its 0 default', () => {
    expect(shownC(lease(), 1)).toBe('0.00');
  });

  it('keys F01 = 3 for the three remaining $0 months', () => {
    // Three, not four: month 1 was consumed by CFo.
    expect(shownF(lease(), 1)).toBe('3.00');
  });

  it('enters the $5000 outflow at C02', () => {
    // The guidebook prints "-5000.00" here with no thousands separator, while
    // p. 47 prints "-7,000.00" for the same magnitude and p. 49's own NPV result
    // prints "-138,088.44" WITH one. The BA II Plus groups digits unconditionally.
    expect(shownC(lease(), 2)).toBe('-5,000.00');
  });

  it('groups eight months at $5000', () => {
    expect(shownF(lease(), 2)).toBe('8.00');
  });

  it('leaves C03 at 0 for the third group', () => {
    expect(shownC(lease(), 3)).toBe('0.00');
  });

  it('keys F03 = 3', () => {
    expect(shownF(lease(), 3)).toBe('3.00');
  });

  it('enters the $6000 outflow at C04', () => {
    // The p. 49 time-line diagram labels this group "$600" -- off by a factor of
    // ten from the schedule, the keystrokes and the displays, which all say 6000.
    expect(shownC(lease(), 4)).toBe('-6,000.00');
  });

  it('groups nine months at $6000', () => {
    expect(shownF(lease(), 4)).toBe('9.00');
  });

  it('leaves C05 at 0 for the fifth group', () => {
    expect(shownC(lease(), 5)).toBe('0.00');
  });

  it('keys F05 = 2', () => {
    expect(shownF(lease(), 5)).toBe('2.00');
  });

  it('enters the $7000 outflow at C06', () => {
    expect(shownC(lease(), 6)).toBe('-7,000.00');
  });

  it('groups ten months at $7000', () => {
    expect(shownF(lease(), 6)).toBe('10.00');
  });

  it('covers all 36 months across six slots', () => {
    const months = lease().groups.reduce((sum, g) => sum + g.F, 0);
    expect(months + 1).toBe(36); // +1 for CFo, which occupies month 1
    expect(flowCount(lease())).toBe(6);
  });

  it('NPV opens on I at its 0 default', () => {
    expect(shown(lease().I)).toBe('0.00');
  });

  it('displays I = 0.83 after keying 10 / 12 ENTER', () => {
    // The worksheet has no P/Y mechanism, so an annual 10% is divided by hand.
    const s = setI(lease(), toInternal(10 / 12));
    expect(shown(s.I)).toBe('0.83');
  });

  it('stores I unrounded behind that 0.83 display', () => {
    const s = setI(lease(), toInternal(10 / 12));
    expect(s.I).toBe(0.8333333333333); // 13 significant digits, not 0.83
  });

  it('computes NPV = -138,088.44', () => {
    // ARBITER CASE. Negative because every flow is an outflow with no offsetting
    // inflow: a present value of payments, not a profitability signal.
    const s = setI(lease(), toInternal(10 / 12));
    expect(shown(solveNPV(s))).toBe('-138,088.44');
    expect(solveNPV(s)).toBeCloseTo(-138088.4358221567, 6);
  });

  it('would miss by $92.89 if the stored rate were rounded to the display', () => {
    // The precision rule this example exists to pin down: DEC is cosmetic, and an
    // implementation that stored the displayed 0.83 fails here.
    const rounded = setI(lease(), 0.83);
    expect(shown(solveNPV(rounded))).toBe('-138,181.32');
  });

  it('lets zero-valued groups contribute nothing while still advancing the periods', () => {
    // C01/C03/C05 are all 0. Dropping them entirely -- rather than letting their
    // frequencies advance S_j -- would mis-time every later payment.
    const s = setI(lease(), toInternal(10 / 12));
    const withoutTiming = setI(
      { ...s, groups: s.groups.filter((g) => g.C !== 0) },
      toInternal(10 / 12),
    );
    expect(shown(solveNPV(withoutTiming))).not.toBe('-138,088.44');
  });
});

describe('sign changes (guidebook p. 45-46)', () => {
  const streamOf = (CFo: number, amounts: number[]): CashFlowState =>
    amounts.reduce((s, c, k) => setFlow(s, k + 1, c), setCFo(CASH_FLOW_DEFAULTS, CFo));

  it('counts CFo as part of the stream', () => {
    // The p. 45 one-sign-change diagram flips only CFo downward.
    expect(signChanges(streamOf(-7000, [3000, 4000, 5000]))).toBe(1);
    expect(signChanges(streamOf(7000, [3000, 4000, 5000]))).toBe(0);
  });

  it('reports no sign change when every flow shares a sign', () => {
    expect(signChanges(streamOf(1000, [2000, 3000]))).toBe(0);
    expect(signChanges(streamOf(-1000, [-2000, -3000]))).toBe(0);
  });

  it('does not count a zero flow as a sign change', () => {
    // Implied by the lease, which carries CFo=0 and three zero groups alongside
    // negative flows and is treated as an ordinary problem.
    expect(signChanges(streamOf(0, [0, -5000, 0, -6000]))).toBe(0);
    expect(signChanges(streamOf(-1000, [0, 2000]))).toBe(1);
  });

  it('counts each flip in an alternating stream', () => {
    expect(signChanges(streamOf(-1, [2, -3, 4]))).toBe(3);
  });

  it('is unaffected by frequency', () => {
    // Repeating a flow cannot flip its sign.
    const s = setFrequency(streamOf(-1000, [500]), 1, 9);
    expect(signChanges(s)).toBe(1);
  });
});

describe('IRR error conditions', () => {
  it('raises Error 5 when the stream has no sign change', () => {
    // p. 84: "the calculator computed IRR without at least one sign change in the
    // cash-flow list".
    let s = setCFo(CASH_FLOW_DEFAULTS, 1000);
    s = setFlow(s, 1, 2000);
    expect(() => solveIRR(s)).toThrow(CalculatorError);
    try {
      solveIRR(s);
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.NoSolution);
    }
  });

  it('raises Error 5 for an all-outflow stream', () => {
    let s = setCFo(CASH_FLOW_DEFAULTS, -1000);
    s = setFlow(s, 1, -500);
    expect(() => solveIRR(s)).toThrow(/Error 5/);
  });

  it('raises Error 5 when the whole stream is zero', () => {
    // Degenerate, but no sign change means Error 5 by the p. 84 rule.
    const s = setFrequency(CASH_FLOW_DEFAULTS, 1, 3);
    expect(() => solveIRR(s)).toThrow(/Error 5/);
  });

  it('raises Error 5 on the lease, which is all outflows', () => {
    let s = setFrequency(CASH_FLOW_DEFAULTS, 1, 3);
    s = setFrequency(setFlow(s, 2, -5000), 2, 8);
    expect(() => solveIRR(s)).toThrow(/Error 5/);
  });

  it('raises Error 7 when a sign change exists but no real root does', () => {
    // NPV = -1 + 3x - 3x^2 where x = 1/(1+i). Its discriminant is negative, so the
    // curve never reaches zero for any rate -- yet the stream has two sign changes,
    // so the Error 5 guard does not fire. The guidebook allows exactly this:
    // "the calculator might not find IRR, even if a solution exists ... Error 7".
    let s = setCFo(CASH_FLOW_DEFAULTS, -1);
    s = setFlow(s, 1, 3);
    s = setFlow(s, 2, -3);
    expect(signChanges(s)).toBe(2);
    try {
      solveIRR(s);
      expect.unreachable('expected Error 7');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.IterationLimitExceeded);
    }
  });
});

describe('IRR with multiple roots (guidebook p. 46)', () => {
  it('reports the root closest to zero', () => {
    // NPV = -1000 + 2500x - 1540x^2 factors to roots at x = 10/11 and x = 5/7,
    // i.e. IRR = 10% and IRR = 40%. Two sign changes, two solutions.
    //
    // UNSPECIFIED: p. 46 says the calculator "displays the one closest to zero"
    // but not in what sense, nor whether negative roots are candidates, nor what
    // it seeds from. No worked example exercises a multi-root stream, so TI's
    // exact choice is not recoverable from the documentation. Smallest |IRR| is
    // the plain reading.
    let s = setCFo(CASH_FLOW_DEFAULTS, -1000);
    s = setFlow(s, 1, 2500);
    s = setFlow(s, 2, -1540);
    expect(signChanges(s)).toBe(2);
    expect(shown(solveIRR(s))).toBe('10.00');

    // Both really are roots.
    expect(solveNPV(setI(s, 10))).toBeCloseTo(0, 9);
    expect(solveNPV(setI(s, 40))).toBeCloseTo(0, 9);
  });

  it('finds a negative root when that is the one nearest zero', () => {
    // A stream whose only root is a loss: pay 1000, get 900 back one period later.
    let s = setCFo(CASH_FLOW_DEFAULTS, -1000);
    s = setFlow(s, 1, 900);
    expect(shown(solveIRR(s))).toBe('-10.00');
  });
});

describe('Fnn range (guidebook p. 84, Error 4)', () => {
  it('accepts the printed bounds 0.5 and 9,999', () => {
    expect(flowAt(setFrequency(CASH_FLOW_DEFAULTS, 1, MIN_FREQUENCY), 1).F).toBe(0.5);
    expect(flowAt(setFrequency(CASH_FLOW_DEFAULTS, 1, MAX_FREQUENCY), 1).F).toBe(9999);
  });

  it('raises Error 4 below 0.5', () => {
    for (const F of [0, 0.25, 0.49, -1]) {
      try {
        setFrequency(CASH_FLOW_DEFAULTS, 1, F);
        expect.unreachable(`expected Error 4 for F=${F}`);
      } catch (e) {
        expect((e as CalculatorError).code).toBe(ErrorCode.OutOfRange);
      }
    }
  });

  it('raises Error 4 above 9,999', () => {
    for (const F of [9999.5, 10000, 1e6]) {
      expect(() => setFrequency(CASH_FLOW_DEFAULTS, 1, F)).toThrow(/Error 4/);
    }
  });

  it('uses a non-integral frequency as-is in the summation', () => {
    // UNSPECIFIED: p. 43 describes Fnn as a count of occurrences, which reads as an
    // integer, while the p. 84 error bound of 0.5 implies fractions are accepted.
    // What a frequency of 2.5 MEANS is never explained, and whether the hardware
    // truncates, rounds or uses it as-is is not stated. Used as-is here: it is at
    // least arithmetically defined, since n_j only ever appears as an exponent.
    let s = setCFo(CASH_FLOW_DEFAULTS, 0);
    s = setFrequency(setFlow(s, 1, 100), 1, 2.5);
    s = setI(s, 10);
    const i = 0.1;
    expect(solveNPV(s)).toBeCloseTo(100 * ((1 - Math.pow(1 + i, -2.5)) / i), 9);
  });

  it('rejects an out-of-range frequency at solve time, not just at entry', () => {
    const s: CashFlowState = { CFo: -100, groups: [{ C: 50, F: 0 }], I: 10 };
    expect(() => solveNPV(s)).toThrow(/Error 4/);
    expect(() => solveIRR(s)).toThrow(/Error 4/);
  });
});

describe('the LN boundary at I = -100 (guidebook p. 84, Error 5)', () => {
  // p. 84 lists under Error 5: "TVM, Cash Flow, and Bond worksheets: the LN
  // (logarithm) input is not > 0 during calculations." The p. 76 expression holds
  // exactly one transcendental -- the power (1+i)^(-n_j), which a decimal machine
  // evaluates as e^(-n_j x ln(1+i)). Its LN input is (1+i), so the clause bites at
  // 1 + i <= 0, i.e. I <= -100.
  //
  // Regression guard: before this was implemented, log1p(i <= -1) returned NaN and
  // toInternal reported it as Error 1, "Overflow -- result is not a number".
  // Nothing overflows here, and none of Error 1's p. 84 causes cover a NaN.

  it('raises Error 5 at exactly I = -100, where the LN input is 0', () => {
    const s = setI(editedMachine(), -100);
    try {
      solveNPV(s);
      expect.unreachable('expected Error 5');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.NoSolution);
    }
  });

  it('raises Error 5 below I = -100, where the LN input is negative', () => {
    for (const I of [-100.0001, -150, -200, -1e6]) {
      const s = setI(editedMachine(), I);
      expect(() => solveNPV(s), `I=${I}`).toThrow(/Error 5/);
    }
  });

  it('does not raise Error 1 at the boundary', () => {
    // The specific misreport this guard replaces.
    for (const I of [-100, -150]) {
      try {
        solveNPV(setI(editedMachine(), I));
      } catch (e) {
        expect((e as CalculatorError).code).not.toBe(ErrorCode.Overflow);
      }
    }
  });

  it('still computes just above the boundary, where the LN input is positive', () => {
    // I = -99.99 is a lawful, if absurd, rate: 1 + i = 1e-4 > 0. The discount
    // factors are enormous but finite, and the calculator has no cause to refuse.
    const v = solveNPV(setI(editedMachine(), -99));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });

  it('leaves a stream with nothing to discount alone at any rate', () => {
    // No group holds a non-zero amount, so the summation evaluates no power of
    // (1+i) and takes no LN at all -- NPV is plain CFo. "During calculations"
    // (p. 84) is the operative phrase: the LN never happens.
    const empty = setI(setCFo(CASH_FLOW_DEFAULTS, -500), -150);
    expect(shown(solveNPV(empty))).toBe('-500.00');

    const allZero = setI(setFrequency(setCFo(CASH_FLOW_DEFAULTS, -500), 1, 3), -150);
    expect(shown(solveNPV(allZero))).toBe('-500.00');
  });

  it('never lets IRR reach the boundary', () => {
    // The probe grid stops at i = -0.9999, so the LN input stays positive
    // throughout the solve. IRR takes no rate from the user, so there is no way
    // to drive it past -100 from outside either.
    const s = setI(editedMachine(), -150); // I is ignored by IRR
    expect(shown(solveIRR(s))).toBe('52.71');
  });
});

describe('NPV at a zero rate', () => {
  it('falls back to the undiscounted sum', () => {
    // UNSPECIFIED: the annuity factor (1-(1+i)^-n)/i is 0/0 at i = 0 and the
    // guidebook gives no i = 0 variant. Its limit is n_j, so NPV is the plain sum.
    // I = 0 is the default, so NPV DOWN CPT straight after a reset lands here.
    const s = editedMachine(); // I defaults to 0
    expect(s.I).toBe(0);
    // -7000 + 3000x1 + 4000x1 + 5000x4
    expect(shown(solveNPV(s))).toBe('20,000.00');
  });

  it('is continuous across the zero-rate branch', () => {
    // Guards the annuity factor's numerical stability, not just the i = 0 limit.
    // Transcribing (1-(1+i)^-n)/i literally returns 20,000.0022 at I = 1e-9 --
    // cents of pure cancellation noise at a rate of one part in 1e11.
    //
    // The bound tightens with the rate because NPV genuinely declines as I rises:
    // dNPV/di is about -87,500 here, so I = 1e-5 really is worth 19,999.99. Only
    // deviation beyond that slope is an artefact.
    const s = editedMachine();
    for (const I of [1e-9, 1e-7]) {
      expect(solveNPV(setI(s, I))).toBeCloseTo(20000, 3);
    }
    expect(solveNPV(setI(s, 1e-5))).toBeCloseTo(19999.99, 2);
  });
});

describe('insert and delete mechanics (guidebook p. 44)', () => {
  it('deletes the middle flow of the guidebook diagram, shifting the rest down', () => {
    // 5,000 / 8,000 / 10,000 -> 5,000 / 10,000. Position 3 is consumed, not blanked.
    let s = setFlow(setFlow(setFlow(CASH_FLOW_DEFAULTS, 1, 5000), 2, 8000), 3, 10000);
    s = deleteFlow(s, 2);
    expect(flowCount(s)).toBe(2);
    expect(shownC(s, 1)).toBe('5,000.00');
    expect(shownC(s, 2)).toBe('10,000.00');
    expect(shownC(s, 3)).toBe('0.00');
  });

  it('inserts the middle flow of the guidebook diagram, renumbering upward', () => {
    // 5,000 / 8,000 -> 5,000 / 7,000 / 8,000.
    let s = setFlow(setFlow(CASH_FLOW_DEFAULTS, 1, 5000), 2, 8000);
    s = insertFlow(s, 2, 7000);
    expect(flowCount(s)).toBe(3);
    expect(shownC(s, 1)).toBe('5,000.00');
    expect(shownC(s, 2)).toBe('7,000.00');
    expect(shownC(s, 3)).toBe('8,000.00');
  });

  it('carries each frequency along with its amount when flows shift', () => {
    let s = setFrequency(setFlow(CASH_FLOW_DEFAULTS, 1, 5000), 1, 6);
    s = setFrequency(setFlow(s, 2, 8000), 2, 7);
    s = insertFlow(s, 1, 1000);
    expect(shownF(s, 1)).toBe('1.00'); // the fresh slot
    expect(shownF(s, 2)).toBe('6.00'); // travelled with 5,000
    expect(shownF(s, 3)).toBe('7.00'); // travelled with 8,000
  });

  it('deleting a slot past the end of the list does nothing', () => {
    const s = enteredMachine();
    expect(deleteFlow(s, 10)).toEqual(s);
  });

  it('caps insertion at 24 groups', () => {
    // UNSPECIFIED: the guidebook says insertion increases the following flows "up
    // to the maximum of 24" but not what happens to the flow pushed off the end.
    // Read as the list saturating rather than erroring.
    let s = CASH_FLOW_DEFAULTS;
    for (let n = 1; n <= MAX_CASH_FLOWS; n++) s = setFlow(s, n, n * 100);
    expect(flowCount(s)).toBe(24);

    s = insertFlow(s, 1, 999);
    expect(flowCount(s)).toBe(MAX_CASH_FLOWS);
    expect(shownC(s, 1)).toBe('999.00');
    expect(shownC(s, 24)).toBe('2,300.00'); // the old C24 = 2,400 fell off the end
  });

  it('rejects a slot outside 1-24', () => {
    // Unreachable from the keypad -- the hardware cannot navigate past C24 -- but
    // guarded because this module is callable directly.
    for (const n of [0, 25, 1.5, -3]) {
      expect(() => flowAt(CASH_FLOW_DEFAULTS, n)).toThrow(/Error 4/);
      expect(() => setFlow(CASH_FLOW_DEFAULTS, n, 1)).toThrow(/Error 4/);
      expect(() => deleteFlow(CASH_FLOW_DEFAULTS, n)).toThrow(/Error 4/);
    }
  });
});

describe('worksheet state', () => {
  it('defaults CFo, I and the group list to empty', () => {
    expect(CASH_FLOW_DEFAULTS.CFo).toBe(0);
    expect(CASH_FLOW_DEFAULTS.I).toBe(0);
    expect(flowCount(CASH_FLOW_DEFAULTS)).toBe(0);
    expect(DEFAULT_FREQUENCY).toBe(1);
  });

  it('is frozen against accidental mutation', () => {
    expect(Object.isFrozen(CASH_FLOW_DEFAULTS)).toBe(true);
  });

  it('reads a vacant slot as amount 0, frequency 1', () => {
    expect(flowAt(CASH_FLOW_DEFAULTS, 24)).toEqual({ C: 0, F: 1 });
  });

  it('treats every editor as pure', () => {
    const s = enteredMachine();
    const snapshot = structuredClone(s);
    deleteFlow(s, 1);
    insertFlow(s, 1, 5);
    setFlow(s, 1, 42);
    setFrequency(s, 1, 9);
    setCFo(s, 1);
    setI(s, 5);
    expect(s).toEqual(snapshot);
  });

  it('leaves the stream untouched when computing', () => {
    // NPV and IRR are compute-only registers owned by the state machine, not
    // stored here; solving must have no effect on the worksheet. This is the
    // module's half of the p. 48 observation that IRR still reads 0.00 straight
    // after NPV was computed -- computing one does not populate the other.
    const s = setI(editedMachine(), 20);
    const snapshot = structuredClone(s);
    solveNPV(s);
    solveIRR(s);
    expect(s).toEqual(snapshot);
  });

  it('keeps CFo independent of the group list', () => {
    // CFo occurs exactly once and has no frequency: there is no F00.
    const s = setCFo(enteredMachine(), -1234);
    expect(s.CFo).toBe(-1234);
    expect(flowCount(s)).toBe(3);
  });

  it('rounds entered values into the 13-digit internal store', () => {
    const s = setCFo(CASH_FLOW_DEFAULTS, 1 / 3);
    expect(s.CFo).toBe(0.3333333333333);
  });
});

describe('an empty stream', () => {
  it('gives NPV = CFo when no groups are entered', () => {
    const s = setI(setCFo(CASH_FLOW_DEFAULTS, -500), 20);
    expect(shown(solveNPV(s))).toBe('-500.00');
  });

  it('gives NPV = 0.00 on a freshly cleared worksheet', () => {
    expect(shown(solveNPV(CASH_FLOW_DEFAULTS))).toBe('0.00');
  });

  it('raises Error 5 for IRR on a freshly cleared worksheet', () => {
    expect(() => solveIRR(CASH_FLOW_DEFAULTS)).toThrow(/Error 5/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  BREAKEVEN_DEFAULTS,
  computeBreakeven,
  solveFC,
  solveP,
  solvePFT,
  solveQ,
  solveVC,
  type BreakevenState,
} from './breakeven.js';
import { formatValue } from '../display/format.js';
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const be = (o: Partial<BreakevenState>): BreakevenState => ({ ...BREAKEVEN_DEFAULTS, ...o });
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/**
 * The guidebook's canoe company (p. 72): paddles sell for $20, unit variable
 * cost is $15, fixed costs are $3,000. PFT is left at 0, which is what makes the
 * computed Q a breakeven quantity rather than a target-profit quantity.
 */
const CANOE = be({ FC: 3000, VC: 15, P: 20, PFT: 0 });

describe('guidebook breakeven example (p. 72)', () => {
  // other-worksheets-breakeven-enter-fc
  it('displays FC = 3,000.00 with a thousands separator', () => {
    expect(shown(CANOE.FC)).toBe('3,000.00');
  });

  // other-worksheets-breakeven-enter-vc
  it('displays VC = 15.00', () => {
    expect(shown(CANOE.VC)).toBe('15.00');
  });

  // other-worksheets-breakeven-enter-price
  it('displays P = 20.00', () => {
    expect(shown(CANOE.P)).toBe('20.00');
  });

  // other-worksheets-breakeven-pft-left-at-zero
  it('displays PFT = 0.00 when left as-is', () => {
    // The example steps onto PFT and keys nothing; the worksheet is not
    // auto-cleared on entry, so this leans on a prior reset having zeroed it.
    expect(shown(CANOE.PFT)).toBe('0.00');
  });

  // other-worksheets-breakeven-quantity -- the project's required parity example.
  it('computes Q = 600.00', () => {
    expect(shown(solveQ(CANOE))).toBe('600.00');
  });

  it('computes Q = 600 exactly, not merely to two displayed decimals', () => {
    expect(solveQ(CANOE)).toBe(600);
  });

  // appendix-formulas-breakeven-quantity -- the SAME keystroke sequence and the
  // same 600.00, filed a second time under the appendix's formula section
  // (tests/golden/appendix-formulas.json) rather than the worksheet chapter's.
  // Asserted explicitly so the id is not silently uncovered: that golden's point
  // is that breakeven is not its own formula but the PFT = 0 solution of the one
  // printed equation, so it is pinned here through solvePFT, not just solveQ.
  it('is the PFT = 0 solution of the printed equation, not a separate formula', () => {
    expect(shown(solveQ(CANOE))).toBe('600.00');
    // 0 = 20Q - (3000 + 15Q) at Q = 600: the identity the golden's note spells out.
    expect(solvePFT(be({ ...CANOE, Q: 600 }))).toBe(0);
  });
});

describe('solving for each unknown', () => {
  // Each solve is fed the other four values from the p. 72 example, including
  // its answer Q = 600, and must return the value the example started with.
  const solved = be({ ...CANOE, Q: 600 });

  it('solves FC', () => {
    expect(shown(solveFC(solved))).toBe('3,000.00');
  });

  it('solves VC', () => {
    expect(shown(solveVC(solved))).toBe('15.00');
  });

  it('solves P', () => {
    expect(shown(solveP(solved))).toBe('20.00');
  });

  it('solves PFT', () => {
    expect(shown(solvePFT(solved))).toBe('0.00');
  });

  it('solves Q', () => {
    expect(shown(solveQ(solved))).toBe('600.00');
  });

  it('dispatches every variable through computeBreakeven', () => {
    expect(computeBreakeven(solved, 'FC')).toBe(3000);
    expect(computeBreakeven(solved, 'VC')).toBe(15);
    expect(computeBreakeven(solved, 'P')).toBe(20);
    expect(computeBreakeven(solved, 'PFT')).toBe(0);
    expect(computeBreakeven(solved, 'Q')).toBe(600);
  });

  it('satisfies the printed identity PFT = PQ - (FC + VCQ) at the solved point', () => {
    const s = be({ FC: 3000, VC: 15, P: 20, Q: 600 });
    expect(solvePFT(s)).toBe(s.P * s.Q - (s.FC + s.VC * s.Q));
  });
});

describe('errors', () => {
  it('raises Error 1 computing Q when P = VC and there is a fixed cost to cover', () => {
    const s = be({ FC: 3000, VC: 20, P: 20, PFT: 0 });
    expect(() => solveQ(s)).toThrow(CalculatorError);
    try {
      solveQ(s);
      expect.unreachable('solveQ should have raised');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 computing Q when P = VC and FC + PFT is zero', () => {
    // The 0/0 branch: the spec notes every quantity satisfies this state, but a
    // zero divisor is still a zero divisor on the hardware.
    const s = be({ FC: 0, VC: 20, P: 20, PFT: 0 });
    expect(() => solveQ(s)).toThrow(CalculatorError);
    expect(() => solveQ(s)).toThrowError(/Error 1/);
  });

  it('raises Error 1 computing Q when the stored P and VC coincide at 13 digits', () => {
    // The store is what makes these equal, not any tolerance inside the solve:
    // 0.1 + 0.2 is 0.30000000000000004 as a double but lands on 0.3 once rounded
    // into the 13-digit internal store, which is what the worksheet holds.
    const s = be({ FC: 3000, VC: toInternal(0.1 + 0.2), P: 0.3, PFT: 0 });
    expect(s.VC).toBe(s.P);
    expect(() => solveQ(s)).toThrow(CalculatorError);
  });

  it('does not swallow a genuine small margin', () => {
    // The mirror of the case above: a difference that survives the store is a
    // real one and must divide, however thin. Guards against a well-meaning
    // epsilon creeping into the pole test. The margin is a power of two so the
    // subtraction is exact -- this asserts the pole's behaviour, not the
    // engine's double-vs-decimal cancellation, which is a separate concern.
    const s = be({ FC: 1, VC: 1, P: 1 + Math.pow(2, -16), PFT: 0 });
    expect(solveQ(s)).toBe(65536);
  });

  it('raises Error 1 computing P when Q = 0', () => {
    const s = be({ FC: 3000, VC: 15, PFT: 0, Q: 0 });
    try {
      solveP(s);
      expect.unreachable('solveP should have raised');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 computing VC when Q = 0', () => {
    const s = be({ FC: 3000, P: 20, PFT: 0, Q: 0 });
    try {
      solveVC(s);
      expect.unreachable('solveVC should have raised');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 when a computed Q overflows the calculator range', () => {
    const s = be({ FC: 1e99, VC: 0, P: 1e-50, PFT: 0 });
    try {
      solveQ(s);
      expect.unreachable('solveQ should have raised');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('does not raise for FC or PFT when Q = 0 -- neither divides', () => {
    const s = be({ FC: 3000, VC: 15, P: 20, Q: 0 });
    expect(solvePFT(s)).toBe(-3000); // sell nothing, lose the fixed cost
    expect(solveFC(be({ ...s, PFT: -3000 }))).toBe(3000);
  });
});

describe('edge cases', () => {
  it('leaves a fractional Q unrounded', () => {
    // 3000 / 5.5 = 545.4545...; the guidebook prints no rounding rule, so the
    // internal value keeps its 13 digits and only the display rounds.
    const s = be({ FC: 3000, VC: 15, P: 20.5, PFT: 0 });
    const q = solveQ(s);
    expect(Number.isInteger(q)).toBe(false);
    expect(q).toBeCloseTo(545.4545454545, 9);
    expect(shown(q)).toBe('545.45');
  });

  it('treats a nonzero PFT as a target-profit solve, not a breakeven solve', () => {
    // The p. 72 sequence keys nothing into PFT. A prior session leaving PFT
    // nonzero silently changes the answer; a faithful engine reproduces that.
    expect(solveQ(be({ ...CANOE, PFT: 500 }))).toBe(700);
    expect(solveQ(CANOE)).toBe(600);
  });

  it('returns a quantity below breakeven for a negative target profit', () => {
    // Below the breakeven quantity the operation runs at a loss (p. 71).
    expect(solveQ(be({ ...CANOE, PFT: -1000 }))).toBe(400);
  });

  it('computes a loss for quantities under the breakeven point', () => {
    expect(solvePFT(be({ ...CANOE, Q: 400 }))).toBe(-1000);
    expect(solvePFT(be({ ...CANOE, Q: 600 }))).toBe(0);
    expect(solvePFT(be({ ...CANOE, Q: 800 }))).toBe(1000);
  });

  it('applies no sign convention to FC and VC', () => {
    // A TVM-style reading of FC as an outflow (-3000) would flip Q's sign. The
    // p. 72 example rules that out: the entered magnitude is positive.
    expect(solveQ(CANOE)).toBe(600);
    expect(solveQ(be({ ...CANOE, FC: -3000 }))).toBe(-600);
  });

  it('handles a zero fixed cost -- breakeven at zero units, not at the first unit', () => {
    // With nothing to recover, Q = (0 + 0)/5 = 0: the operation is already at
    // breakeven before a single paddle is sold. Every unit after that is profit,
    // which is a different statement from breaking even ON the first unit.
    expect(solveQ(be({ FC: 0, VC: 15, P: 20, PFT: 0 }))).toBe(0);
    expect(solvePFT(be({ FC: 0, VC: 15, P: 20, Q: 1 }))).toBe(5);
  });

  it('starts from all-zero defaults, frozen', () => {
    expect(BREAKEVEN_DEFAULTS).toEqual({ FC: 0, VC: 0, P: 0, PFT: 0, Q: 0 });
    expect(Object.isFrozen(BREAKEVEN_DEFAULTS)).toBe(true);
  });

  it('cannot solve Q from the cleared defaults -- P and VC are both zero', () => {
    // 2ND CLR WORK zeroes all five (p. 71), which parks the worksheet exactly on
    // the P = VC pole.
    expect(() => solveQ(BREAKEVEN_DEFAULTS)).toThrow(CalculatorError);
  });
});

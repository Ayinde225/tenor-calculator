import { describe, it, expect, vi } from 'vitest';

// The central registry (worksheet-registry.ts) is wired up by another step, so
// BOND is not in it yet. Inject it here so the real reducer -- which reads the
// module-level WORKSHEETS -- routes bond keys, and every test below drives the
// machine through actual key presses rather than calling descriptor functions.
// Merging over the real registry keeps PROFIT/AMORT live and is forward-compatible
// with the eventual central wiring.
vi.mock('../worksheet-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../worksheet-registry.js')>();
  const { BOND } = await import('./bond-nav.js');
  return { ...actual, WORKSHEETS: { ...actual.WORKSHEETS, BOND } };
});

import { reduce, reduceAll, project, INITIAL_STATE } from '../machine.js';
import { parseKeySequence } from '../keys.js';
import { renderFlat } from '../display-state.js';
import { ErrorCode } from '../../errors.js';
import type { CalculatorState } from '../state.js';
import { assertRegistryConsistent } from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { BOND } from './bond-nav.js';

/** Press a recorded token sequence. Tokens as an array -- `CLR WORK` is one key. */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}
const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);
const value = (tokens: readonly string[], from?: CalculatorState): string =>
  press(tokens, from).display.value;

/**
 * The pp. 53-54 worked example, key-for-key from tests/golden/bond.json.
 * SDT 6-12-2006, CPN 7, RDT 12-31-2007, RV 100, 30/360, 2/Y, YLD 8 -> PRI 98.56,
 * AI 3.15.
 */
const example = [
  '2ND', 'BOND',
  '6.1206', 'ENTER',
  'DOWN', '7', 'ENTER',
  'DOWN', '12.3107', 'ENTER',
  'DOWN',
  'DOWN', '2ND', 'SET',
  'DOWN',
  'DOWN', '8', 'ENTER',
] as const;

// ===========================================================================
// Registry shape
// ===========================================================================

describe('the BOND descriptor is well-formed', () => {
  it('agrees with its own kind declarations', () => {
    expect(() => assertRegistryConsistent({ BOND })).not.toThrow();
    // And so does the merged registry the machine actually runs against.
    expect(() => assertRegistryConsistent(WORKSHEETS)).not.toThrow();
  });

  it('is reachable through its entry key', () => {
    // 2ND BOND opens the worksheet on its first field rather than being inert.
    expect(press(['2ND', 'BOND']).state.mode).toEqual({
      kind: 'worksheet',
      worksheet: 'BOND',
      field: 0,
    });
  });
});

// ===========================================================================
// Golden: defaults after CLR WORK (guidebook pp. 50-51)
// ===========================================================================

describe('golden: bond-defaults-* (guidebook pp. 50-51 defaults table)', () => {
  const cleared = ['2ND', 'BOND', '2ND', 'CLR WORK'] as const;

  it('CLR WORK resets SDT to 12-31-1990', () => {
    expect(screen([...cleared])).toBe('SDT= 12-31-1990');
  });

  it('CPN default is 0.00', () => {
    expect(screen([...cleared, 'DOWN'])).toBe('CPN= 0.00');
  });

  it('RDT default matches SDT (which is what arms the p. 50 Error 6 note)', () => {
    expect(screen([...cleared, 'DOWN', 'DOWN'])).toBe('RDT= 12-31-1990');
  });

  it('RV default is 100.00 percent of par', () => {
    expect(screen([...cleared, 'DOWN', 'DOWN', 'DOWN'])).toBe('RV= 100.00');
  });

  it('day-count toggle defaults to ACT (bare, no label, no =-value of its own)', () => {
    expect(value([...cleared, 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('ACT');
    expect(screen([...cleared, 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('ACT');
  });

  it('coupon-frequency toggle defaults to 2/Y', () => {
    expect(value([...cleared, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('2/Y');
  });
});

// ===========================================================================
// Golden: bond-error6-on-default-dates (guidebook p. 50)
// ===========================================================================

describe('golden: bond-error6-on-default-dates (guidebook p. 50)', () => {
  // p. 50: "navigating before you enter values causes an error (Error 6)."
  // The mechanism is that AI auto-computes on sight and calls bondFactors, whose
  // date check fires because SDT and RDT share the 12-31-1990 default (p. 85).
  // AI is position 8, so the error appears when it is scrolled onto.
  const cleared = ['2ND', 'BOND', '2ND', 'CLR WORK'] as const;
  const toAi = [...cleared, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];

  it('scrolling onto AI on the fresh worksheet raises Error 6', () => {
    const r = press(toAi);
    expect(r.display.value).toBe('Error 6');
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.InvalidDate);
  });

  it('CE/C clears the error and the worksheet is still there', () => {
    // p. 50: "To clear the error, press CE/C."
    const r = press([...toAi, 'CE/C']);
    expect(r.state.errorState).toBeNull();
    expect(r.state.mode.kind).toBe('worksheet');
  });

  /**
   * The golden case records SEVEN DOWNs, not eight, and its own note says the key
   * count is approximate ("assumes it fires when a computed position is reached").
   * Seven DOWNs land on PRI, which is enter-or-compute and shows its stored 0
   * without recomputing -- only AI computes on sight. Pinned, not papered over:
   * this is the exact position where the recorded sequence and the mechanism part.
   */
  it('DEFECT: the recorded seven-DOWN count stops on PRI (0.00), not on the error', () => {
    const r = press([...cleared, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN']);
    expect(renderFlat(r.display)).toBe('PRI= 0.00');
    expect(r.state.errorState).toBeNull();
  });
});

// ===========================================================================
// Golden: the pp. 53-54 worked example, row by row
// ===========================================================================

describe('golden: bond-example-* (guidebook pp. 53-54)', () => {
  it('opening the worksheet shows the current SDT', () => {
    expect(screen(['2ND', 'BOND'])).toBe('SDT= 12-31-1990');
  });

  it('settlement date keyed mm.ddyy displays in US format, month unpadded', () => {
    expect(screen(['2ND', 'BOND', '6.1206', 'ENTER'])).toBe('SDT= 6-12-2006');
  });

  it('coupon rate is a percentage of par', () => {
    expect(screen(['2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER'])).toBe('CPN= 7.00');
  });

  it('redemption date keyed mm.ddyy displays in US format', () => {
    expect(
      screen(['2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER']),
    ).toBe('RDT= 12-31-2007');
  });

  it('redemption value left at its 100.00 default', () => {
    expect(
      screen([
        '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER', 'DOWN',
      ]),
    ).toBe('RV= 100.00');
  });

  it('2ND SET flips the day-count toggle from ACT to 360', () => {
    expect(
      screen([
        '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
        'DOWN', 'DOWN', '2ND', 'SET',
      ]),
    ).toBe('360');
  });

  it('coupon frequency left at 2/Y', () => {
    expect(
      screen([
        '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
        'DOWN', 'DOWN', '2ND', 'SET', 'DOWN',
      ]),
    ).toBe('2/Y');
  });

  it('yield entered as a percentage', () => {
    expect(screen([...example])).toBe('YLD= 8.00');
  });

  it('PRIMARY: CPT computes the price to 98.56', () => {
    expect(screen([...example, 'DOWN', 'CPT'])).toBe('PRI= 98.56');
  });

  it('PRIMARY: AI auto-computes to 3.15 on a single arrow, no CPT', () => {
    expect(screen([...example, 'DOWN', 'CPT', 'DOWN'])).toBe('AI= 3.15');
  });
});

// ===========================================================================
// Navigating the ring (pp. 21-22, 28, 50)
// ===========================================================================

describe('the field ring walks and wraps in variable-table order (p. 50)', () => {
  // A valid bond so AI does not error while walking: SDT 6-12-2006 < RDT 12-31-2007.
  const valid = press([
    '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
  ]).state;

  it('DOWN steps SDT -> CPN -> RDT -> RV -> ACT -> 2/Y -> YLD -> PRI -> AI', () => {
    const labels = ['SDT=', 'CPN=', 'RDT=', 'RV=', '', '', 'YLD=', 'PRI=', 'AI='];
    for (let i = 0; i < labels.length; i++) {
      const downs = Array<string>(i).fill('DOWN');
      const d = press(['2ND', 'BOND', ...downs], valid).display;
      expect(d.label).toBe(labels[i]);
    }
  });

  it('the two toggles sit at positions 4 and 5, printing their state names', () => {
    expect(value(['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], valid)).toBe('ACT');
    expect(value(['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], valid)).toBe('2/Y');
  });

  it('DOWN from AI wraps back to SDT (p. 28)', () => {
    const toAi = ['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(press(toAi, valid).display.label).toBe('AI=');
    expect(press([...toAi, 'DOWN'], valid).display.label).toBe('SDT=');
  });

  it('UP from SDT wraps to AI', () => {
    expect(press(['2ND', 'BOND', 'UP'], valid).display.label).toBe('AI=');
  });

  it('re-pressing 2ND BOND returns to the first field', () => {
    expect(press(['2ND', 'BOND', 'DOWN', 'DOWN', '2ND', 'BOND'], valid).display.label).toBe('SDT=');
  });
});

// ===========================================================================
// ENTER on each entry field, CPT on each compute field (p. 50)
// ===========================================================================

describe('ENTER assigns and CPT computes (guidebook p. 50)', () => {
  it('ENTER stores each of the four knowns at full internal precision', () => {
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7.5', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', '102', 'ENTER',
    ]);
    expect(r.state.bond.SDT).toEqual({ year: 2006, month: 6, day: 12 });
    expect(r.state.bond.CPN).toBe(7.5);
    expect(r.state.bond.RDT).toEqual({ year: 2007, month: 12, day: 31 });
    expect(r.state.bond.RV).toBe(102);
  });

  it('CPT on PRI computes the price and stores it', () => {
    const r = press([...example, 'DOWN', 'CPT']);
    expect(r.state.bond.PRI).toBeCloseTo(98.56275, 4);
    expect(r.display.indicators).toContain('=');
  });

  it('CPT on YLD round-trips the computed price back to 8.00', () => {
    // Compute PRI from YLD 8, then compute YLD back from that PRI: UP lands on YLD.
    expect(screen([...example, 'DOWN', 'CPT', 'UP', 'CPT'])).toBe('YLD= 8.00');
  });

  it('CPT on PRI from an entered yield of 0 prices at par-plus-accrued shape', () => {
    // A sanity anchor distinct from the golden 8% case: at YLD 0 the price is the
    // undiscounted redemption plus coupons minus accrued, all positive and finite.
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', 'DOWN', '2ND', 'SET', 'DOWN', 'DOWN', 'DOWN', 'CPT',
    ]);
    expect(r.state.errorState).toBeNull();
    // RV 100 + four 3.5 coupons - 3.15 accrued = 110.85.
    expect(r.state.bond.PRI).toBeCloseTo(110.85, 2);
  });
});

// ===========================================================================
// 2ND SET on each setting (guidebook pp. 51, 53)
// ===========================================================================

describe('2ND SET cycles each toggle in place (guidebook pp. 51, 53)', () => {
  it('day-count: ACT -> 360 -> ACT', () => {
    const onAct = ['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(value([...onAct], INITIAL_STATE)).toBe('ACT');
    expect(value([...onAct, '2ND', 'SET'])).toBe('360');
    expect(value([...onAct, '2ND', 'SET', '2ND', 'SET'])).toBe('ACT');
  });

  it('coupon frequency: 2/Y -> 1/Y -> 2/Y', () => {
    const onFreq = ['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(value([...onFreq])).toBe('2/Y');
    expect(value([...onFreq, '2ND', 'SET'])).toBe('1/Y');
    expect(value([...onFreq, '2ND', 'SET', '2ND', 'SET'])).toBe('2/Y');
  });

  it('a setting shows the SET prompt and stays put when 2ND SET is pressed', () => {
    const r = press(['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '2ND', 'SET']);
    expect(r.display.indicators).toContain('SET');
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'BOND', field: 4 });
  });

  it('1/Y makes the coupon count annual (M = 1) in the price', () => {
    // Same bond as the golden case but one coupon per year: N and the geometry
    // change, so the price differs from the 2/Y 98.56 -- proving the toggle feeds
    // the maths, not just the display.
    const at1y = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', 'DOWN', '2ND', 'SET', 'DOWN', '2ND', 'SET', 'DOWN', '8', 'ENTER', 'DOWN', 'CPT',
    ]);
    expect(at1y.state.errorState).toBeNull();
    expect(at1y.display.label).toBe('PRI=');
    expect(at1y.display.value).not.toBe('98.56');
  });

  it('ENTER and CPT do not change a setting; only 2ND SET does', () => {
    const onAct = ['2ND', 'BOND', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(value([...onAct, 'ENTER'])).toBe('ACT'); // no set to run
    expect(value([...onAct, 'CPT'])).toBe('ACT'); // no compute to run
    expect(value([...onAct, '2ND', 'SET'])).toBe('360'); // SET is the only mover
  });
});

// ===========================================================================
// The '=' trap and the indicator prompts (pp. 21-22, 27)
// ===========================================================================

describe("the '=' cue and the prompt annunciators (pp. 21-22, 27)", () => {
  it('lights = on a committed numeric field value', () => {
    const d = press(['2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER']).display;
    expect(d.label).toBe('CPN=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry on a numeric field', () => {
    const d = press(['2ND', 'BOND', 'DOWN', '7']).display;
    expect(d.label).toBe('CPN=');
    expect(d.value).toBe('7');
    expect(d.indicators).not.toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under a numeric label (p. 27)', () => {
    // The trap in its pure form on the CPN position: 120,000 is PV, not CPN.
    const r = press(['2ND', 'BOND', 'DOWN', '120000', 'PV']);
    expect(r.display.label).toBe('CPN=');
    expect(r.display.value).toBe('120,000.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.bond.CPN).toBe(0); // CPN untouched
    expect(r.state.tvm.PV).toBe(120000);
  });

  it('YLD and PRI prompt with both ENTER and COMPUTE (enter-or-compute, p. 22)', () => {
    const yld = press([...example]).display; // sits on YLD after 8 ENTER
    expect(yld.label).toBe('YLD=');
    expect(yld.indicators).toContain('ENTER');
    expect(yld.indicators).toContain('COMPUTE');

    const pri = press([...example, 'DOWN']).display; // PRI
    expect(pri.label).toBe('PRI=');
    expect(pri.indicators).toContain('ENTER');
    expect(pri.indicators).toContain('COMPUTE');
  });

  it('AI prompts with neither ENTER nor COMPUTE (auto-compute)', () => {
    const d = press([...example, 'DOWN', 'CPT', 'DOWN']).display;
    expect(d.label).toBe('AI=');
    expect(d.indicators).not.toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('offers UP and DOWN while more variables exist', () => {
    const d = press(['2ND', 'BOND']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });
});

// ===========================================================================
// Clearing and leaving (guidebook pp. 11, 50, 52)
// ===========================================================================

describe('2ND CLR WORK resets Bond to defaults (guidebook pp. 50-51)', () => {
  it('clears every Bond variable and returns to SDT', () => {
    const r = press([...example, 'DOWN', 'CPT', '2ND', 'CLR WORK']);
    expect(renderFlat(r.display)).toBe('SDT= 12-31-1990');
    expect(r.state.bond).toEqual({
      SDT: { year: 1990, month: 12, day: 31 },
      CPN: 0,
      RDT: { year: 1990, month: 12, day: 31 },
      RV: 100,
      dayCount: 'ACT',
      frequency: '2/Y',
      YLD: 0,
      PRI: 0,
    });
  });

  it('touches only Bond, not the TVM registers or Profit Margin', () => {
    const seeded: CalculatorState = {
      ...INITIAL_STATE,
      tvm: { ...INITIAL_STATE.tvm, PV: 120000 },
      profit: { ...INITIAL_STATE.profit, CST: 42 },
    };
    const r = press([...example, '2ND', 'CLR WORK'], seeded);
    expect(r.state.tvm.PV).toBe(120000);
    expect(r.state.profit.CST).toBe(42);
  });
});

describe('2ND QUIT leaves to standard mode, keeping the values (guidebook p. 52)', () => {
  it('returns to standard mode at zero but preserves the entered bond', () => {
    const r = press([...example, 'DOWN', 'CPT', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.bond.CPN).toBe(7);
    expect(r.state.bond.YLD).toBe(8);
    expect(r.state.bond.dayCount).toBe('360');
    expect(r.state.bond.PRI).toBeCloseTo(98.56275, 4);
  });

  it('re-entering after QUIT shows the retained SDT, not a fresh default', () => {
    const left = press([...example, '2ND', 'QUIT']).state;
    expect(screen(['2ND', 'BOND'], left)).toBe('SDT= 6-12-2006');
  });
});

// ===========================================================================
// Error conditions the worksheet raises (guidebook pp. 84-85)
// ===========================================================================

describe('errors latch rather than throw (guidebook pp. 84-85)', () => {
  it('Error 6: an impossible date entry (month 13)', () => {
    const r = press(['2ND', 'BOND', '13.0106', 'ENTER']);
    expect(r.display.value).toBe('Error 6');
    expect(r.state.errorState).toBe(ErrorCode.InvalidDate);
    // CE/C recovers and the un-set SDT is still its default.
    const cleared = reduce(r.state, 'CE/C');
    expect(cleared.state.errorState).toBeNull();
    expect(renderFlat(cleared.display)).toBe('SDT= 12-31-1990');
  });

  it('Error 6: computing with RDT not later than SDT', () => {
    // SDT 12-31-2007 keyed, RDT left at the 12-31-1990 default -> RDT < SDT.
    const r = press([
      '2ND', 'BOND', '12.3107', 'ENTER', 'DOWN', '7', 'ENTER',
      'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT',
    ]);
    expect(r.display.value).toBe('Error 6');
    expect(r.state.errorState).toBe(ErrorCode.InvalidDate);
  });

  it('Error 4: computing PRI with CPN at its 0 default', () => {
    // Valid dates, RV 100, but CPN 0 -> non-positive coupon is out of range (p. 84).
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', 'DOWN', '12.3107', 'ENTER',
      'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT',
    ]);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('Error 4: a negative RV', () => {
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', '50', '+/-', 'ENTER', 'DOWN', 'DOWN', 'DOWN', '8', 'ENTER', 'DOWN', 'CPT',
    ]);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('Error 4: computing YLD with PRI at its 0 default (PRI is an input here)', () => {
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT', // YLD position, PRI still 0
    ]);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('Error 5: a yield that drives the discount base 1 + Y/M to zero', () => {
    // YLD -200 with M = 2 gives 1 + (-2)/2 = 0, an LN-domain failure (p. 84).
    const r = press([
      '2ND', 'BOND', '6.1206', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN', '12.3107', 'ENTER',
      'DOWN', 'DOWN', 'DOWN', 'DOWN', '200', '+/-', 'ENTER', 'DOWN', 'CPT',
    ]);
    expect(r.display.value).toBe('Error 5');
    expect(r.state.errorState).toBe(ErrorCode.NoSolution);
  });

  it('a latched error swallows every key but CE/C, then the worksheet resumes', () => {
    const errored = press(['2ND', 'BOND', '13.0106', 'ENTER']);
    // Digits are ignored while latched.
    const stillErr = press(['9'], errored.state);
    expect(stillErr.display.value).toBe('Error 6');
    const back = reduce(stillErr.state, 'CE/C');
    expect(back.state.errorState).toBeNull();
    expect(back.state.mode.kind).toBe('worksheet');
  });
});

// ===========================================================================
// Totality: project never throws, even on a bad field powered off
// ===========================================================================

describe('projection stays total on a throwing field (worksheet-nav contract)', () => {
  it('never throws out of project when AI cannot be computed', () => {
    const bad: CalculatorState = {
      ...INITIAL_STATE,
      // RDT == SDT default, sitting on AI (position 8): get() will throw Error 6.
      mode: { kind: 'worksheet', worksheet: 'BOND', field: 8 },
      poweredOn: false,
    };
    expect(() => project(bad)).not.toThrow();
    // The field cannot be read, so = is not lit.
    expect(project(bad).indicators).not.toContain('=');
  });
});

import { describe, it, expect, vi } from 'vitest';

/**
 * DEPR is not in the central WORKSHEETS registry yet -- the task wires that up
 * "centrally afterwards", so the unmodified reducer treats `2ND DEPR` as a dead
 * key. To exercise the descriptor the way it will actually run, inject it into the
 * registry the machine reads -- the one line the central wiring will add -- and
 * drive everything below through the real `reduceAll`, never by calling the
 * descriptor's own get/set/compute/cycle.
 */
vi.mock('../worksheet-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../worksheet-registry.js')>();
  const { DEPRECIATION } = await import('./depreciation-nav.js');
  return { ...actual, WORKSHEETS: { ...actual.WORKSHEETS, DEPR: DEPRECIATION } };
});

import { reduce, reduceAll, project, INITIAL_STATE } from '../machine.js';
import { parseKeySequence } from '../keys.js';
import { renderFlat } from '../display-state.js';
import { assertRegistryConsistent } from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { DEPRECIATION } from './depreciation-nav.js';
import type { CalculatorState } from '../state.js';
import type { DepreciationState } from '../../worksheets/depreciation.js';
import { ErrorCode } from '../../errors.js';

/** Press a recorded sequence. Tokens as an array -- `CLR WORK` is one key. */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

const value = (tokens: readonly string[], from?: CalculatorState): string =>
  press(tokens, from).display.value;

const label = (tokens: readonly string[], from?: CalculatorState): string =>
  press(tokens, from).display.label;

const withDepr = (o: Partial<DepreciationState>): CalculatorState => ({
  ...INITIAL_STATE,
  depr: { ...INITIAL_STATE.depr, ...o },
});

/** The p. 58 example ends on CST; every golden step below hangs off this prefix. */
const TO_CST = [
  '2ND', 'DEPR',
  'DOWN', '31.5', 'ENTER',
  'DOWN', '3.5', 'ENTER',
  'DOWN', '1000000', 'ENTER',
];
const toWrapYR = [...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
const toYear2 = [...toWrapYR, 'CPT'];

/** European format unlocks SLF/DBF (p. 55, p. 57). Separator format is enough. */
const EUR: CalculatorState = {
  ...INITIAL_STATE,
  format: { ...INITIAL_STATE.format, separators: 'EUR' },
};

// ===========================================================================
// The descriptor is well-formed and reachable
// ===========================================================================

describe('the DEPR descriptor', () => {
  it('is self-consistent: every kind matches its handlers', () => {
    expect(() => assertRegistryConsistent({ DEPR: DEPRECIATION })).not.toThrow();
  });

  it('rides in the same registry as the reference worksheets once wired', () => {
    expect(() => assertRegistryConsistent(WORKSHEETS)).not.toThrow();
  });

  it('lists the fields in LCD scroll order (p. 55)', () => {
    expect(DEPRECIATION.fields.map((f) => f.label)).toEqual([
      '', // the method line prints its mnemonic, no label
      'LIF=',
      'M01=',
      'DT1=',
      'CST=',
      'SAL=',
      'YR=',
      'DEP=',
      'RBV=',
      'RDV=',
    ]);
  });
});

// ===========================================================================
// Golden cases -- tests/golden/depreciation.json (guidebook p. 58, DEC = 2)
// ===========================================================================

describe('golden: depreciation-sl-* (guidebook p. 58)', () => {
  // depreciation-sl-open-worksheet-shows-default-method
  it('opens showing the active method, default SL, with no numeric value', () => {
    expect(value(['2ND', 'DEPR'])).toBe('SL');
    expect(screen(['2ND', 'DEPR'])).toBe('SL');
  });

  // depreciation-sl-enter-life-31-5
  it('DOWN reaches LIF and 31.5 ENTER assigns a fractional life', () => {
    expect(value(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER'])).toBe('31.50');
    expect(screen(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER'])).toBe('LIF= 31.50');
  });

  // depreciation-sl-enter-starting-month-3-5
  it('DOWN reaches M01 and 3.5 ENTER assigns a mid-March start', () => {
    expect(value(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER', 'DOWN', '3.5', 'ENTER'])).toBe('3.50');
  });

  // depreciation-sl-enter-cost-1000000
  it('DOWN past the hidden DT1 reaches CST; 1,000,000 shows US separators', () => {
    expect(value(TO_CST)).toBe('1,000,000.00');
    expect(screen(TO_CST)).toBe('CST= 1,000,000.00');
  });

  // depreciation-sl-salvage-left-at-default-zero
  it('DOWN steps onto SAL, left at its default 0', () => {
    expect(value([...TO_CST, 'DOWN'])).toBe('0.00');
    expect(label([...TO_CST, 'DOWN'])).toBe('SAL=');
  });

  // depreciation-sl-year-left-at-default-one
  it('DOWN steps onto YR, left at its default 1', () => {
    expect(value([...TO_CST, 'DOWN', 'DOWN'])).toBe('1.00');
    expect(label([...TO_CST, 'DOWN', 'DOWN'])).toBe('YR=');
  });

  // depreciation-sl-year1-dep
  it('DOWN auto-computes year 1 DEP = 25,132.28', () => {
    expect(value([...TO_CST, 'DOWN', 'DOWN', 'DOWN'])).toBe('25,132.28');
    expect(screen([...TO_CST, 'DOWN', 'DOWN', 'DOWN'])).toBe('DEP= 25,132.28');
  });

  // depreciation-sl-year1-rbv
  it('DOWN auto-computes year 1 RBV = 974,867.72', () => {
    expect(value([...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('974,867.72');
    expect(label([...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('RBV=');
  });

  // depreciation-sl-year1-rdv
  it('DOWN auto-computes year 1 RDV = 974,867.72', () => {
    expect(value([...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('974,867.72');
    expect(label([...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('RDV=');
  });

  // depreciation-sl-wrap-from-rdv-back-to-yr
  it('DOWN from RDV wraps back to YR, still showing year 1 (p. 57)', () => {
    expect(value(toWrapYR)).toBe('1.00');
    expect(label(toWrapYR)).toBe('YR=');
  });

  // depreciation-sl-increment-yr-as-printed-2nd-set
  it('2ND SET on YR advances to year 2, as the p. 58 example literally prints', () => {
    // DEPR-1: the example's key column reads `2nd ENTER` (= 2ND SET); the prose
    // says CPT. YR is modelled as a setting so 2ND SET reaches it. Value 2.00 is
    // uncontested under both spellings.
    expect(value([...toWrapYR, '2ND', 'SET'])).toBe('2.00');
    expect(label([...toWrapYR, '2ND', 'SET'])).toBe('YR=');
  });

  // depreciation-sl-increment-yr-via-cpt
  it('CPT on YR advances to year 2, the reading the prose documents (p. 57)', () => {
    expect(value(toYear2)).toBe('2.00');
    expect(label(toYear2)).toBe('YR=');
  });

  // depreciation-sl-year2-dep
  it('year 2 DEP = 31,746.03 (full year, no FSTYR factor)', () => {
    expect(value([...toYear2, 'DOWN'])).toBe('31,746.03');
    expect(screen([...toYear2, 'DOWN'])).toBe('DEP= 31,746.03');
  });

  // depreciation-sl-year2-rbv
  it('year 2 RBV = 943,121.69 (rounded accumulation)', () => {
    expect(value([...toYear2, 'DOWN', 'DOWN'])).toBe('943,121.69');
  });

  // depreciation-sl-year2-rdv
  it('year 2 RDV = 943,121.69', () => {
    expect(value([...toYear2, 'DOWN', 'DOWN', 'DOWN'])).toBe('943,121.69');
  });
});

// ===========================================================================
// The field ring: a plain wrap everywhere but the RDV -> YR return (p. 57)
// ===========================================================================

describe('the field ring scrolls in LCD order (p. 55), DT1 hidden under SL', () => {
  it('DOWN walks METHOD -> LIF -> M01 -> CST -> SAL -> YR -> DEP -> RBV -> RDV', () => {
    expect(label(['2ND', 'DEPR'])).toBe(''); // METHOD line
    expect(label(['2ND', 'DEPR', 'DOWN'])).toBe('LIF=');
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN'])).toBe('M01=');
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN'])).toBe('CST='); // DT1 skipped
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('SAL=');
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('YR=');
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('DEP=');
    const toRBV = ['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(label(toRBV)).toBe('RBV=');
    expect(label([...toRBV, 'DOWN'])).toBe('RDV=');
  });

  it('DOWN from RDV returns to YR, NOT to the method line (p. 57)', () => {
    const toRDV = ['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(label(toRDV)).toBe('RDV=');
    expect(label([...toRDV, 'DOWN'])).toBe('YR=');
  });

  it('the setup fields stay reachable: UP from YR returns to SAL', () => {
    // The RDV->YR shortcut does not sever the setup half -- from YR you scroll back
    // up through SAL, CST, ... exactly as before.
    const toYR = ['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(label(toYR)).toBe('YR=');
    expect(label([...toYR, 'UP'])).toBe('SAL=');
  });

  it('re-pressing 2ND DEPR from a setup field returns to the method line (p. 28, p. 57)', () => {
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', '2ND', 'DEPR'])).toBe('');
    expect(value(['2ND', 'DEPR', 'DOWN', 'DOWN', '2ND', 'DEPR'])).toBe('SL');
  });

  it('KNOWN DEVIATION: re-pressing 2ND DEPR while RDV is displayed lands on YR', () => {
    // p. 57 says 2ND DEPR shows the current method. The RDV->YR shortcut hides the
    // setup fields for the instant RDV is displayed, and re-entry re-scans from the
    // same state, so it lands on YR instead of METHOD. Pinned, not hidden: it is an
    // untested corner (who re-opens the worksheet parked on RDV?), and the only
    // price of expressing the p. 57 shortcut inside the generic ring.
    const toRDV = ['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(label(toRDV)).toBe('RDV=');
    expect(label([...toRDV, '2ND', 'DEPR'])).toBe('YR=');
  });
});

// ===========================================================================
// The method line: a setting AND the DB/DBX percent (p. 55, p. 57)
// ===========================================================================

describe('2ND SET cycles the depreciation method (p. 57)', () => {
  it('walks SL -> SYD -> DB -> DBX -> SL under the US format (no SLF/DBF)', () => {
    expect(value(['2ND', 'DEPR'])).toBe('SL');
    expect(value(['2ND', 'DEPR', '2ND', 'SET'])).toBe('SYD');
    expect(value(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET'])).toBe('DB= 200.00');
    expect(value(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET', '2ND', 'SET'])).toBe('DBX= 200.00');
    expect(
      value(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET', '2ND', 'SET', '2ND', 'SET']),
    ).toBe('SL'); // wraps, SLF/DBF absent under US
  });

  it('offers SLF and DBF once the format is European (p. 55, p. 57)', () => {
    expect(value(['2ND', 'DEPR'], EUR)).toBe('SL');
    expect(value(['2ND', 'DEPR', '2ND', 'SET'], EUR)).toBe('SLF');
    expect(value(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET'], EUR)).toBe('SYD');
  });

  it('lights the SET indicator on the method line', () => {
    expect(press(['2ND', 'DEPR']).display.indicators).toContain('SET');
  });
});

describe('the DB/DBX percent is keyed on the method line (p. 57)', () => {
  it('accepts a percent under DB and shows it against the mnemonic', () => {
    const r = press(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET', '150', 'ENTER']);
    expect(renderFlat(r.display)).toBe('DB= 150.00');
    expect(r.state.depr.dbPercent).toBe(150);
    expect(r.state.depr.method).toBe('DB');
  });

  it('echoes the keyed digits alone while mid-entry, before ENTER commits', () => {
    const d = press(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET', '150']).display;
    expect(d.value).toBe('150');
    expect(d.indicators).not.toContain('='); // half-keyed: belongs to nobody
  });

  it('leaves 200 standing when accepted without keying (p. 57)', () => {
    expect(value(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET'])).toBe('DB= 200.00');
  });

  it('ignores a keyed value under a method with no percent (SL)', () => {
    // ENTER on the SL line has nothing to store; the mnemonic is unchanged.
    const r = press(['2ND', 'DEPR', '150', 'ENTER']);
    expect(r.state.depr.dbPercent).toBe(200); // untouched default
    expect(value(['2ND', 'DEPR', '150', 'ENTER'])).toBe('SL');
  });
});

// ===========================================================================
// DT1: visible only under SLF (p. 57 "DT1 (if SLF)")
// ===========================================================================

describe('DT1 appears only under the SLF method (p. 57)', () => {
  it('is skipped under SL: three DOWNs from the method line land on CST', () => {
    expect(label(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN'])).toBe('CST=');
  });

  it('is reachable under SLF: three DOWNs land on DT1', () => {
    // SL -> SLF is one 2ND SET under the European format.
    expect(label(['2ND', 'DEPR', '2ND', 'SET', 'DOWN', 'DOWN', 'DOWN'], EUR)).toBe('DT1=');
  });

  it('stores a keyed dd.mmyy date under SLF (DEPR-4, undocumented/unverified)', () => {
    const r = press(['2ND', 'DEPR', '2ND', 'SET', 'DOWN', 'DOWN', 'DOWN', '16.0324', 'ENTER'], EUR);
    expect(r.state.depr.DT1).toEqual({ day: 16, month: 3, year: 2024 });
    expect(renderFlat(r.display)).toBe('DT1= 16-03-2024');
  });
});

// ===========================================================================
// YR: enter-or-compute, plus 2ND SET (DEPR-1)
// ===========================================================================

describe('YR takes ENTER, CPT and 2ND SET (DEPR-1)', () => {
  it('ENTER assigns a year directly', () => {
    const r = press(['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '5', 'ENTER']);
    expect(renderFlat(r.display)).toBe('YR= 5.00');
    expect(r.state.depr.YR).toBe(5);
  });

  it('CPT increments YR by one and refreshes Last Answer (p. 19, p. 57)', () => {
    const r = press([...toWrapYR, 'CPT']);
    expect(r.state.depr.YR).toBe(2);
    expect(r.state.ans).toBe(2);
  });

  it('2ND SET increments YR by one, matching the printed example (p. 58)', () => {
    const r = press([...toWrapYR, '2ND', 'SET']);
    expect(r.state.depr.YR).toBe(2);
  });

  it('CPT then CPT reaches year 3', () => {
    expect(value([...toWrapYR, 'CPT', 'CPT'])).toBe('3.00');
  });
});

// ===========================================================================
// Every entry field takes ENTER; the auto outputs take neither ENTER nor CPT
// ===========================================================================

describe('ENTER assigns each keyed variable', () => {
  it('stores a salvage value on SAL', () => {
    const r = press([...TO_CST, 'DOWN', '50000', 'ENTER']);
    expect(renderFlat(r.display)).toBe('SAL= 50,000.00');
    expect(r.state.depr.SAL).toBe(50000);
  });

  it('keeps an entered value at full precision though the LCD rounds (§1.4)', () => {
    const r = press(['2ND', 'DEPR', 'DOWN', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.state.depr.LIF).toBe(6.125);
  });
});

describe('the auto outputs compute on sight and ignore CPT (p. 22, p. 56)', () => {
  it('DEP is computed with the * (here `=`) provenance cue lit', () => {
    const d = press([...TO_CST, 'DOWN', 'DOWN', 'DOWN']).display;
    expect(d.label).toBe('DEP=');
    expect(d.value).toBe('25,132.28');
    expect(d.indicators).toContain('=');
  });

  it('CPT on DEP is a silent no-op: the value is already the computed one', () => {
    const withCpt = press([...TO_CST, 'DOWN', 'DOWN', 'DOWN', 'CPT']);
    expect(renderFlat(withCpt.display)).toBe('DEP= 25,132.28');
    expect(withCpt.state.errorState).toBeNull();
    expect(withCpt.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DEPR', field: 7 });
  });
});

// ===========================================================================
// The '=' indicator and the display trap (p. 27)
// ===========================================================================

describe("the '=' indicator marks a value as belonging to its label (p. 27)", () => {
  it('is lit on a committed field value', () => {
    const d = press(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER']).display;
    expect(d.label).toBe('LIF=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry: a half-keyed number belongs to nobody', () => {
    const d = press(['2ND', 'DEPR', 'DOWN', '31.5']).display;
    expect(d.label).toBe('LIF=');
    expect(d.value).toBe('31.5'); // echoed as typed, not padded to DEC
    expect(d.indicators).not.toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under the label (p. 27)', () => {
    // `LIF= 120,000.00` on screen, but 120,000 is PV -- only the missing `=` says so.
    const r = press(['2ND', 'DEPR', 'DOWN', '120000', 'PV']);
    expect(r.display.label).toBe('LIF=');
    expect(r.display.value).toBe('120,000.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.depr.LIF).toBe(1); // LIF never touched
    expect(r.state.tvm.PV).toBe(120000);
  });
});

// ===========================================================================
// Indicator prompts follow the field type (pp. 21-22)
// ===========================================================================

describe('indicator prompts follow the variable type (pp. 21-22)', () => {
  it('an auto-compute output prompts with neither ENTER nor COMPUTE (p. 22)', () => {
    const d = press([...TO_CST, 'DOWN', 'DOWN', 'DOWN']).display; // DEP
    expect(d.label).toBe('DEP=');
    expect(d.indicators).not.toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('a plain entry variable prompts with ENTER but not COMPUTE or SET', () => {
    const d = press(['2ND', 'DEPR', 'DOWN']).display; // LIF
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
    expect(d.indicators).not.toContain('SET');
  });

  it('offers UP and DOWN while more variables exist (p. 21)', () => {
    const d = press(['2ND', 'DEPR']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });

  it('keeps the global annunciators lit inside the worksheet', () => {
    const bgn: CalculatorState = { ...INITIAL_STATE, tvm: { ...INITIAL_STATE.tvm, mode: 'BGN' } };
    expect(press(['2ND', 'DEPR'], bgn).display.indicators).toContain('BGN');
  });
});

// ===========================================================================
// CE/C, 2ND CLR WORK, 2ND QUIT (p. 11, p. 56)
// ===========================================================================

describe('CE/C CE/C clears a keyed-but-not-entered value (p. 11)', () => {
  it('drops the keyed value and restores the previous one, without leaving', () => {
    const r = press(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER', '99', 'CE/C', 'CE/C']);
    expect(renderFlat(r.display)).toBe('LIF= 31.50');
    expect(r.state.depr.LIF).toBe(31.5);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DEPR', field: 1 });
  });

  it('the first press shows zero, detached from the label', () => {
    const d = press(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER', '99', 'CE/C']).display;
    expect(d.label).toBe('LIF=');
    expect(d.value).toBe('0.00');
    expect(d.indicators).not.toContain('=');
  });
});

describe('2ND CLR WORK resets LIF, YR, CST, SAL only (p. 56)', () => {
  it('clears the four, spares the method and M01, and lands on the method line', () => {
    const r = press([...TO_CST, '2ND', 'CLR WORK']);
    expect(value([...TO_CST, '2ND', 'CLR WORK'])).toBe('SL'); // method preserved
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DEPR', field: 0 });
    expect(r.state.depr.LIF).toBe(1);
    expect(r.state.depr.CST).toBe(0);
    expect(r.state.depr.SAL).toBe(0);
    expect(r.state.depr.YR).toBe(1);
    // p. 56 names only LIF/YR/CST/SAL; M01 keeps its entered value.
    expect(r.state.depr.M01).toBe(3.5);
  });

  it('keeps the selected method and its percent across the clear (p. 56)', () => {
    const r = press(['2ND', 'DEPR', '2ND', 'SET', '2ND', 'SET', '150', 'ENTER', '2ND', 'CLR WORK']);
    expect(r.state.depr.method).toBe('DB');
    expect(r.state.depr.dbPercent).toBe(150);
    expect(renderFlat(r.display)).toBe('DB= 150.00');
  });

  it('returns to the method line even when pressed while RDV is displayed', () => {
    // The setup fields are hidden while RDV shows (the p. 57 shortcut); the clear
    // parks the field back on METHOD so it is never trapped in the YR..RDV loop.
    const r = press([
      ...TO_CST,
      'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', // onto RDV
      '2ND', 'CLR WORK',
    ]);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DEPR', field: 0 });
    expect(renderFlat(r.display)).toBe('SL');
  });

  it('touches only this worksheet, not the TVM registers', () => {
    const seeded: CalculatorState = {
      ...INITIAL_STATE,
      tvm: { ...INITIAL_STATE.tvm, PV: 120000 },
    };
    const r = press(['2ND', 'DEPR', '2ND', 'CLR WORK'], seeded);
    expect(r.state.tvm.PV).toBe(120000);
  });
});

describe('2ND QUIT leaves to standard mode without clearing (p. 11)', () => {
  it('returns to standard mode at zero, keeping the worksheet values', () => {
    const r = press(['2ND', 'DEPR', 'DOWN', '31.5', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.depr.LIF).toBe(31.5); // persists for the next 2ND DEPR
  });
});

// ===========================================================================
// Totality: the reducer latches, it does not throw (guidebook pp. 84-85)
// ===========================================================================

describe('the reducer stays total inside the worksheet', () => {
  /** Scroll from the method line down to DEP, six DOWNs under SL. */
  const toDEP = ['2ND', 'DEPR', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];

  it('latches Error 2 when SAL exceeds CST (p. 84)', () => {
    const r = press(toDEP, withDepr({ CST: 100, SAL: 200 }));
    expect(r.display.value).toBe('Error 2');
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
  });

  it('latches Error 4 when LIF <= 0 (p. 84)', () => {
    const r = press(toDEP, withDepr({ LIF: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
    expect(r.display.value).toBe('Error 4');
  });

  it('latches Error 4 when M01 is out of the 1..<13 month range (p. 84)', () => {
    expect(press(toDEP, withDepr({ M01: 13 })).state.errorState).toBe(ErrorCode.OutOfRange);
    expect(press(toDEP, withDepr({ M01: 0.5 })).state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('latches Error 4 on a non-positive or fractional YR (p. 57, p. 84)', () => {
    expect(press(toDEP, withDepr({ YR: 0 })).state.errorState).toBe(ErrorCode.OutOfRange);
    expect(press(toDEP, withDepr({ YR: 1.5 })).state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('latches Error 4 on a non-positive declining-balance percent (p. 84)', () => {
    const r = press(toDEP, withDepr({ method: 'DB', dbPercent: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('the failed auto-compute does not move the field off YR', () => {
    // The error fires on the sixth DOWN, landing onto DEP; the field stays on YR.
    const r = press(toDEP, withDepr({ CST: 100, SAL: 200 }));
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DEPR', field: 6 });
  });

  it('CE/C clears the error, then CE/C restores the field it struck on (p. 11)', () => {
    const errored = press(toDEP, withDepr({ CST: 100, SAL: 200 }));
    // First press clears the error to a bare 0; second re-reads YR under its label.
    const once = reduce(errored.state, 'CE/C');
    expect(once.state.errorState).toBeNull();
    expect(renderFlat(once.display)).toBe('YR= 0.00');
    const twice = reduce(once.state, 'CE/C');
    expect(renderFlat(twice.display)).toBe('YR= 1.00');
  });

  it('never throws out of project, even parked powered-off on a throwing field', () => {
    const parked: CalculatorState = {
      ...withDepr({ CST: 100, SAL: 200 }),
      mode: { kind: 'worksheet', worksheet: 'DEPR', field: 7 }, // DEP, which throws
      poweredOn: false,
    };
    expect(() => project(parked)).not.toThrow();
    expect(() => reduce(parked, '5')).not.toThrow();
    // The field cannot be read, so it cannot be claimed to belong to the label.
    expect(project(parked).indicators).not.toContain('=');
  });
});

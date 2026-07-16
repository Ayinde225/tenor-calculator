import { describe, it, expect } from 'vitest';
import { reduce, INITIAL_STATE } from '../machine.js';
import { parseKeySequence, type Key } from '../keys.js';
import {
  renderFlat,
  renderEntry,
  renderValue,
  errorDisplayState,
  type DisplayState,
  type Indicator,
} from '../display-state.js';
import { CalculatorError, ErrorCode } from '../../errors.js';
import type { CalculatorState } from '../state.js';
import {
  WORKSHEET_ENTRY_KEYS,
  assertRegistryConsistent,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
  type WorksheetRegistry,
} from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { INTEREST_CONVERSION_WORKSHEET } from './interest-conversion-nav.js';

/**
 * ICONV is not yet in the central `WORKSHEETS` switch -- the registry is wired up
 * centrally after every parallel worksheet lands, and this file must not touch it
 * (or machine.ts). So the machine's `reduce`/`project`, which are hard-wired to
 * `WORKSHEETS`, would treat `2ND ICONV` as a dead key.
 *
 * These tests therefore drive a registry that includes the descriptor through the
 * SAME navigation engine machine.ts uses -- `WORKSHEET_ENTRY_KEYS`,
 * `enterWorksheet`, `reduceWorksheet`, `worksheetDisplay` -- and delegate every
 * standard-calculator key (digits, `.`, `+/-`, `2ND`, QUIT, ...) to the real
 * `reduce`. `step` and `projectWith` below are a line-for-line mirror of
 * `machine.dispatch` and `machine.project` with `WORKSHEETS` swapped for this
 * registry; nothing about the descriptor's behaviour is special-cased. Key presses
 * still go in as keys; no descriptor handler is called directly.
 *
 * When the registry is wired centrally, every sequence here runs unchanged through
 * `reduceAll` -- the delegation is the only scaffolding.
 */
const REGISTRY: WorksheetRegistry = { ...WORKSHEETS, ICONV: INTEREST_CONVERSION_WORKSHEET };

const disarm = (s: CalculatorState): CalculatorState => ({
  ...s,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

/** Mirror of machine.latchError, for the worksheet command boundary. */
const latch = (s: CalculatorState, code: ErrorCode): CalculatorState => ({
  ...disarm(s),
  errorState: code,
  entryBuffer: null,
});

/** Mirror of machine.indicatorsFor: the global annunciators carried through. */
function baseIndicators(s: CalculatorState): Indicator[] {
  const ind: Indicator[] = [];
  if (s.secondArmed) ind.push('2nd');
  if (s.invArmed) ind.push('INV');
  if (s.hypArmed) ind.push('HYP');
  if (s.format.angleUnit === 'RAD') ind.push('RAD');
  if (s.tvm.mode === 'BGN') ind.push('BGN');
  return ind;
}

/** Mirror of machine.project, over REGISTRY. */
function projectWith(s: CalculatorState): DisplayState {
  if (s.errorState !== null) return errorDisplayState(s.errorState);
  const fmt = { decimals: s.format.DEC, separator: s.format.separators };
  const ind = baseIndicators(s);
  if (s.mode.kind === 'worksheet') {
    const d = worksheetDisplay(s, REGISTRY, fmt, ind);
    if (d !== null) return d;
  }
  if (s.entryBuffer !== null) return renderEntry(s.entryBuffer, fmt, '', ind);
  return renderValue(s.displayValue, fmt, '', ind);
}

/** Mirror of the worksheet-relevant slice of machine.dispatch, over REGISTRY. */
function step(s: CalculatorState, key: Key): CalculatorState {
  // Error gate (machine.reduce): only CE/C is live; the real reducer enforces it.
  if (s.errorState !== null) return reduce(s, key).state;

  // Worksheet entry keys open their worksheet whether or not 2ND is armed.
  const opens = WORKSHEET_ENTRY_KEYS[key];
  if (opens !== undefined) return disarm(enterWorksheet(s, opens, REGISTRY));

  // Inside the worksheet, the navigation engine claims its keys; whatever it
  // returns null for falls through to the real reducer, exactly as machine.ts
  // wires it. `get`/`set`/`compute` may throw; latch it like the command boundary.
  if (s.mode.kind === 'worksheet') {
    try {
      const next = reduceWorksheet(s, key, REGISTRY);
      if (next !== null) return disarm(next);
    } catch (e) {
      if (e instanceof CalculatorError) return latch(s, e.code);
      throw e;
    }
  }

  return reduce(s, key).state;
}

function drive(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  let s = from;
  for (const key of parseKeySequence(tokens)) s = step(s, key);
  return { state: s, display: projectWith(s) };
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(drive(tokens, from).display);
const value = (tokens: readonly string[], from?: CalculatorState): string =>
  drive(tokens, from).display.value;

// ===========================================================================
// The descriptor is well-formed and reachable
// ===========================================================================

describe('the ICONV descriptor', () => {
  it('agrees with its own kind declarations', () => {
    expect(() => assertRegistryConsistent({ ICONV: INTEREST_CONVERSION_WORKSHEET })).not.toThrow();
  });

  it('has its entry key wired in WORKSHEET_ENTRY_KEYS', () => {
    // machine.ts consumes this map; the author does not touch it, but a broken
    // wiring would make 2ND ICONV inert.
    expect(WORKSHEET_ENTRY_KEYS['ICONV']).toBe('ICONV');
  });

  it('lists NOM, EFF, C/Y in LCD order', () => {
    expect(INTEREST_CONVERSION_WORKSHEET.fields.map((f) => f.label)).toEqual([
      'NOM=',
      'EFF=',
      'C/Y=',
    ]);
  });
});

// ===========================================================================
// Golden cases -- the p. 67 certificate example, one sequence in steps
// ===========================================================================

describe('golden: other-worksheets-iconv-* (guidebook p. 67)', () => {
  // other-worksheets-iconv-enter-nom
  it('opens on NOM and 15 ENTER assigns it (NOM= 15.00)', () => {
    expect(screen(['2ND', 'ICONV', '15', 'ENTER'])).toBe('NOM= 15.00');
    expect(value(['2ND', 'ICONV', '15', 'ENTER'])).toBe('15.00');
  });

  // other-worksheets-iconv-enter-cy
  it('DOWN DOWN passes EFF and lands on C/Y, where 4 ENTER assigns it (C/Y= 4.00)', () => {
    const r = drive(['2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER']);
    expect(renderFlat(r.display)).toBe('C/Y= 4.00');
    expect(r.state.iconv.CY).toBe(4);
  });

  // other-worksheets-iconv-eff-from-nom -- the project's required parity target.
  it('UP from C/Y returns to EFF, where CPT computes 15.87', () => {
    const eff = ['2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT'];
    expect(screen(eff)).toBe('EFF= 15.87');
    expect(value(eff)).toBe('15.87');
  });

  it('keeps EFF at 13 internal digits, not the 2 displayed (p. 9, p. 86)', () => {
    const r = drive(['2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT']);
    // 100 x (1.0375^4 - 1) = 15.86504150390625; the LCD rounds only for display.
    expect(r.state.iconv.EFF).toBeCloseTo(15.86504150391, 10);
    expect(r.display.value).toBe('15.87');
  });
});

// ===========================================================================
// The inverse solve -- CPT on NOM (spec "convert back to nominal")
// ===========================================================================

describe('NOM and EFF are interchangeable (p. 66)', () => {
  it('computes NOM back from a computed EFF, round-tripping to 15.00', () => {
    // Compute EFF from NOM=15, C/Y=4, then step up to NOM and CPT. The stored EFF
    // is full-precision, so solveNOM returns 15.00 exactly -- the p. 67 example run
    // in reverse, and the only evidence the NOM solver is wired to the right field.
    const r = drive([
      '2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT',
      'UP', 'CPT',
    ]);
    expect(renderFlat(r.display)).toBe('NOM= 15.00');
  });

  it('computes EFF then NOM without disturbing C/Y', () => {
    const r = drive([
      '2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT', 'UP', 'CPT',
    ]);
    expect(r.state.iconv.CY).toBe(4);
  });
});

// ===========================================================================
// Navigation -- the three-field ring (p. 66)
// ===========================================================================

describe('the field ring wraps NOM -> EFF -> C/Y (p. 66)', () => {
  it('opens on NOM', () => {
    expect(drive(['2ND', 'ICONV']).display.label).toBe('NOM=');
  });

  it('DOWN steps NOM -> EFF -> C/Y', () => {
    expect(drive(['2ND', 'ICONV', 'DOWN']).display.label).toBe('EFF=');
    expect(drive(['2ND', 'ICONV', 'DOWN', 'DOWN']).display.label).toBe('C/Y=');
  });

  it('DOWN from C/Y wraps back to NOM', () => {
    expect(drive(['2ND', 'ICONV', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('NOM=');
  });

  it('UP from NOM wraps to C/Y', () => {
    expect(drive(['2ND', 'ICONV', 'UP']).display.label).toBe('C/Y=');
  });

  it('re-pressing 2ND ICONV returns to NOM (p. 28)', () => {
    expect(drive(['2ND', 'ICONV', 'DOWN', '2ND', 'ICONV']).display.label).toBe('NOM=');
  });
});

// ===========================================================================
// Field values persist across navigation
// ===========================================================================

describe('entered values are stored and reappear on scroll', () => {
  it('stores 6.125 at full precision though the LCD shows 6.13 (§1.4)', () => {
    const r = drive(['2ND', 'ICONV', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.state.iconv.NOM).toBe(6.125);
  });

  it('shows a stored NOM again after scrolling away and back', () => {
    const r = drive(['2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', 'DOWN']);
    expect(renderFlat(r.display)).toBe('NOM= 15.00');
  });
});

// ===========================================================================
// Indicator prompts follow field type (pp. 21-22)
// ===========================================================================

describe('indicator prompts follow the variable type (pp. 21-22)', () => {
  it('NOM and EFF are enter-or-compute: both ENTER and COMPUTE', () => {
    const nom = drive(['2ND', 'ICONV']).display;
    expect(nom.indicators).toContain('ENTER');
    expect(nom.indicators).toContain('COMPUTE');
    const eff = drive(['2ND', 'ICONV', 'DOWN']).display;
    expect(eff.indicators).toContain('ENTER');
    expect(eff.indicators).toContain('COMPUTE');
  });

  it('C/Y is enter-only: ENTER but not COMPUTE (p. 66)', () => {
    const d = drive(['2ND', 'ICONV', 'DOWN', 'DOWN']).display;
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('offers UP and DOWN while more variables exist (p. 21)', () => {
    const d = drive(['2ND', 'ICONV']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });

  it('carries the global annunciators lit inside the worksheet', () => {
    const bgn: CalculatorState = { ...INITIAL_STATE, tvm: { ...INITIAL_STATE.tvm, mode: 'BGN' } };
    expect(drive(['2ND', 'ICONV'], bgn).display.indicators).toContain('BGN');
  });
});

// ===========================================================================
// The display trap (p. 27): the '=' is the only cue the number is the variable's
// ===========================================================================

describe("the '=' indicator marks a value that belongs to its label (p. 27)", () => {
  it('is lit on a committed field value', () => {
    const d = drive(['2ND', 'ICONV', '15', 'ENTER']).display;
    expect(d.label).toBe('NOM=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry: a half-keyed number belongs to nobody', () => {
    const d = drive(['2ND', 'ICONV', '1', '5']).display;
    expect(d.label).toBe('NOM='); // the label stays...
    expect(d.value).toBe('15');
    expect(d.indicators).not.toContain('='); // ...but the cue is gone.
  });

  it('comes back the instant ENTER assigns it', () => {
    expect(drive(['2ND', 'ICONV', '1', '5', 'ENTER']).display.indicators).toContain('=');
  });
});

// ===========================================================================
// 2ND SET and CPT on fields that do not take them
// ===========================================================================

describe('keys a field cannot take are silent no-ops', () => {
  it('2ND SET does nothing: ICONV declares no settings', () => {
    const r = drive(['2ND', 'ICONV', '15', 'ENTER', '2ND', 'SET']);
    expect(renderFlat(r.display)).toBe('NOM= 15.00');
    expect(r.state.errorState).toBeNull();
  });

  it('CPT on C/Y is inert -- it is enter-only (p. 66)', () => {
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '4', 'ENTER', 'CPT']);
    expect(renderFlat(r.display)).toBe('C/Y= 4.00');
    expect(r.state.iconv.CY).toBe(4);
    expect(r.state.errorState).toBeNull();
  });
});

// ===========================================================================
// Clearing: the C/Y asymmetry (p. 67)
// ===========================================================================

describe('2ND CLR WORK clears NOM and EFF but spares C/Y (p. 67)', () => {
  it('zeroes NOM and EFF, keeps C/Y, and lands on NOM', () => {
    const r = drive([
      '2ND', 'ICONV', '15', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT',
      '2ND', 'CLR WORK',
    ]);
    expect(renderFlat(r.display)).toBe('NOM= 0.00');
    expect(r.state.iconv).toEqual({ NOM: 0, EFF: 0, CY: 4 }); // C/Y survives
  });

  it('is the chapter asymmetry: C/Y is NOT reset to its default of 1', () => {
    // A worksheet whose CLR WORK is defined to leave a variable alone cannot be
    // sharing that variable with the TVM C/Y (p. 67).
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '9', 'ENTER', 'UP', 'UP', '2ND', 'CLR WORK']);
    expect(r.state.iconv.CY).toBe(9);
  });
});

// ===========================================================================
// 2ND QUIT (p. 11)
// ===========================================================================

describe('2ND QUIT leaves to standard-calculator mode (p. 11)', () => {
  it('returns to standard mode at zero, keeping the worksheet values', () => {
    const r = drive(['2ND', 'ICONV', '15', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.iconv.NOM).toBe(15); // persists for the next 2ND ICONV
  });
});

// ===========================================================================
// Totality: the reducer latches, it does not throw (guidebook p. 84)
// ===========================================================================

describe('the reducer stays total inside the worksheet', () => {
  it('latches Error 4 when C/Y is zero and a rate is computed (p. 84)', () => {
    // C/Y sits in a divisor and an exponent; C/Y <= 0 is Error 4. This is the case
    // that pins the dropped p. 84 relational glyph to `<= 0` rather than `< 0`.
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '0', 'ENTER', 'UP', 'CPT']);
    expect(r.display.value).toBe('Error 4');
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('latches Error 4 when C/Y is negative', () => {
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '4', '+/-', 'ENTER', 'UP', 'CPT']);
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('latches Error 2 when NOM = -100 x C/Y drives ln(0) (p. 84)', () => {
    // x = .01 x (-400) / 4 = -1, so x + 1 = 0 and ln is undefined. Interest
    // Conversion is outside p. 84's Error 5 LN scope, so it is Error 2.
    const r = drive(['2ND', 'ICONV', '400', '+/-', 'ENTER', 'DOWN', 'DOWN', '4', 'ENTER', 'UP', 'CPT']);
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
    expect(r.display.value).toBe('Error 2');
  });

  it('latches Error 1 when a huge NOM and C/Y push EFF past the range (p. 84)', () => {
    // x + 1 ~ 1e4 raised to the 9,999th power overflows 1E100 by tens of thousands
    // of orders of magnitude. NOM is keyed at the 10-digit display cap.
    const r = drive(['2ND', 'ICONV', '9999999999', 'ENTER', 'DOWN', 'DOWN', '9999', 'ENTER', 'UP', 'CPT']);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
    expect(r.display.value).toBe('Error 1');
  });

  it('the failed navigation does not move the field', () => {
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '0', 'ENTER', 'UP', 'CPT']);
    // Still on EFF (index 1), where CPT was pressed.
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'ICONV', field: 1 });
  });

  it('CE/C clears the error and the worksheet is still there', () => {
    const r = drive(['2ND', 'ICONV', 'DOWN', 'DOWN', '0', 'ENTER', 'UP', 'CPT', 'CE/C']);
    expect(r.state.errorState).toBeNull();
    expect(renderFlat(r.display)).toBe('EFF= 0.00');
  });
});

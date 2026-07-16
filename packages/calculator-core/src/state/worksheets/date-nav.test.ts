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
import { DATE_WORKSHEET } from './date-nav.js';

/**
 * DATE is not yet in the central `WORKSHEETS` switch -- the registry is wired up
 * centrally after every parallel worksheet lands, and this file must not touch it
 * (or machine.ts). So the machine's `reduce`/`project`, hard-wired to `WORKSHEETS`,
 * would treat `2ND DATE` as a dead key.
 *
 * These tests therefore drive a registry that includes the descriptor through the
 * SAME navigation engine machine.ts uses -- `WORKSHEET_ENTRY_KEYS`,
 * `enterWorksheet`, `reduceWorksheet`, `worksheetDisplay` -- and delegate every
 * standard-calculator key (digits, `.`, `+/-`, `2ND`, QUIT, the TVM keys, ...) to
 * the real `reduce`. `step` and `projectWith` below mirror `machine.dispatch` and
 * `machine.project` with `WORKSHEETS` swapped for this registry; no descriptor
 * handler is ever called directly, only pressed as keys. When the registry is
 * wired centrally, every sequence here runs unchanged through `reduceAll`.
 */
const REGISTRY: WorksheetRegistry = { ...WORKSHEETS, DATE: DATE_WORKSHEET };

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

describe('the DATE descriptor', () => {
  it('agrees with its own kind declarations', () => {
    expect(() => assertRegistryConsistent({ DATE: DATE_WORKSHEET })).not.toThrow();
  });

  it('has its entry key wired in WORKSHEET_ENTRY_KEYS', () => {
    // machine.ts consumes this map; the author does not touch it, but a broken
    // wiring would make 2ND DATE inert.
    expect(WORKSHEET_ENTRY_KEYS['DATE']).toBe('DATE');
  });

  it('lists DT1, DT2, DBD then the day-count slot in LCD order (p. 68)', () => {
    expect(DATE_WORKSHEET.fields.map((f) => f.label)).toEqual(['DT1=', 'DT2=', 'DBD=', '']);
  });
});

// ===========================================================================
// Golden cases -- the p. 69 days-between-dates example, one sequence in steps
// ===========================================================================

describe('golden: other-worksheets-date-* (guidebook p. 69)', () => {
  // other-worksheets-date-default-dt1
  it('opens on the default DT1 = 12-31-1990', () => {
    expect(screen(['2ND', 'DATE'])).toBe('DT1= 12-31-1990');
    expect(value(['2ND', 'DATE'])).toBe('12-31-1990');
  });

  // other-worksheets-date-enter-dt1
  it('reads 9.0403 as 9-04-2003 (US MM.DDYY, unpadded month, padded day)', () => {
    expect(screen(['2ND', 'DATE', '9.0403', 'ENTER'])).toBe('DT1= 9-04-2003');
    expect(value(['2ND', 'DATE', '9.0403', 'ENTER'])).toBe('9-04-2003');
  });

  // other-worksheets-date-enter-dt2
  it('DOWN reaches DT2, and 11.0103 ENTER assigns 11-01-2003', () => {
    const keys = ['2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER'];
    expect(screen(keys)).toBe('DT2= 11-01-2003');
    expect(value(keys)).toBe('11-01-2003');
  });

  // other-worksheets-date-act-setting-displayed
  it('DOWN DOWN from DT2 passes DBD and lands on the bare ACT setting', () => {
    // A setting, not a number: no label, no "=" value -- just the method name.
    const keys = ['2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER', 'DOWN', 'DOWN'];
    expect(screen(keys)).toBe('ACT');
    expect(value(keys)).toBe('ACT');
  });

  // other-worksheets-date-dbd-act -- the project's parity target.
  it('UP from the setting returns to DBD, where CPT computes 58.00', () => {
    const keys = [
      '2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER',
      'DOWN', 'DOWN', 'UP', 'CPT',
    ];
    expect(screen(keys)).toBe('DBD= 58.00');
    expect(value(keys)).toBe('58.00');
  });

  it('displays DBD at the DEC setting, hence 58.00 and not 58', () => {
    const keys = [
      '2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER',
      'DOWN', 'DOWN', 'UP', 'CPT',
    ];
    expect(drive(keys).state.date.DBD).toBe(58);
    expect(value(keys)).toBe('58.00');
  });
});

// ===========================================================================
// Enter two of three, compute the third -- every field interchangeable (p. 69)
// ===========================================================================

describe('any of DT1/DT2/DBD computes from the other two (p. 69)', () => {
  it('enters DBD directly: DOWN DOWN from DT1, 58 ENTER', () => {
    expect(screen(['2ND', 'DATE', 'DOWN', 'DOWN', '58', 'ENTER'])).toBe('DBD= 58.00');
  });

  it('projects DT2 forward: DT1 default + DBD 1 = 1-01-1991', () => {
    // Dec 31 1990 + 1 day crosses the year boundary (matches date.ts).
    const keys = ['2ND', 'DATE', 'DOWN', 'DOWN', '1', 'ENTER', 'UP', 'CPT'];
    expect(screen(keys)).toBe('DT2= 1-01-1991');
    expect(drive(keys).state.date.DT2).toEqual({ year: 1991, month: 1, day: 1 });
  });

  it('projects DT1 backward: DT2 11-01-2003 minus DBD 58 = 9-04-2003', () => {
    const keys = [
      '2ND', 'DATE', 'DOWN', '11.0103', 'ENTER', 'DOWN', '58', 'ENTER', 'UP', 'UP', 'CPT',
    ];
    expect(screen(keys)).toBe('DT1= 9-04-2003');
  });

  it('a computed date overwrites whatever the field held before', () => {
    // DT2 starts at the 12-31-1990 default; computing it replaces that.
    const keys = ['2ND', 'DATE', 'DOWN', 'DOWN', '1', 'ENTER', 'UP', 'CPT'];
    expect(drive(keys).state.date.DT2).not.toEqual({ year: 1990, month: 12, day: 31 });
  });
});

// ===========================================================================
// Navigation -- the four-field ring wraps (pp. 28, 68)
// ===========================================================================

describe('the field ring DT1 -> DT2 -> DBD -> ACT/360 wraps (p. 68)', () => {
  it('opens on DT1', () => {
    expect(drive(['2ND', 'DATE']).display.label).toBe('DT1=');
  });

  it('DOWN steps DT1 -> DT2 -> DBD -> setting', () => {
    expect(drive(['2ND', 'DATE', 'DOWN']).display.label).toBe('DT2=');
    expect(drive(['2ND', 'DATE', 'DOWN', 'DOWN']).display.label).toBe('DBD=');
    expect(value(['2ND', 'DATE', 'DOWN', 'DOWN', 'DOWN'])).toBe('ACT'); // the setting slot
  });

  it('DOWN from the setting wraps back to DT1', () => {
    expect(drive(['2ND', 'DATE', 'DOWN', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('DT1=');
  });

  it('UP from DT1 wraps to the setting slot', () => {
    expect(value(['2ND', 'DATE', 'UP'])).toBe('ACT');
  });

  it('re-pressing 2ND DATE returns to DT1 (p. 28)', () => {
    expect(drive(['2ND', 'DATE', 'DOWN', 'DOWN', '2ND', 'DATE']).display.label).toBe('DT1=');
  });

  it('a stored date reappears after scrolling away and back', () => {
    const keys = ['2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(screen(keys)).toBe('DT1= 9-04-2003');
  });
});

// ===========================================================================
// Indicator prompts follow field type (pp. 21-22)
// ===========================================================================

describe('indicator prompts follow the variable type (pp. 21-22)', () => {
  it('DT1, DT2 and DBD are enter-or-compute: both ENTER and COMPUTE', () => {
    for (const nav of [[], ['DOWN'], ['DOWN', 'DOWN']]) {
      const d = drive(['2ND', 'DATE', ...nav]).display;
      expect(d.indicators).toContain('ENTER');
      expect(d.indicators).toContain('COMPUTE');
    }
  });

  it('the day-count slot is a setting: SET, not ENTER or COMPUTE', () => {
    const d = drive(['2ND', 'DATE', 'DOWN', 'DOWN', 'DOWN']).display;
    expect(d.indicators).toContain('SET');
    expect(d.indicators).not.toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('offers UP and DOWN while more variables exist (p. 21)', () => {
    const d = drive(['2ND', 'DATE']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });

  it('carries the global annunciators lit inside the worksheet', () => {
    const bgn: CalculatorState = { ...INITIAL_STATE, tvm: { ...INITIAL_STATE.tvm, mode: 'BGN' } };
    expect(drive(['2ND', 'DATE'], bgn).display.indicators).toContain('BGN');
  });
});

// ===========================================================================
// The display trap (p. 27): the '=' is the only cue the number is the variable's
// ===========================================================================

describe("the '=' indicator marks a value that belongs to its label (p. 27)", () => {
  it('is lit on a committed date value', () => {
    const d = drive(['2ND', 'DATE', '9.0403', 'ENTER']).display;
    expect(d.label).toBe('DT1=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry: a half-keyed date belongs to nobody', () => {
    const d = drive(['2ND', 'DATE', '9', '.', '0', '4']).display;
    expect(d.label).toBe('DT1='); // the label stays...
    expect(d.value).toBe('9.04');
    expect(d.indicators).not.toContain('='); // ...but the cue is gone.
  });

  it('comes back the instant ENTER assigns it', () => {
    expect(drive(['2ND', 'DATE', '9.0403', 'ENTER']).display.indicators).toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under the numeric DBD label', () => {
    // The trap in its purest form: `DBD= 500.00` on screen, and 500 is PV, not the
    // day count. Only the missing `=` says so. DBD is the field this worksheet can
    // carry the trap on -- DT1/DT2 render a string and light `=` unconditionally.
    const r = drive(['2ND', 'DATE', 'DOWN', 'DOWN', '500', 'PV']);
    expect(r.display.label).toBe('DBD=');
    expect(r.display.value).toBe('500.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.date.DBD).toBe(0); // DBD was NOT touched
    expect(r.state.tvm.PV).toBe(500);
  });
});

// ===========================================================================
// The day-count setting: 2ND SET cycles ACT <-> 360 (pp. 68-69)
// ===========================================================================

describe('2ND SET cycles the ACT/360 day-count method (p. 68)', () => {
  it('renders the setting as the bare method name with SET and = lit', () => {
    const d = drive(['2ND', 'DATE', 'DOWN', 'DOWN', 'DOWN']).display;
    expect(d.value).toBe('ACT');
    expect(d.indicators).toContain('SET');
    expect(d.indicators).toContain('=');
  });

  it('toggles ACT -> 360 -> ACT in place', () => {
    const toSlot = ['2ND', 'DATE', 'DOWN', 'DOWN', 'DOWN'];
    expect(value(toSlot)).toBe('ACT');
    expect(value([...toSlot, '2ND', 'SET'])).toBe('360');
    expect(value([...toSlot, '2ND', 'SET', '2ND', 'SET'])).toBe('ACT');
  });

  it('still computes DBD under 360, one day short of the ACT count (p. 69)', () => {
    // ACT gives 58 for the same pair; 30/360 gives 57 (date.ts).
    const keys = [
      '2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER',
      'DOWN', 'DOWN', '2ND', 'SET', 'UP', 'CPT',
    ];
    expect(screen(keys)).toBe('DBD= 57.00');
    expect(drive(keys).state.date.method).toBe('360');
  });
});

// ===========================================================================
// Clearing and leaving (pp. 11, 68)
// ===========================================================================

describe('2ND CLR WORK resets the dates but spares the day-count method (p. 68)', () => {
  it('restores DT1, DT2, DBD to defaults, keeps 360, and lands on DT1', () => {
    const r = drive([
      '2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER',
      'DOWN', 'DOWN', '2ND', 'SET', '2ND', 'CLR WORK',
    ]);
    expect(renderFlat(r.display)).toBe('DT1= 12-31-1990');
    expect(r.state.date.DT1).toEqual({ year: 1990, month: 12, day: 31 });
    expect(r.state.date.DT2).toEqual({ year: 1990, month: 12, day: 31 });
    expect(r.state.date.DBD).toBe(0);
    expect(r.state.date.method).toBe('360'); // the method is deliberately untouched
  });

  it('touches only this worksheet, not the TVM registers', () => {
    const withPv: CalculatorState = {
      ...INITIAL_STATE,
      tvm: { ...INITIAL_STATE.tvm, PV: 120000 },
    };
    const r = drive(['2ND', 'DATE', '9.0403', 'ENTER', '2ND', 'CLR WORK'], withPv);
    expect(r.state.tvm.PV).toBe(120000);
  });
});

describe('2ND QUIT leaves to standard-calculator mode (p. 11)', () => {
  it('returns to standard mode at zero, keeping the date values', () => {
    const r = drive(['2ND', 'DATE', '9.0403', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.date.DT1).toEqual({ year: 2003, month: 9, day: 4 }); // persists
  });
});

// ===========================================================================
// Totality: the reducer latches, it does not throw (guidebook pp. 84-85)
// ===========================================================================

describe('the reducer stays total inside the worksheet', () => {
  it('latches Error 6 for an impossible date -- January 32 (p. 85)', () => {
    const r = drive(['2ND', 'DATE', '1.3203', 'ENTER']);
    expect(r.display.value).toBe('Error 6');
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.InvalidDate);
  });

  it('latches Error 6 for the wrong entry format, MM.DDYYYY (p. 85)', () => {
    // Six fractional digits: the year was keyed in full instead of two digits.
    const r = drive(['2ND', 'DATE', '9.042003', 'ENTER']);
    expect(r.display.value).toBe('Error 6');
    expect(r.state.errorState).toBe(ErrorCode.InvalidDate);
  });

  it('latches Error 4 when a computed date leaves the 1980-2079 window (p. 84)', () => {
    // DT1 = 12-31-2079 is the last supported day; + 1 falls off the end.
    const r = drive(['2ND', 'DATE', '12.3179', 'ENTER', 'DOWN', 'DOWN', '1', 'ENTER', 'UP', 'CPT']);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('latches Error 5 when DT1/DT2 is computed under the 360 method (p. 69)', () => {
    // "You can compute DBD using this day-count method, but not DT1 or DT2."
    // Error 5 is the project's reading of the barred solve (docs/OPEN-QUESTIONS.md).
    const r = drive([
      '2ND', 'DATE', '9.0403', 'ENTER', 'DOWN', '11.0103', 'ENTER',
      'DOWN', 'DOWN', '2ND', 'SET', 'UP', 'UP', 'CPT',
    ]);
    expect(r.display.value).toBe('Error 5');
    expect(r.state.errorState).toBe(ErrorCode.NoSolution);
  });

  it('the failed navigation does not move the field', () => {
    const r = drive(['2ND', 'DATE', '12.3179', 'ENTER', 'DOWN', 'DOWN', '1', 'ENTER', 'UP', 'CPT']);
    // Still on DT2 (index 1), where CPT was pressed.
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'DATE', field: 1 });
  });

  it('CE/C clears the error and the worksheet is still there', () => {
    const errored = ['2ND', 'DATE', '12.3179', 'ENTER', 'DOWN', 'DOWN', '1', 'ENTER', 'UP', 'CPT'];
    const r = drive([...errored, 'CE/C']);
    expect(r.state.errorState).toBeNull();
    // Back on DT2, showing its own (untouched) default value.
    expect(renderFlat(r.display)).toBe('DT2= 12-31-1990');
  });
});

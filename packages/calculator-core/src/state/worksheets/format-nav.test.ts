/**
 * FORMAT worksheet tests (guidebook pp. 9-10).
 *
 * WHY THIS FILE CARRIES A LOCAL REDUCER. The generic machine hardcodes its
 * registry (`import { WORKSHEETS } from './worksheet-registry.js'`), and FORMAT is
 * wired into that registry centrally, AFTER this worksheet is written -- so at the
 * moment these tests run, a bare `reduce`/`reduceAll` would route `2ND FORMAT` to a
 * worksheet the machine cannot see and render it as standard mode. The navigation
 * framework was built to be registry-injectable for exactly this reason: every
 * `worksheet-nav.ts` export takes a `registry` argument. `reduceCore` below threads
 * a merged `{ ...WORKSHEETS, FORMAT }` registry through the SAME pipeline the real
 * reducer uses (same key ordering, same enter/navigate/dispatch split, same error
 * latch), delegating every standard-calculator key to the real `reduce` -- whose
 * own worksheet routing is inert for FORMAT and so does no harm. Presses still go
 * in as `parseKeySequence` tokens; nothing calls a descriptor's `get`/`set`/`cycle`
 * directly. When FORMAT joins the central registry this harness becomes redundant
 * and the same sequences will run on the real `reduceAll` unchanged.
 */
import { describe, it, expect } from 'vitest';
import { reduce as machineReduce, project as machineProject, INITIAL_STATE } from '../machine.js';
import { parseKeySequence, type Key } from '../keys.js';
import { renderFlat, errorDisplayState, type DisplayState, type Indicator } from '../display-state.js';
import { CalculatorError, ErrorCode } from '../../errors.js';
import { FORMAT_DEFAULTS, type CalculatorState } from '../state.js';
import {
  WORKSHEET_ENTRY_KEYS,
  assertRegistryConsistent,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
  type WorksheetRegistry,
} from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { FORMAT } from './format-nav.js';

// ---------------------------------------------------------------------------
// The harness: the machine's pipeline with FORMAT injected into the registry.
// ---------------------------------------------------------------------------

const REGISTRY: WorksheetRegistry = { ...WORKSHEETS, FORMAT };

const disarm = (s: CalculatorState): CalculatorState => ({
  ...s,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

/** Mirror of machine.indicatorsFor -- the global annunciators a worksheet carries. */
function baseIndicators(s: CalculatorState): Indicator[] {
  const ind: Indicator[] = [];
  if (s.secondArmed) ind.push('2nd');
  if (s.invArmed) ind.push('INV');
  if (s.hypArmed) ind.push('HYP');
  if (s.format.angleUnit === 'RAD') ind.push('RAD');
  if (s.tvm.mode === 'BGN') ind.push('BGN');
  return ind;
}

/** Mirror of machine.dispatch, but worksheet keys route through REGISTRY. */
function dispatchCore(state: CalculatorState, key: Key): CalculatorState {
  if (key === '2ND') return { ...state, secondArmed: !state.secondArmed };
  if (key === 'INV') return { ...state, invArmed: true, secondArmed: false };
  if (key === 'HYP') return { ...state, hypArmed: true, secondArmed: false };

  const opens = WORKSHEET_ENTRY_KEYS[key];
  if (opens !== undefined) return disarm(enterWorksheet(state, opens, REGISTRY));

  if (state.mode.kind === 'worksheet') {
    const next = reduceWorksheet(state, key, REGISTRY);
    if (next !== null) return disarm(next);
  }

  // Standard-calculator fall-through. Entry keys and the modifier latches are
  // already handled above, and the real reducer's own worksheet routing is inert
  // for FORMAT, so this only ever runs standard-mode logic (digits, operators,
  // QUIT, CE/C) -- taken verbatim from the machine so the arithmetic is real.
  return machineReduce(state, key).state;
}

function reduceCore(state: CalculatorState, key: Key): CalculatorState {
  // Powered-off and error-latched gates are registry-independent; let the real
  // reducer own them (CE/C recovery, key-swallowing).
  if (!state.poweredOn || state.errorState !== null) return machineReduce(state, key).state;
  try {
    return dispatchCore(state, key);
  } catch (e) {
    if (e instanceof CalculatorError) {
      return { ...disarm(state), errorState: e.code, entryBuffer: null };
    }
    throw e;
  }
}

function projectWith(state: CalculatorState): DisplayState {
  if (state.errorState !== null) return errorDisplayState(state.errorState);
  if (state.mode.kind === 'worksheet') {
    const fmt = { decimals: state.format.DEC, separator: state.format.separators };
    const d = worksheetDisplay(state, REGISTRY, fmt, baseIndicators(state));
    if (d !== null) return d;
  }
  return machineProject(state);
}

function run(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  let s = from;
  for (const key of parseKeySequence(tokens)) s = reduceCore(s, key);
  return { state: s, display: projectWith(s) };
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(run(tokens, from).display);

// ===========================================================================
// The descriptor is well-formed
// ===========================================================================

describe('the FORMAT descriptor is consistent with the contract', () => {
  it('passes the registry self-check once merged in', () => {
    expect(() => assertRegistryConsistent(REGISTRY)).not.toThrow();
  });

  it('lists DEC then the four settings, in LCD order (p. 9)', () => {
    expect(FORMAT.fields.map((f) => f.kind)).toEqual([
      'entry',
      'setting',
      'setting',
      'setting',
      'setting',
    ]);
  });

  it('names an entry key that opens FORMAT', () => {
    expect(WORKSHEET_ENTRY_KEYS['FORMAT']).toBe('FORMAT');
  });
});

// ===========================================================================
// Entering and navigating the ring (p. 9)
// ===========================================================================

describe('2ND FORMAT opens on DEC (p. 9 step 1)', () => {
  it('lands on the DEC field showing the current setting', () => {
    const r = run(['2ND', 'FORMAT']);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
    expect(r.display.label).toBe('DEC=');
    // DEC=2 default rendered like every numeric field on this machine (FMT-7).
    expect(r.display.value).toBe('2.00');
  });

  it('offers UP and DOWN, there being five variables to walk (p. 9)', () => {
    const d = run(['2ND', 'FORMAT']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });
});

describe('golden: overview-display-formats-nav-* (guidebook p. 9)', () => {
  it('nav-dec-to-angle-units: one DOWN reaches the angle-unit format -> DEG', () => {
    expect(screen(['2ND', 'FORMAT', 'DOWN'])).toBe('DEG');
  });

  it('nav-dec-to-separators: three DOWN reach the number-separator format -> US', () => {
    // p. 9 prints "↑↑↑ or ↓↓↓"; only the ↓ path is arithmetically consistent
    // (FMT-1), and only it is encoded.
    expect(screen(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN'])).toBe('US');
  });

  it('walks every field in order: DEC, DEG, US(date), US(sep), Chn(method)', () => {
    expect(run(['2ND', 'FORMAT']).display.label).toBe('DEC=');
    expect(screen(['2ND', 'FORMAT', 'DOWN'])).toBe('DEG');
    expect(screen(['2ND', 'FORMAT', 'DOWN', 'DOWN'])).toBe('US');
    expect(screen(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN'])).toBe('US');
    expect(screen(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('Chn');
  });

  it('the ring wraps: DOWN off the calc method returns to DEC', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN']);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
    expect(r.display.label).toBe('DEC=');
  });

  it('UP from DEC wraps to the calc method', () => {
    expect(screen(['2ND', 'FORMAT', 'UP'])).toBe('Chn');
  });
});

// ===========================================================================
// DEC: the entry field (p. 9 step 2, and the DEC=9 floating trap)
// ===========================================================================

describe('DEC takes a keyed value and ENTER (p. 9 step 2)', () => {
  it('stores a fixed place count', () => {
    const r = run(['2ND', 'FORMAT', '4', 'ENTER']);
    expect(r.state.format.DEC).toBe(4);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
    expect(r.display.indicators).toContain('=');
  });

  it('DEC governs display only: a later result shows to the chosen places', () => {
    // 1 / 8 = 0.125 exactly; at DEC=4 it reads 0.1250.
    expect(screen(['2ND', 'FORMAT', '4', 'ENTER', '2ND', 'QUIT', '1', '÷', '8', '='])).toBe(
      '0.1250',
    );
  });

  it('DEC=9 selects FLOATING decimal, not nine fixed places (p. 9)', () => {
    // Nine fixed places would print 0.125000000; floating trims to 0.125.
    expect(screen(['2ND', 'FORMAT', '9', 'ENTER', '2ND', 'QUIT', '1', '÷', '8', '='])).toBe(
      '0.125',
    );
  });

  it('DEC=0 shows no decimal places at all', () => {
    expect(screen(['2ND', 'FORMAT', '0', 'ENTER', '2ND', 'QUIT', '1', '÷', '8', '='])).toBe('0');
  });

  it('the entered value keeps full internal precision; only DEC changes rendering', () => {
    // The stored DEC is exactly the keyed integer, no rounding artefact.
    expect(run(['2ND', 'FORMAT', '9', 'ENTER']).state.format.DEC).toBe(9);
  });
});

describe('DEC out of range is Error 4 (p. 84)', () => {
  it('10 is above the range', () => {
    const r = run(['2ND', 'FORMAT', '10', 'ENTER']);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('a negative DEC is below the range', () => {
    const r = run(['2ND', 'FORMAT', '5', '+/-', 'ENTER']);
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('the bad entry does not change DEC, and CE/C recovers into the worksheet', () => {
    const errored = run(['2ND', 'FORMAT', '10', 'ENTER']);
    expect(errored.state.format.DEC).toBe(2); // untouched
    const cleared = run(['CE/C'], errored.state);
    expect(cleared.state.errorState).toBeNull();
    expect(cleared.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
  });

  it('a fractional DEC truncates rather than erroring (FMT-6)', () => {
    // 2.5 is inside 0-9, so it is not Error 4; truncation keeps a place count of 2.
    expect(run(['2ND', 'FORMAT', '2.5', 'ENTER']).state.format.DEC).toBe(2);
  });

  it('2ND SET on DEC is a no-op: DEC is keyed, not cycled (FMT-3)', () => {
    const r = run(['2ND', 'FORMAT', '2ND', 'SET']);
    expect(r.state.format.DEC).toBe(2);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
    expect(r.display.label).toBe('DEC=');
  });
});

// ===========================================================================
// The four settings, cycled with 2ND SET (p. 9 step 4, p. 10)
// ===========================================================================

describe('2ND SET toggles each setting (p. 9-10)', () => {
  it('spec select-radians (p. 9-10 keystroke table): angle unit DEG -> RAD', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', '2ND', 'SET']);
    expect(renderFlat(r.display)).toBe('RAD');
    expect(r.state.format.angleUnit).toBe('RAD');
    expect(r.display.indicators).toContain('SET');
    expect(r.display.indicators).toContain('=');
  });

  it('spec select-european-dates (p. 9 keystroke table): date format US -> Eur', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', 'DOWN', '2ND', 'SET']);
    expect(renderFlat(r.display)).toBe('Eur');
    expect(r.state.format.dateFormat).toBe('EUR');
  });

  it('spec select-european-separators (p. 9 keystroke table): separators US -> Eur', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', '2ND', 'SET']);
    expect(renderFlat(r.display)).toBe('Eur');
    expect(r.state.format.separators).toBe('EUR');
  });

  it('golden overview-display-formats-select-aos-via-format: calc method Chn -> AOS', () => {
    expect(screen(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '2ND', 'SET'])).toBe('AOS');
  });

  it('a second 2ND SET wraps a two-state setting back (p. 9)', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', '2ND', 'SET', '2ND', 'SET']);
    expect(renderFlat(r.display)).toBe('DEG');
    expect(r.state.format.angleUnit).toBe('DEG');
  });

  it('the separator toggle re-renders the number field (p. 9)', () => {
    // Eur separators print 1.000,00: the change is visible in a later result.
    expect(
      screen([
        '2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', '2ND', 'SET',
        '2ND', 'QUIT', '1000', '=',
      ]),
    ).toBe('1.000,00');
  });
});

// ===========================================================================
// The calc-method setting actually drives standard-mode evaluation (p. 10)
// ===========================================================================

describe('golden: overview-display-formats-{chn,aos}-3-plus-2-times-4 (guidebook p. 10)', () => {
  it('chn: 3 + 2 x 4 evaluates in entry order -> 20.00', () => {
    // Chn is the power-on default, so this needs no format change.
    expect(screen(['3', '+', '2', '×', '4', '='])).toBe('20.00');
  });

  it('aos: selecting AOS via FORMAT then the same keys -> 11.00', () => {
    // Drive the whole path through the worksheet: set AOS, quit, evaluate.
    expect(
      screen([
        '2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '2ND', 'SET',
        '2ND', 'QUIT', '3', '+', '2', '×', '4', '=',
      ]),
    ).toBe('11.00');
  });
});

// ===========================================================================
// 2ND CLR WORK resets ALL FIVE formats (p. 10 / edge case 10)
// ===========================================================================

describe('2ND CLR WORK restores every format, not just the one shown (p. 10)', () => {
  /** A machine with all five formats moved off their defaults. */
  const scrambled: CalculatorState = {
    ...INITIAL_STATE,
    format: { DEC: 5, angleUnit: 'RAD', dateFormat: 'EUR', separators: 'EUR', calcMethod: 'AOS' },
  };

  it('CLR WORK from the calc-method field still resets DEC, angle, date and separators', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '2ND', 'CLR WORK'], scrambled);
    expect(r.state.format).toEqual(FORMAT_DEFAULTS);
  });

  it('returns to the first field, DEC, at its default', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', '2ND', 'CLR WORK'], scrambled);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'FORMAT', field: 0 });
    expect(r.display.label).toBe('DEC=');
    expect(r.display.value).toBe('2.00');
  });

  it('touches only the formats -- memories and worksheet data survive', () => {
    const withData: CalculatorState = {
      ...scrambled,
      profit: { CST: 100, SEL: 125, MAR: 20 },
      tvm: { ...INITIAL_STATE.tvm, PV: 120000 },
    };
    const r = run(['2ND', 'FORMAT', '2ND', 'CLR WORK'], withData);
    expect(r.state.profit).toEqual({ CST: 100, SEL: 125, MAR: 20 });
    expect(r.state.tvm.PV).toBe(120000);
  });
});

// ===========================================================================
// 2ND QUIT leaves without reverting (p. 7, p. 11, spec Clearing/reset)
// ===========================================================================

describe('2ND QUIT returns to standard mode and keeps the changed formats (p. 11)', () => {
  it('a setting changed with 2ND SET survives QUIT intact', () => {
    const r = run(['2ND', 'FORMAT', 'DOWN', '2ND', 'SET', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(r.state.format.angleUnit).toBe('RAD'); // not reverted
    expect(renderFlat(r.display)).toBe('0.00');
  });

  it('a DEC change survives QUIT and keeps governing the display', () => {
    const r = run(['2ND', 'FORMAT', '4', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.format.DEC).toBe(4);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(r.display.value).toBe('0.0000');
  });
});

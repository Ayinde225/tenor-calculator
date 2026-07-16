/**
 * Percent Change / Compound Interest worksheet, driven through real key presses.
 *
 * WHY A LOCAL HARNESS. This descriptor is not yet in the central `WORKSHEETS`
 * registry -- the wiring is added elsewhere, after all ten worksheets land, and
 * this file must not edit `worksheet-registry.ts`. So `machine.reduce`, which is
 * hard-wired to `WORKSHEETS`, cannot reach PCT on its own. `applyKey` below
 * reproduces `machine.dispatch` at exactly the three points where the registry is
 * consulted -- the worksheet entry key, the navigation keys, and the projection --
 * and delegates every other transition to the real `machine.reduce`. Those other
 * transitions are registry-independent: for any key that is neither a worksheet
 * entry key nor a navigation key, `reduceWorksheet` returns null regardless of
 * which registry it is handed, so the standard reducer already computes the
 * correct state. The result is that PCT is exercised through `parseKeySequence`
 * and the genuine key vocabulary, not by calling descriptor functions directly.
 *
 * Every golden case in tests/golden/other-worksheets.json that belongs to PCT is
 * asserted below by its id, against the exact flat display string.
 */
import { describe, it, expect } from 'vitest';
import { reduce as machineReduce, INITIAL_STATE } from '../machine.js';
import { parseKeySequence, type Key } from '../keys.js';
import {
  renderFlat,
  renderEntry,
  renderValue,
  errorDisplayState,
  type Indicator,
  type DisplayState,
} from '../display-state.js';
import { CalculatorError, ErrorCode } from '../../errors.js';
import type { CalculatorState } from '../state.js';
import {
  WORKSHEET_ENTRY_KEYS,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
  assertRegistryConsistent,
  type WorksheetRegistry,
} from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { PERCENT_CHANGE } from './percent-change-nav.js';

// The registry the machine will hold once PCT is wired centrally.
const registry: WorksheetRegistry = { ...WORKSHEETS, PCT: PERCENT_CHANGE };

// Exactly `worksheet-nav.ts`'s NAVIGATION_KEYS (not exported).
const NAV: ReadonlySet<Key> = new Set<Key>(['UP', 'DOWN', 'ENTER', 'CPT', 'SET', 'CLR WORK', 'CE/C']);

const disarm = (s: CalculatorState): CalculatorState => ({
  ...s,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

const latch = (s: CalculatorState, code: ErrorCode): CalculatorState => ({
  ...s,
  errorState: code,
  entryBuffer: null,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

/** One key, routed exactly as `machine.dispatch` would with `registry` in place. */
function applyKey(state: CalculatorState, key: Key): CalculatorState {
  // An error latches the display until CE/C; the standard reducer handles that
  // gate (and ON/OFF) registry-free.
  if (state.errorState !== null) return machineReduce(state, key).state;

  try {
    const opens = WORKSHEET_ENTRY_KEYS[key];
    if (opens !== undefined) return disarm(enterWorksheet(state, opens, registry));

    if (state.mode.kind === 'worksheet' && NAV.has(key)) {
      const next = reduceWorksheet(state, key, registry);
      if (next !== null) return disarm(next);
    }
  } catch (e) {
    if (e instanceof CalculatorError) return latch(state, e.code);
    throw e;
  }

  // Digits, '.', +/-, 2ND, QUIT, ... -- registry-independent, so the real reducer
  // produces the correct state.
  return machineReduce(state, key).state;
}

/** Mirror of `machine.project`, but projecting the field from `registry`. */
function projectWith(state: CalculatorState): DisplayState {
  if (state.errorState !== null) return errorDisplayState(state.errorState);
  const fmt = { decimals: state.format.DEC, separator: state.format.separators };
  const ind: Indicator[] = [];
  if (state.secondArmed) ind.push('2nd');
  if (state.invArmed) ind.push('INV');
  if (state.hypArmed) ind.push('HYP');
  if (state.format.angleUnit === 'RAD') ind.push('RAD');
  if (state.tvm.mode === 'BGN') ind.push('BGN');

  if (state.mode.kind === 'worksheet') {
    const d = worksheetDisplay(state, registry, fmt, ind);
    if (d !== null) return d;
  }
  if (state.entryBuffer !== null) return renderEntry(state.entryBuffer, fmt, '', ind);
  return renderValue(state.displayValue, fmt, '', ind);
}

function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  let s = from;
  for (const k of parseKeySequence(tokens)) s = applyKey(s, k);
  return { state: s, display: projectWith(s) };
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

// ===========================================================================
// The registry accepts the descriptor
// ===========================================================================

describe('the PCT descriptor is well-formed', () => {
  it('passes the registry consistency check alongside the reference worksheets', () => {
    expect(() => assertRegistryConsistent(registry)).not.toThrow();
  });

  it('is reached by the 2ND Δ% entry key', () => {
    expect(WORKSHEET_ENTRY_KEYS['Δ%']).toBe('PCT');
    expect(PERCENT_CHANGE.id).toBe('PCT');
    expect(press(['2ND', 'Δ%']).state.mode).toEqual({
      kind: 'worksheet',
      worksheet: 'PCT',
      field: 0,
    });
  });
});

// ===========================================================================
// Golden: Computing Percent Change (guidebook p. 65)
// ===========================================================================

describe('golden: other-worksheets-pct-change-* (guidebook p. 65)', () => {
  it('enter-old: 2ND Δ% 658 ENTER -> OLD= 658.00', () => {
    expect(screen(['2ND', 'Δ%', '658', 'ENTER'])).toBe('OLD= 658.00');
  });

  it('enter-new: DOWN 700 ENTER -> NEW= 700.00', () => {
    expect(screen(['2ND', 'Δ%', '658', 'ENTER', 'DOWN', '700', 'ENTER'])).toBe('NEW= 700.00');
  });

  it('compute-pct: DOWN CPT -> %CH= 6.38 (relies on the default #PD = 1)', () => {
    // The example never clears the worksheet; 658->700 at #PD=1 is 6.382978...%.
    expect(screen(['2ND', 'Δ%', '658', 'ENTER', 'DOWN', '700', 'ENTER', 'DOWN', 'CPT'])).toBe(
      '%CH= 6.38',
    );
  });

  it('enter-negative-pct: keying -7 over the computed %CH -> %CH= -7.00', () => {
    expect(
      screen([
        '2ND', 'Δ%', '658', 'ENTER',
        'DOWN', '700', 'ENTER',
        'DOWN', 'CPT',
        '7', '+/-', 'ENTER',
      ]),
    ).toBe('%CH= -7.00');
  });

  it('compute-new-from-negative: UP CPT -> NEW= 611.94 (658 x 0.93)', () => {
    expect(
      screen([
        '2ND', 'Δ%', '658', 'ENTER',
        'DOWN', '700', 'ENTER',
        'DOWN', 'CPT',
        '7', '+/-', 'ENTER',
        'UP', 'CPT',
      ]),
    ).toBe('NEW= 611.94');
  });
});

// ===========================================================================
// Golden: Computing Compound Interest (guidebook p. 65) -- the #PD-is-exponent arbiter
// ===========================================================================

describe('golden: other-worksheets-compound-interest-* (guidebook p. 65)', () => {
  it('enter-old: 500 ENTER -> OLD= 500.00', () => {
    expect(screen(['2ND', 'Δ%', '500', 'ENTER'])).toBe('OLD= 500.00');
  });

  it('enter-new: DOWN 750 ENTER -> NEW= 750.00', () => {
    expect(screen(['2ND', 'Δ%', '500', 'ENTER', 'DOWN', '750', 'ENTER'])).toBe('NEW= 750.00');
  });

  it('enter-periods: DOWN DOWN 5 ENTER -> #PD= 5.00', () => {
    expect(
      screen(['2ND', 'Δ%', '500', 'ENTER', 'DOWN', '750', 'ENTER', 'DOWN', 'DOWN', '5', 'ENTER']),
    ).toBe('#PD= 5.00');
  });

  it('growth-rate: UP CPT -> %CH= 8.45 (proves #PD is an EXPONENT, OW-2)', () => {
    // 100 x ((750/500)^(1/5) - 1) = 8.4472...%. A multiplicative reading gives 10.
    expect(
      screen([
        '2ND', 'Δ%', '500', 'ENTER',
        'DOWN', '750', 'ENTER',
        'DOWN', 'DOWN', '5', 'ENTER',
        'UP', 'CPT',
      ]),
    ).toBe('%CH= 8.45');
  });
});

// ===========================================================================
// Golden: Cost-Sell-Markup (guidebook pp. 65-66) -- the #PD-clears-to-1 arbiter
// ===========================================================================

describe('golden: other-worksheets-cost-sell-markup-* (guidebook pp. 65-66)', () => {
  it('clr-work-zeroes-old: 2ND CLR WORK -> OLD= 0.00', () => {
    expect(screen(['2ND', 'Δ%', '2ND', 'CLR WORK'])).toBe('OLD= 0.00');
  });

  it('enter-cost: 100 ENTER -> OLD= 100.00', () => {
    expect(screen(['2ND', 'Δ%', '2ND', 'CLR WORK', '100', 'ENTER'])).toBe('OLD= 100.00');
  });

  it('enter-sell: DOWN 125 ENTER -> NEW= 125.00', () => {
    expect(screen(['2ND', 'Δ%', '2ND', 'CLR WORK', '100', 'ENTER', 'DOWN', '125', 'ENTER'])).toBe(
      'NEW= 125.00',
    );
  });

  it('markup: DOWN CPT -> %CH= 25.00 (unreachable unless CLR WORK left #PD = 1, OW-1)', () => {
    // The arbiter for OW-1: only OLD and NEW are keyed after the clear. If #PD
    // cleared to 0, solveCH would divide by zero on the 1/#PD term (Error 1).
    expect(
      screen([
        '2ND', 'Δ%', '2ND', 'CLR WORK',
        '100', 'ENTER',
        'DOWN', '125', 'ENTER',
        'DOWN', 'CPT',
      ]),
    ).toBe('%CH= 25.00');
  });
});

// ===========================================================================
// Every field solves for the other three (guidebook p. 64)
// ===========================================================================

describe('any of the four variables is the unknown (p. 64)', () => {
  it('computes OLD from NEW, %CH and the default #PD', () => {
    // 125 / 1.25 = 100.
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      'DOWN', '125', 'ENTER',
      'DOWN', '25', 'ENTER',
      'UP', 'UP', 'CPT',
    ]);
    expect(renderFlat(r.display)).toBe('OLD= 100.00');
    expect(r.state.pctChange.OLD).toBe(100);
  });

  it('computes #PD from OLD, NEW and %CH', () => {
    // A doubling at 100% per period takes exactly one period: ln(2)/ln(2) = 1.
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      '100', 'ENTER',
      'DOWN', '200', 'ENTER',
      'DOWN', '100', 'ENTER',
      'DOWN', 'CPT',
    ]);
    expect(renderFlat(r.display)).toBe('#PD= 1.00');
    expect(r.state.pctChange.PD).toBe(1);
  });
});

// ===========================================================================
// Navigation: the four-field ring (p. 64)
// ===========================================================================

describe('the field ring is OLD -> NEW -> %CH -> #PD and wraps (p. 64)', () => {
  const open = ['2ND', 'Δ%'] as const;

  it('DOWN walks all four labels in order', () => {
    expect(press([...open]).display.label).toBe('OLD=');
    expect(press([...open, 'DOWN']).display.label).toBe('NEW=');
    expect(press([...open, 'DOWN', 'DOWN']).display.label).toBe('%CH=');
    expect(press([...open, 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('#PD=');
  });

  it('DOWN from #PD wraps back to OLD', () => {
    expect(press([...open, 'DOWN', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('OLD=');
  });

  it('UP from OLD wraps to #PD', () => {
    expect(press([...open, 'UP']).display.label).toBe('#PD=');
  });
});

// ===========================================================================
// The '=' display trap and the prompt indicators (pp. 21-22, 27)
// ===========================================================================

describe("the '=' indicator marks the value as the field's own (p. 27)", () => {
  it('is lit on a freshly entered value', () => {
    const d = press(['2ND', 'Δ%', '658', 'ENTER']).display;
    expect(d.label).toBe('OLD=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry -- the label stays but the cue is gone', () => {
    const d = press(['2ND', 'Δ%', '658']).display;
    expect(d.label).toBe('OLD=');
    expect(d.value).toBe('658');
    expect(d.indicators).not.toContain('=');
  });
});

describe('every field is enter-or-compute (p. 64) and prompts accordingly', () => {
  it('lights ENTER and COMPUTE together on each of the four fields', () => {
    for (const nav of [[], ['DOWN'], ['DOWN', 'DOWN'], ['DOWN', 'DOWN', 'DOWN']]) {
      const d = press(['2ND', 'Δ%', ...nav]).display;
      expect(d.indicators).toContain('ENTER');
      expect(d.indicators).toContain('COMPUTE');
    }
  });

  it('offers UP and DOWN, there being four variables to walk', () => {
    const d = press(['2ND', 'Δ%']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });
});

// ===========================================================================
// Clearing and leaving (p. 63)
// ===========================================================================

describe('2ND CLR WORK resets the worksheet to defaults (p. 63, OW-1)', () => {
  it('zeroes OLD/NEW/%CH but sets #PD to 1, and lands on OLD', () => {
    const r = press([
      '2ND', 'Δ%',
      '658', 'ENTER',
      'DOWN', '700', 'ENTER',
      'DOWN', 'DOWN', '5', 'ENTER',
      '2ND', 'CLR WORK',
    ]);
    expect(renderFlat(r.display)).toBe('OLD= 0.00');
    expect(r.state.pctChange).toEqual({ OLD: 0, NEW: 0, CH: 0, PD: 1 });
  });

  it('touches only this worksheet, not TVM or Profit Margin', () => {
    const seeded = press(['2ND', 'PROFIT', '100', 'ENTER']).state;
    const withTvm: CalculatorState = { ...seeded, tvm: { ...seeded.tvm, PV: 120000 } };
    const r = press(['2ND', 'Δ%', '500', 'ENTER', '2ND', 'CLR WORK'], withTvm);
    expect(r.state.pctChange).toEqual({ OLD: 0, NEW: 0, CH: 0, PD: 1 });
    expect(r.state.profit.CST).toBe(100);
    expect(r.state.tvm.PV).toBe(120000);
  });
});

describe('2ND QUIT leaves to standard mode without clearing (p. 63)', () => {
  it('returns to standard mode at zero, keeping the worksheet values', () => {
    const r = press(['2ND', 'Δ%', '658', 'ENTER', 'DOWN', '700', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.pctChange.OLD).toBe(658);
    expect(r.state.pctChange.NEW).toBe(700);
  });

  it('re-opening shows the retained OLD (values persist across QUIT)', () => {
    const quit = press(['2ND', 'Δ%', '658', 'ENTER', '2ND', 'QUIT']).state;
    expect(screen(['2ND', 'Δ%'], quit)).toBe('OLD= 658.00');
  });
});

// ===========================================================================
// Errors (guidebook p. 84) -- the reducer stays total
// ===========================================================================

describe('the worksheet raises Error 1 on an internal divide by zero (p. 84)', () => {
  it('computing %CH with OLD = 0 divides by zero -> Error 1', () => {
    const r = press(['2ND', 'Δ%', '2ND', 'CLR WORK', 'DOWN', '200', 'ENTER', 'DOWN', 'CPT']);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 1');
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('computing OLD with %CH = -100 collapses the factor to zero -> Error 1', () => {
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      'DOWN', '100', 'ENTER',
      'DOWN', '100', '+/-', 'ENTER',
      'UP', 'UP', 'CPT',
    ]);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('computing #PD with %CH = 0 makes ln(1) = 0 the divisor -> Error 1', () => {
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      '100', 'ENTER',
      'DOWN', '200', 'ENTER',
      'DOWN', 'DOWN', 'CPT',
    ]);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });
});

describe('the worksheet raises Error 2 on an invalid argument (p. 84)', () => {
  it('computing #PD across a sign change takes ln of a negative -> Error 2', () => {
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      '100', 'ENTER',
      'DOWN', '50', '+/-', 'ENTER',
      'DOWN', 'DOWN', 'CPT',
    ]);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 2');
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
  });

  it('computing %CH with a negative ratio and an even root -> Error 2', () => {
    // NEW/OLD = -1 under #PD = 2 asks for a real square root of -1.
    const r = press([
      '2ND', 'Δ%', '2ND', 'CLR WORK',
      '100', 'ENTER',
      'DOWN', '100', '+/-', 'ENTER',
      'DOWN', 'DOWN', '2', 'ENTER',
      'UP', 'CPT',
    ]);
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
  });
});

describe('an error is recoverable and leaves the worksheet in place', () => {
  it('CE/C CE/C clears the error and re-shows the field', () => {
    const errored = press(['2ND', 'Δ%', '2ND', 'CLR WORK', 'DOWN', '200', 'ENTER', 'DOWN', 'CPT']);
    expect(errored.state.errorState).toBe(ErrorCode.Overflow);

    let s = errored.state;
    for (const k of parseKeySequence(['CE/C', 'CE/C'])) s = applyKey(s, k);
    expect(s.errorState).toBeNull();
    expect(s.mode).toEqual({ kind: 'worksheet', worksheet: 'PCT', field: 2 });
    expect(renderFlat(projectWith(s))).toBe('%CH= 0.00');
  });
});

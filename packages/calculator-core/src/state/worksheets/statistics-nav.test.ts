/**
 * Statistics worksheet tests -- both rings (2ND DATA, 2ND STAT).
 *
 * NO GOLDEN CASES EXIST. tests/golden/statistics.json is `cases: []`, and that is
 * correct, not a gap: the guidebook has no Statistics worked example anywhere
 * (docs/OPEN-QUESTIONS.md, STAT-1). So every expected value below is derived by
 * hand from the p. 80 appendix formulas -- computed at each use site -- and the
 * arithmetic is the only oracle. That is the weakest verification in the engine and
 * it is called out so no reader mistakes these for transcribed hardware output.
 *
 * DRIVING THROUGH KEY PRESSES WITHOUT THE CENTRAL WIRING. The DATA/STAT descriptors
 * are not yet in `WORKSHEETS` (they are registered centrally, after this task), so
 * the shipped `reduceAll` cannot reach them. `drive` below is a faithful stand-in:
 * it runs the REAL framework functions -- `enterWorksheet`, `reduceWorksheet`,
 * `worksheetDisplay` -- against a registry that merges these two descriptors in,
 * and defers every registry-independent key (digits, +/-, 2ND, QUIT, ...) to the
 * shipped `reduce`. It mirrors machine.ts's pipeline exactly (the same latch gate,
 * the same disarm, the same catch-and-latch), so once the wiring lands the same
 * `parseKeySequence` token lists will run unchanged through `reduceAll`.
 */
import { describe, it, expect } from 'vitest';
import { reduce as baseReduce, INITIAL_STATE } from '../machine.js';
import { parseKeySequence, type Key } from '../keys.js';
import {
  renderEntry,
  renderFlat,
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
import { DATA_WORKSHEET, STAT_WORKSHEET } from './statistics-nav.js';

// ---------------------------------------------------------------------------
// The local machine stand-in (see the file header)
// ---------------------------------------------------------------------------

const REGISTRY: WorksheetRegistry = { ...WORKSHEETS, DATA: DATA_WORKSHEET, STAT: STAT_WORKSHEET };

const disarm = (s: CalculatorState): CalculatorState => ({
  ...s,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

function baseIndicators(s: CalculatorState): Indicator[] {
  const ind: Indicator[] = [];
  if (s.secondArmed) ind.push('2nd');
  if (s.invArmed) ind.push('INV');
  if (s.hypArmed) ind.push('HYP');
  if (s.format.angleUnit === 'RAD') ind.push('RAD');
  if (s.tvm.mode === 'BGN') ind.push('BGN');
  return ind;
}

/** project() from machine.ts, re-pointed at the merged registry. */
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

/** One key, routed exactly as machine.ts routes it but with the merged registry. */
function step(s: CalculatorState, key: Key): CalculatorState {
  // Powered off / latched error are handled identically by the shipped reducer.
  if (!s.poweredOn || s.errorState !== null) return baseReduce(s, key).state;

  try {
    const opens = WORKSHEET_ENTRY_KEYS[key];
    if (opens !== undefined) return disarm(enterWorksheet(s, opens, REGISTRY));
    if (s.mode.kind === 'worksheet') {
      const next = reduceWorksheet(s, key, REGISTRY);
      if (next !== null) return disarm(next);
    }
    // Registry-independent keys (digits, +/-, 2ND, QUIT, TVM, ...) are the shipped
    // reducer's job; it falls through the unregistered worksheet the same way.
    return baseReduce(s, key).state;
  } catch (e) {
    if (e instanceof CalculatorError) {
      return { ...disarm(s), errorState: e.code, entryBuffer: null };
    }
    throw e;
  }
}

function drive(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  let s = from;
  for (const k of parseKeySequence(tokens)) s = step(s, k);
  return { state: s, display: projectWith(s) };
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(drive(tokens, from).display);

// ---------------------------------------------------------------------------
// Fixtures -- data sets and their hand-derived statistics (p. 80)
// ---------------------------------------------------------------------------

/**
 * The perfect line Y = 2X through (1,2), (2,4), (3,6).
 *   ΣX=6  ΣX2=14  ΣY=12  ΣY2=56  ΣXY=28  n=3
 *   x̄=2  σx=√(2/3)=0.8165  Sx=√1=1
 *   ȳ=4  σy=√(8/3)=1.6330  Sy=√4=2
 *   b=(3·28-12·6)/(3·14-36)=12/6=2   a=(12-2·6)/3=0   r=b·σx/σy=2·½=1
 */
const linData = [
  '2ND', 'DATA', '2ND', 'CLR WORK',
  '1', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN',
  '2', 'ENTER', 'DOWN', '4', 'ENTER', 'DOWN',
  '3', 'ENTER', 'DOWN', '6', 'ENTER',
];

/**
 * One-variable data: value 10 with frequency 2, value 20 with frequency 3, i.e.
 * {10,10,20,20,20} (p. 60 -- Ynn is the count of occurrences).
 *   n=ΣYnn=5  ΣX=Σ(Ynn·Xnn)=80  ΣX2=Σ(Ynn·Xnn²)=1400
 *   x̄=80/5=16  σx=√((1400-1280)/5)=√24=4.8990  Sx=√((1400-1280)/4)=√30=5.4772
 */
const oneVarData = [
  '2ND', 'DATA', '2ND', 'CLR WORK',
  '10', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN',
  '20', 'ENTER', 'DOWN', '3', 'ENTER',
];

// ===========================================================================
// The registry contract
// ===========================================================================

describe('the two descriptors are well-formed', () => {
  it('every field kind matches the handlers it supplies', () => {
    expect(() =>
      assertRegistryConsistent({ DATA: DATA_WORKSHEET, STAT: STAT_WORKSHEET }),
    ).not.toThrow();
  });

  it('both ids have an entry key wired (2ND DATA, 2ND STAT)', () => {
    expect(WORKSHEET_ENTRY_KEYS['DATA']).toBe('DATA');
    expect(WORKSHEET_ENTRY_KEYS['STAT']).toBe('STAT');
  });
});

// ===========================================================================
// 2ND DATA -- entering, navigating, and storing data (pp. 59-62)
// ===========================================================================

describe('the data-entry ring (p. 61)', () => {
  it('opens on X01 (p. 61)', () => {
    expect(screen(['2ND', 'DATA'])).toBe('X01= 0.00');
  });

  it('an empty list offers no scrolling -- only X01 is reachable', () => {
    const d = drive(['2ND', 'DATA']).display;
    expect(d.indicators).not.toContain('DOWN');
    // ENTER is prompted, since X01 takes a keyed value.
    expect(d.indicators).toContain('ENTER');
  });

  it('keys the first X, then DOWN reveals Y01 defaulted to 1 (p. 60)', () => {
    expect(screen(['2ND', 'DATA', '5', 'ENTER'])).toBe('X01= 5.00');
    expect(screen(['2ND', 'DATA', '5', 'ENTER', 'DOWN'])).toBe('Y01= 1.00');
  });

  it('walks X01 Y01 X02 Y02 ... as pairs are entered', () => {
    // Each new X appends a point; its Y then becomes reachable, and one fresh X
    // slot opens past it.
    expect(screen([...linData.slice(0, 6)])).toBe('X01= 1.00'); // ...'1','ENTER'
    expect(screen(['2ND', 'DATA', '2ND', 'CLR WORK', '1', 'ENTER', 'DOWN'])).toBe('Y01= 1.00');
    const r = drive(linData);
    expect(renderFlat(r.display)).toBe('Y03= 6.00');
    expect(r.state.stats.points).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]);
  });

  it('overwriting an existing X keeps its Y (p. 60 default is for creation)', () => {
    // Enter (1,2), scroll back to X01, re-key it as 9: the frequency/Y stays 2.
    const r = drive([
      '2ND', 'DATA', '2ND', 'CLR WORK',
      '1', 'ENTER', 'DOWN', '2', 'ENTER',
      'UP', '9', 'ENTER',
    ]);
    expect(renderFlat(r.display)).toBe('X01= 9.00');
    expect(r.state.stats.points).toEqual([{ x: 9, y: 2 }]);
  });

  it('keeps full internal precision on a keyed value, not the displayed 6.13 (§1.4)', () => {
    const r = drive(['2ND', 'DATA', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.state.stats.points[0]?.x).toBe(6.125);
  });

  it("mid-entry drops the '=' cue -- a half-keyed value belongs to nobody (p. 27)", () => {
    const d = drive(['2ND', 'DATA', '4', '2']).display;
    expect(d.label).toBe('X01='); // the label stays...
    expect(d.value).toBe('42');
    expect(d.indicators).not.toContain('='); // ...but the assignment cue is gone.
  });
});

// ===========================================================================
// 2ND STAT -- the method setting and the auto-computed results (pp. 59-62)
// ===========================================================================

describe('2ND SET cycles the calculation method (p. 62)', () => {
  it('opens on the method used last -- LIN by default (p. 62)', () => {
    expect(screen(['2ND', 'STAT'])).toBe('LIN');
  });

  it('lights the SET prompt and the = cue on the method', () => {
    const d = drive(['2ND', 'STAT']).display;
    expect(d.indicators).toContain('SET');
    expect(d.indicators).toContain('=');
  });

  it('cycles LIN -> Ln -> EXP -> PWR -> 1-V -> LIN (p. 59, p. 62)', () => {
    expect(screen(['2ND', 'STAT', 'SET'])).toBe('Ln');
    expect(screen(['2ND', 'STAT', 'SET', 'SET'])).toBe('EXP');
    expect(screen(['2ND', 'STAT', 'SET', 'SET', 'SET'])).toBe('PWR');
    expect(screen(['2ND', 'STAT', 'SET', 'SET', 'SET', 'SET'])).toBe('1-V');
    expect(screen(['2ND', 'STAT', 'SET', 'SET', 'SET', 'SET', 'SET'])).toBe('LIN');
  });
});

describe('LIN results on the perfect line Y = 2X (derived from p. 80)', () => {
  const stat = [...linData, '2ND', 'STAT'];

  it('scrolls the full two-variable result list in p. 59 order', () => {
    const expected = [
      'n= 3.00',
      'x̄= 2.00',
      'Sx= 1.00',
      'σx= 0.82', // √(2/3) = 0.8165 -> 0.82
      'ȳ= 4.00',
      'Sy= 2.00',
      'σy= 1.63', // √(8/3) = 1.6330 -> 1.63
      'a= 0.00',
      'b= 2.00',
      'r= 1.00',
    ];
    for (let k = 0; k < expected.length; k++) {
      const downs = Array<string>(k + 1).fill('DOWN');
      expect(screen([...stat, ...downs])).toBe(expected[k]);
    }
  });

  it('the sums land after X′/Y′ in the ring (p. 59)', () => {
    // method(0) .. r(10) X'(11) Y'(12) ΣX(13) ΣX2(14) ΣY(15) ΣY2(16) ΣXY(17)
    const downTo = (n: number) => [...stat, ...Array<string>(n).fill('DOWN')];
    expect(screen(downTo(13))).toBe('ΣX= 6.00');
    expect(screen(downTo(14))).toBe('ΣX2= 14.00');
    expect(screen(downTo(15))).toBe('ΣY= 12.00');
    expect(screen(downTo(16))).toBe('ΣY2= 56.00');
    expect(screen(downTo(17))).toBe('ΣXY= 28.00');
  });

  it('the ring wraps: DOWN off ΣXY returns to the method (p. 28)', () => {
    expect(screen([...stat, ...Array<string>(18).fill('DOWN')])).toBe('LIN');
  });

  it('an auto result prompts with neither ENTER nor COMPUTE (p. 22)', () => {
    const d = drive([...stat, 'DOWN']).display; // n
    expect(d.label).toBe('n=');
    expect(d.indicators).not.toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
    expect(d.indicators).toContain('='); // the value is the variable's own
  });

  it('a result refreshes Last Answer, being an automatic compute (p. 19)', () => {
    const r = drive([...stat, 'DOWN']); // n = 3
    expect(r.state.ans).toBe(r.state.displayValue);
    expect(r.state.displayValue).toBe(3);
  });
});

describe('one-variable statistics hide the regression results (p. 60, p. 62)', () => {
  // Cycle to 1-V after entering the frequency data.
  const stat = [...oneVarData, '2ND', 'STAT', 'SET', 'SET', 'SET', 'SET'];

  it('shows exactly n, x̄, Sx, σx, ΣX, ΣX2 and then wraps', () => {
    const expected = [
      'n= 5.00', // Σ frequencies
      'x̄= 16.00', // 80/5
      'Sx= 5.48', // √30 = 5.4772 -> 5.48
      'σx= 4.90', // √24 = 4.8990 -> 4.90
      'ΣX= 80.00', // Σ(Ynn·Xnn)
      'ΣX2= 1,400.00', // Σ(Ynn·Xnn²)
      '1-V', // ΣX2 wraps straight back to the method (still 1-V) -- ȳ..ΣXY skipped
    ];
    for (let k = 0; k < expected.length; k++) {
      const downs = Array<string>(k + 1).fill('DOWN');
      expect(screen([...stat, ...downs])).toBe(expected[k]);
    }
  });

  it('the two-variable outputs are unreachable, not merely blank', () => {
    // Four DOWNs from σx would be ȳ/Sy/σy/a in 2-V; under 1-V they are skipped, so
    // the fifth field after the method is ΣX, not ȳ.
    expect(screen([...stat, 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('ΣX= 80.00');
  });
});

// ===========================================================================
// X' and Y' -- the paired predictor (p. 62). See statistics-nav.ts deviation 1.
// ===========================================================================

describe("X' / Y' predict one from the other (p. 62)", () => {
  const stat = [...linData, '2ND', 'STAT'];
  // method(0) .. X'(11) Y'(12)
  const toXprime = [...stat, ...Array<string>(11).fill('DOWN')];
  const toYprime = [...stat, ...Array<string>(12).fill('DOWN')];

  it("keys X'=10 and computes Y'=20 on the line Y=2X (p. 62 forward procedure)", () => {
    // X' shown -> value ENTER -> DOWN -> Y' -> CPT.
    expect(screen([...toXprime, '10', 'ENTER', 'DOWN', 'CPT'])).toBe("Y'= 20.00");
  });

  it("keys Y'=20 and computes X'=10 (p. 62 reverse procedure, moving UP)", () => {
    // Y' shown -> value ENTER -> UP -> X' -> CPT.
    expect(screen([...toYprime, '20', 'ENTER', 'UP', 'CPT'])).toBe("X'= 10.00");
  });

  it("X' prompts as enter-or-compute -- both ENTER and COMPUTE (p. 22)", () => {
    const d = drive(toXprime).display;
    expect(d.label).toBe("X'=");
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).toContain('COMPUTE');
  });

  it("DEVIATION: X' and Y' share the display register, not two stores", () => {
    // After computing Y'=20 from X'=10, scrolling UP to X' shows the computed 20,
    // not the original 10 keyed in -- there is no state slot for either, so the
    // pair is really one shared display value (see deviation 1). Faithful hardware
    // keeps X' = 10 here; this is the documented divergence.
    expect(screen([...toXprime, '10', 'ENTER', 'DOWN', 'CPT', 'UP'])).toBe("X'= 20.00");
  });
});

// ===========================================================================
// Clearing and leaving (p. 60, p. 11)
// ===========================================================================

describe('2ND CLR WORK is portion-specific (p. 60)', () => {
  it('in the data ring: drops X and Y, keeps the method (p. 60)', () => {
    // Set the method to EXP first, enter data, then clear the DATA portion.
    const withMethod = drive(['2ND', 'STAT', 'SET', 'SET']).state; // EXP
    const r = drive([...linData, '2ND', 'DATA', '2ND', 'CLR WORK'], withMethod);
    expect(renderFlat(r.display)).toBe('X01= 0.00');
    expect(r.state.stats.points).toEqual([]);
    expect(r.state.stats.method).toBe('EXP'); // method survived
  });

  it('in the results ring: method back to LIN, X and Y kept (p. 60)', () => {
    const r = drive([...linData, '2ND', 'STAT', 'SET', 'SET', '2ND', 'CLR WORK']); // was EXP
    expect(renderFlat(r.display)).toBe('LIN');
    // Data retained -- scrolling to n still finds the three points.
    expect(screen(['DOWN'], r.state)).toBe('n= 3.00');
    expect(r.state.stats.points).toHaveLength(3);
  });
});

describe('2ND QUIT leaves to standard mode (p. 11), keeping the data', () => {
  it('from the data ring', () => {
    const r = drive([...linData, '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.stats.points).toHaveLength(3); // stored data survives
  });

  it('from the results ring', () => {
    const r = drive([...linData, '2ND', 'STAT', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(r.display.label).toBe('');
  });
});

// ===========================================================================
// Errors -- the reducer stays total (p. 84)
// ===========================================================================

describe('the reducer latches, never throws, on a bad result (p. 84)', () => {
  it('Error 1 when scrolling into the results with no data (p. 60, STAT-4)', () => {
    // Every result divides by n; with n = 0 that is Error 1 (Overflow). p. 60 says
    // an error appears but does not name it -- see statistics.ts / OPEN-QUESTIONS.
    const r = drive(['2ND', 'STAT', 'DOWN']); // scroll onto n with an empty set
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 1');
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('CE/C clears the error and the method is still there (p. 84)', () => {
    const errored = drive(['2ND', 'STAT', 'DOWN']);
    const cleared = drive(['CE/C'], errored.state);
    expect(cleared.state.errorState).toBeNull();
    expect(renderFlat(cleared.display)).toBe('LIN');
  });

  it('Error 1 when every X is identical -- the slope denominator collapses (p. 84)', () => {
    // (5,1) (5,2) (5,3): σx = 0 and n·Σx² − (Σx)² = 0, so the regression divides by
    // zero. n, x̄, Sx, σx, ȳ, Sy, σy still read; a is the first to fail.
    const allX = [
      '2ND', 'DATA', '2ND', 'CLR WORK',
      '5', 'ENTER', 'DOWN', '1', 'ENTER', 'DOWN',
      '5', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN',
      '5', 'ENTER', 'DOWN', '3', 'ENTER',
      '2ND', 'STAT',
    ];
    expect(screen([...allX, 'DOWN', 'DOWN', 'DOWN', 'DOWN'])).toBe('σx= 0.00'); // still fine
    const r = drive([...allX, ...Array<string>(8).fill('DOWN')]); // scroll onto a
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('Error 1 when every Y is identical -- σy = 0 makes r divide by zero (p. 84)', () => {
    // (1,7) (2,7) (3,7): ȳ, Sy, σy read fine; a/b/r come as a set and raise.
    const allY = [
      '2ND', 'DATA', '2ND', 'CLR WORK',
      '1', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN',
      '2', 'ENTER', 'DOWN', '7', 'ENTER', 'DOWN',
      '3', 'ENTER', 'DOWN', '7', 'ENTER',
      '2ND', 'STAT',
    ];
    expect(screen([...allY, ...Array<string>(7).fill('DOWN')])).toBe('σy= 0.00'); // still fine
    const r = drive([...allY, ...Array<string>(8).fill('DOWN')]); // scroll onto a
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('Error 1 on Sx with a single point -- the n−1 divisor is zero (p. 84)', () => {
    // n and x̄ read; the sample deviation divides by n−1 = 0 (statistics.ts).
    const one = ['2ND', 'DATA', '2ND', 'CLR WORK', '5', 'ENTER', '2ND', 'STAT'];
    expect(screen([...one, 'DOWN'])).toBe('n= 1.00');
    expect(screen([...one, 'DOWN', 'DOWN'])).toBe('x̄= 5.00');
    const r = drive([...one, 'DOWN', 'DOWN', 'DOWN']); // scroll onto Sx
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('Error 2 when Ln meets a non-positive X (the p. 61 model restriction)', () => {
    // Ln fits on ln(X); X <= 0 is LN of a non-positive argument -> Error 2. The
    // transform runs for every result, so even n raises here (statistics.ts).
    const lnBadX = [
      '2ND', 'DATA', '2ND', 'CLR WORK',
      '1', 'ENTER', 'DOWN', '2', 'ENTER', 'DOWN',
      '-1', 'ENTER', 'DOWN', '4', 'ENTER',
      '2ND', 'STAT', 'SET', // LIN -> Ln
    ];
    const r = drive([...lnBadX, 'DOWN']); // scroll onto n
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 2');
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
  });
});

// ===========================================================================
// The documented limitation: INS / DEL are inert
// ===========================================================================

describe('2ND INS / 2ND DEL are not wired (see statistics-nav.ts deviation 2)', () => {
  it('DEL does not remove a data point -- the generic engine never routes it', () => {
    // The engine claims only UP/DOWN/ENTER/CPT/SET/CLR WORK/CE/C; INS and DEL fall
    // through to the standard reducer, which has no case for them. Pinned so that
    // wiring them later (a machine.ts change) is a deliberate, visible act.
    const r = drive([...linData, 'DEL']);
    expect(r.state.stats.points).toHaveLength(3); // nothing deleted
    expect(r.state.mode.kind).toBe('worksheet');
  });

  it('INS does not open a slot', () => {
    const r = drive([...linData, 'INS']);
    expect(r.state.stats.points).toHaveLength(3);
  });
});

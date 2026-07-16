/**
 * Statistics: the two prompted-worksheet descriptors.
 *
 * One data set (`state.stats`) is presented through two worksheets that share it
 * (guidebook pp. 59-62):
 *
 *   2ND DATA  -- the data-entry ring: X01, Y01, X02, Y02, ... up to 50 pairs.
 *   2ND STAT  -- the results ring: a method setting (LIN/Ln/EXP/PWR/1-V, cycled
 *               with 2ND SET) followed by the computed outputs. Which outputs are
 *               visible depends on the method: 1-V shows only n, x̄, Sx, σx, ΣX,
 *               ΣX2 (p. 60, p. 62); the two-variable outputs are hidden.
 *
 * NO PARITY ORACLE. Statistics is the only worksheet chapter in the guidebook with
 * no worked example, so tests/golden/statistics.json is legitimately empty (see
 * docs/OPEN-QUESTIONS.md, STAT-1). Every expected value in the test file is derived
 * by hand from the p. 80 appendix formulas via ../../worksheets/statistics.ts,
 * which itself carries no oracle. This descriptor is arithmetic-only glue over that
 * module; the maths, the corrections to the printed source, and the error rules all
 * live there.
 *
 * TWO DEVIATIONS forced by the fixed state shape and the generic engine's key set,
 * both flagged here because a reader must not mistake them for oversights:
 *
 *  1. X' AND Y' HAVE NO STATE SLOT. `StatisticsState` deliberately stores neither
 *     -- the module models them as arguments to predictX/predictY "to keep every
 *     function pure and total" (statistics.ts). This descriptor may not add a slot
 *     (it owns no state type), so it carries the predictor in `displayValue`: both
 *     X' and Y' return `displayValue` from `get`, so UP/DOWN between the pair
 *     preserves it, and each one's `compute` reads it as the counterpart's just-
 *     entered value. This reproduces the two one-shot procedures p. 62 documents
 *     (enter X' -> ↓ -> CPT Y', and enter Y' -> ↑ -> CPT X') exactly. It does NOT
 *     model X' and Y' as two independent persistent registers: after computing one
 *     from the other, scrolling back shows the computed value, not the original
 *     key-in. No worked example distinguishes the two, and the fixed `Mode` shape
 *     leaves no room to (STAT-7 territory).
 *
 *  2. 2ND INS / 2ND DEL ARE INERT. p. 60 lists insert/delete of a data point, but
 *     the generic engine (worksheet-nav.ts) claims only UP, DOWN, ENTER, CPT, SET,
 *     CLR WORK and CE/C; INS and DEL fall through to the standard reducer, which
 *     has no case for them. Wiring them would require editing machine.ts, which
 *     this worksheet must not touch. Entry, navigation and overwrite all work; only
 *     mid-list insert/delete is missing. Flagged, not hidden.
 *
 * Source: guidebook pp. 59-62 (behaviour), p. 80 (formulas), p. 84 (errors).
 */
import { CalculatorError, ErrorCode } from '../../errors.js';
import {
  clearData,
  clearStat,
  mean,
  nextMethod,
  populationStdDev,
  predictX,
  predictY,
  regression,
  sampleStdDev,
  statSums,
  DEFAULT_FREQUENCY,
  MAX_DATA_POINTS,
  type StatSums,
} from '../../worksheets/statistics.js';
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';

// ---------------------------------------------------------------------------
// 2ND DATA -- the data-entry ring (guidebook pp. 59-62)
// ---------------------------------------------------------------------------

/** `nn` in a label is always two digits: X01, Y07, X50 (p. 59). */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * Store a keyed X. A brand-new point (the one slot beyond the last entered pair)
 * is appended with Ynn defaulting to 1, which p. 60 states happens "when an Xnn is
 * keyed in". Editing an existing Xnn keeps its Ynn: the default is for creation,
 * not for every keystroke, or revisiting a point to fix its X would silently wipe
 * its frequency. That reading is inference -- p. 60 does not spell out the edit
 * case -- and there is no worked example to settle it.
 */
function setX(s: CalculatorState, i: number, v: number): CalculatorState {
  const points = s.stats.points;
  const next =
    i < points.length
      ? points.map((p, k) => (k === i ? { x: v, y: p.y } : p))
      : [...points, { x: v, y: DEFAULT_FREQUENCY }];
  return { ...s, stats: { ...s.stats, points: next } };
}

function setY(s: CalculatorState, i: number, v: number): CalculatorState {
  const next = s.stats.points.map((p, k) => (k === i ? { x: p.x, y: v } : p));
  return { ...s, stats: { ...s.stats, points: next } };
}

/**
 * The 100 fields X01..Y50, in LCD order (p. 59).
 *
 * The pair at 1-based index `p` (zero-based `i = p - 1`) is reachable only when the
 * data list is long enough: Xnn once `p` points already exist OR `p` is the single
 * new slot just past the end (`p <= length + 1`); Ynn only once its Xnn exists
 * (`p <= length`), since a Y with no X is not a point. So an empty list shows just
 * X01, and the ring grows one field at a time as data is entered. At the 50-pair
 * capacity (p. 60) there is no 51st slot, so the list simply stops accepting more.
 */
function dataFields(): FieldDescriptor[] {
  const fields: FieldDescriptor[] = [];
  for (let p = 1; p <= MAX_DATA_POINTS; p++) {
    const i = p - 1;
    fields.push({
      label: `X${pad2(p)}=`,
      kind: 'entry',
      get: (s) => s.stats.points[i]?.x ?? 0,
      set: (s, v) => setX(s, i, v),
      visible: (s) => p <= s.stats.points.length + 1,
    });
    fields.push({
      label: `Y${pad2(p)}=`,
      kind: 'entry',
      get: (s) => s.stats.points[i]?.y ?? DEFAULT_FREQUENCY,
      set: (s, v) => setY(s, i, v),
      visible: (s) => p <= s.stats.points.length,
    });
  }
  return fields;
}

export const DATA_WORKSHEET: WorksheetDescriptor = {
  id: 'DATA',
  fields: dataFields(),
  // p. 60: clearing the data portion drops every X and Y but keeps the method.
  clearWork: (s) => ({ ...s, stats: clearData(s.stats) }),
};

// ---------------------------------------------------------------------------
// 2ND STAT -- the results ring (guidebook pp. 59-62)
// ---------------------------------------------------------------------------

const notOneVariable = (s: CalculatorState): boolean => s.stats.method !== '1-V';

/**
 * Every result is automatic-compute: it evaluates the instant it is scrolled onto,
 * with no CPT step (p. 60, p. 62), and is never stored -- so the work happens in
 * `get`, run fresh each time. Re-running the whole sum walk per field is the same
 * no-caching discipline the Amortization descriptor follows: a stored result would
 * go stale the moment a data point changed underneath it.
 */
function autoResult(label: string, read: (s: CalculatorState) => number): FieldDescriptor {
  return { label, kind: 'auto', get: read };
}

/** A result that p. 60 hides under 1-V: shown only for the four regression models. */
function twoVariableResult(
  label: string,
  read: (s: CalculatorState) => number,
): FieldDescriptor {
  return { label, kind: 'auto', get: read, visible: notOneVariable };
}

/**
 * The sums behind every result, guarded against the empty data set.
 *
 * p. 60 says scrolling into the results with no data entered "will display an
 * error" but does not name it; the module raises Error 1 (Overflow), the mechanism
 * p. 84 supplies since every result divides by n (STAT-4). `statSums` itself does
 * not raise on n = 0, so the guard is here. `n` is the first result after the
 * method in both rings, so this fires before any sum field is reachable -- the sum
 * getters below need no guard of their own.
 */
function loadedSums(s: CalculatorState): StatSums {
  const sums = statSums(s.stats);
  if (sums.n === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'no statistics data points entered (p. 60)');
  }
  return sums;
}

/**
 * X' and Y': enter one, CPT the other (p. 62). See the module header, deviation 1
 * -- the value lives in `displayValue`, not in state, so `get` returns it and
 * `set` is a no-op (the engine has already put the keyed value on the display).
 * `compute` reads it as the counterpart the user entered a keystroke earlier.
 */
function predictorField(
  label: string,
  compute: (s: CalculatorState) => CalculatorState,
): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => s.displayValue,
    set: (s) => s,
    compute,
    visible: notOneVariable,
  };
}

export const STAT_WORKSHEET: WorksheetDescriptor = {
  id: 'STAT',
  fields: [
    // The method, cycled by 2ND SET (p. 62). A setting prints no label of its own;
    // its value is the model name (worksheet-nav.ts renders the string directly).
    {
      label: '',
      kind: 'setting',
      get: (s) => s.stats.method,
      cycle: (s) => ({ ...s, stats: { ...s.stats, method: nextMethod(s.stats.method) } }),
    },

    // Shown for 1-V and every regression (p. 60). Under a regression these read the
    // TRANSFORMED x, as statSums documents; under 1-V, x is frequency-weighted.
    autoResult('n=', (s) => loadedSums(s).n),
    autoResult('x̄=', (s) => mean(loadedSums(s).sumX, loadedSums(s).n)),
    autoResult('Sx=', (s) => {
      const S = loadedSums(s);
      return sampleStdDev(S.sumX, S.sumX2, S.n);
    }),
    autoResult('σx=', (s) => {
      const S = loadedSums(s);
      return populationStdDev(S.sumX, S.sumX2, S.n);
    }),

    // Two-variable only (p. 60). ȳ, Sy, σy compute from their own sums, so they
    // survive an all-Y-identical set that only sinks the regression -- matching the
    // hardware, which shows each result as it is scrolled to (p. 62). a, b and r
    // come as a set from `regression`, which raises Error 1 together when the fit
    // is degenerate (all X identical, or all Y identical): see statistics.ts.
    twoVariableResult('ȳ=', (s) => mean(loadedSums(s).sumY, loadedSums(s).n)),
    twoVariableResult('Sy=', (s) => {
      const S = loadedSums(s);
      return sampleStdDev(S.sumY, S.sumY2, S.n);
    }),
    twoVariableResult('σy=', (s) => {
      const S = loadedSums(s);
      return populationStdDev(S.sumY, S.sumY2, S.n);
    }),
    twoVariableResult('a=', (s) => regression(s.stats).a),
    twoVariableResult('b=', (s) => regression(s.stats).b),
    twoVariableResult('r=', (s) => regression(s.stats).r),

    predictorField("X'=", (s) => ({ ...s, displayValue: predictX(s.stats, s.displayValue) })),
    predictorField("Y'=", (s) => ({ ...s, displayValue: predictY(s.stats, s.displayValue) })),

    autoResult('ΣX=', (s) => loadedSums(s).sumX),
    autoResult('ΣX2=', (s) => loadedSums(s).sumX2),
    twoVariableResult('ΣY=', (s) => loadedSums(s).sumY),
    twoVariableResult('ΣY2=', (s) => loadedSums(s).sumY2),
    twoVariableResult('ΣXY=', (s) => loadedSums(s).sumXY),
  ],
  // p. 60: clearing the results portion resets the method to LIN and keeps X and Y.
  clearWork: (s) => ({ ...s, stats: clearStat(s.stats) }),
};

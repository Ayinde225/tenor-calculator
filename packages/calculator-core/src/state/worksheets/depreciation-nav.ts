/**
 * Depreciation worksheet descriptor (guidebook pp. 55-58).
 *
 * A ten-position ring: the METHOD line, then LIF, M01, DT1 (SLF only), CST, SAL,
 * YR, and the three automatic-compute outputs DEP, RBV, RDV. Every formula, the
 * six methods, FSTYR, the DEC-dependent rounding and every reconstructed edge live
 * in `../../worksheets/depreciation.ts`; this file only wires the fields to it.
 *
 * FOUR PLACES THIS DESCRIPTOR LEAVES THE STRAIGHT PATH, each because the hardware
 * does something the generic engine has no other hook for. All four are called out
 * so none reads like an accident.
 *
 * 1. THE RDV -> YR WRAP (p. 57: "If the remaining depreciable value (RDV) variable
 *    is displayed, you can press down to return to the year to compute (YR)
 *    variable"; confirmed by the p. 58 example, whose first "View second year"
 *    down-press moves RDV -> YR = 1.00). Everywhere else the ring is a plain wrap.
 *    The generic engine wraps to the first VISIBLE field, so the setup fields
 *    (METHOD..SAL) declare themselves invisible for the single instant RDV is the
 *    displayed field; down from RDV then skips them and lands on YR. The trick is
 *    confined to that instant -- from YR, DEP, RBV and every setup field the setup
 *    variables are reachable exactly as normal (up from YR still returns to SAL),
 *    so it does not amputate the setup half of the worksheet.
 *
 * 2. YR IS MODELLED AS A `setting` (DEPR-1). p. 57 says twice that CPT increments
 *    YR; the p. 58 example prints the same step as `down 2nd ENTER` (i.e. 2ND SET)
 *    and both show YR 1.00 -> 2.00. The value is uncontested; only the key differs.
 *    The generic engine routes 2ND SET solely to a field's `cycle`, and `cycle` is
 *    permitted only on a `setting`, so YR is declared `setting` carrying `cycle`,
 *    `compute` AND `set` -- all three increment/store, so ENTER assigns, and CPT
 *    and 2ND SET each bump YR by one. This lights SET (and COMPUTE) on YR, which
 *    the bare hardware may not; it is the only way one descriptor can honour both
 *    spellings, and the resulting YR = 2 is what the example and the prose agree on.
 *
 * 3. THE METHOD LINE IS DUAL-NATURED (p. 55 "Setting/Enter"). Selecting a method is
 *    a 2ND SET action, but DB, DBX and DBF also hold an entered percent keyed ON
 *    THE SAME LINE (p. 57 "you must either key in a value or accept the default of
 *    200"). So METHOD is a `setting` carrying a `cycle` (advance the method) AND a
 *    `set` (store the percent, ignored under the non-percent methods). `get`
 *    returns the bare mnemonic for SL/SYD/SLF and "<mnemonic>= <percent>" for the
 *    declining-balance methods, so the percent is visible and enterable while the
 *    mnemonic identifies the method (p. 55 "Display" column). A `set` on the line
 *    lights ENTER even under SL, where nothing is enterable -- a static-field-shape
 *    limitation with no per-value control and no golden coverage.
 *
 * 4. DT1 IS VISIBLE ONLY UNDER SLF (p. 57 step 3: "M01, DT1 (if SLF), CST, SAL, and
 *    YR"; spec edge-case 9). The task brief said "SLF/DBF", but p. 57 and the maths
 *    module both tie DT1 to SLF alone -- DBF's first-year fraction reads M01, not
 *    DT1 -- so DT1 rides with SLF only. Its dd.mmyy entry and date display are
 *    reconstructed (DEPR-4, undocumented) and unverified; no golden case reaches it.
 *
 * ROUNDING. Depreciation rounds its internal results to the displayed decimal
 * setting (p. 9, p. 56, p. 78), so `s.format.DEC` is threaded into `depreciate`
 * for the three auto fields exactly as amortization threads it into `amortize`.
 *
 * CLR WORK preserves the method, M01 and the DB percent and resets only LIF, YR,
 * CST, SAL (p. 56); it also parks the field back on the method line, which matters
 * because the setup fields are hidden while RDV is displayed (deviation 1) and a
 * clear pressed there would otherwise be unable to scan back to METHOD.
 *
 * The descriptor is exported for the central registry to pick up; this file does
 * not touch `worksheet-registry.ts` or `machine.ts`.
 */
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';
import { formatValue } from '../../display/format.js';
import {
  clearWork as clearDepreciationWork,
  depreciate,
  nextMethod,
  nextYear,
  type DepreciationDate,
  type DepreciationMethod,
} from '../../worksheets/depreciation.js';

// Field positions in the LCD scroll ring (p. 55). Named so the RDV wrap and the
// CLR WORK reset read against labels rather than bare integers.
const METHOD = 0;
const LIF = 1;
const M01 = 2;
const DT1 = 3;
const CST = 4;
const SAL = 5;
const YR = 6;
const DEP = 7;
const RBV = 8;
const RDV = 9;

/** DB, DBX, DBF carry an entered declining-balance percent (p. 55, p. 56). */
const usesPercent = (m: DepreciationMethod): boolean =>
  m === 'DB' || m === 'DBX' || m === 'DBF';

/** True when SLF/DBF may be selected: European date OR separator format (p. 55, p. 57). */
const isEuropean = (s: CalculatorState): boolean =>
  s.format.dateFormat === 'EUR' || s.format.separators === 'EUR';

/**
 * The one instant the setup fields hide themselves: while RDV is the displayed
 * field, so that down from RDV wraps to YR (deviation 1). Guarded on the worksheet
 * id so a foreign worksheet parked on its own field 9 never trips it, and on
 * `mode.kind` so entry from standard mode sees every field.
 */
const rdvDisplayed = (s: CalculatorState): boolean =>
  s.mode.kind === 'worksheet' && s.mode.worksheet === 'DEPR' && s.mode.field === RDV;

const setupVisible = (s: CalculatorState): boolean => !rdvDisplayed(s);

/** dd.mmyy -> a starting date (SLF, European). DEPR-4: reconstructed, unverified. */
function parseDt1(v: number): DepreciationDate {
  // Rendered at 13 digits, as date.ts does, so 16.0324 does not arrive as
  // 16.03239999999 and lose its trailing digit.
  const [intPart = '0', fractionRaw = ''] = Math.abs(v).toPrecision(13).split('.');
  const fraction = fractionRaw.replace(/0+$/, '').padEnd(4, '0');
  const yy = Number(fraction.slice(2, 4));
  return {
    day: Number(intPart),
    month: Number(fraction.slice(0, 2)),
    // Two-digit year into 1980-2079, the same window date.ts uses (p. 81).
    year: yy >= 80 ? 1900 + yy : 2000 + yy,
  };
}

/** EUR dd-mm-yyyy, leading field unpadded like date.ts. DT1 is a European method's field. */
const formatDt1 = (d: DepreciationDate): string =>
  `${d.day}-${String(d.month).padStart(2, '0')}-${d.year}`;

/** A plain enter-only variable over one numeric slot of `s.depr`. */
function entryField(
  label: string,
  get: (s: CalculatorState) => number,
  set: (s: CalculatorState, v: number) => CalculatorState,
): FieldDescriptor {
  return { label, kind: 'entry', get, set, visible: setupVisible };
}

/** One automatic-compute output: DEP, RBV or RDV, evaluated on sight (p. 56). */
function autoField(label: string, pick: (r: ReturnType<typeof depreciate>) => number): FieldDescriptor {
  return {
    label,
    kind: 'auto',
    // p. 9, p. 56, p. 78: depreciation rounds to the DISPLAYED decimals, so DEC is
    // an input to the arithmetic here, not just to the rendering. May throw
    // (SAL > CST, an out-of-range variable); the reducer catches at the boundary.
    get: (s) => pick(depreciate(s.depr, s.format.DEC)),
  };
}

const METHOD_FIELD: FieldDescriptor = {
  label: '',
  kind: 'setting',
  visible: setupVisible,
  // The mnemonic alone for SL/SYD/SLF; "<mnemonic>= <percent>" for the declining-
  // balance methods, so the keyed percent shows against the method it belongs to.
  get: (s) => {
    const d = s.depr;
    if (usesPercent(d.method)) {
      const shown = formatValue(d.dbPercent, {
        decimals: s.format.DEC,
        separator: s.format.separators,
      });
      return `${d.method}= ${shown}`;
    }
    return d.method;
  },
  // ENTER on the line stores the declining-balance percent (p. 57). Under a method
  // with no percent there is nothing to key, so the press is a silent no-op.
  set: (s, v) => (usesPercent(s.depr.method) ? { ...s, depr: { ...s.depr, dbPercent: v } } : s),
  // 2ND SET walks the method list, wrapping; SLF/DBF only under a European format.
  cycle: (s) => ({ ...s, depr: { ...s.depr, method: nextMethod(s.depr.method, isEuropean(s)) } }),
};

const YR_FIELD: FieldDescriptor = {
  // `setting` purely so 2ND SET reaches YR (deviation 2). ENTER stores it; CPT and
  // 2ND SET both increment it by one.
  label: 'YR=',
  kind: 'setting',
  get: (s) => s.depr.YR,
  set: (s, v) => ({ ...s, depr: { ...s.depr, YR: v } }),
  compute: (s) => ({ ...s, depr: nextYear(s.depr) }),
  cycle: (s) => ({ ...s, depr: nextYear(s.depr) }),
};

const DT1_FIELD: FieldDescriptor = {
  label: 'DT1=',
  kind: 'entry',
  // Only under SLF (p. 57), and it is a setup field so it also hides while RDV
  // shows -- though RDV is unreachable without leaving DT1's own method behind.
  visible: (s) => s.depr.method === 'SLF' && setupVisible(s),
  get: (s) => {
    const dt = s.depr.DT1;
    return dt === undefined ? 0 : formatDt1(dt);
  },
  set: (s, v) => ({ ...s, depr: { ...s.depr, DT1: parseDt1(v) } }),
};

export const DEPRECIATION: WorksheetDescriptor = {
  id: 'DEPR',
  fields: [
    METHOD_FIELD,
    entryField('LIF=', (s) => s.depr.LIF, (s, v) => ({ ...s, depr: { ...s.depr, LIF: v } })),
    entryField('M01=', (s) => s.depr.M01, (s, v) => ({ ...s, depr: { ...s.depr, M01: v } })),
    DT1_FIELD,
    entryField('CST=', (s) => s.depr.CST, (s, v) => ({ ...s, depr: { ...s.depr, CST: v } })),
    entryField('SAL=', (s) => s.depr.SAL, (s, v) => ({ ...s, depr: { ...s.depr, SAL: v } })),
    YR_FIELD,
    autoField('DEP=', (r) => r.DEP),
    autoField('RBV=', (r) => r.RBV),
    autoField('RDV=', (r) => r.RDV),
  ],
  // p. 56: CLR WORK resets LIF, YR, CST, SAL only -- method, M01 and the DB percent
  // survive. The field is parked back on the method line so a clear pressed while
  // RDV is displayed (setup fields hidden, deviation 1) still returns to the top
  // rather than being trapped in the YR..RDV loop.
  clearWork: (s) => ({
    ...s,
    depr: clearDepreciationWork(s.depr),
    mode: s.mode.kind === 'worksheet' ? { ...s.mode, field: METHOD } : s.mode,
  }),
};

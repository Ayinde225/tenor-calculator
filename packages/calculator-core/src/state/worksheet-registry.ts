/**
 * WorksheetId -> WorksheetDescriptor.
 *
 * This is the switch. A worksheet with a descriptor here is live: its entry key
 * opens it and `worksheet-nav.ts` drives every prompt, keystroke and annunciator
 * from the field list below. A worksheet without one has an inert entry key.
 *
 * TO ADD A WORKSHEET
 *
 *  1. Write its maths in `../worksheets/<name>.ts` -- pure, throwing
 *     `CalculatorError`, knowing nothing about display or state.
 *  2. Add a `WorksheetDescriptor` here whose fields are in LCD order. Read the
 *     contract at the top of `worksheet-nav.ts` first; the short version is that
 *     `get` is the single source of a field's value and is called on every
 *     projection, `set` receives a value already at internal precision, and
 *     automatic-compute variables compute in `get` and are never stored.
 *  3. Nothing else. Do not touch `machine.ts`: the entry keys are already wired
 *     in `WORKSHEET_ENTRY_KEYS`, and navigation routes on `mode.kind`.
 *
 * `assertRegistryConsistent` checks every descriptor's shape and is asserted in
 * `worksheet-nav.test.ts`. Run it.
 *
 * The two worksheets below are here because they bracket the contract. Profit
 * Margin is three interchangeable enter-or-compute fields and nothing else.
 * Amortization has enter fields with a compute that rewrites a DIFFERENT field,
 * three automatic-compute fields, and results that depend on the DEC setting.
 * Between them they exercise every branch in the navigation engine except
 * `cycle` and `visible`.
 */
import {
  AMORTIZATION_DEFAULTS,
  amortize,
  nextRange,
} from '../worksheets/amortization.js';
import {
  PROFIT_MARGIN_DEFAULTS,
  computeProfitMargin,
  type ProfitMarginVariable,
} from '../worksheets/profit-margin.js';
import type { CalculatorState } from './state.js';
import type { FieldDescriptor, WorksheetDescriptor, WorksheetRegistry } from './worksheet-nav.js';

// ---------------------------------------------------------------------------
// Profit Margin (guidebook pp. 70-71)
// ---------------------------------------------------------------------------

/**
 * All three variables are enter-or-compute (p. 70): key any two, compute the
 * third. So each declares `kind: 'entry'` and carries a `compute` -- the shape
 * the guidebook calls "enter-or-compute", which lights both the ENTER and COMPUTE
 * indicators (p. 22).
 */
function profitField(label: string, v: ProfitMarginVariable): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => s.profit[v],
    set: (s, x) => ({ ...s, profit: { ...s.profit, [v]: x } }),
    compute: (s) => ({ ...s, profit: { ...s.profit, [v]: computeProfitMargin(s.profit, v) } }),
  };
}

const PROFIT: WorksheetDescriptor = {
  id: 'PROFIT',
  fields: [profitField('CST=', 'CST'), profitField('SEL=', 'SEL'), profitField('MAR=', 'MAR')],
  // p. 70: all three default to zero. Nothing to preserve, unlike ICONV's C/Y.
  clearWork: (s) => ({ ...s, profit: PROFIT_MARGIN_DEFAULTS }),
};

// ---------------------------------------------------------------------------
// Amortization (guidebook pp. 27-28, 40-41)
// ---------------------------------------------------------------------------

/**
 * CPT on P1 or P2 advances the WINDOW, not the field it was pressed on.
 *
 * p. 28: "Press CPT. Both P1 and P2 update automatically to represent the next
 * range of payments... if the previous range was 1 through 12, pressing CPT
 * updates the range to 13 through 24." And, for the other end: "If you did not
 * press CPT with P1 displayed, you can press CPT with P2 displayed to enter
 * values for both P1 and P2 in the next range." Same action, either field.
 *
 * This is the one place the generic engine's assumption that `compute` writes the
 * displayed field is too narrow, and it holds up: `compute` returns a whole state
 * and the engine re-reads the displayed field from `get` afterwards, so P1 shows
 * its new value and P2 is already correct when you scroll to it. p. 40 asserts
 * exactly that pair: `↓ CPT` -> `P1= 22.00`, then `↓` -> `P2= 33.00`.
 */
const advanceWindow = (s: CalculatorState): CalculatorState => ({
  ...s,
  amort: nextRange(s.amort),
});

/**
 * BAL, PRN and INT are automatic-compute: they evaluate on sight and are never
 * stored (p. 22). Each runs the whole schedule from payment 1 -- amortization has
 * no closed form (ENGINE-DESIGN §3.1) -- so scrolling BAL -> PRN -> INT walks it
 * three times. That is the cost of not caching, and not caching is the point:
 * a stored BAL would go stale the moment PMT changed.
 *
 * `s.format.DEC` is passed in because amortization rounds to the DISPLAYED
 * decimal setting as it iterates (p. 9, p. 76). The schedule genuinely changes
 * when DEC changes; this is the one worksheet where the display reaches into the
 * arithmetic, and the dependency is explicit here rather than hidden.
 */
function amortResult(pick: (r: ReturnType<typeof amortize>) => number) {
  return (s: CalculatorState): number => pick(amortize(s.tvm, s.amort, s.format.DEC));
}

const AMORT: WorksheetDescriptor = {
  id: 'AMORT',
  fields: [
    {
      label: 'P1=',
      kind: 'entry',
      get: (s) => s.amort.P1,
      set: (s, v) => ({ ...s, amort: { ...s.amort, P1: v } }),
      compute: advanceWindow,
    },
    {
      label: 'P2=',
      kind: 'entry',
      get: (s) => s.amort.P2,
      set: (s, v) => ({ ...s, amort: { ...s.amort, P2: v } }),
      compute: advanceWindow,
    },
    { label: 'BAL=', kind: 'auto', get: amortResult((r) => r.BAL) },
    { label: 'PRN=', kind: 'auto', get: amortResult((r) => r.PRN) },
    { label: 'INT=', kind: 'auto', get: amortResult((r) => r.INT) },
  ],
  // p. 26: P1 and P2 reset to 1. The TVM registers the schedule reads are NOT
  // this worksheet's to clear -- that is 2ND CLR TVM, in standard mode (p. 22).
  clearWork: (s) => ({ ...s, amort: AMORTIZATION_DEFAULTS }),
};

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The remaining worksheets, built as independent descriptors and wired in here.
//
// Each module owns its own field list and clearWork logic; this file's job is
// only to make them reachable through the reducer. Keyed by WorksheetId so the
// entry keys in WORKSHEET_ENTRY_KEYS resolve. Statistics and Cash Flow each
// contribute more than one worksheet (a data list plus a results list; the flow
// list plus the NPV and IRR sub-worksheets), matching the hardware.
// ---------------------------------------------------------------------------
import { CASH_FLOW, NPV, IRR } from './worksheets/cash-flow-nav.js';
import { BOND } from './worksheets/bond-nav.js';
import { DEPRECIATION } from './worksheets/depreciation-nav.js';
import { DATA_WORKSHEET, STAT_WORKSHEET } from './worksheets/statistics-nav.js';
import { PERCENT_CHANGE } from './worksheets/percent-change-nav.js';
import { INTEREST_CONVERSION_WORKSHEET } from './worksheets/interest-conversion-nav.js';
import { DATE_WORKSHEET } from './worksheets/date-nav.js';
import { BREAKEVEN } from './worksheets/breakeven-nav.js';
import { MEMORY } from './worksheets/memory-nav.js';
import { FORMAT } from './worksheets/format-nav.js';

export const WORKSHEETS: WorksheetRegistry = Object.freeze({
  PROFIT,
  AMORT,
  CF: CASH_FLOW,
  NPV,
  IRR,
  BOND,
  DEPR: DEPRECIATION,
  DATA: DATA_WORKSHEET,
  STAT: STAT_WORKSHEET,
  PCT: PERCENT_CHANGE,
  ICONV: INTEREST_CONVERSION_WORKSHEET,
  DATE: DATE_WORKSHEET,
  BRKEVN: BREAKEVEN,
  MEM: MEMORY,
  FORMAT,
});

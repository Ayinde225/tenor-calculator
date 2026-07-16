/**
 * Breakeven worksheet descriptor (guidebook pp. 71-72).
 *
 * Five variables around one linear identity, `PFT = PQ - (FC + VC·Q)`. The maths
 * -- every solved form, the P = VC pole, the sign convention -- lives in
 * `../../worksheets/breakeven.ts`; this file is only the field ring the generic
 * engine walks.
 *
 * Every variable is "enter-or-compute" (p. 71): key any four and compute the
 * fifth. That is not a distinct field kind -- it is `kind: 'entry'` carrying a
 * `compute`, the shape the guidebook lights with both the ENTER and COMPUTE
 * indicators (p. 22). All five fields are therefore identical but for which slot
 * of `s.breakeven` they read and write, so one factory builds them.
 *
 * There are no settings and no conditional fields: unlike Date's ACT/360 or
 * Depreciation's method, nothing here is cycled with 2ND SET or hidden, so the
 * ring is a plain five-field loop in the order the LCD scrolls (p. 71):
 * FC -> VC -> P -> PFT -> Q.
 *
 * The descriptor is exported for the central registry to pick up; this file does
 * not touch `worksheet-registry.ts`.
 */
import {
  BREAKEVEN_DEFAULTS,
  computeBreakeven,
  type BreakevenVariable,
} from '../../worksheets/breakeven.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';

/**
 * One enter-or-compute field over a single `s.breakeven` slot.
 *
 * `compute` writes only its own variable, leaving the other four untouched, so
 * the engine re-reads the displayed field from `get` and the computed value lands
 * under its own label. `computeBreakeven` may throw CalculatorError at the P = VC
 * or Q = 0 poles; the reducer catches it at the command boundary.
 */
function breakevenField(label: string, v: BreakevenVariable): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => s.breakeven[v],
    set: (s, x) => ({ ...s, breakeven: { ...s.breakeven, [v]: x } }),
    compute: (s) => ({ ...s, breakeven: { ...s.breakeven, [v]: computeBreakeven(s.breakeven, v) } }),
  };
}

export const BREAKEVEN: WorksheetDescriptor = {
  id: 'BRKEVN',
  fields: [
    breakevenField('FC=', 'FC'),
    breakevenField('VC=', 'VC'),
    breakevenField('P=', 'P'),
    breakevenField('PFT=', 'PFT'),
    breakevenField('Q=', 'Q'),
  ],
  // p. 71: 2ND CLR WORK sets all five to zero. There is no C/Y-style exception to
  // preserve here, so the whole slice resets to its defaults.
  clearWork: (s) => ({ ...s, breakeven: BREAKEVEN_DEFAULTS }),
};

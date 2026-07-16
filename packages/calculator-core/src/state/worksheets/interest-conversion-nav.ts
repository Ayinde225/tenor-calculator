/**
 * Interest Conversion worksheet descriptor (guidebook pp. 66-67).
 *
 * A three-field ring: NOM, EFF, C/Y. NOM and EFF are enter-or-compute -- key
 * either rate and compute the other (p. 66) -- so each declares `kind: 'entry'`
 * and carries a `compute`, the shape that lights both the ENTER and COMPUTE
 * prompts (worksheet-nav.ts, p. 22). C/Y is enter-only (p. 66): it stores an
 * ENTER'd value but is never a CPT target, so it supplies `set` and no `compute`.
 *
 * The maths lives in ../../worksheets/interest-conversion.ts; this file only
 * wires the fields to it. `computeInterestConversion` may throw CalculatorError
 * (Error 4 on C/Y <= 0, Error 2 on an ln-domain violation); the reducer catches
 * it at the command boundary, so `compute` re-throws by simply not guarding.
 *
 * THE C/Y ASYMMETRY. 2ND CLR WORK here clears NOM and EFF but deliberately leaves
 * C/Y untouched (p. 67) -- the one asymmetric clear in the chapter, and the reason
 * `iconv.CY` is this worksheet's own storage rather than the TVM C/Y. That rule is
 * `clearInterestConversionWork`, which spares C/Y; using it rather than the reset
 * defaults is what carries the asymmetry.
 */
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';
import {
  clearInterestConversionWork,
  computeInterestConversion,
  type InterestConversionVariable,
} from '../../worksheets/interest-conversion.js';

/**
 * NOM and EFF: enter-or-compute (p. 66). Both read and write the same slot and
 * solve for it from the other two; `computeInterestConversion` dispatches on the
 * variable name.
 */
function rateField(label: string, v: InterestConversionVariable): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => s.iconv[v],
    set: (s, x) => ({ ...s, iconv: { ...s.iconv, [v]: x } }),
    compute: (s) => ({ ...s, iconv: { ...s.iconv, [v]: computeInterestConversion(s.iconv, v) } }),
  };
}

export const INTEREST_CONVERSION_WORKSHEET: WorksheetDescriptor = {
  id: 'ICONV',
  fields: [
    rateField('NOM=', 'NOM'),
    rateField('EFF=', 'EFF'),
    {
      // Enter-only (p. 66): stores a keyed value, never computes. No `compute`, so
      // the field prompts with ENTER alone and CPT on it is a silent no-op.
      label: 'C/Y=',
      kind: 'entry',
      get: (s) => s.iconv.CY,
      set: (s, v) => ({ ...s, iconv: { ...s.iconv, CY: v } }),
    },
  ],
  // p. 67: clears NOM and EFF, spares C/Y. Not INTEREST_CONVERSION_DEFAULTS, which
  // would reset C/Y to 1 -- the 2ND RESET value, not the 2ND CLR WORK one.
  clearWork: (s) => ({ ...s, iconv: clearInterestConversionWork(s.iconv) }),
};

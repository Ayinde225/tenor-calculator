/**
 * The two TVM sub-settings reached from standard-calculator mode.
 *
 *   2ND P/Y  ->  a two-field prompt: P/Y then C/Y
 *   2ND BGN  ->  a one-field setting: END or BGN
 *
 * Neither is a worksheet in the guidebook's own taxonomy -- their values live in
 * the TVM registers, not in a worksheet of their own -- but the navigation is
 * identical to a prompted worksheet, so they are expressed as descriptors rather
 * than special-cased in the reducer.
 *
 * The one behaviour that is specific to P/Y: entering a value for P/Y also sets
 * C/Y to the same value (p. 26). You then scroll to C/Y and change it if the
 * compounding frequency differs -- which is exactly what the pp. 38-39 example
 * does (P/Y 12, then C/Y 4). So the P/Y field writes BOTH registers and the C/Y
 * field writes only C/Y.
 *
 * Source: guidebook p. 26 (P/Y/C/Y entry, END/BGN), p. 9 (BGN indicator).
 */
import type { CalculatorState } from '../state.js';
import type { WorksheetDescriptor } from '../worksheet-nav.js';

export const PY_WORKSHEET: WorksheetDescriptor = {
  id: 'PY',
  fields: [
    {
      label: 'P/Y=',
      kind: 'entry',
      get: (s) => s.tvm.PY,
      // Entering P/Y drags C/Y with it (p. 26).
      set: (s, v) => ({ ...s, tvm: { ...s.tvm, PY: v, CY: v } }),
    },
    {
      label: 'C/Y=',
      kind: 'entry',
      get: (s) => s.tvm.CY,
      set: (s, v) => ({ ...s, tvm: { ...s.tvm, CY: v } }),
    },
  ],
  // 2ND CLR WORK here returns P/Y and C/Y to their defaults of 1 (p. 25).
  clearWork: (s) => ({ ...s, tvm: { ...s.tvm, PY: 1, CY: 1 } }),
};

export const BGN_WORKSHEET: WorksheetDescriptor = {
  id: 'BGNSET',
  fields: [
    {
      // The LCD shows just `END` or `BGN`, no label (p. 26). 2ND SET toggles it.
      label: '',
      kind: 'setting',
      get: (s: CalculatorState) => s.tvm.mode,
      cycle: (s) => ({
        ...s,
        tvm: { ...s.tvm, mode: s.tvm.mode === 'END' ? 'BGN' : 'END' },
      }),
    },
  ],
  // END is the default (p. 25). CLR WORK restores it.
  clearWork: (s) => ({ ...s, tvm: { ...s.tvm, mode: 'END' } }),
};

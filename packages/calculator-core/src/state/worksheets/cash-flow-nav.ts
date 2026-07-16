/**
 * Cash Flow worksheet descriptors (guidebook pp. 42-49).
 *
 * THREE worksheets share one stream. `CF` holds the flows (CFo, then C01/F01 ..
 * C24/F24), and the NPV and IRR sub-worksheets read that same `s.cashFlow` to
 * discount it. They are separate WorksheetDescriptors because they have separate
 * entry keys -- `CF`, `NPV`, `IRR` (all primary keys, no 2ND prefix; the golden
 * corpus opens each with a bare press) -- and separate `2ND CLR WORK` scopes
 * (p. 42): clearing in CF wipes CFo/Cnn/Fnn, in NPV wipes NPV, in IRR wipes IRR,
 * and none of the three touches the others. The maths lives in
 * ../../worksheets/cash-flow.ts; this file only wires fields to it.
 *
 * THE DYNAMIC FIELD LIST (p. 42-44). The ring is not a fixed length: it shows CFo
 * plus exactly as many Cnn/Fnn pairs as have been entered, plus ONE empty pair
 * ready to take the next flow. That "one past the end" slot is what the p. 43
 * entry loop lands on with each `↓`, and what the p. 49 lease steps past to leave
 * a group at its 0 default. Modelled here as a static array of all 24 possible
 * pairs, each pair made conditionally `visible`: slot n is reachable only while
 * n <= (number of groups entered) + 1, so an empty stream shows CFo/C01/F01 and a
 * three-group stream shows through C04/F04. `flowAt` reads a not-yet-reached slot
 * as the documented default (amount 0, frequency 1, p. 47), so the empty slot
 * prints `C0k= 0.00` / `F0k= 1.00` before anything is keyed.
 *
 * NPV AND IRR ARE NOT STORED (p. 48). `CashFlowState` is {CFo, groups, I} and holds
 * no NPV or IRR register: both are recomputed from the stream by `get` on every
 * projection, exactly as amortization's BAL/PRN/INT are (worksheet-nav.ts). This
 * is the module's half of the p. 48 observation that IRR still reads its own value
 * "based on the current cash-flow values" -- computing NPV never populates IRR,
 * because neither is a stored slot that the other could write. They carry
 * `kind: 'compute'` (compute-only, p. 42) with a no-op `compute`: the value is
 * produced by `get`, and CPT's only job is to re-land the field so `get` runs and
 * refreshes Last Answer (p. 19). `solveNPV`/`solveIRR` may throw (Error 4 on a bad
 * Fnn, Error 5 on no IRR sign change or the I<=-100 LN boundary, Error 7 on a
 * non-converging IRR); the reducer catches at the command boundary, so neither
 * handler guards.
 *
 * FRAMEWORK LIMITATIONS THAT BLOCK PART OF THE GOLDEN CORPUS. Three behaviours the
 * pp. 47-49 examples rely on are not reachable through the generic engine as
 * delivered, and cannot be supplied from a descriptor (they live in machine.ts /
 * worksheet-nav.ts, which this task must not edit). They are documented here and
 * pinned in the test file rather than hidden:
 *
 *   1. 2ND INS / 2ND DEL. `reduceWorksheet` claims only UP/DOWN/ENTER/CPT/SET/
 *      CLR WORK/CE/C and the reducer has no INS/DEL case, so both keys are inert.
 *      The maths (`insertFlow`/`deleteFlow`, cash-flow.ts) is ready and unit-tested;
 *      only the key routing is missing. The p. 47 edit (delete C03, insert at C02)
 *      therefore does not run, so every machine-example case downstream of it
 *      computes against the PRE-edit stream.
 *   2. `10 ÷ 12 ENTER` into I. `pressEnter` reads `currentValue`, which returns the
 *      entry buffer and ignores the pending division, so ENTER stores 12, not the
 *      0.8333... the p. 49 lease needs. The stored-vs-displayed precision rule is
 *      correct in the maths (`setI` keeps full precision); it is the worksheet
 *      ENTER path that drops the pending operation.
 *   3. 2ND RESET ENTER. The reducer's RESET only sets mode to standard; it neither
 *      restores defaults nor shows the `RST` acknowledgement, so the lease's
 *      opening reset row is not reproducible here. Its effect (a clean machine) is
 *      already the INITIAL_STATE the tests start from.
 *
 * Source: guidebook pp. 42-49 (behaviour, worked examples), pp. 76-77 (formulas),
 * pp. 84-85 (errors); docs/OPEN-QUESTIONS.md (CF-1, CF-13..16).
 */
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';
import {
  MAX_CASH_FLOWS,
  flowAt,
  flowCount,
  setCFo,
  setFlow,
  setFrequency,
  setI,
  solveIRR,
  solveNPV,
} from '../../worksheets/cash-flow.js';

/** `C01`.. / `F01`.. -- the slot number always prints two digits (p. 42). */
const slotLabel = (prefix: 'C' | 'F', n: number): string => `${prefix}${String(n).padStart(2, '0')}=`;

/**
 * Slot n is on the ring only while it is one of the entered groups or the single
 * empty slot past them (p. 43-44). `flowCount + 1` is that empty slot; beyond it
 * the ring has not grown yet. n never exceeds MAX_CASH_FLOWS, so the +1 saturates
 * harmlessly at a full 24-group list.
 */
const slotVisible =
  (n: number) =>
  (s: CalculatorState): boolean =>
    n <= flowCount(s.cashFlow) + 1;

/** Cnn: the amount, enter-only (p. 42). `flowAt` reads a vacant slot as 0.00. */
function amountField(n: number): FieldDescriptor {
  return {
    label: slotLabel('C', n),
    kind: 'entry',
    get: (s) => flowAt(s.cashFlow, n).C,
    set: (s, v) => ({ ...s, cashFlow: setFlow(s.cashFlow, n, v) }),
    visible: slotVisible(n),
  };
}

/** Fnn: the frequency, enter-only (p. 43). Vacant slots read the default 1.00. */
function frequencyField(n: number): FieldDescriptor {
  return {
    label: slotLabel('F', n),
    kind: 'entry',
    get: (s) => flowAt(s.cashFlow, n).F,
    set: (s, v) => ({ ...s, cashFlow: setFrequency(s.cashFlow, n, v) }),
    visible: slotVisible(n),
  };
}

function cashFlowFields(): FieldDescriptor[] {
  // CFo is mandatory, occurs once, and has no frequency -- there is no F00 (p. 43).
  const fields: FieldDescriptor[] = [
    {
      label: 'CFo=',
      kind: 'entry',
      get: (s) => s.cashFlow.CFo,
      set: (s, v) => ({ ...s, cashFlow: setCFo(s.cashFlow, v) }),
    },
  ];
  // Amount and frequency alternate: Cnn then its own Fnn, then C(nn+1) (p. 43-44).
  for (let n = 1; n <= MAX_CASH_FLOWS; n++) {
    fields.push(amountField(n), frequencyField(n));
  }
  return fields;
}

/**
 * CF -- the flow list. `2ND CLR WORK` here resets CFo and every Cnn/Fnn to their
 * defaults but LEAVES I ALONE (p. 42: the CF bullet names only CFo/Cnn/Fnn). So
 * this cannot spread CASH_FLOW_DEFAULTS, whose I is 0; it clears the two flow
 * fields and preserves the discount rate the NPV sub-worksheet owns.
 */
export const CASH_FLOW: WorksheetDescriptor = {
  id: 'CF',
  fields: cashFlowFields(),
  clearWork: (s) => ({ ...s, cashFlow: { ...s.cashFlow, CFo: 0, groups: [] } }),
};

/**
 * NPV -- opens on the discount rate I, then the computed NPV (p. 45). I is
 * enter-only and per cash-flow period, distinct from the TVM worksheet's I/Y
 * (p. 42); it is stored at full precision by `setI` regardless of the display.
 *
 * `2ND CLR WORK` in this view clears NPV alone (p. 42) and, per OPEN-QUESTIONS
 * CF-19, leaves I: since NPV is recomputed rather than stored there is no register
 * to zero, so the clear is a no-op on state and simply re-lands on I.
 */
export const NPV: WorksheetDescriptor = {
  id: 'NPV',
  fields: [
    {
      label: 'I=',
      kind: 'entry',
      get: (s) => s.cashFlow.I,
      set: (s, v) => ({ ...s, cashFlow: setI(s.cashFlow, v) }),
    },
    {
      label: 'NPV=',
      kind: 'compute',
      get: (s) => solveNPV(s.cashFlow),
      compute: (s) => s,
    },
  ],
  clearWork: (s) => s,
};

/**
 * IRR -- a single computed field, solved against the loaded stream with no rate
 * input (p. 45). Opening it shows the current value; CPT solves. `2ND CLR WORK`
 * clears IRR alone (p. 42); as with NPV there is no stored register, so the clear
 * is a no-op that re-lands on IRR.
 */
export const IRR: WorksheetDescriptor = {
  id: 'IRR',
  fields: [
    {
      label: 'IRR=',
      kind: 'compute',
      get: (s) => solveIRR(s.cashFlow),
      compute: (s) => s,
    },
  ],
  clearWork: (s) => s,
};

/** The three descriptors keyed by id, for the central registry wiring. */
export const CASH_FLOW_WORKSHEETS = Object.freeze({ CF: CASH_FLOW, NPV, IRR });

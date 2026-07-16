/**
 * Bond worksheet descriptor.
 *
 * Nine display positions in the fixed p. 50 variable-table order: SDT, CPN, RDT,
 * RV, the ACT/360 day-count toggle, the 2/Y|1/Y coupon-frequency toggle, YLD, PRI,
 * AI. The maths lives in ../../worksheets/bond.ts; this file is only the wiring
 * that maps each position to `state.bond` and to the generic prompted-worksheet
 * engine. Read the contract at the top of ../worksheet-nav.ts first.
 *
 * WHY DATES AND SETTINGS RETURN STRINGS FROM `get`. The engine renders a `string`
 * result directly and a `number` through the DEC formatter (worksheet-nav.ts
 * `worksheetDisplay`). A bond date must print as `12-31-1990` with an unpadded
 * month (p. 50, p. 53), which no numeric format produces, so SDT and RDT return
 * `formatDate(...)`. The two toggles return their printed state name (`ACT`,
 * `2/Y`) exactly as the settings contract requires.
 *
 * A CONSEQUENCE, ACCEPTED. The engine lights `=` unconditionally on a string
 * result, so the p. 27 foreign-value trap (a keyed/recalled number sitting under
 * the label with `=` dark) is not modelled for the date and setting positions --
 * only for the numeric ones (CPN, RV, YLD, PRI). This is the same behaviour the
 * settings already have by construction, no golden case exercises the trap on a
 * date, and `Mode` cannot carry the provenance the true trap would need. The
 * numeric positions spring the trap normally.
 *
 * YLD and PRI are enter-or-compute (p. 50): each declares `kind: 'entry'` and also
 * carries a `compute`, which lights both the ENTER and COMPUTE prompts (p. 22).
 * AI is auto-compute -- it evaluates in `get` on sight, with no CPT (p. 50, p. 53;
 * BOND-6 leaves CPT on AI undefined, so the auto kind's no-op CPT is the safe
 * reading). On the freshly-reset worksheet SDT and RDT share the 12-31-1990
 * default, so scrolling onto AI runs `accruedInterest`, which raises Error 6 (RDT
 * not later than SDT) -- exactly the p. 50 "navigating before entering values
 * causes an error" note. YLD and PRI do NOT compute on landing, so they show their
 * stored 0 rather than erroring; AI is the first position that computes on sight.
 *
 * The field order is the p. 50 table verbatim. The prose PRI->YLD step (p. 53) is
 * unreachable as printed (BOND-1) and no golden case asserts it, so nothing here
 * adds a wrap-around: the standard ring is all there is.
 *
 * Source: guidebook pp. 50-54 (behaviour, worked example), p. 50 variable table
 * and defaults, pp. 77-78 (formulas, in bond.ts).
 */
import {
  BOND_DEFAULTS,
  accruedInterest,
  computePrice,
  computeYield,
  formatDate,
  parseDateEntry,
  toggleCouponFrequency,
  toggleDayCount,
} from '../../worksheets/bond.js';
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';

/**
 * A date position (SDT, RDT). `get` prints the stored date under the current
 * date-format setting; `set` parses the keyed mm.ddyy (or dd.mmyy) number, which
 * raises Error 6 on an impossible or mis-keyed date (bond.ts `parseDateEntry`).
 */
function dateField(
  label: string,
  read: (s: CalculatorState) => CalculatorState['bond']['SDT'],
  write: (bond: CalculatorState['bond'], date: CalculatorState['bond']['SDT']) => CalculatorState['bond'],
): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => formatDate(read(s), s.format.dateFormat),
    set: (s, v) => ({ ...s, bond: write(s.bond, parseDateEntry(v, s.format.dateFormat)) }),
  };
}

/** A plain numeric enter-only position (CPN, RV). */
function numberField(
  label: string,
  read: (s: CalculatorState) => number,
  write: (bond: CalculatorState['bond'], v: number) => CalculatorState['bond'],
): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: read,
    set: (s, v) => ({ ...s, bond: write(s.bond, v) }),
  };
}

export const BOND: WorksheetDescriptor = {
  id: 'BOND',
  fields: [
    dateField('SDT=', (s) => s.bond.SDT, (bond, SDT) => ({ ...bond, SDT })),
    numberField('CPN=', (s) => s.bond.CPN, (bond, CPN) => ({ ...bond, CPN })),
    dateField('RDT=', (s) => s.bond.RDT, (bond, RDT) => ({ ...bond, RDT })),
    numberField('RV=', (s) => s.bond.RV, (bond, RV) => ({ ...bond, RV })),
    {
      // ACT/360 day-count toggle. Prints its state name, no label, no `=` value
      // of its own (p. 50, p. 53).
      label: '',
      kind: 'setting',
      get: (s) => s.bond.dayCount,
      cycle: (s) => ({ ...s, bond: toggleDayCount(s.bond) }),
    },
    {
      // 2/Y | 1/Y coupon-frequency toggle.
      label: '',
      kind: 'setting',
      get: (s) => s.bond.frequency,
      cycle: (s) => ({ ...s, bond: toggleCouponFrequency(s.bond) }),
    },
    {
      // Enter-or-compute: key a yield, or CPT it from an entered price (p. 50).
      label: 'YLD=',
      kind: 'entry',
      get: (s) => s.bond.YLD,
      set: (s, v) => ({ ...s, bond: { ...s.bond, YLD: v } }),
      compute: (s) => ({ ...s, bond: { ...s.bond, YLD: computeYield(s.bond) } }),
    },
    {
      // Enter-or-compute: key a price, or CPT it from an entered yield (p. 50).
      label: 'PRI=',
      kind: 'entry',
      get: (s) => s.bond.PRI,
      set: (s, v) => ({ ...s, bond: { ...s.bond, PRI: v } }),
      compute: (s) => ({ ...s, bond: { ...s.bond, PRI: computePrice(s.bond) } }),
    },
    {
      // Auto-compute on sight; never stored, never CPT'd (p. 50, p. 53).
      label: 'AI=',
      kind: 'auto',
      get: (s) => accruedInterest(s.bond),
    },
  ],
  // p. 50-51 defaults table: SDT/RDT 12-31-1990, CPN 0, RV 100, YLD 0, PRI 0,
  // day-count ACT, frequency 2/Y. BOND_DEFAULTS carries exactly these.
  clearWork: (s) => ({ ...s, bond: BOND_DEFAULTS }),
};

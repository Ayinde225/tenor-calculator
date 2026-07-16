/**
 * Percent Change / Compound Interest worksheet descriptor (guidebook pp. 63-66).
 *
 * Four variables, all enter-or-compute: `OLD`, `NEW`, `%CH`, `#PD`. The prose on
 * p. 64 is explicit that "any of the four" is solvable from the other three, so
 * every field carries both a `set` and a `compute` -- the "enter-or-compute"
 * shape that lights the ENTER and COMPUTE indicators together (p. 22). That is
 * the same shape as Profit Margin's three fields; the only structural difference
 * is that this worksheet has four of them and no setting.
 *
 * The governing equation and every solved form live in `percent-change.ts`; this
 * file is only the field list and the clear.
 *
 * #PD CLEARS TO 1, NOT 0 (OPEN-QUESTIONS OW-1). `PERCENT_CHANGE_DEFAULTS`
 * carries that correction; `clearWork` just installs the defaults, so the fix is
 * held in one place rather than duplicated here. The p. 65 cost-sell-markup
 * example is the arbiter: it presses 2ND CLR WORK, enters only OLD and NEW, and
 * still computes %CH = 25.00, which the 1/#PD in the %CH solve cannot reach with
 * #PD = 0.
 */
import {
  PERCENT_CHANGE_DEFAULTS,
  computePercentChange,
  type PercentChangeVariable,
} from '../../worksheets/percent-change.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';

/**
 * One enter-or-compute variable. The state key (`CH`, `PD`) and the LCD label
 * (`%CH=`, `#PD=`) differ, which is why both are passed in rather than derived
 * from one another.
 */
function pctField(label: string, v: PercentChangeVariable): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => s.pctChange[v],
    set: (s, x) => ({ ...s, pctChange: { ...s.pctChange, [v]: x } }),
    compute: (s) => ({
      ...s,
      pctChange: { ...s.pctChange, [v]: computePercentChange(s.pctChange, v) },
    }),
  };
}

/**
 * Field order OLD -> NEW -> %CH -> #PD (p. 64 "Entering Values", confirmed by the
 * p. 65 examples' DOWN/UP counts: `DOWN DOWN` from NEW lands on #PD, `UP` from
 * %CH returns to NEW).
 */
export const PERCENT_CHANGE: WorksheetDescriptor = {
  id: 'PCT',
  fields: [
    pctField('OLD=', 'OLD'),
    pctField('NEW=', 'NEW'),
    pctField('%CH=', 'CH'),
    pctField('#PD=', 'PD'),
  ],
  clearWork: (s) => ({ ...s, pctChange: PERCENT_CHANGE_DEFAULTS }),
};

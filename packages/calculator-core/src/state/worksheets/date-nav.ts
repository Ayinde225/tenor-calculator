/**
 * Date worksheet descriptor (guidebook pp. 68-69).
 *
 * A four-field ring: DT1, DT2, DBD, and one ACT/360 setting slot. DT1, DT2 and
 * DBD are enter-or-compute -- key any two, compute the third (p. 69) -- so each
 * declares `kind: 'entry'` and carries a `compute`, the shape that lights both the
 * ENTER and COMPUTE prompts (worksheet-nav.ts, p. 22). The day-count slot is a
 * `setting` cycled by 2ND SET; ACT and 360 share it (p. 68).
 *
 * The maths lives in ../../worksheets/date.ts; this file only wires the fields to
 * it. `parseDateEntry` and `computeDate` throw CalculatorError -- Error 6 for an
 * impossible date or a MM.DDYYYY mis-key, Error 4 for a computed date outside
 * 1980-2079, Error 5 for computing DT1/DT2 under the 360 method (p. 69) -- and the
 * reducer catches at the command boundary, so both handlers re-throw by simply not
 * guarding.
 *
 * WHY DT1 AND DT2 RETURN A STRING FROM `get`. The LCD prints a date as
 * `9-04-2003`, which no numeric formatter can produce from `displayValue`. The
 * navigation engine already renders a `get` that returns a string directly, with
 * the `=` indicator lit (worksheet-nav.ts `worksheetDisplay`) -- the branch the
 * setting slot uses. DT1/DT2 ride that same branch, returning the formatted date.
 * DBD by contrast is a plain count of days and returns a number, so it renders and
 * compares like any numeric field (the `58.00` of p. 69, DEC-formatted).
 *
 * TWO THINGS THIS DESCRIPTOR DELIBERATELY DOES NOT REPRODUCE, both untested by the
 * corpus and both structural, not oversights:
 *
 *  - The weekday abbreviation shown beside a COMPUTED DT1/DT2 (p. 68: "WED"). `get`
 *    is stateless and runs on every projection; it cannot tell a date the user
 *    keyed from one CPT just produced, and neither `DateState` nor `Mode` has a
 *    slot to record that it was computed. `weekdayOf` exists in the maths module
 *    for a caller that can carry the provenance; this framework cannot, and no
 *    golden case asserts the weekday. See docs/OPEN-QUESTIONS.md.
 *  - The p. 27 display trap for DT1/DT2. Because their `get` returns a string,
 *    `worksheetDisplay` lights `=` before it ever compares against `displayValue`,
 *    so a foreign number left under a date label (an RCL, a TVM key) would still
 *    read as belonging to it. The trap is intact for the numeric DBD field, which
 *    is the one this worksheet can carry it on.
 */
import type { CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';
import {
  clearWork as clearDateWork,
  computeDate,
  formatDate,
  parseDateEntry,
  toggleMethod,
} from '../../worksheets/date.js';

/**
 * DT1 and DT2: enter-or-compute (p. 69). `get` returns the formatted date string
 * (rendered directly by the engine, `=` lit); `set` parses the keyed MM.DDYY (or
 * DD.MMYY) token in the current date format; `compute` solves this date from the
 * other date and DBD, which is barred under the 360 method (Error 5, p. 69).
 */
function dateField(label: string, v: 'DT1' | 'DT2'): FieldDescriptor {
  return {
    label,
    kind: 'entry',
    get: (s) => formatDate(s.date[v], s.format.dateFormat),
    set: (s, value) => ({
      ...s,
      date: { ...s.date, [v]: parseDateEntry(value, s.format.dateFormat) },
    }),
    compute: (s) => ({ ...s, date: { ...s.date, [v]: computeDate(s.date, v) } }),
  };
}

export const DATE_WORKSHEET: WorksheetDescriptor = {
  id: 'DATE',
  fields: [
    dateField('DT1=', 'DT1'),
    dateField('DT2=', 'DT2'),
    {
      // Enter-or-compute, but a plain day count: a number, not a date string.
      // Computes under both methods; only DT1/DT2 are barred under 360 (p. 69).
      label: 'DBD=',
      kind: 'entry',
      get: (s) => s.date.DBD,
      set: (s, v) => ({ ...s, date: { ...s.date, DBD: v } }),
      compute: (s) => ({ ...s, date: { ...s.date, DBD: computeDate(s.date, 'DBD') } }),
    },
    {
      // One slot, two methods, cycled by 2ND SET (p. 68). `get` returns the bare
      // method name; the engine renders it as the value with no numeric label.
      label: '',
      kind: 'setting',
      get: (s) => s.date.method,
      cycle: (s) => ({ ...s, date: { ...s.date, method: toggleMethod(s.date.method) } }),
    },
  ],
  // p. 68: clears DT1, DT2 and DBD to their defaults and leaves the day-count
  // method alone. Not DATE_DEFAULTS, which would also reset the method to ACT --
  // that is 2ND RESET, not 2ND CLR WORK.
  clearWork: (s: CalculatorState) => ({ ...s, date: clearDateWork(s.date) }),
};

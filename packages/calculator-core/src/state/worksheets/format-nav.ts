/**
 * The FORMAT worksheet descriptor (guidebook pp. 9-10).
 *
 * Five global format settings, in the order the LCD walks them (p. 9 table):
 *
 *     DEC  ->  angle unit  ->  date format  ->  number separators  ->  calc method
 *
 * `2ND FORMAT` opens on DEC; `↓`/`↑` step one format per press. Unlike every other
 * worksheet these variables are not owned by any computation -- they are the
 * calculator's own display and evaluation settings, held in `state.format` and
 * kept across power-off by Constant Memory (p. 6). So the maths module other
 * worksheets carry does not exist here: reading and writing `state.format` IS the
 * whole behaviour, and it lives in this descriptor.
 *
 * DEC IS AN ENTRY FIELD, THE OTHER FOUR ARE SETTINGS (p. 9). DEC takes a keyed
 * value and `ENTER` (step 2); the four toggles take `2ND SET` (step 4). That split
 * is the reason DEC declares `kind: 'entry'` with a `set`, and the rest declare
 * `kind: 'setting'` with a `cycle`.
 *
 * DEC = 9 IS FLOATING DECIMAL, NOT NINE FIXED PLACES (p. 9: "0-9 (Press 9 for
 * floating-decimal)"). `DecimalSetting` already encodes this -- 9 is the floating
 * sentinel `FLOATING_DECIMAL`, and `formatValue` branches on it -- so storing 9
 * here selects floating display, and a naive nine-places reading is wrong at the
 * top of the range.
 *
 * CLR WORK RESETS ALL FIVE, NOT THE ONE SHOWN (p. 10: "press 2nd [CLR WORK] with
 * one of the formats displayed" restores "all of the calculator formats"). The
 * FORMAT worksheet behaves as a single unit under CLR WORK, so `clearWork` writes
 * the whole `FORMAT_DEFAULTS` rather than just the displayed field -- see
 * OPEN-QUESTIONS FMT note and edge case 10.
 *
 * NAVIGATION IS PLAIN WRAPPING. p. 9 offers "↑↑↑ or ↓↓↓" to reach the separators,
 * but only the ↓ path is arithmetically consistent with the five-format order
 * (OPEN-QUESTIONS FMT-1); the ↑ path and the wrap direction are unresolved. The
 * generic ring in worksheet-nav.ts wraps in both directions, and no golden case
 * exercises the ↑ path, so nothing here encodes the disputed claim.
 *
 * DISPLAY READOUTS ARE LARGELY UNPRINTED (FMT-7). The guidebook shows the four
 * settings' names (DEG/RAD, US/Eur, US/Eur, Chn/AOS -- p. 9 table) but never the
 * literal DEC readout. The four settings therefore print their name with an empty
 * label; DEC, being a numeric entry field, renders through the current DEC format
 * like every other numeric field on this machine (so `DEC= 2.00` at DEC=2), which
 * no golden case contradicts.
 *
 * Source: guidebook p. 9 (the format table, entry and navigation), p. 10 (angle
 * units, calc method, CLR WORK resets all formats), p. 84 (Error 4 ties to DEC out
 * of range).
 */
import { FORMAT_DEFAULTS, type CalculatorState } from '../state.js';
import type { FieldDescriptor, WorksheetDescriptor } from '../worksheet-nav.js';
import { FLOATING_DECIMAL, type DecimalSetting } from '../../display/format.js';
import { CalculatorError, ErrorCode } from '../../errors.js';

// ---------------------------------------------------------------------------
// DEC -- the one entry field (p. 9 step 2, p. 84)
// ---------------------------------------------------------------------------

/**
 * Store a keyed DEC value.
 *
 * Range is 0-9 inclusive, 9 being floating decimal (p. 9); outside it is Error 4,
 * the single error the appendix ties to a FORMAT variable (p. 84 "the DEC value is
 * outside the range 0-9").
 *
 * A fractional entry (2.5) is left unresolved by the guidebook -- Error 4 is tied
 * to a value "outside 0-9", which 2.5 is not (OPEN-QUESTIONS FMT-6). Truncate
 * toward zero, then bound: the reading under which 2.5 keeps a place count of 2
 * and 10 is rejected. `v` arrives already at internal precision; no rounding here.
 */
function setDec(state: CalculatorState, v: number): CalculatorState {
  const places = Math.trunc(v);
  if (places < 0 || places > FLOATING_DECIMAL) {
    throw new CalculatorError(ErrorCode.OutOfRange, `DEC ${places} is outside 0-9`);
  }
  return { ...state, format: { ...state.format, DEC: places as DecimalSetting } };
}

const DEC: FieldDescriptor = {
  label: 'DEC=',
  kind: 'entry',
  get: (s) => s.format.DEC,
  set: setDec,
  // No `compute`: DEC is enter-only. And no `cycle`: 2ND SET on DEC is unstated and
  // treated as a no-op (OPEN-QUESTIONS FMT-3) -- pressSet ignores a field with no
  // cycle, so declaring nothing gives exactly that.
};

// ---------------------------------------------------------------------------
// The four two-state settings (p. 9 step 4, p. 10)
// ---------------------------------------------------------------------------

/**
 * A two-state format setting. `2ND SET` flips it; `get` returns the name the p. 9
 * table prints, with an empty label because the setting name IS the readout.
 *
 * The guidebook documents `2ND SET` only as "change the setting" without a cycle
 * order (p. 9), which is unambiguous for a binary toggle: one press is the flip.
 */
function toggleField(
  get: (s: CalculatorState) => string,
  cycle: (s: CalculatorState) => CalculatorState,
): FieldDescriptor {
  return { label: '', kind: 'setting', get, cycle };
}

// Angle units: DEG (degrees) / RAD (radians), default DEG (p. 9-10). RAD also
// lights the upper-right annunciator, but that is projected from state.format by
// the reducer, not by this field.
const ANGLE = toggleField(
  (s) => (s.format.angleUnit === 'RAD' ? 'RAD' : 'DEG'),
  (s) => ({
    ...s,
    format: { ...s.format, angleUnit: s.format.angleUnit === 'DEG' ? 'RAD' : 'DEG' },
  }),
);

// Dates: US (mm-dd-yyyy) / Eur (dd-mm-yyyy), default US (p. 9). This setting only
// picks the grammar; the Bond and Date worksheets consume it.
const DATE_FORMAT = toggleField(
  (s) => (s.format.dateFormat === 'EUR' ? 'Eur' : 'US'),
  (s) => ({
    ...s,
    format: { ...s.format, dateFormat: s.format.dateFormat === 'US' ? 'EUR' : 'US' },
  }),
);

// Number separators: US (1,000.00) / Eur (1.000,00), default US (p. 9).
const SEPARATORS = toggleField(
  (s) => (s.format.separators === 'EUR' ? 'Eur' : 'US'),
  (s) => ({
    ...s,
    format: { ...s.format, separators: s.format.separators === 'US' ? 'EUR' : 'US' },
  }),
);

// Calculation method: Chn (chain) / AOS (algebraic operating system), default Chn
// (p. 9-10). The chosen method drives the standard-mode expression engine.
const CALC_METHOD = toggleField(
  (s) => (s.format.calcMethod === 'AOS' ? 'AOS' : 'Chn'),
  (s) => ({
    ...s,
    format: { ...s.format, calcMethod: s.format.calcMethod === 'CHN' ? 'AOS' : 'CHN' },
  }),
);

// ---------------------------------------------------------------------------

export const FORMAT: WorksheetDescriptor = {
  id: 'FORMAT',
  fields: [DEC, ANGLE, DATE_FORMAT, SEPARATORS, CALC_METHOD],
  // p. 10: CLR WORK with any format shown resets ALL five to their defaults, not
  // just the displayed one. Writing the whole defaults block is the single-unit
  // behaviour the page describes.
  clearWork: (s) => ({ ...s, format: FORMAT_DEFAULTS }),
};

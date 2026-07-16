/**
 * The generic prompted-worksheet engine.
 *
 * Every prompted worksheet on this machine behaves identically. It is a ring of
 * labelled fields; UP/DOWN walks the ring, ENTER assigns, CPT computes, 2ND SET
 * cycles, 2ND CLR WORK resets, 2ND QUIT leaves (guidebook pp. 21-22). Only the
 * field list differs. So the behaviour lives here once and a worksheet declares
 * nothing but its fields -- see `worksheet-registry.ts`.
 *
 * WHAT A WORKSHEET AUTHOR MUST KNOW
 *
 *  - `get` is called on every projection, not only on navigation. It must be pure
 *    and cheap-ish, and it must be the ONLY source of a field's value. Do not
 *    cache a computed result into `CalculatorState`: automatic-compute variables
 *    (BAL, PRN, INT, DEP, RBV, RDV, AI, the statistics outputs) evaluate the
 *    moment they are scrolled onto (p. 22), and a stored copy is a staleness bug
 *    the hardware cannot have.
 *  - `get` MAY throw `CalculatorError`. Navigation runs inside the reducer's try,
 *    so the throw latches an error exactly as the hardware does. Projection
 *    swallows it -- see `worksheetDisplay`.
 *  - `set` receives a value already rounded to internal precision (13 significant
 *    digits, §1.1). It must not round further: entered values are stored at full
 *    internal precision regardless of what the display shows (§1.4).
 *  - `kind` and the optional handlers must agree; `assertRegistryConsistent`
 *    checks that, and the registry test calls it.
 *
 * THE DISPLAY TRAP (p. 27). Inside a worksheet the calculator "displays only the
 * value you enter or recall, although any variable label previously displayed
 * remains displayed", and the only cue that the number does not belong to the
 * label is that the `=` indicator goes dark. So `SEL= 125.00` and `SEL 125` are
 * different facts about the machine, and the difference is one annunciator.
 * Reproduced here by deriving `=` from whether the display still equals the
 * field's own value.
 *
 * Source: guidebook p. 21 (variable types, the `=` sign, UP/DOWN), p. 22
 * (per-type indicator prompts, 2ND SET), p. 23 (display indicators), p. 27 (the
 * trap), p. 28 (the ring wraps; AMORT auto-advance), p. 11 (CE/C CE/C, CLR WORK,
 * QUIT).
 */
import type { CalculatorState, WorksheetId } from './state.js';
import type { Key } from './keys.js';
import type { DisplayFormat } from '../display/format.js';
import {
  type DisplayState,
  type Indicator,
  makeDisplay,
  renderEntry,
  renderValue,
} from './display-state.js';
import { toInternal } from '../numeric/precision.js';
import { currentValue } from './machine.js';

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

/**
 * How a field behaves. Guidebook p. 21 "Types of Worksheet Variables".
 *
 * The guidebook lists five types; this union has four, because "enter-or-compute"
 * is not a fifth behaviour -- it is an entry field that also carries a `compute`.
 * Bond's YLD/PRI, Breakeven's five, and Profit Margin's three are all of that
 * shape: declare `kind: 'entry'` and supply both `set` and `compute`.
 *
 *   entry    -- the user keys a value and presses ENTER. Supplies `set`.
 *   compute  -- CPT computes it; it cannot be keyed (NPV, IRR). Supplies
 *               `compute`, no `set`.
 *   auto     -- computed the instant it is scrolled onto, never stored (BAL, PRN,
 *               INT, DEP, RBV, RDV, AI, the statistics outputs). Supplies neither
 *               `set` nor `compute`; `get` does the work.
 *   setting  -- 2ND SET cycles it (ACT/360, 2/Y 1/Y, END/BGN, the DEPR method,
 *               the STAT method). Supplies `cycle`; `get` returns the setting's
 *               printed name, e.g. 'ACT'.
 */
export type FieldKind = 'entry' | 'compute' | 'auto' | 'setting';

export interface FieldDescriptor {
  /**
   * Exactly as the LCD prints it, including the trailing `=`: 'P/Y=', 'CFo=',
   * 'BAL='. A setting field that prints no label uses ''.
   *
   * The `=` stays in the label even when the displayed value does NOT belong to
   * the field. The p. 27 trap is carried by the `=` INDICATOR, which is the
   * carrier `display-state.ts` designates for it; duplicating the same fact in
   * the label string would give it two sources of truth.
   */
  readonly label: string;
  readonly kind: FieldKind;
  /**
   * The field's current value. Pure. Called on navigation AND on every
   * projection, so an `auto` field's computation runs here, not in `set`.
   * Returns a string only for `setting` fields.
   */
  readonly get: (s: CalculatorState) => number | string;
  /** ENTER. `v` arrives already rounded to internal precision. Required by `kind: 'entry'`. */
  readonly set?: (s: CalculatorState, v: number) => CalculatorState;
  /** CPT. Required by `kind: 'compute'`; optional on `kind: 'entry'` (enter-or-compute). */
  readonly compute?: (s: CalculatorState) => CalculatorState;
  /** 2ND SET. Advances to the next setting, wrapping. Required by `kind: 'setting'`. */
  readonly cycle?: (s: CalculatorState) => CalculatorState;
  /**
   * Conditional fields. A field whose `visible` returns false is skipped by
   * UP/DOWN and cannot be landed on. Omit for a field that is always shown.
   */
  readonly visible?: (s: CalculatorState) => boolean;
}

export interface WorksheetDescriptor {
  readonly id: WorksheetId;
  /** In LCD order. Entering the worksheet lands on the first VISIBLE one. */
  readonly fields: readonly FieldDescriptor[];
  /** 2ND CLR WORK: reset this worksheet's own variables to their defaults (p. 11). */
  readonly clearWork: (s: CalculatorState) => CalculatorState;
}

/**
 * WorksheetId -> descriptor. Partial: an id with no descriptor is a worksheet
 * that has not been built yet, and its entry key is inert rather than fatal.
 */
export type WorksheetRegistry = Partial<Readonly<Record<WorksheetId, WorksheetDescriptor>>>;

/**
 * The keys that open a worksheet, and which one they open.
 *
 * Keys are logical (`keys.ts`): `2ND AMORT` is two presses and the entry key acts
 * whether or not the 2ND latch happens to be armed, matching how `QUIT`,
 * `RESET` and `CLR TVM` are already dispatched in the reducer.
 *
 * `Δ%` opens PCT and `DATA` opens the statistics data list: the key spelling and
 * the WorksheetId spelling differ, which is the whole reason this map exists.
 */
export const WORKSHEET_ENTRY_KEYS: Partial<Readonly<Record<Key, WorksheetId>>> = Object.freeze({
  AMORT: 'AMORT',
  CF: 'CF',
  NPV: 'NPV',
  IRR: 'IRR',
  BOND: 'BOND',
  DEPR: 'DEPR',
  DATA: 'DATA',
  STAT: 'STAT',
  'Δ%': 'PCT',
  ICONV: 'ICONV',
  DATE: 'DATE',
  PROFIT: 'PROFIT',
  BRKEVN: 'BRKEVN',
  MEM: 'MEM',
  FORMAT: 'FORMAT',
  'P/Y': 'PY',
  BGN: 'BGNSET',
} as const);

/** The keys this engine claims while a worksheet is displayed. Everything else falls through. */
const NAVIGATION_KEYS: ReadonlySet<Key> = new Set<Key>([
  'UP',
  'DOWN',
  'ENTER',
  'CPT',
  'SET',
  'CLR WORK',
  'CE/C',
]);

// ---------------------------------------------------------------------------
// Field selection
// ---------------------------------------------------------------------------

const isVisible = (f: FieldDescriptor, s: CalculatorState): boolean =>
  f.visible === undefined || f.visible(s);

/**
 * The first visible field at or after `start`, walking in `delta`.
 *
 * The ring wraps: p. 28 step 6 says outright that with INT displayed, `↓` shows
 * P1 again, and the p. 40 schedule table uses that wrap twice. The UP direction
 * is assumed symmetric -- no worked example scrolls off the top of a worksheet,
 * so the up-wrap is inference, not transcription.
 *
 * Bounded by the field count so an all-invisible worksheet terminates instead of
 * spinning.
 */
function findVisible(
  ws: WorksheetDescriptor,
  s: CalculatorState,
  start: number,
  delta: 1 | -1,
): number | null {
  const n = ws.fields.length;
  if (n === 0) return null;
  for (let k = 0; k < n; k++) {
    const i = (((start + k * delta) % n) + n) % n;
    const f = ws.fields[i];
    if (f !== undefined && isVisible(f, s)) return i;
  }
  return null;
}

/** The descriptor for the worksheet currently displayed, or null. */
export function activeWorksheet(
  state: CalculatorState,
  registry: WorksheetRegistry,
): WorksheetDescriptor | null {
  if (state.mode.kind !== 'worksheet') return null;
  return registry[state.mode.worksheet] ?? null;
}

/** The field currently displayed, or null. */
export function activeField(
  state: CalculatorState,
  registry: WorksheetRegistry,
): FieldDescriptor | null {
  if (state.mode.kind !== 'worksheet') return null;
  const ws = registry[state.mode.worksheet];
  return ws?.fields[state.mode.field] ?? null;
}

// ---------------------------------------------------------------------------
// Landing on a field
// ---------------------------------------------------------------------------

/**
 * Put the field's own value on the display.
 *
 * For an `auto` field this is where the computation happens -- "the calculator
 * computes and displays the value automatically without you having to press CPT"
 * (p. 22). `get` may throw; the caller is inside the reducer's try.
 *
 * A `setting` field's value is a string, which `displayValue` cannot hold, so the
 * display value is left alone and `worksheetDisplay` renders `get` directly.
 */
function syncDisplay(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  const v = field.get(state);
  if (typeof v === 'string') return { ...state, entryBuffer: null };
  return { ...state, entryBuffer: null, displayValue: v };
}

/**
 * Land on a field: show its value, and refresh Last Answer if the landing itself
 * computed something.
 *
 * ANS is refreshed by "ENTER, CPT, = and automatic computes" (p. 19). Scrolling
 * onto BAL is an automatic compute and so refreshes it; scrolling onto P1, which
 * merely recalls a stored number, does not.
 */
function land(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  const s = syncDisplay(state, field);
  return field.kind === 'auto' ? { ...s, ans: s.displayValue } : s;
}

function moveTo(
  state: CalculatorState,
  ws: WorksheetDescriptor,
  index: number | null,
): CalculatorState {
  if (index === null) return state;
  const field = ws.fields[index];
  if (field === undefined) return state;
  return land({ ...state, mode: { kind: 'worksheet', worksheet: ws.id, field: index } }, field);
}

/**
 * Open a worksheet on its first visible field (p. 21: "After you access a
 * worksheet, press ↓ or ↑ to select variables").
 *
 * Entering does NOT clear. `2ND PROFIT` shows `CST= 0.00` on p. 71 only because
 * that example starts from a reset machine -- there is no auto-clear on entry.
 *
 * An unregistered id leaves the state untouched: the eight worksheets still to be
 * built have live keys but no descriptors, and a dead key beats a crash.
 */
export function enterWorksheet(
  state: CalculatorState,
  id: WorksheetId,
  registry: WorksheetRegistry,
): CalculatorState {
  const ws = registry[id];
  if (ws === undefined) return state;
  const first = findVisible(ws, state, 0, 1);
  if (first === null) return state;
  return moveTo(state, ws, first);
}

// ---------------------------------------------------------------------------
// The keys
// ---------------------------------------------------------------------------

/**
 * ENTER: assign the displayed value to the displayed variable (p. 21).
 *
 * The value taken is whatever the display holds -- the entry buffer if the user
 * is mid-entry, otherwise the committed display value. That second path is not
 * academic: p. 41 amortizes a balloon with `↓ 5 2ND [xP/Y] ENTER`, where xP/Y has
 * already turned the keyed 5 into a committed 60 before ENTER is pressed.
 *
 * A field with no `set` ignores ENTER.
 */
function pressEnter(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  if (field.set === undefined) return state;
  const v = toInternal(currentValue(state));
  const stored = field.set({ ...state, entryBuffer: null, displayValue: v }, v);
  return { ...land(stored, field), ans: v };
}

/**
 * CPT: compute the displayed variable (p. 22).
 *
 * CPT is an immediate action inside a worksheet, not the prefix it is in
 * standard-calculator mode. p. 71 computes cost with a bare `↑ ↑ CPT` and p. 40
 * advances the amortization window with a bare `↓ CPT`; neither is followed by a
 * variable key.
 *
 * A field with no `compute` ignores CPT. That includes the `auto` fields, whose
 * value is already the freshly computed one -- pressing CPT on BAL can do nothing
 * observable because scrolling onto BAL already did it.
 */
function pressCompute(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  if (field.compute === undefined) return state;
  const computed = field.compute(state);
  const landed = land(computed, field);
  return { ...landed, ans: landed.displayValue };
}

/** 2ND SET: "press 2nd [SET] once for each setting" (p. 22). */
function pressSet(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  if (field.cycle === undefined) return state;
  return land(field.cycle(state), field);
}

/**
 * 2ND CLR WORK: reset the CURRENT worksheet's variables to their defaults and
 * return to its first field (p. 11 "The prompted worksheet and reset default
 * values"; TI KB 11231).
 *
 * Only this worksheet. It is not 2ND RESET: other worksheets, the memories and
 * the format settings all survive.
 *
 * The scan for the first visible field runs against the CLEARED state, because
 * clearing can change which fields are visible.
 */
function pressClearWork(state: CalculatorState, ws: WorksheetDescriptor): CalculatorState {
  const cleared = ws.clearWork({ ...state, entryBuffer: null });
  const first = findVisible(ws, cleared, 0, 1);
  if (first === null) return cleared;
  return moveTo(cleared, ws, first);
}

/**
 * CE/C inside a worksheet.
 *
 * p. 11 pairs `CE/C CE/C` with "In a prompted worksheet, the variable value keyed
 * in but not entered (the previous value appears)" and with "Any calculation
 * started but not completed". It never says what ONE press does, so the split
 * below is inference: the first press drops the keyed value and shows 0 exactly
 * as CE/C does in standard-calculator mode, and the second, with nothing left to
 * drop, restores the variable. Two presses then produce the documented outcome,
 * which is the only outcome the guidebook commits to.
 *
 * Either way it does not leave the worksheet -- that is 2ND QUIT's job.
 */
function pressClearEntry(state: CalculatorState, field: FieldDescriptor): CalculatorState {
  const base: CalculatorState = { ...state, pendingOps: [], parenLevels: 0, errorState: null };
  if (state.entryBuffer !== null) return { ...base, entryBuffer: null, displayValue: 0 };
  return land(base, field);
}

/**
 * Route one key while a worksheet is displayed.
 *
 * Returns null for a key this engine does not claim, so the reducer falls through
 * to standard-calculator handling. That fall-through is load-bearing, not a
 * convenience: digits, `.`, `+/-`, backspace, `2ND xP/Y`, RCL and the five TVM
 * keys all stay live inside a worksheet (p. 22, p. 27), and it is exactly those
 * keys that spring the p. 27 display trap.
 *
 * Modifier latches are cleared by the caller.
 */
export function reduceWorksheet(
  state: CalculatorState,
  key: Key,
  registry: WorksheetRegistry,
): CalculatorState | null {
  if (state.mode.kind !== 'worksheet') return null;
  if (!NAVIGATION_KEYS.has(key)) return null;

  const ws = registry[state.mode.worksheet];
  if (ws === undefined) return null;
  const index = state.mode.field;
  const field = ws.fields[index];
  if (field === undefined) return null;

  switch (key) {
    case 'DOWN':
      return moveTo(state, ws, findVisible(ws, state, index + 1, 1));
    case 'UP':
      return moveTo(state, ws, findVisible(ws, state, index - 1, -1));
    case 'ENTER':
      return pressEnter(state, field);
    case 'CPT':
      return pressCompute(state, field);
    case 'SET':
      return pressSet(state, field);
    case 'CLR WORK':
      return pressClearWork(state, ws);
    case 'CE/C':
      return pressClearEntry(state, field);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Read a field without letting a calculator condition escape.
 *
 * Projection is the one place `get` must not throw. The reducer catches at the
 * command boundary, but `project` also runs on paths outside that try (a key
 * pressed while powered off, `reduceAll`'s initial render). If a field cannot be
 * evaluated the error has already been latched by the navigation that computed
 * it, and this projection is unreachable in practice; the guard exists so that
 * "unreachable" never becomes "throws".
 */
function safeGet(field: FieldDescriptor, state: CalculatorState): number | string | null {
  try {
    return field.get(state);
  } catch {
    return null;
  }
}

/**
 * Prompt annunciators, from the field's shape (p. 21-22).
 *
 * ENTER and COMPUTE are prompts, not confirmations: "the ENTER indicator reminds
 * you to press ENTER after keying in a value" (p. 21) and "the COMPUTE indicator
 * reminds you to press CPT to compute its value" (p. 22). They are lit whenever
 * the field can take that key, before and after it is pressed. An enter-or-
 * compute variable "displays the variable label with the ENTER and COMPUTE
 * indicators" (p. 22) -- both, which is why these read the handlers rather than
 * switching on `kind`.
 *
 * The guidebook also prints two finer glyphs the LCD carries beside the number:
 * `◁` for "the calculator entered this" and `*` for "the calculator computed
 * this" (p. 23). p. 71 shows `SEL= 125.00◁` after ENTER and `CST= 100.00 *` after
 * CPT, and neither on the value shown when the worksheet merely opens. This
 * engine's `Indicator` union has no glyph for either; both collapse into `=`,
 * which is lit for all three of those displays because in all three the value
 * does belong to the label. The provenance distinction is not modelled and no
 * golden case asserts it.
 */
function promptIndicators(field: FieldDescriptor): Indicator[] {
  const ind: Indicator[] = [];
  if (field.set !== undefined) ind.push('ENTER');
  if (field.compute !== undefined) ind.push('COMPUTE');
  if (field.kind === 'setting') ind.push('SET');
  return ind;
}

/**
 * Project the LCD for a displayed worksheet field. Returns null when the state is
 * not on a registered worksheet field, so the caller renders standard mode.
 *
 * THE `=` RULE (p. 21: "The = sign displayed between the variable label and value
 * indicates that the variable is assigned the value"; p. 27: "You can tell that
 * the displayed value is not assigned to the displayed variable, because the =
 * indicator is not displayed").
 *
 * `=` is lit iff the display still holds the field's own value. Mid-entry it is
 * dark, because a half-keyed number belongs to nobody yet. A committed number put
 * there by anything other than this field -- `2ND xP/Y`, RCL, a TVM key press, an
 * arithmetic `=` -- is dark too, because it will not match.
 *
 * THAT MATCH IS A DERIVATION, NOT A LATCH, and the difference is observable in one
 * corner. The hardware knows where the number came from; this engine infers it by
 * comparing values, so a foreign number that happens to equal the field's own
 * value (RCL of a memory holding exactly `P1`) lights `=` where the hardware
 * would not. State cannot record the provenance -- `Mode` is fixed at
 * `{ kind, worksheet, field }` -- and the false positive is the benign direction:
 * the cue exists to warn that the number is not the variable's value, and in that
 * corner it is.
 */
export function worksheetDisplay(
  state: CalculatorState,
  registry: WorksheetRegistry,
  fmt: DisplayFormat,
  base: readonly Indicator[],
): DisplayState | null {
  const field = activeField(state, registry);
  if (field === null) return null;

  const ind: Indicator[] = [...base, ...promptIndicators(field)];

  // p. 21: "the ↓ and ↑ indicators remind you to press ↓ or ↑ to select other
  // variables." Both are lit whenever there is another variable to reach, which
  // under a wrapping ring means whenever the worksheet has more than one visible
  // field -- p. 28 confirms `↓` is live even on the last one (INT).
  const ws = activeWorksheet(state, registry);
  if (ws !== null && ws.fields.filter((f) => isVisible(f, state)).length > 1) {
    ind.push('UP', 'DOWN');
  }

  if (state.entryBuffer !== null) return renderEntry(state.entryBuffer, fmt, field.label, ind);

  const v = safeGet(field, state);
  if (typeof v === 'string') return makeDisplay(v, field.label, [...ind, '=']);
  // Object.is, not ===: a field holding -0 against a display holding +0 is a
  // genuine mismatch, and the two render differently (`-0.00` vs `0.00`).
  if (v !== null && Object.is(v, state.displayValue)) ind.push('=');
  return renderValue(state.displayValue, fmt, field.label, ind);
}

// ---------------------------------------------------------------------------
// Registry self-check
// ---------------------------------------------------------------------------

/**
 * Assert that every descriptor's `kind` matches the handlers it supplies.
 *
 * `kind` is declarative and the reducer drives off the handlers, so a mismatch is
 * silent: a field declared `'compute'` with no `compute` simply never responds to
 * CPT. Eight worksheets will be added to the registry by authors who cannot ask
 * questions, so the disagreement is caught here rather than in their golden runs.
 *
 * Throws plain `Error`, not `CalculatorError`: a malformed registry is a defect
 * in this package, not a condition the calculator can be in. It is never called
 * from the reducer.
 */
export function assertRegistryConsistent(registry: WorksheetRegistry): void {
  for (const [id, ws] of Object.entries(registry)) {
    if (ws === undefined) continue;
    if (ws.id !== id) throw new Error(`registry key ${id} holds a descriptor for ${ws.id}`);
    if (ws.fields.length === 0) throw new Error(`${id}: no fields`);

    for (const f of ws.fields) {
      const where = `${id}.${f.label || '(unlabelled)'}`;
      if (f.kind === 'entry' && f.set === undefined) {
        throw new Error(`${where}: kind 'entry' needs a set handler`);
      }
      if (f.kind === 'compute') {
        if (f.compute === undefined) throw new Error(`${where}: kind 'compute' needs a compute handler`);
        if (f.set !== undefined) {
          throw new Error(`${where}: kind 'compute' cannot take ENTER; declare 'entry' with a compute`);
        }
      }
      if (f.kind === 'auto' && (f.set !== undefined || f.compute !== undefined)) {
        throw new Error(`${where}: kind 'auto' computes in get(); it takes neither ENTER nor CPT`);
      }
      if (f.kind === 'setting' && f.cycle === undefined) {
        throw new Error(`${where}: kind 'setting' needs a cycle handler`);
      }
      if (f.kind !== 'setting' && f.cycle !== undefined) {
        throw new Error(`${where}: only kind 'setting' responds to 2ND SET`);
      }
    }
  }
}

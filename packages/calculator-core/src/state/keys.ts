/**
 * The key vocabulary.
 *
 * These are LOGICAL keys, not physical ones. The engine cares which functions
 * exist and how they compose, never where they sit on a bezel -- the physical
 * arrangement is trade dress and is deliberately not modelled here.
 *
 * A key press is one token. `2ND` is its own token and arms the next key rather
 * than fusing with it, exactly as the hardware behaves: the machine has no idea
 * what is coming next when you press it.
 *
 * Source: guidebook p. 7 (2nd/INV/HYP), and the recorded key sequences in
 * tests/golden/*.json, which are the acceptance corpus for this layer.
 */

/** The ten digit keys. */
export type DigitKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

/**
 * Digits, decimal point, and sign -- the number-entry keys.
 *
 * `DigitKey` is kept separate from `.` and `+/-` deliberately: `isDigit` narrows
 * to `DigitKey`, and if it claimed to narrow to `EntryKey` the compiler would
 * conclude that a later `case '.'` is unreachable and silently drop it.
 */
export type EntryKey = DigitKey | '.' | '+/-';

/** Binary operators and expression punctuation. */
export type OperatorKey = '+' | '-' | '×' | '÷' | 'Y^X' | 'NPR' | 'NCR' | '=' | '(' | ')' | '%';

/** Immediate unary functions (AOS priority 1, guidebook p. 87). */
export type UnaryKey =
  | 'X^2' | '√X' | '1/X' | 'X!' | 'LN' | 'E^X'
  | 'SIN' | 'COS' | 'TAN'
  | 'ROUND' | 'RAND';

/** Modifier latches. */
export type ModifierKey = '2ND' | 'INV' | 'HYP';

/** Worksheet entry points and navigation. */
export type WorksheetKey =
  | 'CPT' | 'ENTER' | 'UP' | 'DOWN' | 'SET' | 'INS' | 'DEL'
  | 'AMORT' | 'CF' | 'NPV' | 'IRR' | 'BOND' | 'DEPR' | 'DATA' | 'STAT'
  | 'Δ%' | 'ICONV' | 'DATE' | 'PROFIT' | 'BRKEVN' | 'MEM' | 'FORMAT';

/** TVM registers, which live in standard-calculator mode rather than a worksheet. */
export type TvmKey = 'N' | 'I/Y' | 'PV' | 'PMT' | 'FV' | 'P/Y' | 'xP/Y' | 'BGN';

/** Memory and recall. */
export type MemoryKey = 'STO' | 'RCL' | 'K' | 'ANS';

/** Clearing, power, and reset. */
export type ControlKey = 'CE/C' | 'ON/OFF' | 'QUIT' | 'RESET' | 'CLR TVM' | 'CLR WORK' | 'BKSP';

export type Key =
  | EntryKey
  | OperatorKey
  | UnaryKey
  | ModifierKey
  | WorksheetKey
  | TvmKey
  | MemoryKey
  | ControlKey;

/**
 * Alternate spellings accepted by the key parser.
 *
 * The golden corpus was transcribed by several readers and is not internally
 * uniform: the multiply key appears as both `×` and `*`, equals as `=` and
 * `EQUALS`, and so on. The corpus is left as recorded -- it documents what the
 * guidebook printed, and rewriting it to suit the parser would destroy that
 * provenance. Normalising here instead means every recorded spelling runs.
 */
const ALIASES: Readonly<Record<string, Key>> = Object.freeze({
  '*': '×',
  X: '×',
  MULT: '×',
  TIMES: '×',
  '/': '÷',
  DIV: '÷',
  EQUALS: '=',
  EQ: '=',
  PLUS: '+',
  MINUS: '-',
  SUB: '-',
  PCT: '%',
  PERCENT: '%',
  'SQRT': '√X',
  'SQ': 'X^2',
  'RECIP': '1/X',
  'FACT': 'X!',
  'POW': 'Y^X',
  'YX': 'Y^X',
  'CHS': '+/-',
  'NEG': '+/-',
  'BACKSPACE': 'BKSP',
  'CLR': 'CE/C',
  'C': 'CE/C',
  'OFF': 'ON/OFF',
  'ON': 'ON/OFF',
  'SECOND': '2ND',
  '2nd': '2ND',
  'PCTCH': 'Δ%',
  '%CH': 'Δ%',
  'DELTA%': 'Δ%',
  'STAT': 'DATA',
});

const DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export const isDigit = (k: Key): k is DigitKey => DIGITS.has(k);

/**
 * Every canonical key, for exact-match resolution.
 *
 * Matching against this set rather than upper-casing the token matters: `xP/Y`
 * and `Δ%` are canonically mixed-case, so a blanket `.toUpperCase()` silently
 * turns them into keys that do not exist and the press is dropped on the floor.
 */
const CANONICAL: ReadonlySet<string> = new Set<Key>([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+/-',
  '+', '-', '×', '÷', 'Y^X', 'NPR', 'NCR', '=', '(', ')', '%',
  'X^2', '√X', '1/X', 'X!', 'LN', 'E^X', 'SIN', 'COS', 'TAN', 'ROUND', 'RAND',
  '2ND', 'INV', 'HYP',
  'CPT', 'ENTER', 'UP', 'DOWN', 'SET', 'INS', 'DEL',
  'AMORT', 'CF', 'NPV', 'IRR', 'BOND', 'DEPR', 'DATA', 'STAT',
  'Δ%', 'ICONV', 'DATE', 'PROFIT', 'BRKEVN', 'MEM', 'FORMAT',
  'N', 'I/Y', 'PV', 'PMT', 'FV', 'P/Y', 'xP/Y', 'BGN',
  'STO', 'RCL', 'K', 'ANS',
  'CE/C', 'ON/OFF', 'QUIT', 'RESET', 'CLR TVM', 'CLR WORK', 'BKSP',
]);

/** True if `token` is already a canonical key. */
export const isKey = (token: string): token is Key => CANONICAL.has(token);

/**
 * Parse one recorded token into a key.
 *
 * Resolution order: exact canonical match, then alias, then a case-insensitive
 * sweep of both. Returns null for a token that names no key, so callers can tell
 * "unknown" from "no-op" rather than inventing a press.
 *
 * A multi-character numeric literal such as `"360"` is NOT a key -- the hardware
 * has no such button. `parseKeySequence` expands those into digit presses, which
 * is what actually happened.
 */
export function normalizeKey(token: string): Key | null {
  const t = token.trim();
  if (t.length === 0) return null;

  if (CANONICAL.has(t)) return t as Key;
  if (Object.prototype.hasOwnProperty.call(ALIASES, t)) return ALIASES[t] as Key;

  const upper = t.toUpperCase();
  if (CANONICAL.has(upper)) return upper as Key;
  if (Object.prototype.hasOwnProperty.call(ALIASES, upper)) return ALIASES[upper] as Key;

  // Case-insensitive sweep, for mixed-case canonicals such as `xP/Y`.
  for (const k of CANONICAL) {
    if (k.toUpperCase() === upper) return k as Key;
  }
  return null;
}

/**
 * Expand a recorded key sequence into individual key presses.
 *
 * Golden cases record numbers as single tokens (`"360"`, `"6.125"`, `"-729.13"`)
 * because that is how a human reads a keystroke table. The machine only ever sees
 * one digit at a time, so they are expanded here. A leading `-` becomes a
 * TRAILING `+/-`: the hardware has no minus-sign entry key, and the guidebook
 * enters negatives by keying the magnitude and then pressing `+/-` (p. 26).
 * Thousands separators in a recorded literal are display artefacts, not presses.
 */
export function parseKeySequence(tokens: readonly string[]): Key[] {
  const keys: Key[] = [];

  for (const token of tokens) {
    const t = token.trim();
    if (t.length === 0) continue;

    const numeric = /^-?[\d,]*\.?\d+$/.test(t);
    if (numeric) {
      const negative = t.startsWith('-');
      const digits = (negative ? t.slice(1) : t).replace(/,/g, '');
      for (const ch of digits) {
        keys.push(ch === '.' ? '.' : (ch as EntryKey));
      }
      if (negative) keys.push('+/-');
      continue;
    }

    const key = normalizeKey(t);
    if (key !== null) keys.push(key);
  }

  return keys;
}

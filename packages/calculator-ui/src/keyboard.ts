/**
 * Physical-keyboard to calculator-key mapping.
 *
 * Covers the keys a finance user reaches for without thinking: digits, the four
 * operators, Enter for equals, Backspace, and the arrows for worksheet scrolling.
 * Letter shortcuts (n, i, p, m, f) hit the TVM registers. The full map is surfaced
 * to the user through the shortcut guide, so nothing here is hidden.
 *
 * Returns the primary token to send; the caller applies the same 2ND resolution a
 * button press would, so `2ND` then a mapped key behaves identically to the pad.
 */
import type { Key } from '@tenor/calculator-core';

const MAP: Readonly<Record<string, Key>> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.', ',': '.',
  '+': '+', '-': '-', '*': '×', 'x': '×', 'X': '×', '/': '÷',
  '=': '=', 'Enter': '=',
  '(': '(', ')': ')', '%': '%', '^': 'Y^X',
  Backspace: 'BKSP', Delete: 'CE/C', Escape: 'CE/C',
  ArrowUp: 'UP', ArrowDown: 'DOWN',
  // TVM shortcuts.
  n: 'N', N: 'N', i: 'I/Y', I: 'I/Y', p: 'PV', P: 'PV', m: 'PMT', M: 'PMT', f: 'FV', F: 'FV',
  // Modes.
  c: 'CPT', C: 'CPT', s: 'STO', r: 'RCL',
};

/** The visible shortcut guide, grouped for display. */
export const SHORTCUT_GUIDE: readonly { keys: string; does: string }[] = [
  { keys: '0–9  .', does: 'Digits and decimal point' },
  { keys: '+ − * /', does: 'Arithmetic operators' },
  { keys: 'Enter  =', does: 'Equals / evaluate' },
  { keys: '^', does: 'Power (yˣ)' },
  { keys: '( )', does: 'Parentheses' },
  { keys: 'Backspace', does: 'Delete last digit' },
  { keys: 'Esc  Delete', does: 'Clear entry (CE/C)' },
  { keys: '↑ ↓', does: 'Scroll worksheet variables' },
  { keys: 'N I P M F', does: 'TVM: N, I/Y, PV, PMT, FV' },
  { keys: 'C', does: 'Compute (CPT)' },
  { keys: 'S  R', does: 'Store / recall memory' },
  { keys: "'  (apostrophe)", does: 'Second function (2ND)' },
];

/**
 * Translate a keydown into a calculator key, or null if unmapped.
 *
 * Modifier chords (Ctrl/Alt/Meta) are ignored so browser and OS shortcuts keep
 * working. The second function is reached with the dedicated Tab-to-2ND button or
 * the `'` key (below) rather than overloading digit 2, which must stay a digit.
 */
export function keyFromEvent(e: KeyboardEvent): Key | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.key === "'") return '2ND';
  return MAP[e.key] ?? null;
}

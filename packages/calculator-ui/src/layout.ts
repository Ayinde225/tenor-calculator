/**
 * The keypad layout, as data.
 *
 * This is an ORIGINAL arrangement, not a copy of the BA II Plus bezel: keys are
 * grouped by function into a clean grid. What IS preserved is the authentic
 * workflow -- `2ND` arms the next key's secondary function -- because that is the
 * behaviour finance users rely on, not trade dress.
 *
 * Each key carries a primary token and, optionally, a secondary token reached via
 * 2ND. Labels are what the button shows; `aria` is the spoken description. `tone`
 * drives colour grouping only.
 */
import type { Key } from '@tenor/calculator-core';

export type KeyTone = 'mod' | 'nav' | 'tvm' | 'sheet' | 'fn' | 'num' | 'op' | 'clear' | 'equals';

export interface KeyDef {
  /** Primary function token sent when 2ND is not armed. */
  readonly primary: Key;
  /** What the button face shows for the primary function. */
  readonly label: string;
  /** Secondary function token, sent when 2ND is armed. */
  readonly secondary?: Key;
  /** Small label shown above the face for the secondary function. */
  readonly secondaryLabel?: string;
  /** Spoken description (primary; the secondary is appended automatically). */
  readonly aria: string;
  readonly tone: KeyTone;
}

const k = (
  primary: Key,
  label: string,
  aria: string,
  tone: KeyTone,
  secondary?: Key,
  secondaryLabel?: string,
): KeyDef => {
  const base = { primary, label, aria, tone };
  return secondary !== undefined && secondaryLabel !== undefined
    ? { ...base, secondary, secondaryLabel }
    : base;
};

/**
 * Rows of the grid. Every engine key is reachable; secondary functions are paired
 * onto related primaries so the groupings read logically.
 */
export const KEYPAD: readonly (readonly KeyDef[])[] = [
  [
    k('2ND', '2ND', 'Second function', 'mod'),
    k('CPT', 'CPT', 'Compute', 'nav'),
    k('UP', '▲', 'Scroll up', 'nav'),
    k('DOWN', '▼', 'Scroll down', 'nav'),
    k('ON/OFF', 'ON/OFF', 'On, off', 'nav'),
  ],
  [
    k('N', 'N', 'Number of periods', 'tvm', 'xP/Y', 'xP/Y'),
    k('I/Y', 'I/Y', 'Interest per year', 'tvm', 'P/Y', 'P/Y'),
    k('PV', 'PV', 'Present value', 'tvm', 'AMORT', 'AMORT'),
    k('PMT', 'PMT', 'Payment', 'tvm', 'BGN', 'BGN'),
    k('FV', 'FV', 'Future value', 'tvm', 'CLR TVM', 'CLR TVM'),
  ],
  [
    k('CF', 'CF', 'Cash flow worksheet', 'sheet', 'NPV', 'NPV'),
    k('IRR', 'IRR', 'Internal rate of return', 'sheet', 'BOND', 'BOND'),
    k('DEPR', 'DEPR', 'Depreciation', 'sheet', 'DATA', 'DATA'),
    k('STAT', 'STAT', 'Statistics results', 'sheet', 'Δ%', '%CH'),
    k('ICONV', 'ICONV', 'Interest conversion', 'sheet', 'DATE', 'DATE'),
  ],
  [
    k('PROFIT', 'PROFIT', 'Profit margin', 'sheet', 'BRKEVN', 'BRKEVN'),
    k('MEM', 'MEM', 'Memory worksheet', 'sheet', 'FORMAT', 'FORMAT'),
    k('QUIT', 'QUIT', 'Quit to standard mode', 'clear', 'RESET', 'RESET'),
    k('CLR WORK', 'CLR·W', 'Clear worksheet', 'clear', 'INS', 'INS'),
    k('ENTER', 'ENTER', 'Enter value', 'nav', 'SET', 'SET'),
  ],
  [
    k('X^2', 'x²', 'x squared', 'fn', '√X', '√x'),
    k('1/X', '1/x', 'Reciprocal', 'fn', 'Y^X', 'yˣ'),
    k('LN', 'LN', 'Natural log', 'fn', 'E^X', 'eˣ'),
    k('INV', 'INV', 'Inverse trig', 'fn', 'X!', 'x!'),
    k('HYP', 'HYP', 'Hyperbolic', 'fn', 'ROUND', 'ROUND'),
  ],
  [
    k('SIN', 'SIN', 'Sine', 'fn', 'NPR', 'nPr'),
    k('COS', 'COS', 'Cosine', 'fn', 'NCR', 'nCr'),
    k('TAN', 'TAN', 'Tangent', 'fn', 'RAND', 'RAND'),
    k('(', '(', 'Open parenthesis', 'op', 'DEL', 'DEL'),
    k(')', ')', 'Close parenthesis', 'op', 'DATE', 'DATE'),
  ],
  [
    k('STO', 'STO', 'Store to memory', 'fn'),
    k('7', '7', 'Seven', 'num'),
    k('8', '8', 'Eight', 'num'),
    k('9', '9', 'Nine', 'num'),
    k('÷', '÷', 'Divide', 'op'),
  ],
  [
    k('RCL', 'RCL', 'Recall memory', 'fn'),
    k('4', '4', 'Four', 'num'),
    k('5', '5', 'Five', 'num'),
    k('6', '6', 'Six', 'num'),
    k('×', '×', 'Multiply', 'op'),
  ],
  [
    k('ANS', 'ANS', 'Last answer', 'fn', 'K', 'K'),
    k('1', '1', 'One', 'num'),
    k('2', '2', 'Two', 'num'),
    k('3', '3', 'Three', 'num'),
    k('-', '−', 'Subtract', 'op'),
  ],
  [
    k('%', '%', 'Percent', 'op'),
    k('0', '0', 'Zero', 'num'),
    k('.', '.', 'Decimal point', 'num'),
    k('+/-', '±', 'Change sign', 'num'),
    k('+', '+', 'Add', 'op'),
  ],
  [
    k('CE/C', 'CE/C', 'Clear entry, clear', 'clear'),
    k('BKSP', '⌫', 'Backspace', 'clear'),
    k('FORMAT', 'FMT', 'Format settings', 'sheet'),
    k('AMORT', 'AMORT', 'Amortization', 'sheet'),
    k('=', '=', 'Equals', 'equals'),
  ],
];

/** Resolve the token a key should send, given whether 2ND is currently armed. */
export function tokenFor(def: KeyDef, secondArmed: boolean): Key {
  return secondArmed && def.secondary !== undefined ? def.secondary : def.primary;
}

/** Full spoken description including the secondary function, if any. */
export function ariaFor(def: KeyDef): string {
  if (def.secondaryLabel === undefined) return def.aria;
  return `${def.aria}. Second function: ${def.secondaryLabel}`;
}

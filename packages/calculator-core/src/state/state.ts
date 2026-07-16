/**
 * The complete calculator state.
 *
 * Everything the machine remembers. Anything not here is derived -- and a
 * deliberate amount is derived, because the hardware cannot hold a stale value
 * for a variable it recomputes on sight.
 *
 * Source: guidebook p. 6 (Constant Memory, power behaviour), p. 25 (TVM
 * defaults), and docs/ENGINE-DESIGN.md §4.
 */
import type { DecimalSetting, SeparatorFormat } from '../display/format.js';
import type { CalculationMethod } from '../math/expression-engine.js';
import type { AngleUnit } from '../math/functions.js';
import type { ErrorCode } from '../errors.js';
import type { BinaryOp } from '../math/operators.js';
import { TVM_DEFAULTS, type TvmState } from '../worksheets/tvm.js';
import { AMORTIZATION_DEFAULTS, type AmortizationRange } from '../worksheets/amortization.js';
import { CASH_FLOW_DEFAULTS, type CashFlowState } from '../worksheets/cash-flow.js';
import { BOND_DEFAULTS, type BondState } from '../worksheets/bond.js';
import { DEPRECIATION_DEFAULTS, type DepreciationState } from '../worksheets/depreciation.js';
import { STATISTICS_DEFAULTS, type StatisticsState } from '../worksheets/statistics.js';
import { PERCENT_CHANGE_DEFAULTS, type PercentChangeState } from '../worksheets/percent-change.js';
import {
  INTEREST_CONVERSION_DEFAULTS,
  type InterestConversionState,
} from '../worksheets/interest-conversion.js';
import { DATE_DEFAULTS, type DateState } from '../worksheets/date.js';
import { PROFIT_MARGIN_DEFAULTS, type ProfitMarginState } from '../worksheets/profit-margin.js';
import { BREAKEVEN_DEFAULTS, type BreakevenState } from '../worksheets/breakeven.js';
import { MEMORY_DEFAULTS, type MemoryState } from '../worksheets/memory-worksheet.js';

/** The prompted worksheets. TVM is absent: it lives in standard-calculator mode. */
export type WorksheetId =
  | 'AMORT'
  | 'CF'
  | 'NPV'
  | 'IRR'
  | 'BOND'
  | 'DEPR'
  | 'STAT'
  | 'DATA'
  | 'PCT'
  | 'ICONV'
  | 'DATE'
  | 'PROFIT'
  | 'BRKEVN'
  | 'MEM'
  | 'FORMAT'
  // The two TVM sub-settings, reached from standard-calculator mode by 2ND P/Y
  // and 2ND BGN. They are one- and two-field prompts over the TVM registers
  // rather than worksheets in their own right, but the navigation is identical,
  // so they ride the same descriptor machinery.
  | 'PY'
  | 'BGNSET';

export type Mode = { kind: 'standard' } | { kind: 'worksheet'; worksheet: WorksheetId; field: number };

/** A pending binary operation, held on the operator stack. */
export interface PendingOp {
  readonly op: BinaryOp;
  readonly operand: number;
  readonly depth: number;
}

/** An armed constant (2ND K). Guidebook p. 18. */
export interface ConstantState {
  readonly op: BinaryOp;
  readonly operand: number;
  readonly isPercent: boolean;
}

/** Global format settings. These survive power-off (Constant Memory, p. 6). */
export interface FormatSettings {
  /** 0-8 fixed places; 9 selects FLOATING decimal, not nine places (p. 9). */
  readonly DEC: DecimalSetting;
  readonly angleUnit: AngleUnit;
  readonly dateFormat: 'US' | 'EUR';
  readonly separators: SeparatorFormat;
  /** CHN is the power-on default (p. 10). */
  readonly calcMethod: CalculationMethod;
}

export const FORMAT_DEFAULTS: FormatSettings = Object.freeze({
  DEC: 2 as DecimalSetting,
  angleUnit: 'DEG',
  dateFormat: 'US',
  separators: 'US',
  calcMethod: 'CHN',
});

export interface CalculatorState {
  readonly mode: Mode;
  /** null when not mid-entry: the display then echoes a committed value. */
  readonly entryBuffer: string | null;
  /** The committed display value -- what the LCD shows when not mid-entry. */
  readonly displayValue: number;
  /** Latches the display until CE/C (p. 84). */
  readonly errorState: ErrorCode | null;
  /** False after ON/OFF; the machine swallows everything but ON/OFF. */
  readonly poweredOn: boolean;

  // Modifier latches (p. 7). Three, not one: they compose.
  readonly secondArmed: boolean;
  readonly invArmed: boolean;
  readonly hypArmed: boolean;
  /**
   * CPT is a prefix, like 2ND: it arms the NEXT key to compute rather than store
   * (p. 27). `CPT PMT` computes PMT; a bare `PMT` stores the display into it.
   * The same physical key means opposite things depending on this latch, which
   * is why it has to be state rather than a special case at the call site.
   */
  readonly computeArmed: boolean;
  /**
   * 2ND RESET is a two-step confirmation, not an immediate action (p. 11):
   * pressing it shows `RST ?` and waits. ENTER then performs the hard reset;
   * 2ND QUIT (or any other key) cancels. This latch holds that intermediate
   * "armed but not confirmed" state.
   */
  readonly resetArmed: boolean;

  // Expression evaluation.
  readonly pendingOps: readonly PendingOp[];
  readonly parenLevels: number;

  readonly format: FormatSettings;

  readonly memories: MemoryState;
  /** Refreshed by ENTER, CPT, = and automatic computes (p. 19). */
  readonly ans: number;
  readonly constant: ConstantState | null;
  readonly randomSeed: number | null;

  readonly tvm: TvmState;
  readonly amort: AmortizationRange;
  readonly cashFlow: CashFlowState;
  readonly bond: BondState;
  readonly depr: DepreciationState;
  readonly stats: StatisticsState;
  readonly pctChange: PercentChangeState;
  readonly iconv: InterestConversionState;
  readonly date: DateState;
  readonly profit: ProfitMarginState;
  readonly breakeven: BreakevenState;
}

/**
 * The state after 2ND RESET ENTER -- a known starting point (p. 11).
 *
 * Note P/Y and C/Y are 1 here, not 12. See TVM_DEFAULTS for why that is not a
 * typo: the p. 30 example resets, never sets P/Y, and only reproduces at 1.
 */
export const INITIAL_STATE: CalculatorState = Object.freeze({
  mode: { kind: 'standard' } as Mode,
  entryBuffer: null,
  displayValue: 0,
  errorState: null,
  poweredOn: true,

  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
  resetArmed: false,

  pendingOps: [],
  parenLevels: 0,

  format: FORMAT_DEFAULTS,

  memories: MEMORY_DEFAULTS,
  ans: 0,
  constant: null,
  randomSeed: null,

  tvm: TVM_DEFAULTS,
  amort: AMORTIZATION_DEFAULTS,
  cashFlow: CASH_FLOW_DEFAULTS,
  bond: BOND_DEFAULTS,
  depr: DEPRECIATION_DEFAULTS,
  stats: STATISTICS_DEFAULTS,
  pctChange: PERCENT_CHANGE_DEFAULTS,
  iconv: INTEREST_CONVERSION_DEFAULTS,
  date: DATE_DEFAULTS,
  profit: PROFIT_MARGIN_DEFAULTS,
  breakeven: BREAKEVEN_DEFAULTS,
});

/**
 * The slice retained by Constant Memory across power-off (p. 6).
 *
 * Everything volatile is dropped: display, entry buffer, error, the modifier
 * latches, and the operator stack. The constant register and random seed are
 * treated as transient too -- a constant is armed with no indicator, and
 * silently resurrecting one across a power cycle is the worse failure mode
 * (OPEN-QUESTIONS: MEM-7, MATH-7).
 */
export type PersistedState = Pick<
  CalculatorState,
  | 'format'
  | 'memories'
  | 'ans'
  | 'tvm'
  | 'amort'
  | 'cashFlow'
  | 'bond'
  | 'depr'
  | 'stats'
  | 'pctChange'
  | 'iconv'
  | 'date'
  | 'profit'
  | 'breakeven'
>;

export function persist(state: CalculatorState): PersistedState {
  return {
    format: state.format,
    memories: state.memories,
    ans: state.ans,
    tvm: state.tvm,
    amort: state.amort,
    cashFlow: state.cashFlow,
    bond: state.bond,
    depr: state.depr,
    stats: state.stats,
    pctChange: state.pctChange,
    iconv: state.iconv,
    date: state.date,
    profit: state.profit,
    breakeven: state.breakeven,
  };
}

/**
 * Wake from a deliberate ON/OFF: standard mode at zero, error cleared, pending
 * operations dropped (p. 6). Distinct from an APD wake, which restores
 * everything including a live error -- see `restoreAfterApd`.
 */
export function restoreAfterPowerOff(saved: PersistedState): CalculatorState {
  return { ...INITIAL_STATE, ...saved };
}

/**
 * Wake from Automatic Power Down: the machine turns on exactly as you left it,
 * "saving display settings, stored memory, pending operations, and error
 * conditions" (p. 6). So APD restores strictly more than ON/OFF does, and the
 * two paths must be modelled separately.
 */
export function restoreAfterApd(saved: CalculatorState): CalculatorState {
  return { ...saved, poweredOn: true };
}

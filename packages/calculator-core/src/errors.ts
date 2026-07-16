/**
 * The eight error conditions of the BA II Plus, reproduced with their original
 * numbering. The number is part of the product's observable behaviour: the
 * hardware displays exactly `Error 5`, so the code numbers must match.
 *
 * Source: official guidebook pp. 84-85.
 */
export enum ErrorCode {
  /** Result outside calculator range; divide by zero; 1/x with x=0; stats with all-identical values. */
  Overflow = 1,
  /** x! outside integer 0-69; LN(x<=0); y^x with y<0 and non-integer x; sqrt(x<0); amort P2<P1; depreciation SAL>CST. */
  InvalidArgument = 2,
  /** More than 15 active parenthesis levels, or more than 8 pending operations. */
  TooManyPendingOperations = 3,
  /** A variable was set outside its permitted range (P1/P2, P/Y, C/Y, Fnn, RV/CPN/PRI, dates, DEC, ...). */
  OutOfRange = 4,
  /** No solution exists: I/Y where FV, N*PMT and PV share a sign; LN input <=0 mid-calculation; IRR with no sign change. */
  NoSolution = 5,
  /** Invalid date, wrong date format, or bond redemption date not after settlement date. */
  InvalidDate = 6,
  /** An iterative solve (I/Y, IRR, YLD) exceeded its iteration limit. */
  IterationLimitExceeded = 7,
  /** The user pressed ON/OFF to cancel an iterative calculation in progress. */
  CanceledIterativeCalculation = 8,
}

/**
 * Human-readable names. Deliberately our own wording rather than TI's, and used
 * only for diagnostics and tests -- the LCD renders `Error <n>` and nothing else.
 */
export const ERROR_NAMES: Readonly<Record<ErrorCode, string>> = Object.freeze({
  [ErrorCode.Overflow]: 'Overflow',
  [ErrorCode.InvalidArgument]: 'Invalid argument',
  [ErrorCode.TooManyPendingOperations]: 'Too many pending operations',
  [ErrorCode.OutOfRange]: 'Out of range',
  [ErrorCode.NoSolution]: 'No solution exists',
  [ErrorCode.InvalidDate]: 'Invalid date',
  [ErrorCode.IterationLimitExceeded]: 'Iteration limit exceeded',
  [ErrorCode.CanceledIterativeCalculation]: 'Canceled iterative calculation',
});

/**
 * Thrown by pure calculation functions. The state machine catches these at the
 * command boundary and converts them into a displayed error condition, which is
 * how the hardware behaves: an error latches the display until CE/C is pressed.
 */
export class CalculatorError extends Error {
  readonly code: ErrorCode;
  /** Free-text detail for tests and guided mode. Never shown on the LCD. */
  readonly detail: string;

  constructor(code: ErrorCode, detail = '') {
    super(`Error ${code}: ${ERROR_NAMES[code]}${detail ? ` (${detail})` : ''}`);
    this.name = 'CalculatorError';
    this.code = code;
    this.detail = detail;
  }
}

/** The string the LCD shows for an error condition, e.g. `Error 5`. */
export function errorDisplay(code: ErrorCode): string {
  return `Error ${code}`;
}

export const raise = (code: ErrorCode, detail?: string): never => {
  throw new CalculatorError(code, detail);
};

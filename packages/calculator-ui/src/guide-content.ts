/**
 * Guided-mode content: original, plain-language explanations of each worksheet
 * and its variables.
 *
 * This is teaching material, written from scratch -- it does NOT reproduce the
 * guidebook's prose. It never computes anything: value readers pull from the
 * public engine state, and the active variable and its live value come from the
 * projected display. Guided mode therefore cannot calculate differently from
 * authentic mode, because it does not calculate at all.
 */
import { type CalculatorState, type WorksheetId } from '@tenor/calculator-core';

export interface GuidedVariable {
  /** The on-screen label, without the trailing '='. */
  readonly label: string;
  readonly name: string;
  readonly explain: string;
  /** Current value from stored state, or null for a value only shown when active. */
  readonly value: (s: CalculatorState) => number | null;
  /** Matches a live display label to this variable (defaults to exact). */
  readonly matches?: (displayLabel: string) => boolean;
}

export interface GuidedExample {
  readonly title: string;
  readonly steps: string;
}

export interface GuidedContext {
  readonly title: string;
  readonly intro: string;
  readonly variables: readonly GuidedVariable[];
  readonly example?: GuidedExample;
}

const v = (
  label: string,
  name: string,
  explain: string,
  value: (s: CalculatorState) => number | null,
  matches?: (displayLabel: string) => boolean,
): GuidedVariable => ({ label, name, explain, value, ...(matches ? { matches } : {}) });

/** Standard mode doubles as the TVM context: the N/I·Y/PV/PMT/FV keys live here. */
const STANDARD: GuidedContext = {
  title: 'Time Value of Money',
  intro:
    'Enter any four of the five values, then press CPT and the key for the fifth to solve it. ' +
    'Cash you receive is positive; cash you pay out is negative.',
  variables: [
    v('N', 'Number of periods', 'Total count of payments or compounding periods.', (s) => s.tvm.N),
    v('I/Y', 'Interest per year', 'Nominal annual interest rate, as a percent.', (s) => s.tvm.IY),
    v('PV', 'Present value', 'A lump sum at the start — a loan received, or a deposit made.', (s) => s.tvm.PV),
    v('PMT', 'Payment', 'The level amount paid or received each period.', (s) => s.tvm.PMT),
    v('FV', 'Future value', 'The lump sum left at the end of the last period.', (s) => s.tvm.FV),
  ],
  example: {
    title: 'Monthly mortgage payment',
    steps:
      'Set P/Y to 12. Enter 360 N, 6.125 I/Y, 120000 PV, 0 FV, then CPT PMT. ' +
      'The payment shows as −729.13 (negative: you pay it out).',
  },
};

const PY: GuidedContext = {
  title: 'Payments & Compounding',
  intro:
    'P/Y is how many payments fall in a year; C/Y is how many times interest compounds. ' +
    'Setting P/Y also sets C/Y to match — change C/Y afterward only if they differ.',
  variables: [
    v('P/Y', 'Payments per year', 'Number of payment periods in one year.', (s) => s.tvm.PY),
    v('C/Y', 'Compounding per year', 'Number of times interest compounds per year.', (s) => s.tvm.CY),
  ],
};

const BGNSET: GuidedContext = {
  title: 'Payment Timing',
  intro:
    'END means payments fall at the end of each period (most loans). BGN means the start of each ' +
    'period (most leases). Press 2ND SET to switch; the BGN indicator lights when it is on.',
  variables: [
    v('END/BGN', 'Timing', 'Whether each payment lands at the end or the start of its period.', () => null,
      (l) => l === 'END' || l === 'BGN'),
  ],
};

const AMORT: GuidedContext = {
  title: 'Amortization',
  intro:
    'See how a loan is paid down over a range of payments. Enter the first and last payment number, ' +
    'then scroll to read the balance, principal, and interest for that range.',
  variables: [
    v('P1', 'First payment', 'The first payment number in the range.', (s) => s.amort.P1),
    v('P2', 'Last payment', 'The last payment number in the range.', (s) => s.amort.P2),
    v('BAL', 'Balance', 'Loan balance remaining after payment P2.', () => null),
    v('PRN', 'Principal', 'Principal paid across payments P1 through P2.', () => null),
    v('INT', 'Interest', 'Interest paid across payments P1 through P2.', () => null),
  ],
};

const CF: GuidedContext = {
  title: 'Cash Flow',
  intro:
    'Enter an uneven stream: CFo at time zero, then each amount Cnn and how many times it repeats (Fnn). ' +
    'Inflows are positive, outflows negative. Use 2ND INS and 2ND DEL to edit the list.',
  variables: [
    v('CFo', 'Initial cash flow', 'The cash flow at time zero, before any repeating groups.', (s) => s.cashFlow.CFo),
    v('Cnn', 'Cash flow amount', 'An amount in the stream. Inflows positive, outflows negative.', () => null,
      (l) => /^C\d/.test(l)),
    v('Fnn', 'Frequency', 'How many times the amount above repeats in a row.', () => null,
      (l) => /^F\d/.test(l)),
  ],
};

const NPV: GuidedContext = {
  title: 'Net Present Value',
  intro:
    'Discount the whole cash-flow stream back to today at a rate you choose. Enter I, then CPT NPV. ' +
    'A positive NPV means the stream earns more than the rate.',
  variables: [
    v('I', 'Discount rate', 'The rate per period used to discount the cash flows, as a percent.', (s) => s.cashFlow.I),
    v('NPV', 'Net present value', "The stream's value today at rate I.", (s) => s.cashFlow.NPV),
  ],
};

const IRR: GuidedContext = {
  title: 'Internal Rate of Return',
  intro:
    'The single rate at which the stream breaks even — its net present value is exactly zero. ' +
    'Press CPT to solve it from the cash flows already entered.',
  variables: [
    v('IRR', 'Internal rate of return', 'The rate that makes the net present value zero.', (s) => s.cashFlow.IRR),
  ],
};

const BOND: GuidedContext = {
  title: 'Bond',
  intro:
    'Price a bond or find its yield. Enter the settlement and redemption dates, the coupon rate, and ' +
    'the redemption value, then compute price or yield. Enter your values before scrolling.',
  variables: [
    v('SDT', 'Settlement date', 'The date the bond is bought, as MM.DDYY.', () => null),
    v('CPN', 'Coupon rate', 'The annual coupon rate, as a percent.', (s) => s.bond.CPN),
    v('RDT', 'Redemption date', 'The date the bond matures or is called, as MM.DDYY.', () => null),
    v('RV', 'Redemption value', 'What the bond pays back per 100 of par.', (s) => s.bond.RV),
    v('YLD', 'Yield', 'Annual yield to redemption, as a percent.', (s) => s.bond.YLD),
    v('PRI', 'Price', 'Dollar price per 100 of par value.', (s) => s.bond.PRI),
    v('AI', 'Accrued interest', 'Interest earned since the last coupon, owed to the seller.', () => null),
  ],
};

const DEPR: GuidedContext = {
  title: 'Depreciation',
  intro:
    'Spread an asset’s cost over its useful life. Choose a method, enter the life, cost, and salvage ' +
    'value, then read each year’s depreciation and the remaining book value.',
  variables: [
    v('LIF', 'Life', 'Useful life of the asset, in years.', (s) => s.depr.LIF),
    v('M01', 'Starting month', 'The month the asset is placed in service.', (s) => s.depr.M01),
    v('CST', 'Cost', 'The original cost of the asset.', (s) => s.depr.CST),
    v('SAL', 'Salvage value', 'The value expected at the end of the asset’s life.', (s) => s.depr.SAL),
    v('YR', 'Year', 'The year whose depreciation you are reading.', (s) => s.depr.YR),
    v('DEP', 'Depreciation', 'Depreciation charged in the selected year.', () => null),
    v('RBV', 'Remaining book value', 'Cost minus all depreciation charged so far.', () => null),
    v('RDV', 'Remaining depreciable', 'Value still left to depreciate.', () => null),
  ],
};

const OTHER: Record<string, GuidedContext> = {
  PCT: {
    title: 'Percent Change',
    intro:
      'Relate an old value, a new value, and the percent change between them. Enter any two and ' +
      'compute the third. #PD compounds the change over that many periods.',
    variables: [
      v('OLD', 'Old value', 'The starting value.', (s) => s.pctChange.OLD),
      v('NEW', 'New value', 'The ending value.', (s) => s.pctChange.NEW),
      v('%CH', 'Percent change', 'Percent change from OLD to NEW.', (s) => s.pctChange.CH, (l) => l.startsWith('%CH')),
      v('#PD', 'Periods', 'Number of periods the change compounds over (usually 1).', (s) => s.pctChange.PD, (l) => l.startsWith('#PD')),
    ],
  },
  ICONV: {
    title: 'Interest Conversion',
    intro:
      'Convert between a nominal annual rate and the effective annual rate it really earns, given how ' +
      'often it compounds. Enter two of the three and compute the third.',
    variables: [
      v('NOM', 'Nominal rate', 'The stated annual rate, as a percent.', (s) => s.iconv.NOM),
      v('EFF', 'Effective rate', 'The true annual rate after compounding, as a percent.', (s) => s.iconv.EFF),
      v('C/Y', 'Compounding per year', 'How many times a year the nominal rate compounds.', (s) => s.iconv.CY),
    ],
  },
  DATE: {
    title: 'Date',
    intro:
      'Count the days between two dates, or find a date a number of days away. Enter dates as MM.DDYY. ' +
      'Choose actual days or the 30/360 convention with 2ND SET.',
    variables: [
      v('DT1', 'First date', 'The earlier date, as MM.DDYY.', () => null),
      v('DT2', 'Second date', 'The later date, as MM.DDYY.', () => null),
      v('DBD', 'Days between', 'Number of days from DT1 to DT2.', (s) => s.date.DBD),
    ],
  },
  PROFIT: {
    title: 'Profit Margin',
    intro:
      'Relate cost, selling price, and gross profit margin (the margin is a percent of the selling ' +
      'price). Enter any two and compute the third.',
    variables: [
      v('CST', 'Cost', 'What the item costs you.', (s) => s.profit.CST),
      v('SEL', 'Selling price', 'What you sell it for.', (s) => s.profit.SEL),
      v('MAR', 'Margin', 'Gross profit as a percent of the selling price.', (s) => s.profit.MAR),
    ],
  },
  BRKEVN: {
    title: 'Breakeven',
    intro:
      'Find the quantity where profit is zero. Enter fixed cost, variable cost per unit, unit price, and ' +
      'a profit target, then compute the quantity.',
    variables: [
      v('FC', 'Fixed cost', 'Costs that do not change with volume.', (s) => s.breakeven.FC),
      v('VC', 'Variable cost', 'Cost per unit produced.', (s) => s.breakeven.VC),
      v('P', 'Price', 'Selling price per unit.', (s) => s.breakeven.P),
      v('PFT', 'Profit', 'Target profit (0 for breakeven).', (s) => s.breakeven.PFT),
      v('Q', 'Quantity', 'Units needed to reach that profit.', (s) => s.breakeven.Q),
    ],
  },
};

const CATALOG: Partial<Record<WorksheetId | 'standard', GuidedContext>> = {
  standard: STANDARD,
  PY,
  BGNSET,
  AMORT,
  CF,
  NPV,
  IRR,
  BOND,
  DEPR,
  ...OTHER,
};

/** The guided context for the current engine state. */
export function contextFor(state: CalculatorState): GuidedContext {
  if (state.mode.kind === 'worksheet') {
    return CATALOG[state.mode.worksheet] ?? STANDARD;
  }
  return STANDARD;
}

/** Match a live display label (e.g. 'CFo=') to the variable it describes. */
export function activeVariable(
  context: GuidedContext,
  displayLabel: string,
): GuidedVariable | null {
  if (displayLabel === '') return null;
  const bare = displayLabel.replace(/=$/, '');
  for (const variable of context.variables) {
    if (variable.matches ? variable.matches(bare) : variable.label === bare) return variable;
  }
  return null;
}

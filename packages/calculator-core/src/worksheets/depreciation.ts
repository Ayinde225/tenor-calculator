/**
 * Depreciation worksheet.
 *
 * With amortization, this is one of only two worksheets where the DISPLAY setting
 * reaches into the arithmetic. Guidebook p. 9 states the general rule (DEC is
 * cosmetic, the internal 13-digit value is untouched) and names these two as the
 * exceptions; p. 56 says the calculator "computes one year at a time and rounds
 * the results to the number of decimal places set"; p. 78 says "Values for DEP,
 * RDV, CST, and SAL are rounded to the number of decimals you choose to be
 * displayed". So `decimals` is a required input, and accumulated depreciation
 * accumulates ROUNDED yearly charges -- not exact ones.
 *
 * The published formulas (pp. 78-79), transcribed from the rendered page images
 * because the PDF text layer drops every equation:
 *
 *     RDV = CST - SAL - accumulated depreciation
 *
 *     SL   DEP = (CST - SAL) / LIF
 *          first year: ((CST - SAL) / LIF) x FSTYR
 *          last year or more: DEP = RDV
 *
 *     SYD  DEP = (LIF + 2 - YR - FSTYR) x (CST - SAL) / (LIF x (LIF + 1) / 2)
 *          first year: LIF x (CST - SAL) / (LIF x (LIF + 1) / 2) x FSTYR
 *          last year or more: DEP = RDV
 *
 *     DB   DEP = (RBV x DB%) / (LIF x 100), where RBV is for YR - 1
 *          first year: ((CST x DB%) / (LIF x 100)) x FSTYR
 *          unless (CST x DB%) / (LIF x 100) > RDV, then use RDV x FSTYR
 *          if DEP > RDV, use DEP = RDV
 *          if computing last year, DEP = RDV
 *
 * WHAT THE GUIDEBOOK DOES NOT PUBLISH, and is therefore DERIVED here. Each of
 * these is a reconstruction, not a citation:
 *
 *  1. FSTYR. Used by every first-year formula, defined nowhere in the appendix.
 *     Reconstructed as (13 - M01) / 12 from the M01 semantics on p. 56 (integer
 *     part = month placed in service, decimal part = fraction of that month
 *     elapsed before depreciation starts). Settled by the p. 58 example:
 *     M01 = 3.5 -> (13 - 3.5)/12 = 0.791666..., and 1,000,000/31.5 x 0.791666...
 *     = 25,132.2751... -> 25,132.28, exactly the printed result. Year 2 carries no
 *     FSTYR factor and gives 31,746.03, also exact. One example cannot rule out
 *     every alternative, but it pins both the shape and the scale.
 *
 *  2. RBV. No formula anywhere in the appendix. Inferred as CST - accumulated
 *     depreciation from the p. 58 example (1,000,000 - 25,132.28 = 974,867.72).
 *     Because that example has SAL = 0, RBV and RDV coincide throughout it and it
 *     cannot discriminate RBV = CST - accum from RBV = RDV. The DB formula settles
 *     it: DB depreciates RBV, and a declining-balance charge must be taken on book
 *     value including salvage, otherwise the "if DEP > RDV" clamp it prints would
 *     be unreachable. So RBV keeps SAL in it and RDV does not.
 *
 *  3. lastYear = ceil(LIF + 1 - FSTYR). The "last year or more" clause is printed
 *     but "last year" is never defined. A fractional M01 pushes the schedule one
 *     calendar year past LIF (a partial first year plus a partial final year),
 *     which is exactly why that clause exists. Corroborated two ways: it returns
 *     LIF when FSTYR = 1 and LIF is an integer, and for SYD the "DEP = RDV" dump
 *     it selects equals the general formula evaluated at that year to 9 decimals.
 *
 *  4. DBX crossover. Described in prose only as declining balance "with crossover
 *     to SL" (p. 55); the trigger is stated nowhere in pp. 55-58 or the appendix.
 *     Implemented as the standard formulation DEP = max(DB charge, RDV / remaining
 *     life), which switches exactly when the straight-line charge on the remaining
 *     depreciable value first overtakes the declining charge, and stays switched
 *     (once SL wins it keeps winning, since its charge is flat while DB's decays).
 *     Reproduces the textbook 5-year 200% schedule 40000/24000/14400/10800/10800.
 *     NO GOLDEN CASE EXERCISES THIS. It is unverified against the hardware.
 *
 *  5. SLF (French straight-line). Undocumented beyond the variable table. Taken as
 *     SL with the first-year fraction read from DT1 on a 30/360 basis rather than
 *     from M01. The two conventions provably agree: DT1 = 16 March gives
 *     (360 - 75)/360 = 0.791666..., identical to M01 = 3.5. That agreement is the
 *     whole argument for this reading, and it is why SLF falls back to M01 when
 *     DT1 is unset (p. 56 gives DT1 no reset default, so the worksheet must cope
 *     without one). STILL UNVERIFIED -- no example exercises SLF.
 *
 *  6. DBF (French declining balance). The weakest reconstruction here. Taken as
 *     DBX with the first-year fraction counted in WHOLE months, (13 - floor(M01))
 *     / 12, on the reasoning that the French degressif convention prorates from
 *     the first day of the month of acquisition and does cross over to
 *     straight-line. Nothing in this source supports or refutes it. SPECULATIVE.
 *
 * Sign convention: there is none. Depreciation quantities are unsigned magnitudes
 * (p. 58 prints DEP = 25,132.28* with no minus), so none of the sign-flip defects
 * affecting the TVM appendix apply here.
 *
 * Source: guidebook pp. 55-58 (behaviour, example), pp. 78-79 (formulas),
 * pp. 84-85 (errors), p. 9 (rounding).
 */
import {
  toInternal,
  roundToSignificantDigits,
  isIntegerAtInternalPrecision,
  INTERNAL_DIGITS,
} from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';
import { FLOATING_DECIMAL, type DecimalSetting } from '../display/format.js';

export type DepreciationMethod = 'SL' | 'SYD' | 'DB' | 'DBX' | 'SLF' | 'DBF';

/**
 * DT1, the starting date for SLF.
 *
 * Deliberately a local structure rather than a shared date type: DT1 is entered
 * as dd.mmyy under the European format (p. 9), but only its month and day reach
 * the arithmetic, and coupling this module to the Date worksheet's representation
 * would buy nothing. The Date worksheet's 1980-2079 range check (p. 84) is that
 * worksheet's rule and is not enforced here.
 */
export interface DepreciationDate {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31; day 31 is folded to 30 by the 30/360 count. */
  readonly day: number;
}

export interface DepreciationState {
  readonly method: DepreciationMethod;
  /** Life of the asset in years. Positive real for SL/SLF, positive integer for the rest (p. 56). */
  readonly LIF: number;
  /** Starting month: integer part = month, decimal part = fraction of it elapsed (p. 56). */
  readonly M01: number;
  /** Starting date. Present only under SLF (p. 55, p. 57). */
  readonly DT1?: DepreciationDate;
  /** Cost of the asset. */
  readonly CST: number;
  /** Salvage value. */
  readonly SAL: number;
  /** Year to compute. Positive integer (p. 57). */
  readonly YR: number;
  /**
   * Percent of declining balance for the active method.
   *
   * The p. 56 reset table lists DB and DBX as separate rows each defaulting to
   * 200, which implies the hardware remembers a percent per method. That is a
   * state-machine concern; the calculation only ever sees the active method's
   * percent, so one field is enough here.
   */
  readonly dbPercent: number;
}

/** One row of the schedule. */
export interface DepreciationYear {
  readonly year: number;
  /** Depreciation for the year. */
  readonly DEP: number;
  /** Remaining book value at the end of the year. */
  readonly RBV: number;
  /** Remaining depreciable value at the end of the year. */
  readonly RDV: number;
}

export type DepreciationResult = Omit<DepreciationYear, 'year'>;

/** Defaults after 2ND RESET ENTER (p. 56). DT1 is given no reset default there. */
export const DEPRECIATION_DEFAULTS: DepreciationState = Object.freeze({
  method: 'SL',
  LIF: 1,
  M01: 1,
  CST: 0,
  SAL: 0,
  YR: 1,
  dbPercent: 200,
});

/**
 * The 2ND SET cycle.
 *
 * The guidebook prints the six methods in two irreconcilable orders: p. 55's
 * variable table runs SL/SYD/DB/DBX/SLF/DBF, p. 57 step 3 runs SL/SLF/SYD/DB/
 * DBX/DBF. Neither page claims to be the cycle order. p. 57 wins here only
 * because it is the page describing what 2ND SET actually does, whereas p. 55 is
 * a reference table that also interleaves the non-method variables. No worked
 * example cycles the method, so nothing in the corpus settles this.
 */
export const METHOD_CYCLE: readonly DepreciationMethod[] = Object.freeze([
  'SL',
  'SLF',
  'SYD',
  'DB',
  'DBX',
  'DBF',
] as const);

/** SLF and DBF appear in the cycle only under a European date or separator format (p. 55, p. 57). */
export function availableMethods(european: boolean): readonly DepreciationMethod[] {
  return european ? METHOD_CYCLE : METHOD_CYCLE.filter((m) => m !== 'SLF' && m !== 'DBF');
}

/** Advance the method selection one step, wrapping (p. 55, p. 57). */
export function nextMethod(method: DepreciationMethod, european: boolean): DepreciationMethod {
  const cycle = availableMethods(european);
  const at = cycle.indexOf(method);
  // An unavailable method (SLF/DBF outside the European formats) restarts the cycle.
  return cycle[at === -1 ? 0 : (at + 1) % cycle.length] ?? 'SL';
}

/** True when the method takes a declining-balance percent (p. 55, p. 56). */
function usesPercent(method: DepreciationMethod): boolean {
  return method === 'DB' || method === 'DBX' || method === 'DBF';
}

/**
 * RND: round to the displayed number of decimal places.
 *
 * Floating decimal (DEC=9) has no fixed decimal count and the guidebook does not
 * say what RND means there; as in amortization we fall back to internal 13-digit
 * precision, the reading that leaves the arithmetic untouched.
 */
function rnd(x: number, decimals: DecimalSetting): number {
  if (decimals === FLOATING_DECIMAL) {
    return roundToSignificantDigits(x, INTERNAL_DIGITS);
  }
  return Number(x.toFixed(decimals));
}

function assertDate(dt: DepreciationDate): void {
  const bad =
    !isIntegerAtInternalPrecision(dt.month) ||
    !isIntegerAtInternalPrecision(dt.day) ||
    dt.month < 1 ||
    dt.month > 12 ||
    dt.day < 1 ||
    dt.day > 31;
  if (bad) {
    // Error 6 is the guidebook's error for an invalid date (p. 84), but the error
    // table lists no depreciation-specific trigger for it -- DT1 is simply never
    // discussed there. Raising it is an inference; the alternative is letting a
    // malformed DT1 produce a silently wrong FSTYR, which is worse.
    throw new CalculatorError(ErrorCode.InvalidDate, `DT1 ${dt.day}.${dt.month} is not a valid date`);
  }
}

/**
 * FSTYR: the fraction of the first calendar year the asset is in service.
 *
 * DERIVED -- see the module header, reconstruction 1. Verified to the cent against
 * the only worked example (p. 58).
 */
export function firstYearFraction(state: DepreciationState): number {
  if (state.method === 'SLF' && state.DT1 !== undefined) {
    assertDate(state.DT1);
    // 30/360: every month is 30 days. Folding day 31 to 30 keeps December 31 from
    // producing a zero-length first year.
    const elapsed = 30 * (state.DT1.month - 1) + Math.min(state.DT1.day, 30) - 1;
    return toInternal((360 - elapsed) / 360);
  }
  if (state.method === 'DBF') {
    // SPECULATIVE -- see the module header, reconstruction 6.
    return toInternal((13 - Math.floor(state.M01)) / 12);
  }
  return toInternal((13 - state.M01) / 12);
}

/**
 * The year in which the schedule exhausts RDV -- the "last year" of the printed
 * "last year or more" clause. DERIVED; see the module header, reconstruction 3.
 *
 * Rounded to internal precision before the ceiling so that a value landing at
 * 32.000000000001 through float drift does not buy a spurious 33rd year.
 */
export function lastYear(state: DepreciationState): number {
  const fstyr = firstYearFraction(state);
  return Math.ceil(roundToSignificantDigits(state.LIF + 1 - fstyr, INTERNAL_DIGITS));
}

function assertState(state: DepreciationState): void {
  // Error 4 bounds, p. 84. The comparison glyphs are vector drawings that the PDF
  // drops from the text layer AND from the rendered image alike -- the page prints
  // "declining balance percent  0; LIF  0; YR _ 0; CST < 0; SAL < 0; or M01 1
  // M01  13". Only CST < 0 and SAL < 0 survive. The rest are reconstructed from
  // the prose that constrains them: the DB percent "must be a positive number" and
  // LIF "must be a positive real"/"positive integer" (p. 56), YR "must be a
  // positive integer" (p. 57), and M01 is a month number, which forces <= 0,
  // <= 0, <= 0, < 1 and >= 13 respectively. High-confidence inference, not
  // transcription.
  if (state.LIF <= 0) {
    throw new CalculatorError(ErrorCode.OutOfRange, `LIF must be > 0, got ${state.LIF}`);
  }
  if (state.CST < 0) {
    throw new CalculatorError(ErrorCode.OutOfRange, `CST must be >= 0, got ${state.CST}`);
  }
  if (state.SAL < 0) {
    throw new CalculatorError(ErrorCode.OutOfRange, `SAL must be >= 0, got ${state.SAL}`);
  }
  if (state.M01 < 1 || state.M01 >= 13) {
    throw new CalculatorError(ErrorCode.OutOfRange, `M01 must be >= 1 and < 13, got ${state.M01}`);
  }
  if (state.YR <= 0) {
    throw new CalculatorError(ErrorCode.OutOfRange, `YR must be > 0, got ${state.YR}`);
  }
  // p. 57 requires YR to be a positive integer but the p. 84 bullet only bounds it
  // at zero, so this is the same kind of inference as the bounds above. Unlike a
  // fractional LIF -- which the formulas still evaluate, and which is therefore
  // accepted below -- a fractional YR has no meaning at all: YR indexes the
  // schedule walk. Rejecting is the only coherent option.
  if (!isIntegerAtInternalPrecision(state.YR)) {
    throw new CalculatorError(ErrorCode.OutOfRange, `YR must be an integer, got ${state.YR}`);
  }
  if (usesPercent(state.method) && state.dbPercent <= 0) {
    throw new CalculatorError(
      ErrorCode.OutOfRange,
      `declining balance percent must be > 0, got ${state.dbPercent}`,
    );
  }
  // p. 56 requires an integer LIF under SYD/DB/DBX/DBF, but the p. 84 error table
  // bounds LIF only at zero and names no error for a fractional life. The formulas
  // evaluate perfectly well with one, so it is accepted rather than rejected --
  // inventing an undocumented Error 4 here would be a guess with no evidence
  // behind it. What the hardware does is an open question.

  // Error 2, p. 84: "Depreciation worksheet: a calculation included SAL > CST."
  // Checked after the range bounds because those are entry-time on the hardware
  // and this one is calculation-time; a pure function collapses both into one
  // call, so the entry-time checks fire first to match the order a user would hit
  // them in. SAL == CST is legal -- only strictly greater is an error.
  if (state.SAL > state.CST) {
    throw new CalculatorError(
      ErrorCode.InvalidArgument,
      `SAL (${state.SAL}) exceeds CST (${state.CST})`,
    );
  }
}

interface Context {
  readonly cst: number;
  readonly sal: number;
  readonly fstyr: number;
  readonly last: number;
  readonly decimals: DecimalSetting;
}

/** SL / SLF, p. 79. SLF differs only in how FSTYR was obtained. */
function straightLineCharge(state: DepreciationState, ctx: Context, year: number): number {
  const rate = toInternal((ctx.cst - ctx.sal) / state.LIF);
  return year === 1 ? toInternal(rate * ctx.fstyr) : rate;
}

/**
 * SYD, p. 79, read with the printed parentheses balanced.
 *
 * The page draws the general form's numerator as `(LIF+2-YR-FSTYR)x(CST-SAL` --
 * two opens, one close -- and both denominators as `((LIF x (LIF+1)) / 2`, three
 * opens, two closes. The intended reading is forced by the page's own structure:
 * substituting YR = 1 and FSTYR = 1 into the general form reproduces the printed
 * first-year form exactly, which no other bracketing does.
 */
function sumOfYearsCharge(state: DepreciationState, ctx: Context, year: number): number {
  const digits = toInternal((state.LIF * (state.LIF + 1)) / 2);
  if (digits === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'sum-of-years digits is zero');
  }
  if (year === 1) {
    return toInternal(((state.LIF * (ctx.cst - ctx.sal)) / digits) * ctx.fstyr);
  }
  return toInternal(((state.LIF + 2 - year - ctx.fstyr) * (ctx.cst - ctx.sal)) / digits);
}

/** DB, p. 79. RBV is for YR - 1, which for year 1 is CST. */
function decliningBalanceCharge(
  state: DepreciationState,
  ctx: Context,
  year: number,
  rbvBefore: number,
  rdvBefore: number,
): number {
  if (year === 1) {
    const base = toInternal((ctx.cst * state.dbPercent) / (state.LIF * 100));
    // "Unless; (CST x DB%)/(LIF x 100) > RDV; then use RDV x FSTYR" (p. 79).
    return base > rdvBefore ? toInternal(rdvBefore * ctx.fstyr) : toInternal(base * ctx.fstyr);
  }
  return toInternal((rbvBefore * state.dbPercent) / (state.LIF * 100));
}

/**
 * The straight-line leg of the DBX/DBF crossover: the remaining depreciable value
 * spread evenly over the life still to run. DERIVED -- see the module header,
 * reconstruction 4.
 */
function crossoverCharge(
  state: DepreciationState,
  ctx: Context,
  year: number,
  rdvBefore: number,
): number {
  // Year 1 has consumed no life yet; every later year has consumed FSTYR plus one
  // full year per year elapsed since.
  const remaining = year === 1 ? state.LIF : toInternal(state.LIF - ctx.fstyr - (year - 2));
  if (remaining <= 0) return rdvBefore;
  const charge = toInternal(rdvBefore / remaining);
  return year === 1 ? toInternal(charge * ctx.fstyr) : charge;
}

function chargeFor(
  state: DepreciationState,
  ctx: Context,
  year: number,
  rbvBefore: number,
  rdvBefore: number,
): number {
  // "Last year or more: DEP = RDV" (p. 79). Checked before the first-year forms so
  // that a life short enough to expire inside its own first calendar year (say
  // LIF = 0.5) dumps the whole depreciable value rather than pro-rating it away.
  if (year >= ctx.last) return rnd(rdvBefore, ctx.decimals);

  let dep: number;
  switch (state.method) {
    case 'SL':
    case 'SLF':
      dep = straightLineCharge(state, ctx, year);
      break;
    case 'SYD':
      dep = sumOfYearsCharge(state, ctx, year);
      break;
    case 'DB':
      dep = decliningBalanceCharge(state, ctx, year, rbvBefore, rdvBefore);
      break;
    case 'DBX':
    case 'DBF':
      dep = Math.max(
        decliningBalanceCharge(state, ctx, year, rbvBefore, rdvBefore),
        crossoverCharge(state, ctx, year, rdvBefore),
      );
      break;
  }

  // "If DEP > RDV, use DEP = RDV" (p. 79). Printed only under declining balance;
  // applied to every method here as a guard. For SL and SYD it is unreachable --
  // their charges are bounded by RDV until the last year, which the clause above
  // already intercepts -- so extending it changes no documented result and only
  // stops an undocumented input from driving RDV negative.
  if (dep > rdvBefore) dep = rdvBefore;
  if (dep < 0) dep = 0;
  return rnd(dep, ctx.decimals);
}

/**
 * Walk the schedule from year 1, which is unavoidable: each year's charge depends
 * on the accumulated depreciation before it, and that accumulation is of ROUNDED
 * charges (p. 9, p. 56, p. 78).
 */
function walk(state: DepreciationState, decimals: DecimalSetting, through: number): DepreciationYear[] {
  const ctx: Context = {
    // p. 78 rounds CST and SAL to the display setting alongside DEP and RDV.
    cst: rnd(state.CST, decimals),
    sal: rnd(state.SAL, decimals),
    fstyr: firstYearFraction(state),
    last: lastYear(state),
    decimals,
  };

  const rows: DepreciationYear[] = [];
  let accumulated = 0;

  for (let year = 1; year <= through; year++) {
    const rbvBefore = rnd(toInternal(ctx.cst - accumulated), decimals);
    const rdvBefore = rnd(toInternal(ctx.cst - ctx.sal - accumulated), decimals);
    const DEP = chargeFor(state, ctx, year, rbvBefore, rdvBefore);

    accumulated = rnd(toInternal(accumulated + DEP), decimals);
    rows.push({
      year,
      DEP,
      RBV: rnd(toInternal(ctx.cst - accumulated), decimals),
      RDV: rnd(toInternal(ctx.cst - ctx.sal - accumulated), decimals),
    });
  }
  return rows;
}

/**
 * Compute DEP, RBV and RDV for the year in `state.YR`.
 *
 * On the hardware these are auto-computed as you scroll onto them (p. 56); there
 * is no CPT step and no unknown to solve for, so all three come back together.
 *
 * @param decimals the current DEC setting -- it changes the result, by design.
 */
export function depreciate(state: DepreciationState, decimals: DecimalSetting): DepreciationResult {
  assertState(state);

  const last = lastYear(state);
  const rows = walk(state, decimals, Math.min(state.YR, last));
  // Provably non-empty: lastYear >= 1 because LIF > 0 and FSTYR <= 1, and YR >= 1
  // by assertState, so the loop runs at least once.
  const final = rows[rows.length - 1]!;

  if (state.YR > last) {
    // Past the end of the schedule RDV is already zero, so "last year or more:
    // DEP = RDV" (p. 79) yields nothing. Short-circuited rather than iterated so
    // that a large YR costs no more than the schedule itself; the values are
    // identical either way.
    return { DEP: rnd(0, decimals), RBV: final.RBV, RDV: final.RDV };
  }
  return { DEP: final.DEP, RBV: final.RBV, RDV: final.RDV };
}

/**
 * The whole schedule, year 1 through the last. Not a hardware feature -- the
 * calculator shows one year at a time -- but the same walk, exposed for guided
 * mode and export. Terminates where the guidebook says it does, at RDV = 0 (p. 57).
 */
export function depreciationSchedule(
  state: DepreciationState,
  decimals: DecimalSetting,
): DepreciationYear[] {
  assertState(state);
  const rows = walk(state, decimals, lastYear(state));

  // "The schedule is complete when RDV equals zero" (p. 57) -- not "when the last
  // calendar year is reached". The two coincide for SL, SLF, SYD and the crossover
  // methods, whose charges are sized to land RDV on zero exactly at lastYear(). They
  // do NOT coincide for DB: the "if DEP > RDV, use DEP = RDV" clamp and the
  // "unless (CST x DB%)/(LIF x 100) > RDV, then use RDV x FSTYR" first-year clause
  // (both p. 79) can exhaust RDV years early -- a 5-year 400% life on CST 10,000 /
  // SAL 5,000 dumps the whole depreciable value in year 1. Walking on to lastYear()
  // there appends nothing but DEP = 0 rows, which is a schedule the guidebook says
  // has already ended. RDV = 0 means CST - SAL - accumulated = 0, so no later year
  // can charge anything; truncating loses no information.
  //
  // depreciate() is deliberately NOT truncated: YR past the end is a legitimate
  // query and "last year or more: DEP = RDV" (p. 79) answers it with zero.
  const done = rows.findIndex((r) => r.RDV === 0);
  return done === -1 ? rows : rows.slice(0, done + 1);
}

/**
 * CPT on the YR line: increment YR by one (p. 57).
 *
 * The p. 58 example prints this step as [down] [2nd] [ENTER] -- i.e. 2ND SET --
 * and both the text layer and a magnified crop confirm those glyphs, but p. 57
 * says twice that CPT is the key, and YR is an enter-only variable that 2ND SET
 * has no business touching. Treated as a typo in the example's key column; the
 * resulting YR = 2 is uncontested either way, so the state machine can route both
 * spellings here.
 */
export function nextYear(state: DepreciationState): DepreciationState {
  return { ...state, YR: state.YR + 1 };
}

/**
 * 2ND CLR WORK inside the worksheet: resets LIF, YR, CST and SAL only (p. 56).
 *
 * The p. 56 bullet names exactly those four and explicitly spares the depreciation
 * method. It says nothing about M01, the DB/DBX percent or DT1, even though the
 * first two do carry reset defaults in the same table -- so they are left alone
 * here. 2ND RESET ENTER is the operation that restores DEPRECIATION_DEFAULTS.
 */
export function clearWork(state: DepreciationState): DepreciationState {
  return { ...state, LIF: 1, YR: 1, CST: 0, SAL: 0 };
}

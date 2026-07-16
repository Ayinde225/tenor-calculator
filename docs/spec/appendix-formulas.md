# Appendix — Internal Formulas

> Source: official BA II Plus guidebook, pages 74-83. Behaviour described in original wording.

This section specifies the arithmetic the calculator runs internally: TVM, amortization, cash
flow / NPV / IRR, bonds, depreciation, statistics and regression, interest-rate conversion,
percent change, profit margin, breakeven, and the two day-count methods.

**How this section was recovered.** Every equation on pp. 74-83 is a vector drawing, not text.
The text layer of the PDF drops them entirely, leaving bare `where:` labels above blank space.
All formulas below were transcribed from the rendered page images. Several of them are
demonstrably mis-rendered or mis-typeset in the source (lost superscripts, dropped
parentheses, a `+` that renders as `÷`, a missing leading minus). Each is flagged in
[Formulas](#formulas) and settled against a worked example from elsewhere in the guidebook.
Page 83 is a scanned insert supplying the `Note:` that page 82 leaves empty.

**Arbitration rule used throughout.** Where a printed formula and a worked example disagree,
the worked example is taken as normative and the printed formula is recorded as a defect. Every
such call is backed by a case in `tests/golden/appendix-formulas.json`.

---

## Variables

The appendix does not own any variables; it describes the quantities the worksheets own. The
table below lists every symbol the appendix formulas reference, so an implementer can bind each
one without leaving this document.

### Time Value of Money (pp. 74-75)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `N` | N | 0 | entered/computed | real; payment-count |
| `I/Y` | I/Y | 0 | entered/computed | percent per year |
| `PV` | PV | 0 | entered/computed | real |
| `PMT` | PMT | 0 | entered/computed | real |
| `FV` | FV | 0 | entered/computed | real |
| `P/Y` | P/Y | 12 | setting | > 0 (Error 4 if ≤ 0) |
| `C/Y` | C/Y | 12 | setting | > 0 (Error 4 if ≤ 0) |
| `i` | — | — | internal | periodic rate, per compounding period |
| `k` | — | 0 | internal | 0 in END mode, 1 in BGN mode (p. 75) |
| `G_i` | — | 1 | internal | annuity-due factor `1 + i·k` (p. 75) |

`i` is not a user variable. It is derived from `I/Y`, `C/Y` and `P/Y` and is expressed per
*payment* period, which is why `P/Y` and `C/Y` both appear in its definition (p. 74).

### Amortization (p. 76)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `pmt1` | P1 | 1 | entered | integer 1-9,999 (Error 4 outside) |
| `pmt2` | P2 | 1 | entered | integer 1-9,999; `pmt2 ≥ pmt1` (Error 2 otherwise) |
| `bal()` | BAL | — | computed | real |
| `ΣPrn()` | PRN | — | computed | real |
| `ΣInt()` | INT | — | computed | real |
| `bal(m)` | — | — | internal | balance after payment `m` |
| `I_m` | — | — | internal | interest component of payment `m` |
| `RND` | — | — | internal operator | rounds to the displayed decimal setting |
| `RND12` | — | — | internal operator | rounds to 12 decimal places |
| `npmt` | — | — | internal | payment index at which a bare `bal()` is evaluated |

### Cash Flow / NPV / IRR (pp. 76-77)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `CF_0` | CFo | 0 | entered | real |
| `CF_j` | C01…C24 | 0 | entered | real |
| `n_j` | F01…F24 | 1 | entered | 1-9,999 (Error 4 outside 0.5-9,999) |
| `i` | I | 0 | entered | interest rate per period ÷ 100 |
| `NPV` | NPV | — | computed | real |
| `IRR` | IRR | — | computed | percent |
| `N` | — | — | internal | index of the last entered cash-flow group |
| `S_j` | — | — | internal | cumulative period count through group `j` |

### Bonds (pp. 77-78)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `PRI` | PRI | — | entered/computed | dollar price per $100 par; > 0 (Error 4 if ≤ 0) |
| `RV` | RV | 100 | entered | redemption value per $100 par; > 0 (Error 4 if ≤ 0) |
| `R` | — | — | internal | annual coupon rate as a decimal, `CPN ÷ 100` |
| `Y` | YLD | — | entered/computed | annual yield; `Y` in the formulas is `YLD ÷ 100` |
| `M` | 1/Y, 2/Y | 2 | setting | 1 or 2 coupons per year |
| `DSR` | — | — | internal | days from settlement to redemption |
| `DSC` | — | — | internal | days from settlement to next coupon |
| `E` | — | — | internal | days in the coupon period containing settlement |
| `A` | — | — | internal | accrued days: coupon-period start to settlement |
| `N` | — | — | internal | coupons between settlement and redemption, rounded **up** |
| `K` | — | — | internal | summation counter |
| `AI` | AI | — | computed | accrued interest per $100 par |
| `PAR` | — | 100 | internal | par value |

`M`, `DSR`, `DSC`, `E` and `A` are all products of the selected day-count method (ACT or 360)
and the SDT/RDT dates; the appendix consumes them but does not compute them.

### Depreciation (pp. 78-79)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `CST` | CST | 0 | entered | ≥ 0 (Error 4 if < 0) |
| `SAL` | SAL | 0 | entered | ≥ 0, `SAL ≤ CST` (Error 2 if `SAL > CST`) |
| `LIF` | LIF | 1 | entered | > 0; integer for SYD/DB/DBX/DBF |
| `YR` | YR | 1 | entered | > 0 |
| `DB%` | DB, DBX | 200 | entered | > 0 (Error 4 if ≤ 0) |
| `M01` | M01 | 1 | entered | `1 ≤ M01 < 13` |
| `DEP` | DEP | — | computed | depreciation for year `YR` |
| `RBV` | RBV | — | computed | remaining book value |
| `RDV` | RDV | — | computed | remaining depreciable value |
| `FSTYR` | — | — | internal | **undefined in the appendix** — see [Edge cases](#edge-cases--ambiguities) |

### Statistics and regression (p. 80)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `n` | n | 0 | computed | count of data points, ≤ 50 |
| `Σx`, `Σx²`, `Σxy` | — | — | internal | accumulated sums over transformed data |
| `x̄` | X̄ | — | computed | mean |
| `σx` | σx | — | computed | population (n-weighted) standard deviation |
| `sx` | Sx | — | computed | sample (n-1-weighted) standard deviation |
| `a` | a | — | computed | regression intercept |
| `b` | b | — | computed | regression slope |
| `r` | r | — | computed | correlation coefficient, -1 ≤ r ≤ 1 |

### Interest-rate conversion (p. 80)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `NOM` | NOM | 0 | entered/computed | percent per year |
| `EFF` | EFF | 0 | entered/computed | percent per year |
| `C/Y` | C/Y | 1 | entered | > 0 (Error 4 if ≤ 0) |
| `x` | — | — | internal | rebound differently in each direction — see Formulas |

### Percent change, profit margin, breakeven (pp. 80-81)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `OLD` | OLD | 0 | entered/computed | real |
| `NEW` | NEW | 0 | entered/computed | real |
| `%CH` | %CH | 0 | entered/computed | percent |
| `#PD` | #PD | 1 | entered/computed | real, exponent |
| `SellingPrice` | SEL | 0 | entered/computed | real |
| `Cost` | CST | 0 | entered/computed | real |
| `GrossProfitMargin` | MAR | 0 | entered/computed | percent |
| `PFT` | PFT | 0 | entered/computed | real |
| `P` | P | 0 | entered/computed | price per unit |
| `FC` | FC | 0 | entered/computed | fixed cost |
| `VC` | VC | 0 | entered/computed | variable cost per unit |
| `Q` | Q | 0 | entered/computed | quantity |

### Days between dates (pp. 81-83)

| Symbol | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `DT1` | DT1 | 12-31-1990 | entered/computed | 1980-01-01 … 2079-12-31 |
| `DT2` | DT2 | 12-31-1990 | entered/computed | 1980-01-01 … 2079-12-31 |
| `DBD` | DBD | 0 | entered/computed | real |
| `M1`,`DT1`,`Y1` | — | — | internal | month / day / year of the first date |
| `M2`,`DT2`,`Y2` | — | — | internal | month / day / year of the second date |
| `MB` | — | January | internal | base month |
| `DB` | — | 1 | internal | base day |
| `YB` | — | — | internal | base year: the first year after a leap year |

---

## Behaviour

The appendix is a reference chapter, not an interactive mode. It has no keys, no display and no
variables of its own. What follows describes how the formulas govern the worksheets that do.

### The appendix is documentation, not a worksheet

There is no key sequence that opens it and nothing on pp. 74-83 can be cleared, reset or
computed. It opens with a contents list for the whole appendix — formulas, error conditions,
accuracy, IRR calculations, AOS, batteries, troubleshooting, and TI service and warranty
terms — and then states that the section catalogues the maths the calculator runs internally
(p. 74). Everything below is consumed by the worksheets specified in the sibling documents.

### Rate handling in TVM

`I/Y` is a nominal annual percentage. Two conversions sit between it and the `i` the TVM
equation solves with (p. 74). Going in, the annual rate is scaled to a compounding-period rate
by `.01 × I/Y ÷ C/Y`, then compounded across the `C/Y ÷ P/Y` compounding periods that fall in
one payment period. Coming out, the inverse runs with `P/Y ÷ C/Y` as the exponent and a factor
of `100 × C/Y` restoring the annual percentage. When `P/Y` equals `C/Y` — the default — both
exponents collapse to 1 and `i` is simply `.01 × I/Y ÷ C/Y`.

A separate closed form for `i` applies when `PMT` is zero (p. 74): with no annuity leg the
equation reduces to a single growth factor between `PV` and `FV`, so `i` follows from the
`N`-th root of their ratio without iteration.

### Iteration in TVM

When `PMT` is non-zero, `i` cannot be isolated. The calculator drives the balance equation
`0 = PV + PMT·G_i·[(1-(1+i)^-N)/i] + FV·(1+i)^-N` to zero by iterative search (p. 74). This is
the only TVM quantity requiring iteration; `N`, `PMT`, `PV` and `FV` each have a closed form
(p. 75). Because the search needs the residual to change sign, `I/Y` is unsolvable when `FV`,
`N × PMT` and `PV` all share a sign — the guidebook's Error 5 case (p. 84).

### Payment timing

Payment timing enters through one factor, `G_i = 1 + i·k`, with `k = 0` for END and `k = 1` for
BGN (p. 75). `G_i` multiplies only the `PMT` leg, so it advances every payment by exactly one
period's interest. In END mode `G_i` is 1 and drops out.

### The `i = 0` branch

Each of `N`, `PMT`, `PV` and `FV` is published as a pair: a compounding form for `i ≠ 0` and a
straight-line form for `i = 0` (p. 75). The `i = 0` forms are not a limiting approximation, they
are a separate code path — at `i = 0` the compounding forms divide by zero. An implementation
must branch on `i` exactly, not on a tolerance, and the zero-rate forms simply spread
`PV + FV` evenly across `N` periods.

### Rounding inside amortization

Amortization is the only section that rounds *inside* the loop rather than at the display
(p. 76). Two operators are defined: `RND`, which rounds to the user's decimal setting, and
`RND12`, which rounds to 12 places. The opening balance is `RND(PV)`, each period's interest is
`RND[RND12(-i × bal(m-1))]` — a double rounding, twelve places then display places — and each
payment applied to the balance is `RND(PMT)`. The loop then runs `m = 1 … pmt2`.

The consequence is that an amortization schedule is a function of the *display setting*, not
just of the TVM variables. Change the decimal setting and the schedule genuinely changes. This
also means amortization cannot be derived from the TVM closed forms; it must be simulated
period by period from period 1, even when only a late range is requested.

The guidebook states plainly that balance, principal and interest depend on `PMT`, `PV`, `I/Y`,
`pmt1` and `pmt2` (p. 76). `FV` is absent from that list.

### NPV grouping

`NPV` sums *groups*, not individual periods (p. 76). Each group `j` carries an amount `CF_j` and
a frequency `n_j`. The group's own value is an `n_j`-period level annuity, `(1-(1+i)^-n_j)/i`,
and that annuity is then discounted back over all periods preceding the group. `S_j` is the
running total of frequencies — `S_j = Σ n_i` for `j ≥ 1` and `S_0 = 0` — so the discount
exponent for group `j` is `S_{j-1}`, the count of periods that elapsed before the group began.
`CF_0` is added undiscounted (p. 76).

### IRR

`IRR` is the rate that zeroes `NPV`, reported as a percentage: `IRR = 100 × i` where `i`
satisfies `npv() = 0` (p. 77). It depends only on `CF_0` and the `CF_j` (p. 77) — the interest
rate `I` is an output, not an input. The page also fixes the general link between the displayed
rate and the internal one: `i = I/Y ÷ 100` (p. 77). Because the root-finder needs a sign change,
a cash-flow list without one raises Error 5 (p. 84).

### Bond price: two regimes

Bond pricing splits on how many coupons remain (pp. 77-78).

*One coupon period or less.* Simple interest, not compounding. The redemption value plus the
final coupon is discounted by the single factor `1 + (DSR/E)·(Y/M)`, and accrued interest is
subtracted. The guidebook notes the two terms as: present value of redemption including
interest, then accrued interest owed to the seller (p. 77).

*More than one coupon period.* Three terms (p. 78): the redemption value discounted over
`N-1+DSC/E` periods; the summation of `N` coupons, coupon `K` discounted over `K-1+DSC/E`
periods; minus accrued interest. The guidebook's own gloss distinguishes this first term from
the short-maturity case — here it does *not* include interest (p. 78).

The fractional exponent `DSC/E` is what places settlement partway through a coupon period. `N`
is rounded **up** to a whole number; the guidebook gives 2.4 → 3 (p. 78).

### Bond yield: two regimes

With one coupon period or less, `Y` has a closed form (p. 78). With more than one, there is no
closed form and yield is found by iterative search over the long-maturity price formula
(p. 78) — the same relationship, inverted numerically.

### Accrued interest

`AI = PAR × (R/M) × (A/E)` (p. 78): one coupon's worth of interest, prorated by the fraction of
the coupon period already elapsed at settlement. It applies to securities with standard coupons
or interest at maturity (p. 78).

### Depreciation: the shared frame

`RDV = CST - SAL - accumulated depreciation` (p. 78). `DEP`, `RDV`, `CST` and `SAL` are all
rounded to the displayed decimal count (p. 78) — so, as with amortization, the display setting
participates in the result.

Each method publishes three cases (p. 79): a normal year, a first year scaled by `FSTYR`, and a
terminal case `DEP = RDV` that flushes whatever depreciable value remains. The first-year
proration is why depreciation continues past year `LIF` when `M01` is not January: the schedule
is shifted by a partial year.

- **Straight line** — `(CST-SAL)/LIF` per year, unchanging (p. 79).
- **Sum-of-the-years'-digits** — numerator shrinks year over year through `(LIF+2-YR-FSTYR)`;
  denominator is the constant `LIF(LIF+1)/2` (p. 79).
- **Declining balance** — a rate applied to the *previous* year's remaining book value, so
  `RBV` is taken for `YR-1` (p. 79). Three guards apply (p. 79): the first-year charge is capped
  at `RDV × FSTYR`; any year's `DEP` is capped at `RDV`; and the last year takes `DEP = RDV`.
  Unlike SL and SYD, declining balance never reaches `SAL` on its own — the caps make it
  terminate.

### Statistics

Both standard deviations use the computational (raw-moment) form, `Σx² - (Σx)²/n` over `n` or
`n-1`, raised to the ½ power (p. 80). The guidebook notes once that the formulas apply to both
`x` and `y` (p. 80), so each is really two.

Regressions run on **transformed** data (p. 80). The transform is the worksheet's business —
LIN, Ln, EXP, PWR — and the appendix formulas for `a`, `b` and `r` are applied unchanged
afterward. A single set of formulas therefore covers all four models.

### Interest-rate conversion

Both directions route through an intermediate `x`, but `x` means something different in each
(p. 80). Converting NOM → EFF, `x = .01 × NOM ÷ C/Y` is the *periodic* rate, and the exponent is
`C/Y`. Converting EFF → NOM, `x = .01 × EFF` is the *annual* rate, the exponent is `1 ÷ C/Y`,
and the result is rescaled by `100 × C/Y`. Both are written as `e^(exponent × ln(x+1))` rather
than as a power — an exp-log formulation of `(1+x)^exponent`.

### Percent change

One equation, `NEW = OLD(1 + %CH/100)^#PD`, serves three jobs (p. 80). With `#PD = 1` it is
percent change or cost-sell-markup; with `#PD = n` it is compound interest, `%CH` becoming the
per-period growth rate. Any one of the four can be computed from the other three.

### Profit margin and breakeven

`GrossProfitMargin = ((SellingPrice - Cost)/SellingPrice) × 100` (p. 81) — margin is a
percentage of *selling price*, which is what distinguishes it from markup (a percentage of
cost, handled by the percent-change worksheet).

`PFT = PQ - (FC + VCQ)` (p. 81): revenue less the sum of fixed and variable cost. Breakeven is
the `PFT = 0` case rather than a separate formula.

### Day counts: actual/actual

Both dates are converted to a day number counted from a base date, and `DBD` is the difference
(p. 81). Each day number is: whole years since the base year × 365, plus days from the base
month to the date's month, plus the day of month, plus `(Y - YB)/4` for accumulated leap days
(pp. 81-82). The base is January 1 of the first year following a leap year (p. 82) — chosen so
that the `/4` term counts leap days without an off-by-one. The 1980-2079 range (p. 81) contains
no century non-leap year, which is why the plain `/4` suffices.

### Day counts: 30/360

Every month is forced to 30 days and every year to 360 (p. 82), so
`DBD = (Y2-Y1)×360 + (M2-M1)×30 + (DT2-DT1)` after the day-of-month adjustments. Page 82 gives
two of the adjustments; the scanned insert on p. 83 gives all four, including the two February
rules that p. 82 omits. Applied in order (p. 83):

1. If `DT2` is the last day of February **and** `DT1` is the last day of February, set `DT2` to 30.
2. If `DT1` is the last day of February, set `DT1` to 30.
3. If `DT2` is 31 and `DT1` is 30 or 31, set `DT2` to 30.
4. If `DT1` is 31, set `DT1` to 30.

Order matters: rule 1 tests the *unmodified* `DT1`, so it must run before rule 2 rewrites it.
Page 83 also records three standing conventions: a year is always 360 days; days per period is
`360 ÷ periods` (monthly → 30); and days remaining in a period is the period length less days
accrued.

---

## Formulas

Transcribed from the rendered page images. Where the render is defective, both the literal
rendering and the corrected form are given, with the golden case that settles it.

### Notation

- `RND(v)` — round `v` to the current display decimal setting.
- `RND12(v)` — round `v` to 12 decimal places.
- `^` is exponentiation; `ln` is the natural logarithm.

### Time Value of Money (pp. 74-75)

**Periodic rate from `I/Y`, when `PMT = 0`** (p. 74):

```
i = [ e^(y × ln(x+1)) ] - 1

where:  PMT = 0
        y = C/Y ÷ P/Y
        x = (.01 × I/Y) ÷ C/Y
        C/Y = compounding periods per year
        P/Y = payment periods per year
        I/Y = interest rate per year
```

**Periodic rate from `PV` and `FV`, when `PMT = 0`** (p. 74):

```
i = (-FV ÷ PV)^(1÷N) - 1

where:  PMT = 0
```

Sign convention: the ratio is negated. `PV` and `FV` carry opposite signs under the cash-flow
convention, so `-FV ÷ PV` is positive and the root is real.

**Balance equation — the iteration used to compute `i`** (p. 74):

```
0 = PV + PMT × G_i × [ (1 - (1+i)^-N) / i ] + FV × (1+i)^-N
```

> Render note: the page shows `FVx(1 + i)^-N`. The `x` is a multiplication sign set in the
> italic maths font, not a variable — there is no variable `x` in scope here. Read as
> `FV × (1+i)^-N`.

**`I/Y` from the periodic rate** (p. 74):

```
I/Y = 100 × C/Y × [ e^(y × ln(x+1)) - 1 ]

where:  x = i
        y = P/Y ÷ C/Y
```

**Annuity-due factor** (p. 75):

```
G_i = 1 + i × k

where:  k = 0 for end-of-period payments
        k = 1 for beginning-of-period payments
```

> Render note: printed as `k = l` (lowercase L) for beginning-of-period. The glyph is the
> digit 1; this font renders `1` with a serif that reads as `l`. The same substitution recurs
> throughout pp. 75-76.

**`N`** (p. 75):

```
        ln( (PMT × G_i - FV × i) / (PMT × G_i + PV × i) )
N =     ------------------------------------------------
                        ln(1 + i)

where:  i ≠ 0

N = -(PV + FV) ÷ PMT

where:  i = 0
```

> Render note: the numerator's first term prints as `PMT×G_i−FV×1` and the denominator as
> `ln(l+i)`. Both `1` glyphs are the digit 1; in the numerator the surrounding term is
> `FV × i` — printing `×1` there would make the `i`-dependence vanish and the formula would not
> invert the balance equation. Read as `FV × i` and `ln(1+i)`.

**`PMT`** (p. 75) — **printed form, contradicted by a worked example**:

```
PMT = (i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]        <-- AS PRINTED, p. 75

where:  i ≠ 0

PMT = -(PV + FV) ÷ N

where:  i = 0
```

**Discrepancy (confirmed).** The `i ≠ 0` form lacks a leading minus sign. The `i = 0` form
directly beneath it *has* one, so the page is internally inconsistent. Corrected:

```
PMT = -(i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]       <-- NORMATIVE
```

Settled by the mortgage example (p. 39): `N=360`, `I/Y=6.125`, `P/Y=C/Y=12`, `PV=120000`,
`FV=0`, END. The printed form yields `+729.13`; the calculator displays `-729.13`. Golden case
`appendix-formulas-tvm-pmt-sign-convention`.

**`PV`** (p. 75):

```
PV = [ (PMT × G_i)/i - FV ] × 1/((1+i)^N) - (PMT × G_i)/i

where:  i ≠ 0

PV = -(FV + PMT × N)

where:  i = 0
```

**`FV`** (p. 75):

```
FV = (PMT × G_i)/i - (1+i)^N × ( PV + (PMT × G_i)/i )

where:  i ≠ 0

FV = -(PV + PMT × N)

where:  i = 0
```

> Render note: printed as `(l+i)^N`, digit 1. The second `(PMT × G)/i` prints `G` without its
> `i` subscript; it is `G_i` — the same factor as the first term, as `PV` (immediately above)
> confirms by using `G_i` in both positions.

### Amortization (p. 76)

```
If computing bal(),  pmt2 = npmt

Let:          bal(0) = RND(PV)

Iterate from: m = 1 to pmt2
              { I_m    = RND[ RND12( -i × bal(m-1) ) ]
              { bal(m) = bal(m-1) - I_m + RND(PMT)

then:         bal()   = bal(pmt2)
              ΣPrn()  = bal(pmt2) - bal(pmt1)              <-- AS PRINTED, p. 76
              ΣInt()  = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()

where:        RND   = round to the number of decimal places selected
              RND12 = round to 12 decimal places
```

> Render note: the iteration prints as `l_m = RND[RND12(−i × bal(m − l))]` and
> `bal(m) = bal(m − l − l_m + RND(PMT)`. Three defects: `l` is the digit 1; `l_m` is `I_m`
> (capital I, interest for period `m`) — a lowercase-L/capital-I collision in this font; and the
> second line's parentheses are unbalanced (one `(` too many, no closing `)`). The only balanced
> reading consistent with the worked example is `bal(m) = bal(m-1) - I_m + RND(PMT)`.

**Discrepancy (confirmed).** `ΣPrn()` and `ΣInt()` cannot both be right under any single meaning
of `pmt1`. Take the amortization example (p. 40), first year, `P1=1`, `P2=9`, `PMT=-729.13`,
`bal(0)=120000`, `bal(9)=118928.63`; the calculator displays `PRN=-1071.37`, `INT=-5,490.80`.

- Reading `pmt1 = P1 = 1`: `ΣInt = (9-1+1) × -729.13 - ΣPrn` gives `-5,490.80` ✓, but
  `ΣPrn = bal(9) - bal(1) = -954.74` ✗.
- Reading `pmt1 = P1 - 1 = 0`: `ΣPrn = bal(9) - bal(0) = -1071.37` ✓, but
  `ΣInt = (9-0+1) × -729.13 + 1071.37 = -6,219.93` ✗.

Neither reading satisfies both. Corrected — `pmt1 = P1`, `pmt2 = P2`, with the offset moved
inside `ΣPrn`:

```
ΣPrn() = bal(pmt2) - bal(pmt1 - 1)                          <-- NORMATIVE
ΣInt() = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()              (as printed)
```

Verified against all three years of the p. 40 example (golden cases
`appendix-formulas-amort-*`). Year 2 (`P1=10`, `P2=21`): `ΣPrn = bal(21) - bal(9) =
117421.60 - 118928.63 = -1507.03` ✓ and `ΣInt = 12 × -729.13 + 1507.03 = -7242.53` ✓.

Sign convention: `I_m` is computed as `-i × bal(m-1)`, so for a loan (`PV > 0`) the interest
component is **negative** and is *subtracted* from the balance — two sign inversions that cancel
to a balance increase before `RND(PMT)` (itself negative) reduces it. `PRN` and `INT` therefore
both display negative for a standard loan.

The guidebook notes that balance, principal and interest depend on `PMT`, `PV`, `I/Y`, `pmt1`
and `pmt2` (p. 76) — `FV` is not in the list; `N` enters only through the `PMT` already solved.

### Cash Flow (p. 76)

```
                 N
NPV = CF_0  +   Σ   CF_j (1+i)^(-S_{j-1}) × [ (1 - (1+i)^(-n_j)) / i ]
                j=1

where:        ⎧  j
              ⎪  Σ  n_i      j ≥ 1
        S_j = ⎨ i=1
              ⎪
              ⎩  0           j = 0
```

> Render note: the discount exponent prints as `-S_j-1` with `j` subscripted and `-1` at
> full superscript size — literally `-(S_j) - 1`. That reading is wrong on two counts: it makes
> the `S_j = 0 for j = 0` case in the `where` clause unreachable (the summation starts at
> `j = 1`, so `S_0` is only referenced by an `S_{j-1}` exponent), and it does not reproduce the
> worked example. Read as `S_{j-1}`.

Settled by the NPV example (p. 48): `CF_0=-7000`, `C01=3000 F01=1`, `C02=4000 F02=1`,
`C03=5000 F03=4`, `I=20` → `NPV = 7,266.44`. With `S_{j-1}` the terms are `2500 + 2777.78 +
8988.66`, summing to `7,266.44` ✓. With `-S_j - 1` the first term alone is `1736.11` and no
total near `7,266.44` is reachable. Golden case `appendix-formulas-npv-discount-exponent`.

`NPV` depends on `CF_0`, the `CF_j`, each `n_j` and `i` (p. 76).

### IRR (p. 77)

```
IRR = 100 × i

where:  i satisfies npv() = 0
```

```
i = I/Y ÷ 100
```

`IRR` depends on `CF_0` and the `CF_j` (p. 77).

### Bonds (pp. 77-78)

Source cited by the guidebook for all bond formulas except duration: Lynch and Mayle,
*Standard Securities Calculation Methods*, Securities Industry Association, 1986 (p. 77).

**Price given yield, one coupon period or less to redemption** (p. 77):

```
        ⎡   RV + (100 × R)/M    ⎤     ⎡  A     100 × R ⎤
PRI =   ⎢  ------------------   ⎥  -  ⎢ --- ×  ------- ⎥
        ⎣  1 + (DSR/E) × (Y/M)  ⎦     ⎣  E        M    ⎦

where:  PRI = dollar price per $100 par value
        RV  = redemption value of the security per $100 par value
              (RV = par except where call or put features must be considered)
        R   = annual interest rate (as a decimal; CPN ÷ 100)
        M   = number of coupon periods per year standard for the particular
              security involved (set to 1 or 2 in the Bond worksheet)
        DSR = number of days from settlement date to redemption date
              (maturity date, call date, put date, etc.)
        E   = number of days in coupon period in which the settlement date falls
        Y   = annual yield (as a decimal) on investment with security held to
              redemption (YLD ÷ 100)
        A   = number of days from beginning of coupon period to settlement date
              (accrued days)
```

> Render note: the text layer renders `CPN ÷ 100` as `CPN_100` and `YLD ÷ 100` as `YLD 100`.
> The page image shows division in both. The `where` clause for `RV` is also truncated in the
> text layer; the image reads "RV except in those cases where call or put features must be
> considered", i.e. `RV` equals par unless a call/put applies.

**Yield given price, one coupon period or less to redemption** (p. 78):

```
        ⎡  ( RV/100 + R/M ) - ( PRI/100 + ( (A/E) × (R/M) ) )  ⎤     ⎡ M × E ⎤
Y =     ⎢  -------------------------------------------------   ⎥  ×  ⎢ ----- ⎥
        ⎣            PRI/100 + ( (A/E) × (R/M) )               ⎦     ⎣  DSR  ⎦
```

**Price given yield, more than one coupon period to redemption** (p. 78):

```
        ⎡        RV          ⎤     ⎡  N        100 × (R/M)      ⎤     ⎡        R     A ⎤
PRI =   ⎢ -----------------  ⎥  +  ⎢  Σ   -----------------     ⎥  -  ⎢ 100 × --- × ---⎥
        ⎣ (1 + Y/M)^(N-1+DSC/E) ⎦  ⎣ K=1  (1 + Y/M)^(K-1+DSC/E) ⎦     ⎣        M     E ⎦

where:  N   = number of coupons payable between settlement date and redemption
              date (maturity date, call date, put date, etc.). (If this number
              contains a fraction, raise it to the next whole number; for
              example, 2.4 = 3.)
        DSC = number of days from settlement date to next coupon date
        K   = summation counter
```

**Yield given price, more than one coupon period to redemption** (p. 78): no closed form. Found
by iterative search using the "price with more than one coupon to redemption" formula.

**Accrued interest, securities with standard coupons or interest at maturity** (p. 78):

```
AI = PAR × (R/M) × (A/E)

where:  AI  = accrued interest
        PAR = par value (principal amount to be paid at maturity)
```

Verified by the bond example (p. 53-54): `SDT=6-12-2006`, `CPN=7`, `RDT=12-31-2007`, `RV=100`,
30/360, `2/Y`, `YLD=8` → `AI = 3.15`. With `A = 162`, `E = 180`:
`100 × 0.035 × 0.9 = 3.15` ✓. Golden case `appendix-formulas-bond-accrued-interest`.

### Depreciation (pp. 78-79)

```
RDV = CST - SAL - accumulated depreciation
```

`DEP`, `RDV`, `CST` and `SAL` are rounded to the number of decimals selected for display
(p. 78).

**Straight-line** (p. 79):

```
DEP (normal year)   = (CST - SAL) / LIF
DEP (first year)    = ((CST - SAL) / LIF) × FSTYR
DEP (last year or more) = RDV
```

**Sum-of-the-years'-digits** (p. 79):

```
                        (LIF + 2 - YR - FSTYR) × (CST - SAL)
DEP (normal year)   =   ------------------------------------
                             (LIF × (LIF + 1)) ÷ 2

                        LIF × (CST - SAL)
DEP (first year)    =   ----------------- × FSTYR
                        (LIF × (LIF+1)) ÷ 2

DEP (last year or more) = RDV
```

> Render note: the normal-year numerator prints as `(LIF+2−YR−FSTYR)×(CST−SAL` — the closing
> parenthesis is missing. The denominator prints `((LIF×(LIF+1))÷2` — likewise one `)` short.
> Both are typesetting defects; the balanced reading is unambiguous.

**Declining-balance** (p. 79):

```
DEP (normal year)   = (RBV × DB%) / (LIF × 100)

where:  RBV is for YR - 1

DEP (first year)    = ((CST × DB%) / (LIF × 100)) × FSTYR

Unless; (CST × DB%) / (LIF × 100) > RDV ; then use RDV × FSTYR

If DEP > RDV, use DEP = RDV

If computing last year, DEP = RDV
```

### Statistics (p. 80)

Formulas apply to both `x` and `y` (p. 80).

**Standard deviation with `n` weighting (`σx`)**:

```
        ⎡  Σx² - (Σx)²/n  ⎤ ^(1/2)
σx =    ⎢  -------------  ⎥
        ⎣        n        ⎦
```

**Standard deviation with `n-1` weighting (`sx`)**:

```
        ⎡  Σx² - (Σx)²/n  ⎤ ^(1/2)
sx =    ⎢  -------------  ⎥
        ⎣       n - 1     ⎦
```

**Mean**:

```
x̄ = (Σx) / n
```

> Render note: this PDF flattens every superscript in the statistics block. `(Σx)2` is `(Σx)²`,
> and the trailing `1/2` set outside the bracket is the exponent `^(1/2)`, i.e. a square root —
> without it the quantity would be a variance, and the heading says standard deviation.

### Regressions (p. 80)

Formulas apply to all regression models using transformed data (p. 80).

```
      n(Σxy) - (Σy)(Σx)
b =   -----------------
       n(Σx²) - (Σx)²

      (Σy - b Σx)
a =   -----------
           n

      b × σx
r =   ------
        σy
```

> Render note: the `b` denominator prints `n(Σx2) − Σx)2` — a flattened `²` in both places and
> a dropped `(`. Read as `n(Σx²) - (Σx)²`. In `r`, the glyph rendered as `δ` is `σ`: the
> formula is `r = b·σx/σy`, the standard slope-to-correlation rescaling. `δx`/`δy` are not
> defined anywhere in the guidebook; `σx`/`σy` are defined immediately above on the same page.

### Interest Rate Conversions (p. 80)

```
EFF = 100 × ( e^( (C/Y) × ln(x+1) ) - 1 )

where:  x = .01 × NOM ÷ C/Y

NOM = 100 × C/Y × ( e^( (1 ÷ C/Y) × ln(x+1) ) - 1 )

where:  x = .01 × EFF
```

> Render note: this block is the worst-rendered on the page. As printed:
> `EFF = 100 × (eC/Y × In(x ÷ 1) − 1` and
> `NOM = 100 × C/Y × (e1 ÷ C/Y × IN(x + 1) − 1`. Three defects in each: the exponent of `e` is
> flattened to the baseline (so `e^(C/Y × ln(x+1))` reads as `eC/Y × ln(...)`); the closing
> parenthesis is dropped; and in the `EFF` line `ln(x+1)` renders as `In(x ÷ 1)` — the `+`
> becomes `÷` and the `l` becomes `I`. The `NOM` line one row down prints `(x + 1)` correctly,
> which shows the `÷` is a render artifact and not the source. `ln(x ÷ 1)` is also
> mathematically inert — it is just `ln(x)` — and would make `EFF` negative for any ordinary
> rate.

Settled by the interest-conversion example (p. 67): `NOM=15`, `C/Y=4` → `EFF=15.87`. With
`ln(x+1)`: `x = 0.0375`, `100 × (1.0375^4 - 1) = 15.865` → `15.87` ✓. With `ln(x ÷ 1)`:
`100 × (e^(4 × ln 0.0375) - 1) = -99.98`. Golden case
`appendix-formulas-eff-from-nom-plus-one`.

### Percent Change (pp. 80-81)

```
NEW = OLD × (1 + %CH/100)^#PD

where:  OLD = old value
        NEW = new value
        %CH = percent change
        #PD = number of periods
```

> Render note: `#PD` prints at full size on the baseline immediately after the closing
> parenthesis, as though it were a multiplier. It is the exponent. Multiplication would make
> the compound-interest use of this worksheet impossible.

Settled by the compound-interest example (p. 65): `OLD=500`, `NEW=750`, `#PD=5` → `%CH=8.45`.
As an exponent: `100 × ((750/500)^(1/5) - 1) = 8.447` → `8.45` ✓. As a multiplier the equation
would give `%CH = 10.00`. Golden case `appendix-formulas-pct-change-pd-is-exponent`.

### Profit Margin (p. 81)

```
                              SellingPrice - Cost
GrossProfitMargin  =  ------------------- × 100
                                SellingPrice
```

### Breakeven (p. 81)

```
PFT = PQ - (FC + VCQ)

where:  PFT = profit
        P   = price
        FC  = fixed cost
        VC  = variable cost
        Q   = quantity
```

`PQ` is `P × Q` and `VCQ` is `VC × Q`; juxtaposition denotes multiplication.

### Days between Dates — actual/actual (pp. 81-82)

Date range: January 1, 1980 through December 31, 2079 (p. 81). The method assumes the actual
number of days per month and per year (p. 81).

```
DBD (days between dates) = number of days II - number of days I

Number of Days I  = (Y1 - YB) × 365
                  + (number of days MB to M1)
                  + DT1
                  + (Y1 - YB)/4

Number of Days II = (Y2 - YB) × 365
                  + (number of days MB to M2)
                  + DT2
                  + (Y2 - YB)/4

where:  M1  = month of first date
        DT1 = day of first date
        Y1  = year of first date
        M2  = month of second date
        DT2 = day of second date
        Y2  = year of second date
        MB  = base month (January)
        DB  = base day (1)
        YB  = base year (first year after leap year)
```

> Render note: the text layer renders the multiplication sign as `Q` (`(Y1 -YB) Q 365`); the
> image shows `×`. The `(Y - YB)/4` leap-day term is dropped entirely from the text layer and
> is recoverable only from the image.

### Days between Dates — 30/360 (pp. 82-83)

Source cited: Lynch and Mayle, *Standard Securities Calculation Methods*, Securities Industry
Association, 1986 (p. 82). The method assumes 30 days per month and 360 days per year (p. 82).

```
DBD = (Y2 - Y1) × 360 + (M2 - M1) × 30 + (DT2 - DT1)

where:  M1  = month of first date
        DT1 = day of first date
        Y1  = year of first date
        M2  = month of second date
        DT2 = day of second date
        Y2  = year of second date
```

> Render note: printed `+ (DT2 − DT1` — closing parenthesis dropped.

Day-of-month adjustments, applied in this order. Page 82 gives rules 3 and 4 only; rules 1 and 2
come from the scanned insert on p. 83, which supplies the `Note:` left empty on p. 82:

1. If `DT2` is the last day of February and `DT1` is the last day of February, change `DT2` to 30.
2. If `DT1` is the last day of February, change `DT1` to 30.
3. If `DT2` is 31 and `DT1` is 30 or 31, change `DT2` to 30.
4. If `DT1` is 31, change `DT1` to 30.

Page 82's wording of rules 3-4 matches p. 83's exactly, so the two sources are consistent; p. 83
is strictly more complete. Additional conventions from p. 83: a year always has 360 days; days
per period is `360 ÷ number of periods` (monthly → 30); remaining days in a period is the total
days in the period less days accrued.

---

## Key sequences

The appendix defines no keys. These sequences are the ones that exercise the formulas above and
are reproduced from the worked examples that arbitrate the printed forms. Full keystroke lists
are in `tests/golden/appendix-formulas.json`.

**TVM `PMT` — settles the missing minus sign** (p. 39):

```
2ND  RESET  ENTER          -> RST 0.00
2ND  P/Y  12  ENTER        -> P/Y= 12.00
2ND  QUIT                  -> 0.00
30  2ND  xP/Y  N           -> N= 360.00
6.125  I/Y                 -> I/Y= 6.13
120000  PV                 -> PV= 120,000.00
CPT  PMT                   -> PMT= -729.13
```

**Amortization `ΣPrn`/`ΣInt` — settles the `pmt1` offset** (p. 40, continues the above):

```
2ND  AMORT                 -> P1= (current)
1  ENTER                   -> P1= 1.00
DOWN  9  ENTER             -> P2= 9.00
DOWN                       -> BAL= 118,928.63
DOWN                       -> PRN= -1071.37
DOWN                       -> INT= -5,490.80
```

**NPV — settles the `S_{j-1}` exponent** (pp. 47-48):

```
CF  7000  +|-  ENTER       -> CFo= -7,000.00
DOWN  3000  ENTER  DOWN    -> C01= 3,000.00 / F01= 1.00
DOWN  4000  ENTER  DOWN  1  ENTER   -> C02= 4,000.00 / F02= 1.00
DOWN  5000  ENTER  DOWN  4  ENTER   -> C03= 5,000.00 / F03= 4.00
NPV  20  ENTER             -> I= 20.00
DOWN  CPT                  -> NPV= 7,266.44
IRR  CPT                   -> IRR= 52.71
```

**Interest conversion — settles `ln(x+1)`** (p. 67):

```
2ND  ICONV                 -> NOM= (current)
15  ENTER                  -> NOM= 15.00
DOWN  DOWN  4  ENTER       -> C/Y= 4.00
UP  CPT                    -> EFF= 15.87
```

**Percent change — settles `#PD` as exponent** (p. 65):

```
2ND  DELTA%                -> OLD= (current)
500  ENTER                 -> OLD= 500.00
DOWN  750  ENTER           -> NEW= 750.00
DOWN  DOWN  5  ENTER       -> #PD= 5.00
UP  CPT                    -> %CH= 8.45
```

---

## Clearing/reset

The appendix chapter itself holds no state, so nothing here can be cleared. What the clearing
keys do to the *inputs* of these formulas:

- **CLR TVM** (`2ND CLR TVM`) — zeroes `N`, `I/Y`, `PV`, `PMT`, `FV`. Does **not** touch `P/Y`
  or `C/Y`, so the `y = C/Y ÷ P/Y` and `x = (.01 × I/Y) ÷ C/Y` conversions on p. 74 keep running
  against whatever period settings are in force. Does not change END/BGN, so `k` and therefore
  `G_i` (p. 75) survive. Does not affect the display decimal setting, so the amortization
  `RND` operator (p. 76) is unchanged.
- **CLR WORK** (`2ND CLR WORK`) — scoped to the worksheet currently displayed. In Amortization
  it resets `P1`/`P2`, which are the `pmt1`/`pmt2` of the p. 76 formulas, but leaves the TVM
  variables the schedule is simulated from — so a cleared Amortization worksheet still
  reproduces the same schedule. In Cash Flow it clears `CF_0`, the `CF_j` and the `n_j`. In
  Bond, Depreciation, Statistics, Interest Conversion, Percent Change, Date, Profit Margin and
  Breakeven it clears that worksheet's variables to the defaults listed in each sibling spec.
- **QUIT** (`2ND QUIT`) — leaves worksheet mode for the standard calculator. Purely
  navigational; no formula input changes. Values entered before QUIT remain, which is what lets
  the p. 39 example set `P/Y`, QUIT, and then key `N`/`I/Y`/`PV` against it.
- **RESET** (`2ND RESET ENTER`) — restores every default across the machine: `P/Y = C/Y = 12`,
  END mode, `DEC = 2`, CHN, `RV = 100`, `M = 2` (2/Y), depreciation `SL` with `DB% = 200`,
  `M01 = 1`, `YR = 1`, `LIF = 1`, dates `12-31-1990`, `F0n = 1`, LIN, `#PD = 1`, and all
  worksheet values to zero. Because `DEC` is reset to 2, RESET also silently changes the `RND`
  behaviour in amortization (p. 76) and the depreciation rounding (p. 78).

Nothing on pp. 74-83 is affected by any of these keys — the formulas are fixed.

---

## Errors

The appendix formulas are the mechanism behind most of the conditions in the error table
(p. 84). Mapped to the section that raises them:

**Error 1 (Overflow)**
- Any result outside ±9.9999999999999E99. Reachable from TVM `FV` at large `N` and `i`, from the
  `(1+i)^N` factor in `PMT`/`PV`/`FV` (p. 75), and from `(1+Y/M)^(N-1+DSC/E)` in bond price
  (p. 78).
- Division by zero, including internally. The `i = 0` branches of `N`, `PMT`, `PV` and `FV`
  (p. 75) exist precisely to avoid this in the `/i` terms; the NPV annuity factor
  `(1-(1+i)^-n_j)/i` (p. 76) has no published `i = 0` branch — see
  [Edge cases](#edge-cases--ambiguities).
- Statistics: a data set in which all `X` or all `Y` values are identical. In the regression
  formulas (p. 80) this zeroes `n(Σx²) - (Σx)²`, the denominator of `b`; in `r = b·σx/σy` it
  zeroes `σy`.

**Error 2 (Invalid argument)**
- `ln` of a non-positive argument. Reachable in `N` (p. 75) when the ratio inside the logarithm
  is ≤ 0, and in both interest-conversion formulas (p. 80) when `x + 1 ≤ 0`, i.e. a rate at or
  below -100%.
- `y^x` with `y < 0` and `x` neither an integer nor the reciprocal of one. Reachable in the
  `PMT = 0` rate form `i = (-FV ÷ PV)^(1÷N)` (p. 74) when `-FV ÷ PV` is negative — that is,
  when `PV` and `FV` share a sign — with non-integer `N`.
- Amortization: `P2 < P1`. The p. 76 loop runs `m = 1 to pmt2` and `ΣInt` uses
  `(pmt2 - pmt1 + 1)` as a payment count, which is meaningless when negative.
- Depreciation: `SAL > CST`. Makes `CST - SAL` negative, so every method on p. 79 would return a
  negative charge and `RDV` (p. 78) would start below zero.

**Error 3 (Too many pending operations)** — an AOS/parenthesis limit (more than 15 active levels
of parentheses, or more than 8 pending operations). Not raised by any formula in this section;
the appendix formulas are evaluated internally, not through the pending-operation stack.

**Error 4 (Out of range)**
- Amortization: `P1` or `P2` outside 1-9,999 — the domain of `pmt1`/`pmt2` (p. 76).
- TVM: `P/Y` or `C/Y` ≤ 0. Both are divisors in the p. 74 rate conversions.
- Cash Flow: an `Fnn` value outside 0.5-9,999 — the domain of `n_j` (p. 76).
- Bond: `RV`, `CPN` or `PRI` ≤ 0 (p. 84). `RV` and `R = CPN ÷ 100` are numerators in the price
  formulas (p. 77-78); `PRI/100` sits in the denominator of the short-maturity yield formula
  (p. 78).
- Date: a computed date outside January 1, 1980 - December 31, 2079 — the range p. 81 states for
  the actual/actual method, and the range within which the `(Y - YB)/4` leap term (p. 82) is
  valid.
- Depreciation: declining-balance percent ≤ 0; `LIF` ≤ 0; `YR` ≤ 0; `CST < 0`; `SAL < 0`; or
  `M01` outside `1 ≤ M01 < 13`. `LIF` is a divisor in every p. 79 method; `M01` feeds `FSTYR`.
- Interest Conversion: `C/Y` ≤ 0 — a divisor in both p. 80 formulas.
- `DEC` outside 0-9. Relevant here because `DEC` parameterises the `RND` operator (p. 76) and
  the depreciation rounding (p. 78).

**Error 5 (No solution exists)**
- TVM: `I/Y` requested when `FV`, `N × PMT` and `PV` all carry the same sign. The p. 74 balance
  equation then has no sign change and the iterative search cannot bracket a root. The
  guidebook's note — make inflows positive and outflows negative — is the cash-flow sign
  convention the formulas assume throughout.
- TVM, Cash Flow and Bond: an `ln` input that is not > 0 arising during a calculation.
- Cash Flow: `IRR` requested with no sign change in the cash-flow list. `npv() = 0` (p. 77) has
  no real root when every cash flow points the same way.

**Errors 6, 7, 8** — not raised by this section (invalid date, exceeded iteration limit in
contexts outside these formulas, and reserved conditions respectively; see
`docs/spec/errors-accuracy-aos.md`).

---

## Edge cases & ambiguities

**`FSTYR` is used but never defined.** All three depreciation methods on p. 79 scale the first
year by `FSTYR`, and the term appears nowhere else in the guidebook — not in the p. 79 `where`
clause, not in the Depreciation worksheet chapter. It must be reconstructed from a worked
example. The straight-line example (p. 58) gives `LIF=31.5`, `M01=3.5`, `CST=1,000,000`,
`SAL=0`, `YR=1` → `DEP=25,132.28`. Since `(CST-SAL)/LIF = 31,746.03`, `FSTYR = 25,132.28 /
31,746.03 = 0.791667 = 9.5/12`. That is `(13 - M01)/12`. Recommended reading: `FSTYR` is the
fraction of the first year remaining from `M01`, `FSTYR = (13 - M01)/12`, with `M01`'s
fractional part encoding the day within the month. Verified by golden case
`appendix-formulas-depreciation-fstyr`. Flagged as an open question — one example cannot
distinguish `(13 - M01)/12` from other formulas agreeing at `M01 = 3.5`.

**Lowercase-L / digit-1 / capital-I collisions.** The maths font on pp. 75-76 renders `1` with a
serif indistinguishable from `l`, and `I` similarly. Confirmed instances: `k = l` (p. 75),
`ln(l+i)` (p. 75), `(l+i)^N` in `FV` (p. 75), `FV × 1` in `N` (p. 75), and `l_m` / `bal(m − l)`
throughout the amortization loop (p. 76). Every one is resolvable from context, but an
implementer working from OCR rather than the images will get them wrong.

**No `i = 0` branch is published for NPV.** The annuity factor `(1-(1+i)^-n_j)/i` (p. 76)
divides by `i`, and unlike the TVM formulas p. 76 gives no zero-rate alternative. At `I = 0` the
limit is `n_j`, making `NPV` the plain undiscounted sum. Whether the calculator special-cases
this or raises Error 1 is not stated and no worked example covers `I = 0`. Open question.

**Amortization is display-dependent.** `RND` is defined against the user's decimal setting
(p. 76), so an amortization schedule computed at `DEC = 2` differs from the same loan at
`DEC = 9`. All published amortization figures assume the default `DEC = 2`. Any golden test for
this section must pin the decimal setting; a parity implementation must thread the display
setting into the amortization core rather than treating it as a formatting concern.

**Depreciation is display-dependent too.** `DEP`, `RDV`, `CST` and `SAL` are rounded to the
displayed decimals (p. 78) — but the guidebook does not say *where* in the computation the
rounding lands. For declining balance the charge for year `n` is a function of `RBV` at
`YR-1` (p. 79), so if `RBV` is rounded before being reused the errors compound across the
schedule, and if it is not, they do not. The p. 58 example's second-year `RBV` of `943,121.69`
is consistent with both readings at `DEC = 2` and does not settle it. Open question.

**`RND12` is specified only for amortization.** The double rounding
`RND[RND12(-i × bal(m-1))]` (p. 76) is unique to the amortization loop. Why an intermediate
12-place rounding is needed before the display rounding is not explained, and no other section
mentions `RND12`. It is presumably a guard against the underlying 13-digit internal precision
leaking into the schedule, but the guidebook does not say so.

**`pmt1` is overloaded.** As shown in [Formulas](#formulas), p. 76 uses `pmt1` with one meaning
in `ΣPrn()` and another in `ΣInt()`. The document never defines `pmt1` explicitly — it is only
related to `P1` through the closing note. The normative reading (`pmt1 = P1`, with `ΣPrn()`
reaching back to `bal(pmt1 - 1)`) is settled by three independent years of the p. 40 example,
but it is a correction to the printed text, not a transcription of it.

**`bal()` with no argument and `npmt`.** P. 76 opens with `If computing bal(), pmt2 = npmt`.
`npmt` is not defined on the page or elsewhere in the guidebook. Read: when a bare balance is
requested rather than a range, the loop's upper limit is the payment number at which the
balance is wanted. Open question — the exact binding of `npmt` to a user-visible variable is
unstated.

**Bond `N` rounds up, always.** P. 78 says a fractional coupon count is raised to the next whole
number, with 2.4 → 3. This is a ceiling, not a round-half-up: 2.1 also becomes 3. The example
given happens to round the same way under either rule, so the wording ("raise it to the next
whole number") is the only evidence — but it is unambiguous.

**The 30/360 February rules exist only on the scanned insert.** P. 82's final `Note:` is empty
in both the text layer and the rendered page — the content sits on p. 83, a scanned page from a
different source document typeset in a different font. Without p. 83, rules 1 and 2 (the
last-day-of-February cases) are unrecoverable and any 30/360 date spanning end-of-February
would be wrong. Rule ordering is inferred, not stated: rule 1 must precede rule 2 because rule 1
tests `DT1` before rule 2 rewrites it. No worked example exercises a February boundary. Open
question.

**Actual/actual leap arithmetic is unspecified as to truncation.** The `(Y1 - YB)/4` term
(p. 82) is written as an ordinary fraction, but it counts leap days and must be an integer. The
guidebook does not say whether it floors. Since both `Number of Days I` and `Number of Days II`
carry the same term and `DBD` is their difference, truncation cancels except across a leap-day
boundary — where it decides the answer. Read as a floor. `YB` is defined as "first year after
leap year" (p. 82) rather than as a specific number, which leaves the concrete base year
unstated; the 1980-2079 range (p. 81) contains no century non-leap exception, so any year
`≡ 1 (mod 4)` in range works. Open question.

**The bond example's prose year contradicts its keystrokes.** The p. 53 narrative says the bond
settles June 12, 2004, but the keystroke column enters `6.1206` and the display shows
`SDT= 6-12-2006`; redemption is keyed `12.3107` → `12-31-2007`. The displayed values are
self-consistent and reproduce the published `PRI= 98.56` and `AI= 3.15`. The prose is a
guidebook typo. Recorded here because it is the same class of defect as the formula errors —
the displayed result wins.

**Both `i` symbols on p. 76.** The NPV `where` clause defines `S_j = Σ_{i=1}^{j} n_i`, using `i`
as a summation index — while `i` is simultaneously the interest rate in the formula directly
above it. The two are unrelated. An implementer reading only the `where` clause could bind the
wrong one.

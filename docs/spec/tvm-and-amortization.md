# TVM and Amortization Worksheets

> Source: official BA II Plus guidebook, pages 24-41. Behaviour described in original wording.
> Supporting internal equations recovered from the Formulas appendix, pages 74-76 (those pages are
> rendered as vector art and are absent from the text layer). Error table recovered from pages 84–85.

The TVM variables model a stream of **equal, regularly spaced** cash flows that are uniformly
inflows or uniformly outflows — annuities, loans, mortgages, leases, savings (p. 24). Unequal cash
flows belong to the Cash Flow worksheet instead (p. 24). The Amortization worksheet is a consumer
of whatever the TVM variables currently hold: it does not own its own rate or payment (p. 24).

---

## Variables

### TVM variables (reachable directly from standard-calculator mode)

| Name | Label | Key | Default | Type | Valid range |
|---|---|---|---|---|---|
| Number of periods | `N` | `N` | 0 | entered / computed | display range; not restricted to integers |
| Interest rate per year | `I/Y` | `I/Y` | 0 | entered / computed | nominal annual %, see note below |
| Present value | `PV` | `PV` | 0 | entered / computed | signed (see sign convention) |
| Payment | `PMT` | `PMT` | 0 | entered / computed | signed (see sign convention) |
| Future value | `FV` | `FV` | 0 | entered / computed | signed (see sign convention) |
| Payments per year | `P/Y` | `2ND` `P/Y` | 1 | entered only | must be > 0 — Error 4 otherwise (p. 84) |
| Compounding periods per year | `C/Y` | `2ND` `P/Y` then `↓` | 1 | entered only | must be > 0 — Error 4 otherwise (p. 84) |
| Payment timing | `END` / `BGN` | `2ND` `BGN` `2ND` `SET` | `END` | setting | two-state toggle |

Defaults table transcribed from p. 25.

`I/Y` is always keyed as a **nominal annual** rate. The worksheet derives the per-period rate itself
from `P/Y` and `C/Y` (p. 26); you never enter a periodic rate unless you have deliberately set
`P/Y = C/Y = 1` (which is what the lease example on p. 35 does).

### Amortization variables (prompted worksheet, `2ND` `AMORT`)

| Name | Label | Default | Type | Valid range |
|---|---|---|---|---|
| Starting payment | `P1` | 1 | entered only | integer 1–9,999 — Error 4 outside (p. 84) |
| Ending payment | `P2` | 1 | entered only | integer 1–9,999 — Error 4 outside (p. 84) |
| Balance after `P2` | `BAL` | 0 | auto-compute | — |
| Principal over `P1`…`P2` | `PRN` | 0 | auto-compute | — |
| Interest over `P1`…`P2` | `INT` | 0 | auto-compute | — |

`BAL`, `PRN`, and `INT` are recomputed on display; they cannot be keyed into. The worksheet's field
order is cyclic: `P1 → P2 → BAL → PRN → INT → P1 …` (pp. 27–28).

---

## Behaviour

### Assigning and recalling (p. 27)

Key a number, then press the variable's key to store it. `RCL` followed by a TVM key reads a stored
value back. The five core TVM variables are reachable from **either** standard-calculator mode or
from inside a worksheet, but what you see differs (p. 27):

- **Standard-calculator mode** — the label, an `=` sign, and the value are shown.
- **Worksheet mode** — only the value appears; whatever label was already on screen stays put. The
  absence of the `=` indicator is the cue that the number on screen does not belong to the label on
  screen (p. 27). This is a genuine display trap worth reproducing faithfully.

`CPT` followed by a variable key solves for that variable, and it only does so in
standard-calculator mode (p. 27).

### Values persist (p. 25)

Nothing is cleared between problems. The guidebook leans on this deliberately: the quarterly-payment
example on p. 29 re-uses the `I/Y` and `PV` left behind by the monthly-payment example above it and
only re-enters `P/Y` and `N`. An implementation must carry state across problems identically.

### The unused fifth variable (p. 26)

Every solve uses all five variables. For a four-variable problem you must key `0` into the one you
are not using — e.g. `0` `PMT` for a lump-sum PV/FV problem. The calculator will not infer it.

### Sign convention (pp. 26–27)

Money received is positive; money paid out is negative. This applies symmetrically to entry and to
results: computed inflows come back positive, computed outflows come back negative (p. 27). `+/-`
negates after the digits are keyed (p. 26). Every `CPT PMT` in this page range returns a negative
number because every one of them is a payment the user makes.

### END vs BGN (p. 26)

`END` models an ordinary annuity — payment at the close of each period; the guidebook notes this
covers most loans. `BGN` models an annuity due — payment at the open of each period; typical of
leases. Only `BGN` lights an indicator; `END` shows nothing (p. 26). The toggle is a two-keystroke
affair: `2ND` `BGN` opens the setting, `2ND` `SET` flips it (p. 25).

### `P/Y` drags `C/Y` with it (p. 26)

Entering `P/Y` silently writes the same number into `C/Y`. `C/Y` can then be overridden, but only
afterwards — order matters. The p. 39 deposit example depends on exactly this: it sets `P/Y = 12`
and *then* walks down to set `C/Y = 4`, and the guidebook flags the trap explicitly (p. 38).

### `xP/Y` payment multiplier (p. 27)

`2ND` `xP/Y` multiplies the displayed number by the stored `P/Y`, turning years into periods. It
writes to the display only — press `N` afterwards to commit. `30` `2ND` `xP/Y` `N` with `P/Y = 12`
gives `N = 360`. It is also usable inside the Amortization worksheet to fill `P2`: p. 41 keys
`5` `2ND` `xP/Y` `ENTER` to mean "sixty months".

### Generating a schedule manually (pp. 27–28)

`2ND` `AMORT`, key `P1`, `ENTER`, `↓`, key `P2`, `ENTER`, then `↓` repeatedly to read `BAL` (balance
remaining after payment `P2`), `PRN` (principal over the range), and `INT` (interest over the range).
From `INT`, one more `↓` wraps back to `P1` for the next range (p. 28).

### Generating a schedule automatically (p. 28)

With `P1` on screen, `CPT` advances **both** `P1` and `P2` to the next window, preserving the window
*width*: a range of 1–12 becomes 13–24 (p. 28). The p. 40 example advances 10–21 to 22–33, holding
the 12-period width. Two documented paths (p. 28):

- `CPT` on `P1` → `P2` is recomputed for you, and you may still overwrite it.
- `CPT` on `P2` (without having pressed `CPT` on `P1`) → both are entered for the next range.

### `BAL` and `FV` legitimately disagree (p. 26)

This is the single most important compatibility detail in the section, and it is not a rounding bug
to be smoothed away:

- `BAL`, `PRN`, `INT` are computed from `PMT` **rounded to the current decimal setting**.
- `FV` is computed from the **unrounded** `PMT`.

So `BAL` after *n* payments and `FV` after the same *n* payments will differ. Both are correct.

### Display rounding is cosmetic, storage is not

Entered values keep full internal precision regardless of the 2-decimal display. Two examples in
range prove it, and both are load-bearing golden tests:

- p. 39 keys `6.125` `I/Y`; the display reads `6.13`. The stored 6.125 yields `PMT = -729.13`.
  Had 6.13 actually been stored, `PMT` would be `-729.52`.
- p. 35 keys `22 ÷ 12 =` `I/Y`; the display reads `1.83`. The stored 1.8333… yields `PV = 40,573.18`.
  Had 1.83 been stored, `PV` would be `40,601.33`.

### Display indicators (p. 23, applies throughout this section)

A small marker confirms whether the shown value was **entered** into the worksheet or **computed**
by it. Both markers vanish when a subsequent change invalidates the value. The guidebook's example
tables render these as `◁` (entered) and `*` or `→` (computed) — the two computed glyphs are a
typesetting inconsistency in the source, not two different states. Golden tests record the numeric
string only.

---

## Formulas

Transcribed exactly as rendered on pp. 74–76. **Read the sign-convention warnings below the
equations — three of them are wrong as printed.**

### Periodic rate from the nominal rate (p. 74)

```
i = [ e^(y × ln(x+1)) ] - 1

where:  PMT = 0
        y = C/Y ÷ P/Y
        x = (.01 × I/Y) ÷ C/Y
        C/Y = compounding periods per year
        P/Y = payment periods per year
        I/Y = interest rate per year
```

Algebraically this is the standard nominal-to-per-payment-period conversion:
`i = (1 + (I/Y/100)/C/Y)^(C/Y ÷ P/Y) - 1`. When `P/Y = C/Y` it collapses to `i = (I/Y/100)/C/Y`.

Rate when there is no payment stream (p. 74):

```
i = (-FV ÷ PV)^(1÷N) - 1

where:  PMT = 0
```

### Annuity-due multiplier (p. 75)

```
Gi = 1 + i × k

where:  k = 0 for end-of-period payments
        k = 1 for beginning-of-period payments
```

> The rendered source prints `k = l` (lowercase L) for the BGN case. It is the digit `1`; the
> guidebook's math font substitutes `l` for `1` throughout this appendix.

### The iteration used to compute `i` (p. 74)

```
0 = PV + PMT × Gi × [ (1 - (1+i)^-N) / i ] + FV × (1 + i)^-N
```

This is the master balance equation; every other TVM formula is a rearrangement of it. Note it is
stated with the **correct** signs, which is what makes the `PMT` defect below detectable.

### `I/Y` from `i` (p. 74)

```
I/Y = 100 × C/Y × [ e^(y × ln(x+1)) - 1 ]

where:  x = i
        y = P/Y ÷ C/Y
```

### `N` (p. 75)

```
        ln( (PMT × Gi - FV × 1) / (PMT × Gi + PV × i) )
N =     -----------------------------------------------          where: i ≠ 0
                        ln(1 + i)

N = -(PV + FV) ÷ PMT                                             where: i = 0
```

> **DISCREPANCY — printed `FV × 1` must be `FV × i`.** Verified against the p. 39 deposit example
> (`P/Y=12`, `C/Y=4`, `BGN`, `I/Y=0.5`, `FV=25000`, `PV=0`, `PMT=-203.129…`, true `N=120`):
> as printed the formula returns **11576.35**; with `FV × i` it returns **120.000000**.
> Implement `FV × i`.

### `PMT` (p. 75)

```
PMT = (i / Gi) × [ PV + (PV + FV) / ((1+i)^N - 1) ]              where: i ≠ 0   <-- SIGN ERROR

PMT = -(PV + FV) ÷ N                                             where: i = 0
```

> **DISCREPANCY — the `i ≠ 0` form is missing its leading minus sign.** Verified against the p. 39
> mortgage example (`N=360`, `I/Y=6.125`, `PV=120000`, `FV=0`, `P/Y=C/Y=12`, `END`): the formula as
> printed evaluates to **+729.132647**, i.e. it displays `729.13`; the calculator displays
> **`-729.13`**. Implement:
> ```
> PMT = -(i / Gi) × [ PV + (PV + FV) / ((1+i)^N - 1) ]
> ```
> The magnitude as printed is correct — only the sign is wrong. (A commonly repeated claim that the
> printed formula yields `+729.14` does not reproduce; the value is `729.1326…`, which rounds to
> `729.13`. The defect is the sign alone.) The adjacent `i = 0` form *does* carry its minus sign,
> which is what makes the omission an evident typo rather than a different convention.

### `PV` (p. 75)

```
PV = [ (PMT × Gi)/i - FV ] × 1/(1+i)^N - (PMT × Gi)/i           where: i ≠ 0

PV = -(FV + PMT × N)                                             where: i = 0
```

Verified correct as printed: p. 31 ordinary annuity (`N=10`, `i=0.10`, `PMT=-20000`, `FV=0`,
`Gi=1`) → `122,891.34`, matching the displayed result.

### `FV` (p. 75)

```
FV = (PMT × Gi)/i - (1+i)^N × ( PV + (PMT × G)/i )              where: i ≠ 0

FV = -(PV + PMT × N)                                             where: i = 0
```

Verified correct as printed: p. 30 savings (`N=20`, `i=0.005`, `PV=-5000`, `PMT=0`) → `5,524.48`.

> Two rendering artifacts, not maths errors: the source prints `(l+i)^N` (letter L for the digit 1),
> and writes `G` rather than `Gi` in the final parenthesis. Both denote `Gi`.

### Amortization (p. 76)

```
If computing   bal(), pmt2 = npmt

Let:           bal(0) = RND(PV)

Iterate from:  m = 1 to pmt2
                 { I_m    = RND[ RND12( -i × bal(m-1) ) ]
                 { bal(m) = bal(m-1) - I_m + RND(PMT)

then:          bal()   = bal(pmt2)
               ΣPrn()  = bal(pmt2) - bal(pmt1)                   <-- OFF-BY-ONE
               ΣInt()  = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()

where:         RND   = round the display to the number of decimal places selected
               RND12 = round to 12 decimal places
```

> **DISCREPANCY — `ΣPrn()` is off by one period.** The printed `bal(pmt2) - bal(pmt1)` reproduces
> **none** of the guidebook's own amortization results. It must be `bal(pmt2) - bal(pmt1 - 1)`:
> principal must be measured from the balance standing *before* payment `pmt1`, not after it.
> Verified against the p. 40 schedule (`PV=120000`, `I/Y=6.125`, `P/Y=12`, `PMT=-729.132647`):
>
> | Range | printed `ΣPrn` | corrected `ΣPrn` | guidebook `PRN` |
> |---|---|---|---|
> | 1–9 | -954.74 | **-1,071.37** | -1,071.37 |
> | 10–21 | -1,384.93 | **-1,507.03** | -1,507.03 |
> | 22–33 | -1,472.19 | **-1,601.98** | -1,601.98 |
>
> The corrected form reproduces every `BAL`, `PRN`, and `INT` on pp. 40–41 to the cent.

> Rendering artifacts in this block: the source prints the interest term's subscript as `l_m`
> (letter L) — it is `I_m`, the interest for period `m`. The `bal(m)` line is rendered with an
> unbalanced parenthesis (`bal(m - l - l_m + RND(PMT)`); the intended reading, confirmed by
> numerical agreement with every worked example, is `bal(m) = bal(m-1) - I_m + RND(PMT)`.
> The `where:` note contains two source typos: "diplay" and "number or decimal places".

**Implementation notes that fall out of this formula, all confirmed numerically:**

1. `RND(PMT)` — the *rounded* payment drives the whole iteration. This is the mechanism behind the
   documented `BAL`/`FV` divergence (p. 26).
2. `bal(0) = RND(PV)` — the opening balance is rounded too.
3. The running balance carries **exactly two decimals every period**. Note this falls out of the
   formula rather than needing a separate rounding step: `bal(0) = RND(PV)`, `I_m` is `RND`-ed
   inside the loop, and `RND(PMT)` is already at display precision, so `bal(m)` is *inherently* at
   display precision — the explicit re-rounding of `bal(m)` is a no-op given the other three.
   The load-bearing detail is therefore the **outer `RND` on `I_m`**. Dropping it (keeping only
   `RND12`) and letting the balance carry sub-cent precision gives `118,928.64` / `117,421.62` /
   `115,819.66` against the guidebook's `118,928.63` / `117,421.60` / `115,819.62` — i.e. it fails
   the *first* range too, not just the later ones. Equivalently, an implementation may keep the
   unrounded `PMT` **if** it rounds `bal(m)` explicitly each period; that route also reproduces all
   three ranges, because rounding a 2-decimal balance minus the unrounded `PMT` recovers
   `RND(PMT)`.
4. `I_m` is **negative** for a normal loan (`-i × bal` with `bal > 0`), so `INT` displays negative,
   consistent with the payment sign convention.
5. Iteration always starts at `m = 1`, never at `pmt1` — you must walk the balance forward from the
   origin to reach `bal(pmt1 - 1)`.

### Perpetual annuities (p. 33)

Because `(1 + I/Y/100)^-N` tends to zero as `N` grows, the annuity present-value equations reduce to
(transcribed exactly as rendered):

```
Perpetual ordinary annuity:

              PMT
PV =  ---------------------
        (I/Y) ÷ 100


Perpetual annuity due:

                     PMT
PV =  PMT  +  ---------------------
                  (I/Y) / 100
```

> The two are printed with different division glyphs (`÷` vs `/`) purely as typesetting; they mean
> the same operation. Both are used with `PMT` **positive** here — the p. 32 worked example computes
> `110 ÷ 15 % =` → `733.33`, i.e. a positive price, which is the opposite of the TVM worksheet's
> outflow-negative convention. These formulas are pencil-and-paper aids, not worksheet behaviour;
> the p. 32 example is executed on the arithmetic keys, never touching `PV`/`PMT`.

---

## Key sequences

### Set payments per year

```
2ND  P/Y  <value>  ENTER  2ND  QUIT
```

### Set compounding periods per year (must follow P/Y, never precede it)

```
2ND  P/Y  <p/y>  ENTER  ↓  <c/y>  ENTER  2ND  QUIT
```

### Toggle to beginning-of-period payments

```
2ND  BGN  2ND  SET  2ND  QUIT
```

### Years → periods, then commit to N

```
<years>  2ND  xP/Y  N
```

### Enter a TVM value / an outflow

```
<value>  N | I/Y | PV | PMT | FV
<value>  +/-  PV | PMT | FV
```

### Recall / compute

```
RCL  <tvm key>
CPT  <tvm key>
```

### Amortization, manual range

```
2ND  AMORT  <p1>  ENTER  ↓  <p2>  ENTER  ↓ (BAL)  ↓ (PRN)  ↓ (INT)  ↓ (wraps to P1)
```

### Amortization, auto-advance to next range

```
(from INT)  ↓  CPT   -> P1 and P2 both advance, window width preserved
            ↓        -> P2
            ↓ ↓ ↓    -> BAL, PRN, INT
```

---

## Clearing / reset

| Action | Keys | Effect | Explicitly does NOT touch |
|---|---|---|---|
| Full reset | `2ND` `RESET` `ENTER` | All variables and formats to defaults; display shows `RST` then `0.00`. Sets `N=I/Y=PV=PMT=FV=0`, `P/Y=C/Y=1`, `END`, `P1=P2=1`, `BAL=PRN=INT=0` (p. 25) | — (this is the global reset) |
| Clear TVM only | `2ND` `CLR TVM` | Resets `N`, `I/Y`, `PV`, `PMT`, `FV` to 0 (p. 25) | `P/Y`, `C/Y`, `END`/`BGN`, `P1`, `P2`, decimal format, memories |
| Reset `P/Y` and `C/Y` | `2ND` `P/Y` `2ND` `CLR WORK` | Both back to 1 (p. 25) | the five TVM variables, `END`/`BGN`, amortization variables |
| Reset amortization | `2ND` `CLR WORK` **while in the Amortization worksheet** | `P1=1`, `P2=1`, `BAL=PRN=INT=0` (p. 26) | all five TVM variables, `P/Y`, `C/Y`, `END`/`BGN` |
| Reset `END`/`BGN` | `2ND` `BGN` `2ND` `CLR WORK` | Back to `END` (p. 26) | everything else |
| `QUIT` | `2ND` `QUIT` | Leaves the worksheet for standard-calculator mode | **nothing is cleared** — `QUIT` is navigation only |

Two traps worth calling out:

- `CLR WORK` is **context-sensitive**. The same keystrokes reset `P/Y`/`C/Y`, the amortization
  variables, or `END`/`BGN` depending on which prompted worksheet you are standing in. The prefix
  (`2ND P/Y` vs `2ND AMORT` vs `2ND BGN`) is what selects the target.
- `CLR TVM` does **not** touch `P/Y` or `C/Y`. A user who clears TVM and expects a monthly
  calculation to revert to annual will be wrong. Conversely, `2ND RESET ENTER` *does* reset `P/Y`
  to 1, which is why every example that needs `P/Y = 12` re-enters it immediately after resetting.

---

## Errors

Transcribed from the error table on pp. 84–85 (Errors 1–5 are on p. 84; Errors 6–8 on p. 85). Press
`CE/C` to clear an error message.

| Error | Name | Raised by this section when |
|---|---|---|
| **Error 1** | Overflow | A result falls outside ±9.9999999999999E99, or a division by zero occurs internally (e.g. an amortization or TVM path that divides by `i` when `i` has become 0 through an unguarded route). Generic, but reachable. |
| **Error 2** | Invalid argument | **Amortization:** computing `BAL`, `PRN`, or `INT` with `P2 < P1`. Also reachable via `LN` of a non-positive argument in the `N` solve. |
| **Error 4** | Out of range | **Amortization:** `P1` or `P2` entered outside 1–9,999. **TVM:** `P/Y` or `C/Y` ≤ 0. Also: the `DEC` value outside 0–9. |
| **Error 5** | No solution exists | **TVM:** computing `I/Y` when `FV`, `(N × PMT)`, and `PV` all carry the same sign — the guidebook's own remedy is to check that inflows are positive and outflows negative. **TVM:** an `LN` input that is not > 0 during a calculation. |
| **Error 7** | Iteration limit exceeded | **TVM:** computing `I/Y` for a problem complex enough to exhaust the solver's iterations. |
| **Error 8** | Canceled iterative calculation | **TVM:** `ON/OFF` pressed to stop the evaluation of `I/Y`. **Amortization:** `ON/OFF` pressed to stop the evaluation of `BAL` or `INT`. (p. 85 — the abort key is `ON/OFF`, *not* `CE/C`; `CE/C` is only what clears the resulting error message.) |

Errors 3 and 6 are not reachable from the TVM or Amortization worksheets (Error 3 is parenthesis /
pending-operation depth; Error 6 is date validity).

> **Source ambiguity.** In the p. 84 table the comparison operator in "TVM worksheet: the `P/Y` or
> `C/Y` value **␣** 0" is missing — the glyph is dropped in the rendered page itself, not merely in
> the text extraction, so the image cannot recover it. Context (`P/Y`/`C/Y` are divisors and
> exponent denominators) makes `≤ 0` overwhelmingly likely, and 0 must certainly be rejected. The
> same glyph is dropped from the Bond row ("`RV`, `CPN`, or `PRI` value ␣ 0") and from several
> Depreciation rows, confirming a systematic font failure rather than a local omission. **Flagged as
> an open question rather than resolved.**

---

## Edge cases & ambiguities

1. **`i = 0` is a separate code path.** Every TVM formula on p. 75 ships a distinct closed form for
   `i = 0`, because the general forms divide by `i`. Do not reach `i = 0` by limit; branch on it.

2. **`Gi` also multiplies in the `i = 0` branch — except it doesn't.** The `i = 0` forms
   (`PMT = -(PV+FV) ÷ N`, `PV = -(FV + PMT × N)`, `FV = -(PV + PMT × N)`) contain no `Gi` term at
   all. With `i = 0`, `Gi = 1 + 0 × k = 1` regardless of `END`/`BGN`, so END and BGN are
   indistinguishable at zero interest. This is consistent, but it means a BGN annuity at 0% must
   *not* be special-cased.

3. **`BAL` vs `FV` divergence is specified behaviour** (p. 26), not tolerance. Tests must not use a
   loose epsilon to paper over it; the two use different `PMT` precision by design.

4. **Cent-level rounding inside the amortization loop** (finding #3 under the amortization formula)
   is visible from the p. 40 *first* row onward: an implementation that carries a sub-cent running
   balance misses `BAL(1–9)` by a cent (`118,928.64`) and then drifts further (`115,819.66` by the
   third range). It does not silently pass the first range, so range 1–9 is a sufficient tripwire.
   The error accumulates from the origin, so later ranges fail by more.

5. **Amortization iterates from `m = 1` even when `P1` is large.** Computing `BAL` for `P1 = 300`
   still walks 300 periods. Behaviourally invisible, but it means the rounding accumulates from the
   origin — you cannot jump to `bal(pmt1-1)` with a closed form and match the calculator.

6. **`P1`/`P2` are documented as 1–9,999 integers** but the guidebook never states what happens to a
   fractional entry (e.g. `1.5` `ENTER`). Unspecified.

7. **`N` need not be an integer.** Nothing restricts it, and `CPT N` routinely returns fractional
   periods. But the Amortization worksheet's `P1`/`P2` are integers, so amortizing a non-integer-`N`
   loan is unspecified at the tail.

8. **`I/Y` display rounds to 2 decimals but stores full precision.** Two examples in range depend on
   this (see Behaviour). An implementation that stores the displayed value fails both.

9. **`xP/Y` writes to the display only.** `30` `2ND` `xP/Y` shows 360 but does not set `N`; the
   subsequent `N` keypress is what commits it. The guidebook is explicit (p. 27), and every example
   in range keys `N` afterwards.

10. **Examples on pp. 28–29 never reset.** They assume a default-state machine (`FV = 0`, `END`).
    Their golden tests therefore encode that assumed precondition in `setup` rather than in `keys`.
    p. 29's quarterly example additionally inherits `I/Y` and `PV` from the monthly example above
    it — its `keys` are only reproducible if the monthly example ran first, so its golden case
    carries the inherited values in `setup`.

11. **Guidebook prose contradicts its own table on p. 41.** The bullet list states interest of
    `$27,790.72`; the worked table displays `INT= -27,920.72`. The table is right — reconstructing
    from `60 × 545.55 = 32,733.00` and `PRN = 82,000 - 77,187.72 = 4,812.28` gives
    `INT = 27,920.72`. The prose has transposed two digits. **The table wins.**

12. **Thousands separators are inconsistently typeset on p. 40.** `PRN` appears as `-1071.37` and
    `-1601.98` (no separator) while `-1,507.03` in the same column has one. The calculator's US
    display format inserts separators uniformly; the golden tests use `-1,071.37` and `-1,601.98`.

13. **Truncated sentence on p. 34.** The explanation of variable-cash-flow present value ends
    mid-parenthesis: "…discounted back to the beginning of the first cash flow period (time". The
    remainder ("zero", presumably) is absent from both the text layer and the rendered page. No
    behaviour depends on it.

14. **The p. 32 perpetual-annuity example is not a TVM calculation.** It is executed entirely on the
    arithmetic keys (`110 ÷ 15 % =`), and its results are positive prices, contrary to the TVM sign
    convention. It is included as a golden test because it is a worked example in range, but it must
    not be routed through the TVM solver. Its results are identical under `CHN` and `AOS` (the `%`
    key is a postfix unary operator and there is no precedence conflict), so `calcMethod` is not
    load-bearing for it.

15. **`STO` / `STO +` store unrounded values.** The p. 33–34 cash-flow example sums four PVs into
    memory 1 and recalls `23,171.23`. Summing the *displayed* (rounded) values gives `23,171.22`.
    Only carrying full precision into memory reproduces the guidebook's `23,171.23` and the
    subsequent `171.23`. Memory arithmetic must not round.

# Bond Worksheet

> Source: official BA II Plus guidebook, pages 50-54 (formulas recovered from appendix pages 77-78; error
> table from pages 84-85). Behaviour described in original wording.

The Bond worksheet prices a bond from a yield, or solves the yield from a price, and always reports the
accrued interest that has built up since the last coupon date. All money amounts in this worksheet are
quoted per $100 of par value, never in the bond's actual face amount (p. 50, p. 52). Because settlement and
redemption are entered as calendar dates, the worksheet can price a bond bought part-way through a coupon
period, not just on a coupon anniversary (p. 50).

Enter the worksheet with `2ND` `BOND`; move between variables with `↓` and `↑`; flip either of the two
toggles with `2ND` `SET` (p. 50).

## Variables

The worksheet exposes nine display positions in a fixed order. Two of them (`ACT/360`, `2/Y | 1/Y`) are
toggles rather than numeric fields.

| # | Display | Label | Default | Type | Valid range / notes |
|---|---------|-------|---------|------|---------------------|
| 1 | `SDT` | Settlement date | `12-31-1990` | Enter only | 01-01-1980 through 12-31-2079 (p. 51) |
| 2 | `CPN` | Annual coupon rate, percent of par | `0` | Enter only | See Error 4 below; this is a *rate*, not a dollar coupon (p. 51) |
| 3 | `RDT` | Redemption date | `12-31-1990` | Enter only | 01-01-1980 through 12-31-2079; must be later than `SDT` (p. 51, p. 85) |
| 4 | `RV` | Redemption value, percent of par | `100` | Enter only | 100 for a to-maturity analysis; the call price for a to-call analysis (p. 51) |
| 5 | `ACT` / `360` | Day-count method | `ACT` | Setting | Toggle only — `2ND` `SET` (p. 50) |
| 6 | `2/Y` / `1/Y` | Coupons per year | `2/Y` | Setting | Toggle only — `2ND` `SET` (p. 50) |
| 7 | `YLD` | Yield to redemption | `0` | Enter / compute | Annual nominal yield in percent (p. 50) |
| 8 | `PRI` | Dollar price | `0` | Enter / compute | Dollars per $100 of par (p. 50, p. 52) |
| 9 | `AI` | Accrued interest | — | Auto-compute | Dollars per $100 of par; never entered (p. 50, p. 53) |

The guidebook's variable table (p. 50) lists `ACT` and `360` on separate rows, and `2/Y` and `1/Y` on
separate rows, which reads as four variables. The defaults table on the same page collapses them back into
two entries, `ACT/360` and `2/Y, 1/Y`. They are two toggles, not four fields — see *Edge cases*.

### Semantics worth pinning down

- `CPN` is the annual rate printed on the bond expressed as a percentage of par, so a 7% bond is entered as
  `7`, not as the dollar coupon (p. 51).
- `RV` is likewise a percentage of par. Redeeming at par means `RV = 100`; a callable bond redeemed early
  carries par plus any call premium (p. 51, p. 52).
- The calculator takes it on faith that `RDT` lands on a coupon date. Point `RDT` at the maturity date to
  work to maturity, or at the call date to work to call (p. 51).
- `AI` is produced automatically — there is no `CPT` step for it (p. 53).

## Behaviour

**Opening the worksheet** (`2ND` `BOND`) shows the current `SDT` (p. 52). Values and toggle settings survive
until they are explicitly cleared or overwritten — leaving and re-entering the worksheet does not disturb
them (p. 52).

**Navigating before entering data raises Error 6** (p. 50). This is not arbitrary: `SDT` and `RDT` both
default to 12-31-1990, so on a fresh worksheet the redemption date is *the same as* the settlement date,
which is exactly the Error 6 condition documented on p. 85. Press `CE/C` to clear it (p. 50).

**Entering dates**: key the date as `mm.ddyy` in US format or `dd.mmyy` in European format, then `ENTER`
(p. 51, p. 52). The display format follows the calculator's date-format setting.

**Toggling the day-count method**: press `↓` until `ACT` or `360` shows, then `2ND` `SET` to flip it
(p. 51, p. 53). `ACT` is actual/actual; `360` is 30/360.

**Toggling the coupon frequency**: press `↓` until `2/Y` or `1/Y` shows, then `2ND` `SET` (p. 51, p. 53).

**Computing price**: `↓` to `YLD`, key the yield, `ENTER`, `↓` to `PRI`, `CPT` (p. 53).

**Computing yield**: `↓` to `PRI`, key the price, `ENTER`, `↓` to `YLD`, `CPT` (p. 53). Yield has no closed
form when more than one coupon remains — the calculator searches for it iteratively using the price formula
(p. 78), which is why `YLD` alone can raise Error 7 and Error 8.

**Viewing accrued interest**: `↓` to `AI`. It is already computed (p. 53).

The documented order of work is: enter the four knowns (`SDT`, `CPN`, `RDT`, `RV`), adjust the two toggles if
needed, then enter `YLD` to get `PRI` or enter `PRI` to get `YLD`; `AI` falls out either way (p. 52).

## Formulas

All equations below are transcribed from the rendered appendix images (pp. 77-78). The text layer of the PDF
drops them entirely — they are vector drawings.

### Common symbols (p. 77)

| Symbol | Meaning |
|--------|---------|
| `PRI` | dollar price per $100 par value |
| `RV` | redemption value of the security per $100 par value |
| `R` | annual interest rate as a decimal = `CPN / 100` |
| `M` | number of coupon periods per year (1 or 2, from the `2/Y` `1/Y` toggle) |
| `DSR` | number of days from settlement date to redemption date |
| `DSC` | number of days from settlement date to next coupon date (p. 78) |
| `E` | number of days in the coupon period in which settlement falls |
| `Y` | annual yield as a decimal = `YLD / 100` |
| `A` | number of days from the beginning of the coupon period to settlement (accrued days) |
| `N` | number of coupons payable between settlement and redemption; a fractional result is rounded **up** to the next whole number (e.g. 2.4 → 3) (p. 78) |
| `K` | summation counter (p. 78) |
| `PAR` | par value — principal to be paid at maturity (p. 78) |

`DSR`, `DSC`, `E`, and `A` are all measured under whichever day-count method the `ACT` / `360` toggle
selects.

### Price given yield, one coupon period or less to redemption (p. 77)

```
PRI = [ (RV + (100 × R)/M) / (1 + (DSR/E) × (Y/M)) ] − [ (A/E) × ((100 × R)/M) ]
```

LaTeX:

$$PRI = \left[\frac{RV + \frac{100 \times R}{M}}{1 + \left(\frac{DSR}{E}\right) \times \frac{Y}{M}}\right] - \left[\frac{A}{E} \times \frac{100 \times R}{M}\right]$$

The leading term discounts the redemption amount *including* its interest at the yield for the invested
period; the trailing term strips out the accrued interest owed to the seller (p. 77).

### Yield given price, one coupon period or less to redemption (p. 78)

```
Y = [ ( (RV/100 + R/M) − ( PRI/100 + (A/E × R/M) ) ) / ( PRI/100 + (A/E × R/M) ) ] × [ (M × E) / DSR ]
```

LaTeX:

$$Y = \left[\frac{\left(\frac{RV}{100} + \frac{R}{M}\right) - \left(\frac{PRI}{100} + \left(\frac{A}{E} \times \frac{R}{M}\right)\right)}{\frac{PRI}{100} + \left(\frac{A}{E} \times \frac{R}{M}\right)}\right] \times \left[\frac{M \times E}{DSR}\right]$$

### Price given yield, more than one coupon period to redemption (p. 78)

```
PRI = [ RV / (1 + Y/M)^(N − 1 + DSC/E) ]
    + [ SUM(K = 1 .. N) ( (100 × R/M) / (1 + Y/M)^(K − 1 + DSC/E) ) ]
    − [ 100 × (R/M) × (A/E) ]
```

LaTeX:

$$PRI = \left[\frac{RV}{\left(1 + \frac{Y}{M}\right)^{N-1+\frac{DSC}{E}}}\right] + \left[\sum_{K=1}^{N} \frac{100 \times \frac{R}{M}}{\left(1 + \frac{Y}{M}\right)^{K-1+\frac{DSC}{E}}}\right] - \left[100 \times \frac{R}{M} \times \frac{A}{E}\right]$$

First term: present value of the redemption amount, *excluding* interest. Second term: present value of every
future coupon. Third term: the accrued interest owed to the seller (p. 78).

### Yield given price, more than one coupon period to redemption (p. 78)

No closed form. The calculator iterates on the multi-period price formula above until the price it produces
matches the entered `PRI`.

### Accrued interest (p. 78)

```
AI = PAR × (R/M) × (A/E)
```

LaTeX:

$$AI = PAR \times \frac{R}{M} \times \frac{A}{E}$$

Since the worksheet quotes everything per $100 of par, `PAR = 100` here, which makes `AI` numerically
identical to the third term of the multi-period price formula.

### Sign conventions

The Bond worksheet has **no cash-flow sign convention** — unlike TVM, nothing here is signed by direction.
`PRI`, `AI`, `RV`, and `CPN` are all quoted as positive magnitudes per $100 of par.

**These bond formulas are consistent with the worked example.** This is worth stating explicitly because the
appendix carries known sign errors elsewhere (the printed TVM `PMT` formula omits a leading minus and yields
`+729.14` where the calculator shows `-729.13`). No such defect exists here: recomputing pp. 53-54 from the
multi-period price formula gives `PRI = 98.5628` → displays `98.56`, and `AI = 100 × 0.035 × 0.9 = 3.15`,
both matching the printed results exactly. See *Verification* below.

### Verification of the printed formulas against the worked example

Using the example's own keystrokes (`SDT` 6-12-2006, `RDT` 12-31-2007, `CPN` 7, `RV` 100, 30/360, 2/Y,
`YLD` 8):

- Coupon dates counting back from `RDT`: 12-31-2007, 6-30-2007, 12-31-2006, 6-30-2006, 12-31-2005.
  Settlement falls in the 12-31-2005 → 6-30-2006 period.
- Under 30/360: `A` = 162, `E` = 180, `DSC` = 18, so `A/E` = 0.9 and `DSC/E` = 0.1.
- `N` = 4 coupons remain (6-30-2006, 12-31-2006, 6-30-2007, 12-31-2007).
- `R` = 0.07, `M` = 2, `Y` = 0.08, `Y/M` = 0.04.
- Coupons: `3.5 × (1.04^-0.1 + 1.04^-1.1 + 1.04^-2.1 + 1.04^-3.1)` = 13.16110
- Redemption: `100 × 1.04^-3.1` = 88.55165
- Accrued: `100 × 0.035 × 0.9` = 3.15000
- `PRI` = 13.16110 + 88.55165 − 3.15000 = **98.56275** → displays `98.56` ✓
- `AI` = **3.15** ✓

## Key sequences

**Enter the worksheet**

```
2ND  BOND                      → SDT = <current>
```

**Clear to defaults (while in the worksheet)**

```
2ND  CLR WORK                  → SDT = 12-31-1990
```

**Enter the four knowns** (p. 52)

```
2ND  BOND
<mm.ddyy>  ENTER               → SDT
↓  <rate>  ENTER               → CPN
↓  <mm.ddyy>  ENTER            → RDT
↓  <pct-of-par>  ENTER         → RV
```

**Set the toggles** (p. 53)

```
↓  2ND  SET                    → flips ACT ↔ 360
↓  2ND  SET                    → flips 2/Y ↔ 1/Y
```

**Compute price from yield** (p. 53)

```
↓  <yield>  ENTER              → YLD
↓  CPT                         → PRI  (computed)
↓                              → AI   (auto-computed)
```

**Compute yield from price** (p. 53)

```
↓  <price>  ENTER              → PRI
↓  CPT                         → YLD  (computed)
```

**Warning — the guidebook's printed yield steps contradict its own variable order.** `YLD` (position 7)
sits *before* `PRI` (position 8), yet p. 53, *Computing the Bond Yield*, step 3 reads "Press `↓` to display
**YLD**". From `PRI` a single `↓` lands on `AI`, not `YLD`; wrapping the full nine-position list from `PRI`
back to `YLD` would take eight presses, not one. Computing price walks forward and is self-consistent
(`YLD` → `↓` → `PRI`); computing yield as printed is not. The sequence above transcribes the guidebook
verbatim. The printed `↓` is almost certainly a typo for `↑`, but the guidebook never says so — do not
implement a wrap-around on the strength of this step list. See *Edge cases*.

**Full worked example** (pp. 53-54)

```
2ND  BOND
6.1206   ENTER
↓  7     ENTER
↓  12.3107  ENTER
↓
↓  2ND  SET
↓
↓  8     ENTER
↓  CPT
↓
```

## Clearing/reset

| Action | Effect on the Bond worksheet |
|--------|------------------------------|
| `2ND` `CLR WORK` (while in the worksheet) | Resets every Bond variable to its default: `SDT` 12-31-1990, `CPN` 0, `RDT` 12-31-1990, `RV` 100, `YLD` 0, `PRI` 0, day-count → `ACT`, frequency → `2/Y` (pp. 50-51). |
| `2ND` `RESET` `ENTER` | Resets *all* calculator variables and formats to defaults, Bond variables included (p. 51). |
| `2ND` `QUIT` | Leaves the worksheet for standard-calculator mode. Does **not** clear anything — the guidebook is explicit that entries and settings persist until cleared or overwritten (p. 52). |
| `2ND` `CLR TVM` | **Does not touch the Bond worksheet.** It belongs to the TVM worksheet; Bond keeps its own storage. |
| `CE/C` | Clears an error message or a partial entry (p. 50, p. 84). Does not reset stored variables. |

`CLR WORK` is scoped to the worksheet you are standing in, so it only reaches Bond variables when pressed
inside the Bond worksheet (p. 50).

## Errors

Of Errors 1-8, the Bond worksheet can raise four (pp. 84-85):

| Error | Name | Bond-specific trigger |
|-------|------|-----------------------|
| **Error 4** | Out of range | `RV`, `CPN`, or `PRI` is out of range relative to 0 (p. 84 — the comparison operator fails to render in the source PDF; see *Edge cases*). |
| **Error 5** | No solution exists | The `LN` (logarithm) input is not > 0 during a calculation — shared with the TVM and Cash Flow worksheets (p. 84). |
| **Error 6** | Invalid date | A date is invalid (e.g. January 32) or wrongly formatted (`MM.DDYYYY` instead of `MM.DDYY`); **or** a calculation was attempted with `RDT` earlier than or equal to `SDT` (p. 85). The latter is what fires when you navigate a freshly-reset worksheet, since `SDT` and `RDT` are both 12-31-1990 (p. 50). |
| **Error 7** | Iteration limit exceeded | `YLD` was computed for a problem too complex to converge within the iteration budget (p. 85). |
| **Error 8** | Canceled iterative calculation | `ON/OFF` was pressed to abort a `YLD` computation in progress (p. 85). |

Errors 1, 2, and 3 have no Bond-specific causes listed, though Error 1 (overflow) and Error 3 (too many
pending operations) remain reachable through general arithmetic. Any error clears with `CE/C` (p. 84).

Errors 7 and 8 attach to `YLD` only, never to `PRI` — consistent with `YLD` being the iterative solve and
`PRI` being closed-form (p. 78).

## Edge cases & ambiguities

1. **The example's prose dates contradict its own keystrokes (pp. 53-54).** The narrative sets up a bond
   "maturing on December 31, 2005 and settling on June 12, 2004", but the keystrokes are `6.1206` and
   `12.3107`, and the displays read `SDT = 6-12-2006` and `RDT = 12-31-2007`. **The worked example wins:
   2006 / 2007.** Fortunately the arithmetic is invariant to the discrepancy — the two readings are exactly
   two years (four semiannual periods) apart, so both give `N` = 4, `A/E` = 0.9, `DSC/E` = 0.1, and hence
   the same `98.56` / `3.15`. Only the displayed date strings differ, and the golden tests assert the
   displayed strings from the keystrokes as printed.

2. **Error 4's comparison operator is missing from the source.** Page 84 renders as "the **RV**, **CPN**, or
   **PRI** value ⟨gap⟩ 0." — the glyph fails to draw in the PDF itself, not merely in the text layer (I
   magnified the region to confirm). It is either `< 0` or `≤ 0`. Internal evidence favours **`< 0`**: `CPN`
   and `PRI` both *default* to 0 (p. 51), and a `≤ 0` rule would make the worksheet's own default state
   illegal and would forbid pricing a zero-coupon bond. Treat as unresolved. The same glyph drops elsewhere
   in the Error 4 row ("the **P/Y** or **C/Y** value ⟨gap⟩ 0"), confirming a systematic font defect rather
   than a one-off.

3. **The two-digit year pivot is never stated.** Dates are keyed `mm.ddyy`, the legal window is 1980-2079
   (p. 51), and `06` resolves to 2006 while the default `90` displays as 1990. That implies a pivot of
   80-99 → 1980-1999 and 00-79 → 2000-2079, but pages 50-54 never say so outright. Inferred, not documented.

4. **`ACT`/`360` and `2/Y`/`1/Y` are toggles, not fields.** The p. 50 variable table lists each state on its
   own row with its own "Key" column (`↓` to reach `ACT`, `2ND` `SET` to reach `360`), which misleads into
   modelling four variables. The defaults table on the same page treats them as two settings. Implement two
   toggles occupying two display positions.

5. **The Yield-to-Maturity definition assumes semiannual compounding** (p. 52), yet the worksheet supports
   `1/Y`. Under `1/Y` the compounding is annual (`M` = 1 in the formulas). The glossary text is loose; the
   formulas govern.

6. **`RDT` is assumed to be a coupon date** (p. 51). The guidebook states the assumption but never says what
   happens if it isn't one — coupon dates are back-counted from `RDT` regardless, so an off-cycle `RDT`
   silently shifts the whole coupon schedule rather than erroring.

7. **Appendix `RV` gloss is circular** (p. 77): it reads "RV = redemption value of the security per $100 par
   value (RV except in those cases where call or put features must be considered)". The parenthetical is
   self-referential; the underlying source (Lynch & Mayle, *Standard Securities Calculation Methods*, 1986,
   cited in the p. 77 footnote) defines it as `RV = 100` except where call/put features apply. The `= 100`
   is missing from the render.

8. **Appendix `R` gloss is garbled** (p. 77): printed as "R = annual interest rate (as a decimal; CPN_100)".
   The operator glyph is substituted; it means `CPN ÷ 100`. Confirmed numerically (`R` = 0.07 for `CPN` = 7).
   The parallel `Y` gloss on the same page renders its `÷` correctly, so this is a one-off substitution.

9. **`N` rounds up, not to nearest** (p. 78): a fractional coupon count is raised to the next whole number
   (the guidebook's own example: 2.4 → 3).

10. **`AI` has no `CPT`.** It is auto-computed on display (p. 50, p. 53). Pressing `CPT` on it is undefined
    in the guidebook.

11. **No `P/Y` / `C/Y` interaction.** The Bond worksheet carries its own compounding through `M` (the
    `2/Y` / `1/Y` toggle) and ignores the TVM payments-per-year settings entirely.

12. **The printed `PRI` → `YLD` navigation is unreachable as written** (p. 53). *Computing the Bond Yield*
    step 3 says "Press `↓` to display **YLD**", but `YLD` precedes `PRI` in the p. 50 variable order, so
    `↓` from `PRI` reaches `AI`. Either the arrow is a typo for `↑` or the step list silently assumes the
    user has not yet walked past `YLD`. Unresolved from pages 50-54; the parallel `PRI` computation
    (`YLD` → `↓` → `PRI`) has no such defect. No golden case asserts this path, precisely because the
    guidebook does not pin down what is displayed.

13. **Rounding.** Displays follow the `DEC` format setting (default 2), but the guidebook gives no
    indication that Bond stores rounded internals — unlike the Depreciation worksheet, where p. 78 explicitly
    says `DEP`, `RDV`, `CST`, `SAL` are rounded to the displayed decimals. Assume full internal precision for
    Bond and round only at display.

# Overview, 2nd Key, Display Indicators, Calculator Formats, Reset

> Source: official BA II Plus guidebook, pages 6-11. Behaviour described in original wording.

**Page-number convention.** Citations use the *PDF/extraction* page numbers (the `========== PAGE N ==========`
markers and the `pageNN.png` images), which is the numbering the task assigned. The printed footer on those
pages runs six lower: PDF p. 6 carries the footer "1", PDF p. 11 carries the footer "6". Where the appendix is
cited for error definitions, that is PDF p. 84-85 (footer 79-80).

---

## Variables

This section owns the **FORMAT worksheet** — five global settings that persist across power-off and are not
owned by any computational worksheet. Only `DEC` takes a keyed-in numeric value; the other four are toggled.

| Name | Display label | Default | Type | Valid range / values |
|---|---|---|---|---|
| `DEC` | `DEC` | `2` | setting (entered, numeric) | integer `0`-`9`; `9` selects floating-decimal rather than nine fixed places (p. 9) |
| Angle units | `DEG` / `RAD` | `DEG` | setting (toggled) | `DEG` (degrees), `RAD` (radians) (p. 9) |
| Date format | `US` / `Eur` | `US` | setting (toggled) | `US` = mm-dd-yyyy, `Eur` = dd-mm-yyyy (p. 9) |
| Number separators | `US` / `Eur` | `US` | setting (toggled) | `US` renders `1,000.00`, `Eur` renders `1.000,00` (p. 9) |
| Calculation method | `Chn` / `AOS` | `Chn` | setting (toggled) | `Chn` = chain, `AOS` = algebraic operating system (p. 9) |

Ordering matters: the five settings occupy positions 1-5 of the FORMAT worksheet in exactly the order above,
and the arrow keys walk that order (p. 9).

### Display state (not variables, but part of the observable model)

The readout carries a variable label of up to three characters, an `=` sign, and a numeric field of up to
10 digits (p. 7). Internally values are held to 13 digits (p. 9). Two small markers sit at the right of the
numeric field, and an annunciator row sits above it. The rendered sample on p. 7 shows the full annunciator
row, left to right: `2nd  INV  HYP  COMPUTE  ENTER  SET  ↑↓  DEL  INS  BGN  RAD`, over a sample readout of
`ABC=-12,345,678.90` with the `◄` and `✱` markers lit.

| Indicator | Position | Meaning (p. 7-8) |
|---|---|---|
| `2nd` | annunciator | A second function is armed; the next key selects its second function. |
| `INV` | annunciator | The next key selects its inverse trigonometric function. |
| `HYP` | annunciator | The next key selects its hyperbolic function. |
| `COMPUTE` | annunciator | `CPT` will compute a value for the variable on display. |
| `ENTER` | annunciator | `ENTER` will assign the displayed value to the displayed variable. |
| `SET` | annunciator | `2ND` `SET` will change the setting of the displayed variable. |
| `↑↓` | annunciator | `↓` / `↑` will move to the previous or next worksheet variable. Holding either key scrolls. |
| `DEL` | annunciator | `2ND` `DEL` will delete a cash flow or statistical data point. |
| `INS` | annunciator | `2ND` `INS` will insert a cash flow or statistical data point. |
| `BGN` | annunciator | TVM uses beginning-of-period payments. Unlit means end-of-period (`END`). |
| `RAD` | annunciator (upper right) | Angle values are in radians. Unlit means degrees, which is also the entry unit. |
| `◄` | over numeric field | The displayed value has been *entered* into the current worksheet. Clears after a computation. |
| `✱` | over numeric field | The displayed value was *computed* in the current worksheet. Clears when a change invalidates it. |
| `=` | in readout | The displayed variable currently holds the displayed value. |
| `−` | in readout | The displayed value is negative. |

`BGN` and `END` are surfaced here only as display state; the TVM worksheet owns the setting itself.

---

## Behaviour

### Power

Pressing `ON/OFF` turns the calculator on (p. 6). Two distinct wake paths exist and they differ:

- Woken after a **deliberate `ON/OFF` power-down**: the machine lands in standard-calculator mode showing zero.
  Every worksheet, plus the number, angle-unit, date, separator and calculation-method formats, keep whatever
  they held before (p. 6).
- Woken after **APD (Automatic Power Down)**: the machine resumes exactly as it was left, including display
  settings, stored memory, pending operations *and* any live error condition (p. 6).

Powering down with `ON/OFF` clears the displayed value and any error condition, and abandons any unfinished
standard-calculator operation or worksheet calculation in progress. Constant Memory retains all worksheet
values and settings, the 10 memories, and every format setting (p. 6).

APD fires after roughly five minutes of inactivity, purely to conserve the battery (p. 6).

The behavioural contrast worth encoding: `ON/OFF` discards *transient* state (display, error, pending op) but
keeps *stored* state; APD discards nothing.

### The 2nd key

Each key's primary function is printed on the key face; most keys carry a second function printed above them.
`2ND` followed by the key selects the second function, and while `2ND` is armed the `2nd` annunciator lights in
the upper left (p. 7). Pressing `2ND` a second time disarms it — that is the documented cancel path (p. 7).
`2ND` `QUIT` is given as the canonical example: it leaves whatever worksheet is selected and returns to
standard-calculator mode (p. 7).

### Reading the display

Variable labels appear alongside values of up to 10 digits; anything longer is rendered in scientific
notation (p. 7). The annunciators tell the operator which keys are live and report calculator status (p. 7).

### Entering the FORMAT worksheet and navigating it

`2ND` `FORMAT` opens the worksheet at the `DEC` setting, showing the `DEC` indicator together with the number
of decimal places currently selected (p. 9). From there `↓` and `↑` step one format per press (p. 9). The
guidebook's own navigation examples: `↓` alone reaches the angle-unit format; `↑↑↑` *or* `↓↓↓` reaches the
number-separator format (p. 9). See *Edge cases* — the `↑↑↑` half of that claim does not survive arithmetic.

`2ND` `SET` toggles the setting currently displayed (p. 9). For `DEC`, which is numeric rather than a toggle,
you instead key a value and press `ENTER` (p. 9).

Exit paths from the FORMAT worksheet (p. 9): repeat the navigate-and-toggle cycle for another format; press
`2ND` `QUIT` to return to standard-calculator mode; or press any worksheet key or key sequence to jump
straight into that worksheet.

### Decimal places

The stored value and the shown value are decoupled. Internals are carried to 13 digits; `DEC` governs display
only (p. 9). With floating-decimal selected (`DEC = 9`) up to 10 digits show, and results needing more than 10
switch to scientific notation (p. 9).

Critically, changing `DEC` does **not** round the stored value — with the sole exception of amortization and
depreciation results, which the calculator does round internally. Rounding the internal value requires the
explicit round function (p. 9). The guidebook states that all of its examples assume two decimal places and
that other settings may show different results (p. 9) — which is why every golden test here pins `DEC = 2`.

### Angle units

The angle-unit setting affects how trigonometric *results* are displayed. Selecting radians lights `RAD` in the
upper right; degrees, the default, lights nothing (p. 10). Note the asymmetry recorded on p. 8: when `RAD` is
dark, angle values are both displayed *and must be entered* in degrees.

### Dates

Dates are consumed by the Bond worksheet, the Date worksheet, and the French depreciation methods (p. 10).
The entry convention is `mm.ddyy` under the US format or `dd.mmyy` under European, followed by `ENTER` (p. 10).
Note the entry convention is two-digit-year (`yy`), whereas the format table on p. 9 describes the *display*
as four-digit-year (`mm-dd-yyyy` / `dd-mm-yyyy`).

### Calculation method

`Chn` evaluates strictly left-to-right, in entry order, and the guidebook notes this is what most financial
calculators do (p. 10). `AOS` applies algebraic hierarchy, doing multiplication and division before addition
and subtraction, as most scientific calculators do (p. 10). Both are illustrated with the same keystrokes and
divergent results — see *Formulas* and the golden tests.

### Resetting formats only

With any one of the five formats on display, `2ND` `CLR WORK` restores the default value of **all** the
calculator formats (p. 10) — not merely the one showing.

### Resetting the calculator

A full reset does three things (p. 10): clears the display, all 10 memories, any unfinished calculation and all
worksheet data; restores every default setting; and returns operation to standard-calculator mode.

The guidebook explicitly cautions against reaching for it: because selective clearing methods exist, reset
risks needless data loss (p. 10). It nominates three legitimate occasions — first use, starting a fresh
calculation, and troubleshooting once other remedies have failed (p. 10).

Two reset mechanisms exist:

- **Key sequence** (p. 11): `2ND` `RESET` puts up the `RST ?` prompt with the `ENTER` indicator lit. `ENTER`
  commits, and the machine shows `RST` together with `0.00` to confirm. `2ND` `QUIT` at the prompt cancels,
  leaving `0.00`. If an error condition is live, `CE/C` must clear the display before reset will be accepted.
- **Hard reset** (p. 11): gently insert a pointed object such as an unfolded paper clip into the hole marked
  `RESET` on the back of the case.

---

## Formulas

**This section contains no mathematical equations.** Pages 6-11 carry no vector-drawn formulas; the only
figures are the calculator line drawings, the LCD sample on p. 7, and the two settings tables. The images were
read in full to confirm this — there is no "where:" stub with dropped content anywhere in the range.

What the section does define are two **evaluation rules**, stated by worked example rather than by equation
(p. 10). Both are exercised by the identical key sequence `3` `+` `2` `*` `4` `=`:

```
Chn (chain, default):   evaluate strictly in entry order
                        3 + 2 = 5, 5 * 4 = 20       -> 20
AOS (algebraic):        multiplication/division bind tighter than addition/subtraction
                        2 × 4 = 8; 3 + 8 = 11       -> 11
```

The guidebook spells out both intermediate chains exactly as transcribed above (p. 10) — including its own
punctuation and glyph inconsistency: the Chn line is printed with a comma and an ASCII `*`, the AOS line with
a semicolon and a `×`. The *keys pressed* are `×` in both examples; only the prose narration differs. No
sign-convention issue arises here (both operands and results are positive), so this section has no analogue of
the appendix's missing-minus-sign defect.

Number-rendering rules, stated as prose on p. 9 and transcribed here as facts:

```
internal precision  = 13 significant digits
displayed digits    <= 10  (floating-decimal option)
value needing > 10 digits            -> scientific notation
DEC in 0..8                          -> that many fixed decimal places, display only
DEC = 9                              -> floating decimal
internal rounding applied            -> amortization and depreciation results ONLY
```

The overall machine range, needed to bound the display model, is `±9.9999999999999E99` (appendix, p. 84).

Separator rendering (p. 9), transcribed exactly as printed:

```
US  ->  1,000.00        (group separator ",", radix ".")
Eur ->  1.000,00        (group separator ".", radix ",")
```

The printed `US` sample reads `1,000.00 ` with a trailing space inside the parentheses; this is a typesetting
artifact, not a display character.

---

## Key sequences

Token convention used in the golden file: `2ND` precedes a named second function; multi-digit numbers are one
token; arithmetic keys are `+`, `-`, `×`, `÷`, `=` — matching the key glyphs printed in the guidebook and the
convention used by the rest of the golden corpus (`clearing-and-math-ops`, `memory-and-last-answer`,
`errors-accuracy-aos`). Do not use ASCII `*` / `/`: the p. 10 Chn/AOS cases are duplicated in
`errors-accuracy-aos.json`, and divergent tokens would defeat dedupe at merge.

| Goal | Exact keystrokes | Result (p.) |
|---|---|---|
| Power on / off | `ON/OFF` | p. 6 |
| Arm second function | `2ND` then the key | p. 7 |
| Cancel an armed `2ND` | `2ND` `2ND` | p. 7 |
| Leave a worksheet | `2ND` `QUIT` | p. 7 |
| Open FORMAT at `DEC` | `2ND` `FORMAT` | p. 9 |
| Set decimal places to n | `2ND` `FORMAT` `n` `ENTER` | p. 9 |
| Select floating decimal | `2ND` `FORMAT` `9` `ENTER` | p. 9 |
| DEC -> angle units | `↓` | p. 9 |
| DEC -> number separators | `↓` `↓` `↓` (guidebook also prints `↑` `↑` `↑`) | p. 9 |
| DEC -> calculation method | `↓` `↓` `↓` `↓` | derived from the p. 9 ordering |
| Toggle the displayed setting | `2ND` `SET` | p. 9 |
| Select radians | `2ND` `FORMAT` `↓` `2ND` `SET` | p. 9-10 |
| Select European dates | `2ND` `FORMAT` `↓` `↓` `2ND` `SET` | p. 9 |
| Select European separators | `2ND` `FORMAT` `↓` `↓` `↓` `2ND` `SET` | p. 9 |
| Select AOS | `2ND` `FORMAT` `↓` `↓` `↓` `↓` `2ND` `SET` | p. 9-10 |
| Reset all formats to defaults | `2ND` `CLR WORK` (with any format displayed) | p. 10 |
| Reset the calculator | `2ND` `RESET` `ENTER` | p. 11 |
| Cancel a pending reset | `2ND` `RESET` `2ND` `QUIT` | p. 11 |
| Enter a US date | `mm.ddyy` `ENTER` | p. 10 |
| Enter a European date | `dd.mmyy` `ENTER` | p. 10 |
| Clear one memory | `0` `STO` `n` (n = 0-9) | p. 11 |

Note the toggle sequences above assume a single `2ND` `SET` press flips a two-state setting from its default;
the guidebook documents `2ND` `SET` as "change the setting" (p. 9) without stating cycle order for two-state
settings, which is unambiguous for a binary toggle.

---

## Clearing/reset

The p. 11 clearing table, transcribed as a behavioural contract:

| To clear | Press |
|---|---|
| One character at a time, last digit keyed in first | `→` (backspace) |
| An incorrect entry, an error condition, or an error message | `CE/C` |
| The prompted worksheet, resetting its defaults | `2ND` `CLR WORK` |
| Calculator format settings, resetting their defaults | `2ND` `FORMAT` then `2ND` `CLR WORK` |
| Out of the prompted worksheet back to standard-calculator mode; and all pending operations in standard-calculator mode | `2ND` `QUIT` |
| In a prompted worksheet, a variable value keyed in but not yet entered (the previous value reappears); and any calculation started but not completed | `CE/C` `CE/C` |
| TVM worksheet variables, resetting their defaults | `2ND` `QUIT` then `2ND` `CLR TVM` |
| One of the 10 memories, leaving the other nine untouched | `0` `STO` and a memory number key (`0`-`9`) |

The guidebook directs the reader to the individual worksheet chapters for selective variable clearing (p. 11).

### What each operation does and does not touch, for this section

- **`2ND` `CLR WORK` with a format displayed** — restores defaults for *all five* formats: `DEC` to `2`, angle
  units to `DEG`, dates to `US`, separators to `US`, calculation method to `Chn` (p. 10, defaults from the p. 9
  table). It does not touch the 10 memories, worksheet data, or the displayed value.
- **`2ND` `QUIT`** — exits the FORMAT worksheet to standard-calculator mode and drops pending operations
  (p. 7, p. 11). It does **not** revert, undo, or default any format setting; a format changed with
  `2ND` `SET` survives `QUIT` intact. At the reset prompt it also cancels the pending reset, leaving `0.00`
  (p. 11).
- **`2ND` `CLR TVM`** — belongs to TVM and has no effect on any format setting. Conversely, the format defaults
  restored by `2ND` `CLR WORK` do not include TVM variables. Note the guidebook prescribes `2ND` `QUIT` *before*
  `2ND` `CLR TVM` (p. 11).
- **`2ND` `RESET` `ENTER`** — the superset: display, all 10 memories, unfinished calculations, all worksheet
  data, and all default settings including the five formats, returning to standard-calculator mode (p. 10).
- **`ON/OFF`** — clears the displayed value, any error condition, and any operation or worksheet calculation in
  progress. It does **not** touch format settings, worksheet values, or the 10 memories (p. 6).
- **`CE/C`** — clears an incorrect entry, an error condition, or an error message (p. 11). Required to clear a
  live error before a reset will be accepted (p. 11).

---

## Errors

Pages 6-11 name no error numbers directly; they state only that an error condition must be cleared with `CE/C`
before reset is attempted (p. 11). Mapping this section's behaviours onto the appendix error table (p. 84-85)
gives the following, which are the errors an implementation of *this* section can legitimately raise:

| Error | Raised by this section when |
|---|---|
| **Error 4 — Out of range** | The `DEC` value is outside the range `0`-`9` (appendix, p. 84). This is the only error the appendix ties directly to a FORMAT-worksheet variable. |
| **Error 3 — Too many pending operations** | Expression evaluation under either `Chn` or `AOS` exceeds 15 active levels of parentheses, or exceeds 8 pending operations (appendix, p. 84). `AOS` is the more exposed of the two, since deferring `*` and `/` past a pending `+` or `-` is precisely what consumes a pending-operation slot; `Chn` retires each operation as it is entered. |
| **Error 1 — Overflow** | A result leaves the machine range `±9.9999999999999E99` (appendix, p. 84) — reachable from standard-calculator arithmetic in either calculation method, and the boundary the >10-digit scientific-notation display rule (p. 9) runs up against. |
| **Error 6 — Invalid date** | A date is invalid (the appendix's example is January 32) or is keyed in the wrong format — specifically `MM.DDYYYY` where `MM.DDYY` was required (appendix, p. 85). This is the failure mode of the p. 10 date-entry convention, though the error is surfaced by the Bond and Date worksheets that consume the date, not by the FORMAT setting itself. |

Errors 2, 5, 7 and 8 are not reachable from this section: Error 2 belongs to math/statistics/amortization/
depreciation argument validity, Error 5 and Error 7 to TVM/cash-flow/bond solving, and Error 8 to `ON/OFF`
cancelling an iterative calculation in a worksheet (appendix, p. 84-85).

Note that Error 8's trigger — pressing `ON/OFF` to stop an iterative calculation — is the worksheet-side view
of the p. 6 statement that powering off cancels a worksheet calculation in progress. An implementation should
treat these as the same event described from two sides.

---

## Edge cases & ambiguities

1. **`↑↑↑` cannot reach the number separators (p. 9).** The guidebook says the separator format is reached from
   `DEC` by `↑` `↑` `↑` *or* `↓` `↓` `↓`. With five formats ordered DEC(1), angle(2), date(3), separator(4),
   method(5), `↓↓↓` correctly lands on 4. But `↑↑↑` cannot: if the list wraps, `↑` `↑` lands on 4 and `↑` `↑` `↑`
   overshoots to 3 (dates); if the list does not wrap at the top, `↑↑↑` never leaves `DEC`. The `↑↑↑` figure
   looks like a symmetric copy of `↓↓↓`. **The `↓↓↓` path is authoritative**; the `↑` path is unresolved, and
   with it the question of whether the FORMAT worksheet wraps at all. Flagged as an open question — do not
   encode wrap behaviour from this page alone.
2. **`DEC = 9` is floating-decimal, not nine places (p. 9).** A naive `0`-`9` fixed-places implementation is
   wrong at the top of the range. Only `0`-`8` are fixed-place selections.
3. **`DEC` valid range vs. Error 4 (p. 9 / appendix p. 84).** The value must be integral and within `0`-`9`.
   The guidebook does not state what happens to a *fractional* `DEC` entry (e.g. `2.5`) — whether it truncates
   or raises Error 4. Open question.
4. **Rounding exception (p. 9).** "Changing the number of decimal places affects the display only" is true
   *except* for amortization and depreciation results, which are rounded internally. This exception is stated
   once, in passing, on the format page, but has consequences in two other worksheets. It must not be dropped.
5. **Date entry format vs. date display format (p. 9 vs. p. 10).** Entry is `mm.ddyy` / `dd.mmyy` — two-digit
   year with a period as the field separator. Display is `mm-dd-yyyy` / `dd-mm-yyyy` — four-digit year with
   hyphens. These are different grammars for the same setting and are easy to conflate. The appendix confirms
   the entry grammar is enforced: `MM.DDYYYY` raises Error 6 (p. 85). The century rule that expands `yy` to
   `yyyy` is not stated on these pages; the Date worksheet's `January 1, 1980`-`December 31, 2079` range
   (appendix, p. 84) implies a 1980-2079 window, but that is inference, not statement. Open question.
6. **The `Eur` separator setting and decimal entry.** p. 9 defines `Eur` rendering as `1.000,00`, but the pages
   in range never say whether the *entry* radix key follows the setting, nor how `Eur` separators interact with
   the `mm.ddyy` date convention, which itself uses a period as a separator. Open question.
7. **Chn/AOS results are given as bare integers in prose (p. 10).** The guidebook writes "the Chn answer is 20"
   and "the AOS answer is 11" as arithmetic, not as display captures. At the `DEC = 2` default that every
   example assumes (p. 9), the readout is `20.00` and `11.00`. The golden tests record the two-decimal form and
   flag the substitution.
8. **`2ND` `SET` on `DEC` is not documented.** `DEC` is numeric and takes `ENTER` (p. 9), while the other four
   formats take `2ND` `SET` (p. 9). What `2ND` `SET` does when `DEC` is displayed is unstated — plausibly a
   no-op. Open question.
9. **Two wake paths differ (p. 6).** `ON/OFF`-off then on lands at zero in standard-calculator mode with no
   error; APD-off then on restores pending operations and error conditions. State restoration must be
   conditioned on *how* the machine powered down, not merely on powering up.
10. **`2ND` `CLR WORK` is context-sensitive (p. 10 / p. 11).** The same sequence resets "the prompted worksheet"
    generally (p. 11), but resets *all five formats* — not just the displayed one — when a format is showing
    (p. 10). The FORMAT worksheet behaves as a single unit under `CLR WORK`.
11. **Reset confirmation is a two-glyph state (p. 11).** After `ENTER`, `RST` and `0.00` appear together: `RST`
    is an annunciator/label, `0.00` the numeric field. Likewise the prompt is `RST ?` with the `ENTER`
    indicator lit. An implementation modelling the display as a single string needs to represent these
    composite states.
12. **`2ND` cancel is `2ND` (p. 7).** Pressing `2ND` twice disarms rather than double-arming or falling through
    to a second-function-of-`2ND`. There is no `2ND` `2ND` compound function.

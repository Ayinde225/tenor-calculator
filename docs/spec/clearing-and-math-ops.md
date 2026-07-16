# Clearing, Entry Correction, and Standard-Calculator Math Operations

> Source: official BA II Plus guidebook, pages 11-15. Behaviour described in original wording.

**Page numbering.** Citations below use the **PDF page number** (the `========== PAGE N ==========` marker
and `pages/pageNN.png` filename). The printed footer number is PDF page minus 5 — e.g. PDF p. 12 carries the
printed folio "7". Several pages outside the assigned range are cited where they are the authoritative source for
material this section depends on: p. 7 (`INV`/`HYP` indicators), p. 10 (reset scope; the `Chn`/`AOS` worked
answers), p. 16 (clearing all 10 memories), p. 84 (error table) and p. 87 (AOS hierarchy).

**Scope.** Reset, selective clearing, entry-error correction, the arithmetic/percent/power/root/log/trig/
hyperbolic/factorial/nPr/nCr/random/ROUND operations of standard-calculator mode, parentheses, and scientific
notation entry.

---

## Key-token vocabulary

The guidebook draws primary keys as boxed glyphs and second functions as bracketed labels preceded by `2nd`.
This spec (and the companion golden file) uses these canonical uppercase tokens:

| Guidebook glyph | Token | Kind |
|---|---|---|
| `2nd` | `2ND` | prefix key |
| `→` (backspace/delete) | `BKSP` | primary |
| `CE/C` | `CE/C` | primary |
| `ENTER` | `ENTER` | primary |
| `STO` / `RCL` | `STO` / `RCL` | primary |
| `+` `−` `×` `÷` `=` | `+` `-` `×` `÷` `=` | primary |
| `(` `)` | `(` `)` | primary |
| `y^x` | `Y^X` | primary |
| `%` | `%` | primary |
| `x²` | `X^2` | primary |
| `√x` | `√X` | primary |
| `1/x` | `1/X` | primary |
| `LN` | `LN` | primary |
| `+/−` | `+/-` | primary |
| `INV` | `INV` | primary (inverse-trig prefix) |
| `[RESET]` `[QUIT]` `[CLR WORK]` `[CLR TVM]` `[FORMAT]` `[MEM]` | same, uppercased | second function |
| `[x!]` `[RAND]` `[nCr]` `[nPr]` `[e^x]` `[ROUND]` `[HYP]` `[SIN]` `[COS]` `[TAN]` | `X!` `RAND` `NCR` `NPR` `E^X` `ROUND` `HYP` `SIN` `COS` `TAN` | second function |

Multi-digit numbers are a single token (`1234.86`, `.69315`).

---

## Variables

Standard-calculator mode is not a prompted worksheet, so it has no scrollable labelled variables. The state this
section reads or mutates is:

| Name | Label / prompt | Default | Type | Valid range |
|---|---|---|---|---|
| display value | *(none — bare numeric display)* | `0.00` | entered/computed | ±9.9999999999999E99 (p. 84) |
| internal precision | — | — | computed | up to 13 digits stored, independent of the displayed rounding (p. 15) |
| `n` (nCr/nPr first operand) | *(none — positional)* | — | entered | must be greater than 0 (p. 14) |
| `r` (nCr/nPr second operand) | *(none — positional)* | — | entered | must be greater than 0 (p. 14) |
| factorial operand `x` | *(none — positional)* | — | entered | positive integer ≤ 69 (p. 14); see §Errors for the 0 conflict |
| random seed | *(none)* | unspecified | entered | integer greater than zero (p. 14) |
| random result | *(none)* | — | computed | 0 < x < 1, uniform (p. 14) |
| pending-operation stack | — | empty | internal | at most 8 pending operations (p. 14) |
| open-parenthesis level | — | 0 | internal | at most 15 levels (p. 14) |
| `DEC` (decimal places) | `DEC` | 2 | setting | 0-9 (p. 84); governs what `ROUND` collapses the internal value to (p. 15) |
| angle unit | `DEG` / `RAD` | `DEG` | setting | affects trig argument/result interpretation (p. 14) |
| calculation method | `Chn` / `AOS` | `Chn` | setting | determines evaluation order (p. 12, p. 87) |

`DEC`, angle unit and calculation method are owned by the Format settings section; they are listed here because
`ROUND`, the trig keys, and expression evaluation read them.

---

## Behaviour

### Reset (p. 11)

Pressing `2ND` `RESET` arms the reset: the display shows the `RST ?` prompt together with the `ENTER`
indicator. Pressing `ENTER` performs the reset and the calculator confirms by showing the `RST` indicator over a
display of `0.00`. Backing out before confirming is done with `2ND` `QUIT`, which returns `0.00` and leaves state
untouched.

If the calculator is currently sitting on an error condition, the error has to be cleared with `CE/C` first —
reset cannot be armed on top of a live error message (p. 11).

A hardware equivalent exists: poking the recessed `RESET` hole on the back of the case with a straightened paper
clip performs the same reset (p. 11).

### Selective clearing (p. 11)

The guidebook's clearing table maps each granularity of "undo" to a key sequence:

| Target | Sequence |
|---|---|
| Remove the most recently keyed digit (repeatable) | `BKSP` |
| An incorrect entry, an error condition, or an error message | `CE/C` |
| The current prompted worksheet, restoring its defaults | `2ND` `CLR WORK` |
| The format settings, restoring their defaults | `2ND` `FORMAT` then `2ND` `CLR WORK` |
| Exit a prompted worksheet back to standard-calculator mode; **and** discard all pending operations while in standard-calculator mode | `2ND` `QUIT` |
| A keyed-but-not-yet-`ENTER`ed variable value in a worksheet (the prior value reappears); **and** any started-but-unfinished calculation | `CE/C` `CE/C` |
| The TVM worksheet variables, restoring their defaults | `2ND` `QUIT` then `2ND` `CLR TVM` |
| A single one of the 10 memories, leaving the other nine alone | `0` `STO` *n* where *n* is `0`-`9` |

Variables belonging to an individual worksheet are cleared through that worksheet's own chapter (p. 11).

### Correcting entry errors (p. 12)

A mistyped number can be repaired in place, without destroying the surrounding calculation, provided the repair
happens **before** the next operation key is pressed. `BKSP` deletes one character from the right-hand end of the
number being keyed; `CE/C` discards the whole number currently displayed. The distinction that matters: once an
operation key has been pressed, `CE/C` no longer means "clear this number" — it aborts the calculation in
progress.

The worked example (p. 12) shows the display during entry is *not* forced to the `DEC` format. After `3` `×` the
display settles to `3.00`, but the keyed number reads back literally: `1,234.86`, and after two `BKSP` presses it
reads `1,234.` — a trailing decimal point with nothing after it, and the thousands separator still applied.

### Evaluation order (p. 10, p. 12, p. 87)

Under the default chain method (`Chn`) expressions are evaluated strictly in keying order. p. 12 introduces the
example `3 + 2 × 4` but prints no result; the answers are printed only on p. 10, which gives `Chn` → **20**
(3 + 2 = 5, 5 × 4 = 20) and `AOS` → **11** (2 × 4 = 8, 3 + 8 = 11) for the same keystrokes. Under `AOS` the
calculator applies algebraic hierarchy instead. The appendix hierarchy table (p. 87), highest priority first, is:

1. `x²`, `x!`, `1/x`, `%`, `√x`, `LN`, `e^x`, `HYP`, `INV`, `SIN`, `COS`, `TAN`
2. `nCr`, `nPr`
3. `y^x`
4. `×`, `÷`
5. `+`, `−`
6. `)`
7. `=` (lowest)

### Operations that need a terminating `=` (p. 12-13)

`+`, `−`, `×`, `÷`, `y^x`, parenthesised subexpressions, `%`, `nCr` and `nPr` are all binary/infix and only
resolve when `=` is pressed.

### Operations that resolve immediately (p. 13)

`√x`, `1/x`, `2ND` `X!`, `LN`, `2ND` `E^X`, `2ND` `ROUND`, `2ND` `RAND`, and the trig and hyperbolic keys all act
on the displayed value the instant they are pressed; no `=` is required. `x²` also resolves immediately in the
guidebook's own example (`6.3` `X^2` → `39.69`, p. 13) despite being printed in the "requires `=`" table — see
§Edge cases.

### Percent `%` (p. 12-13)

`%` is context-sensitive — it does not simply divide by 100 in every position:

- After `×` or `÷` it converts the pending operand to a hundredth of itself: `453 × 4 %` → `4/100`, giving
  `18.12`; `14 ÷ 25 %` → `14 ÷ 0.25`, giving `56.00` (labelled "percent ratio" — the fraction 14/25 expressed as
  a percentage).
- After `+` or `−` it resolves the operand to *that percentage of the first operand* and displays the resulting
  amount immediately, before `=`. `498 + 7 %` displays `34.86` (7% of 498); pressing `=` then completes the
  add-on to `532.86`. Symmetrically `69.99 − 10 %` displays `7.00` and `=` yields the discounted `62.99`.

### Universal power `Y^X` (p. 12, 14)

`Y^X` raises the displayed value to the power keyed after it, completing on `=` (`3` `Y^X` `1.25` `=` → `3.95`,
p. 12). The guidebook restricts negative bases: since the reciprocal of an even number is a complex number, a
negative base is only legal with an integer exponent or with the reciprocal of an odd number (p. 14).

### Parentheses `(` `)` (p. 14)

Parentheses override evaluation order for division, multiplication, powers, roots and logarithm calculations. Up
to 15 nesting levels and 8 pending operations are supported. Trailing `)` presses are optional — `=` closes every
outstanding parenthesis, evaluates, and shows the final result. Pressing `)` explicitly is how you *peek* at an
intermediate result: one press per open parenthesis (p. 14).

### Factorial `2ND` `X!` (p. 13-14)

Computes `x!` on the displayed value immediately. The operand must be a positive integer no greater than 69
(p. 14).

### Random numbers `2ND` `RAND` (p. 13-14)

Returns a uniformly distributed real number strictly between 0 and 1 (`0 < x < 1`). Seeding makes a sequence
reproducible, which the guidebook motivates as recreating experiments: key an integer greater than zero, then
press `STO` `2ND` `RAND` (p. 14).

### Combinations and permutations (p. 13-14)

`n` `2ND` `NCR` `r` `=` returns the number of ways to choose `r` items from `n` disregarding order; `n` `2ND`
`NPR` `r` `=` returns the count where order matters. Both `n` and `r` must exceed 0 (p. 14).

### Rounding `2ND` `ROUND` (p. 13, 15)

Normally the display is a rounded *view* of a value stored to as many as 13 digits; `ROUND` makes the view
authoritative by replacing the internally stored value with its displayed, rounded form, so subsequent arithmetic
uses the rounded number. The guidebook's illustration (p. 15) shows an internal `783.6498340833` displayed as
`783.65`; after `ROUND` the internal value has become `783.6500000000` while the display is unchanged at
`783.65`. The stated motivation is a workflow such as rounding a computed bond selling price to the penny before
continuing (p. 15). Note the ordering: `2ND` `ROUND` acts on an already-completed result — the example keys
`2` `÷` `3` `=` **then** `2ND` `ROUND` (p. 13).

### Scientific notation `Y^X` (p. 15)

When a result in standard-decimal format is too large or too small to display, the calculator switches to
scientific notation on its own: mantissa, a blank space, then the exponent. For *input*, `Y^X` doubles as the
exponent key, but only with `AOS` selected: `3 × 10³` is keyed `3` `×` `10` `Y^X` `3` (p. 15).

---

## Formulas

Only two closed-form equations are printed in this range. Both are vector drawings absent from the text layer and
were transcribed from `pages/page14.png` and `pages/page15.png`.

### Combinations (p. 14, rendered image)

```
          n!
nCr = ───────────
      (n − r)! × r!
```

LaTeX: `nCr = \dfrac{n!}{(n-r)!\,\times\,r!}`

Variables: `n` = size of the set, `r` = number of items taken at a time. Both must be greater than 0 (p. 14).
No sign convention applies. Verified against the worked example `52 nCr 5 = 2,598,960.00` (p. 13) —
`52!/(47!×5!) = 2,598,960`. **Formula and example agree.**

### Permutations (p. 15, rendered image — top of page, above the *Rounding* heading)

```
          n!
nPr = ─────────
       (n − r)!
```

LaTeX: `nPr = \dfrac{n!}{(n-r)!}`

Variables: `n` = size of the set, `r` = number of items taken at a time. Both must be greater than 0 (p. 14).
Verified against the worked example `8 nPr 3 = 336.00` (p. 13) — `8!/5! = 336`. **Formula and example agree.**

> Layout hazard worth recording: the `nPr` equation is physically printed on p. 15, orphaned above the *Rounding*
> heading, while its prose lives at the foot of p. 14. Anyone reading p. 14 alone will find the `nPr` prose with
> no equation under it.

### Percent, stated as behaviour (p. 12-13, derived from the worked examples — no equation is printed)

The guidebook prints no formula for `%`. Reconstructed from its own examples, and flagged as inference:

```
a × b %   →  a × (b/100)          453 × 4 %  = 18.12
a ÷ b %   →  a ÷ (b/100)          14 ÷ 25 %  = 56.00
a + b %   →  displays a × (b/100), then =  →  a + a×(b/100)      498 + 7 %  = → 532.86
a − b %   →  displays a × (b/100), then =  →  a − a×(b/100)      69.99 − 10 % = → 62.99
```

No printed formula contradicts this; the four examples are mutually consistent.

### Sign conventions

None of the operations in this section carry a cash-flow sign convention. The only sign-bearing keys are `+/-`
(used in `.5` `+/-` `INV` `COS` to reach `cos⁻¹(−0.5)`, p. 13) and the naturally negative results of trig
functions (`cos(120°)` → `-0.50`, p. 13). **No sign-convention defect was found in this page range** — unlike the
appendix TVM formulas, whose printed `PMT` equation is missing its leading minus sign.

---

## Key sequences

Exact keystroke order as printed. Where the guidebook omits a `2nd` that a reader might expect (the `INV` and
`HYP` sequences), the omission is reproduced faithfully — see §Edge cases.

**Reset**
```
2ND  RESET        → arms reset; RST ? and ENTER indicators light
ENTER             → performs reset; RST indicator, display 0.00
2ND  QUIT         → cancels an armed reset; display 0.00
CE/C              → required first if an error condition is live
```

**Clearing**
```
BKSP                  → delete last keyed character
CE/C                  → clear entry / error / error message
2ND  CLR WORK         → clear current worksheet, restore its defaults
2ND  FORMAT  2ND  CLR WORK   → restore format defaults
2ND  QUIT             → leave worksheet / drop all pending operations
CE/C  CE/C            → drop an un-ENTERed variable value; drop an unfinished calculation
2ND  QUIT  2ND  CLR TVM      → clear TVM variables, restore TVM defaults
0  STO  <0-9>         → clear one memory
```

**Entry correction**
```
3  ×  1234.86  BKSP  BKSP  56  =
```

**Arithmetic (terminate with `=`)**
```
6  +  4  =            6  -  4  =            6  ×  4  =            6  ÷  4  =
3  Y^X  1.25  =
7  ×  (  3  +  5  )  =
453  ×  4  %  =
14  ÷  25  %  =
498  +  7  %  =
69.99  -  10  %  =
52  2ND  NCR  5  =
8   2ND  NPR  3  =
```

**Immediate operations (no `=`)**
```
15.5     √X
3.2      1/X
5        2ND  X!
203.45   LN
.69315   2ND  E^X
6.3      X^2
2  ÷  3  =  2ND  ROUND
2ND  RAND
STO  2ND  RAND                (store seed)
11.54    2ND  SIN
120      2ND  COS
76       2ND  TAN
.2       INV  SIN
.5  +/-  INV  COS
4        INV  TAN
.5   2ND  HYP  SIN
.5   2ND  HYP  COS
.5   2ND  HYP  TAN
5    2ND  HYP  INV  SIN
5    2ND  HYP  INV  COS
.5   2ND  HYP  INV  TAN
```

**Scientific-notation entry (AOS only)**
```
3  ×  10  Y^X  3          → enters 3 × 10³
```

---

## Clearing/reset

What each control does **to this section's state**, and what it leaves alone:

| Control | Affects | Does **not** touch |
|---|---|---|
| `BKSP` | The character-level tail of the number currently being keyed | Pending operations, the stored/internal value of anything already entered, memories, worksheets, settings |
| `CE/C` | The number being keyed; a live error condition/message. After an operation key, aborts the calculation in progress | The 10 memories, format settings, worksheet variables, angle unit, calc method |
| `CE/C` `CE/C` | Any calculation started but not completed; in a worksheet, an un-`ENTER`ed keyed value (previous value reappears) | Memories, format settings, entered worksheet values |
| `2ND` `QUIT` | Exits a prompted worksheet to standard-calculator mode; **discards all pending operations** in standard-calculator mode; cancels an armed reset | Memories, worksheet variable *values*, format settings. Notably: `QUIT` alone does **not** clear TVM variables — the table pairs it with `2ND` `CLR TVM` (p. 11) |
| `2ND` `CLR WORK` | The currently displayed prompted worksheet's variables, restoring that worksheet's defaults | Standard-calculator display, memories, other worksheets. **Meaningless for this section** — standard-calculator math ops are not a worksheet, so there is nothing here for `CLR WORK` to clear |
| `2ND` `FORMAT` `2ND` `CLR WORK` | Format defaults — restores `DEC`, angle unit, calc method, date/separator formats | Memories, worksheet data, the display value |
| `2ND` `CLR TVM` | TVM worksheet variables only | Everything in this section |
| `2ND` `MEM` `2ND` `CLR WORK` | All 10 memories at once (p. 16, adjacent section) | This section's display/pending state |
| `2ND` `RESET` `ENTER` | Everything: display, all 10 memories, unfinished calculations, all worksheet data; restores all default settings; returns to standard-calculator mode (p. 10-11) | Nothing — this is the sledgehammer. Also the effect of removing/discharging the battery (p. 87) |

The stored **random seed** is not listed as a target of any selective clear. Its lifetime under `CLR WORK`,
`QUIT`, or a memory clear is unspecified; only a full reset can be assumed to discard it. See §Open questions.

---

## Errors

Error definitions are transcribed from the appendix table (p. 84, rendered image — the `√x` glyph in the Error 2
row is a vector drawing dropped from the text layer). All errors are dismissed with `CE/C` (p. 84).
Of Errors 1-8, this section can raise **1, 2, and 3**. Errors 4-8 are exclusively worksheet-bound (Amortization,
TVM, Cash Flow, Bond, Date, Depreciation, Interest Conversion, Statistics) and are unreachable from
standard-calculator math.

**Error 1 — Overflow.** Raised when:
- Any result leaves the calculator range `±9.9999999999999E99`.
- A division by zero occurs, including one that only arises internally.
- `1/X` is applied to zero.

**Error 2 — Invalid argument.** Raised when:
- `X!` is applied to an `x` that is not an integer in 0-69.
- `LN` is applied to an `x` that is not greater than 0 (so `LN 0` and `LN` of a negative are both Error 2, not
  Error 1).
- `Y^X` is evaluated with `y < 0` while `x` is neither an integer nor the inverse of an integer.
- `√X` is applied to an `x` less than 0.

**Error 3 — Too many pending operations.** Raised when:
- More than 15 active parenthesis levels are attempted.
- A calculation attempts more than 8 pending operations.

Not stated anywhere in the guidebook: which error, if any, results from violating the `n > 0` / `r > 0`
constraint on `nCr`/`nPr`, from seeding `RAND` with a non-positive or non-integer value, or from `r > n`. See
§Open questions.

---

## Edge cases & ambiguities

**1. Factorial and zero — a direct contradiction between two pages.** p. 14 requires the operand to be a
*positive integer* ≤ 69, which excludes 0. The Error 2 row (p. 84) says the error fires when `x` is *not an
integer 0-69*, which explicitly admits 0 as legal (and `0! = 1` mathematically). The two statements cannot both
hold. The error table is the more precise and the mathematically correct of the two; an implementation should
accept `0` `2ND` `X!` → `1.00`. No worked example arbitrates. Flagged.

**2. `Y^X` and "positive" — the prose contradicts itself and the error table.** p. 14 says `Y^X` raises the
displayed *positive* number to any power, then in the very next note explains the rules for raising a *negative*
number (integer exponents, or reciprocals of odd numbers). Error 2 (p. 84) confirms negative bases are legal
when `x` is an integer or the inverse of an integer. "Positive" is therefore wrong as a precondition; the
governing rule is the Error 2 condition. (The word is additionally printed as the typo "postive".)

**3. The seed example contradicts the seed rule.** p. 14 states the seed must be an integer greater than zero.
The p. 13 example table keys `STO` `2ND` `RAND` with the display sitting at `0.86` — the just-generated random
number — and shows `0.86` as the result. `0.86` is neither an integer nor greater than or equal to 1. Either the
example is sloppy (reusing the previous row's display to save a column) or non-integer seeds are silently
accepted/truncated. Unresolved; the golden case records the printed sequence and notes it is not executable as a
parity assertion.

**4. `x²` is filed under the wrong table.** `6.3` `X^2` → `39.69` (p. 13) is printed inside the table headed
"These operations require you to press `=` to complete", yet its own Press column contains no `=` and the result
is shown immediately. The example's own keystrokes win: `X^2` is an immediate unary operation. The same
misfiling does not affect `nCr`/`nPr`, which genuinely do need `=`.

**5. `INV` and `HYP` appear to imply the 2nd level.** The guidebook prints `11.54` `2nd` `[SIN]` for sine, but
`.2` `[INV]` `[SIN]` for arcsine and `.5` `2nd` `[HYP]` `[SIN]` for hyperbolic sine — i.e. `[SIN]` is reached
without a `2nd` once `INV` or `HYP` has been pressed. Read literally, `INV` and `HYP` are themselves prefixes
that select the second level (consistent with p. 7, where `INV` and `HYP` are described as *indicators* that
light to signal "press a key to select its inverse trigonometric / hyperbolic function"). An implementation must
decide whether `2ND` `INV` `SIN` is also accepted. The golden file reproduces the printed sequences verbatim
rather than normalising them.

**6. The percent add-on example straddles a page break.** The `498 + 7 %` row's terminating `=` is not on p. 12
with the rest of the row — it sits alone in a continuation row at the top of p. 13. A text-only extraction makes
this look like a stray `=` belonging to the discount row. Both percent examples are two-stage: the `%` press
displays the percentage amount (`34.86`, `7.00`) and `=` displays the total (`532.86`, `62.99`).

**7. The discount example does not actually discriminate rounded vs. internal arithmetic.** `69.99 − 10 %`
displays `7.00` (internally `6.999`). Both `69.99 − 7.00` and `69.99 − 6.999` round to `62.99`, so this example
cannot be used to prove the "13 digits internally, display is only a view" claim of p. 15. The `ROUND` diagram
(`783.6498340833` → `783.6500000000`) is the only real evidence, and it carries no keystrokes.

**8. Scientific-notation entry is undefined under the default method.** p. 15 gates `Y^X`-as-exponent on `AOS`,
but `Chn` is the default. Under `Chn`, `3` `×` `10` `Y^X` `3` evaluates left-to-right as `(3×10)³ = 27,000`
rather than `3×10³ = 3,000`. The guidebook shows no display for this example, so no golden case is derivable —
recording it would require inventing a result.

**9. `nCr`/`nPr` domain is under-specified.** "Both the `n` and `r` variables must be greater than 0" (p. 14)
excludes `r = 0` even though `nC0 = 1` and `nP0 = 1`. Nothing is said about non-integer operands, about `r > n`
(where `(n−r)!` would need a factorial of a negative), or about `n > 69` (where the printed formula's `n!` would
breach the factorial limit even though `52 nCr 5` is fine and `70 nCr 68` is a small number). An implementation
that literally evaluates `n!/((n−r)!×r!)` will raise Error 2 on `n > 69` inputs that the calculator plausibly
handles; the guidebook does not say which behaviour is correct.

**10. Display formatting during entry differs from display formatting of results.** `1,234.` (p. 12) shows that
mid-entry the display applies the thousands separator and preserves a trailing decimal point, but does **not**
pad to the `DEC=2` format. Results do (`3.00`, `10.00`, `120.00`).

**11. Random is inherently non-deterministic.** `2ND` `RAND` → `0.86` is annotated by the guidebook itself with
"The random number you generate might be different" (p. 14). The golden case for it asserts only the range
constraint, not the printed value.

**12. `ROUND` with no `DEC` context and no pending calculation.** The example always applies `ROUND` to a
completed result at `DEC=2`. Behaviour when `DEC=9`, when the format is floating, or when `ROUND` is pressed on a
freshly keyed number rather than a computed one, is not covered.

**13. `2ND` `CLR WORK` has no meaning in standard-calculator mode.** The clearing table (p. 11) describes it as
clearing "the prompted worksheet". This section is not a worksheet, so `CLR WORK` is a no-op here — the
equivalent operations are `CE/C` (entry), `CE/C` `CE/C` (unfinished calculation) and `2ND` `QUIT` (pending
operations).

**14. Reset over a live error.** p. 11 requires `CE/C` before `2ND` `RESET` when an error condition exists. It
does not say what happens if you skip it — whether the reset is silently refused or the `RST ?` prompt simply
never appears.

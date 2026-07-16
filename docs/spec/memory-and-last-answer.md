# Memory, Constants, Last Answer, and the Worksheet Navigation Model

> Source: official BA II Plus guidebook, pages 16-23. Behaviour described in original wording.
>
> **Page-numbering convention:** all `p. N` citations in this document are *file/PDF* page
> numbers (`research/pages/pageNN.png`, and the `========== PAGE N ==========` markers in
> `research/guidebook.txt`). The guidebook's own *printed* folio runs five lower: file
> p. 16 is printed p. 11. So this section's range, file p. 16-23, is printed p. 11-18.

Scope: the ten standard-calculator memory registers (`M0`-`M9`), `STO` / `RCL`, memory
arithmetic, constant (`K`) calculations, the Last Answer (`ANS`) feature, and the general
navigation/variable-type model shared by every prompted worksheet.

Supporting cross-references outside the primary range are cited where they change or
constrain behaviour: the clearing table (p. 11), reset semantics (p. 10), the Memory
worksheet chapter (p. 72-73), and the error appendix (p. 84-85).

---

## Variables

### Memory registers

| Name | Display label | Default | Type | Valid range |
|---|---|---|---|---|
| Memory 0 | `M0` | `0` | entered (enter-only) | any value the calculator can represent |
| Memory 1 | `M1` | `0` | entered (enter-only) | as above |
| Memory 2 | `M2` | `0` | entered (enter-only) | as above |
| Memory 3 | `M3` | `0` | entered (enter-only) | as above |
| Memory 4 | `M4` | `0` | entered (enter-only) | as above |
| Memory 5 | `M5` | `0` | entered (enter-only) | as above |
| Memory 6 | `M6` | `0` | entered (enter-only) | as above |
| Memory 7 | `M7` | `0` | entered (enter-only) | as above |
| Memory 8 | `M8` | `0` | entered (enter-only) | as above |
| Memory 9 | `M9` | `0` | entered (enter-only) | as above |

- Any numeric value inside the calculator's representable range may be stored (p. 16). The
  range is given in the error appendix as `±1E-99` through `±9.9999999999999E99`, since
  Error 1 (Overflow) is defined as a result falling outside `±9.9999999999999E99` (p. 84).
- The registers are addressed by the digit keys `0` through `9` (p. 16).
- All ten are classified enter-only when reached through the Memory worksheet (p. 72-73:
  `M0`-`M2` are tabulated on p. 72, `M3`-`M9` on p. 73).
- Registers survive power-off through the Constant Memory feature (p. 16).

### Other state owned by this section

| Name | Display label | Default | Type | Valid range |
|---|---|---|---|---|
| Last Answer | `ANS` (recalled to the display; no persistent on-screen label) | `0` | computed / implicitly maintained | calculator range |
| Constant register | none; no dedicated display indicator is documented (p. 7-8) | empty (no constant armed) | setting-like, armed by keystroke | holds one pending operator plus one operand |

The constant register is not a user-visible variable. It captures the operator/operand pair
armed by `2ND` `K` and is discarded as soon as any key other than a digit or `=` is pressed
(p. 18).

---

## Behaviour

### Storing (p. 16)

Pressing `STO` followed by a digit key `0`-`9` copies the currently displayed value into
that register. The write is unconditional: whatever was previously held in the register is
overwritten with no confirmation step. Storing does not disturb the display and does not
resolve any arithmetic that is still pending.

### Recalling (p. 16)

Pressing `RCL` followed by a digit key `0`-`9` brings that register's contents into the
display. The register is left intact, so the same value can be recalled repeatedly. `RCL`
is one of the documented ways to supply a value to an enter-only worksheet variable
(p. 21).

### Clearing memory (p. 16, p. 11)

Two paths exist:

- One register at a time, leaving the other nine alone: display zero and store it, i.e.
  `0` `STO` `n` (p. 16, restated in the clearing table on p. 11). There is no dedicated
  "clear this memory" key.
- All ten at once: `2ND` `MEM` `2ND` `CLR WORK` (p. 16). This is the Memory worksheet's
  own `CLR WORK`, reached by first entering that worksheet; the Memory worksheet chapter
  documents the same clear as plain `2ND` `CLR WORK` once you are already inside it
  (p. 73).

The guidebook treats clearing memory before starting fresh work as a precaution against
carrying stale values into a new problem (p. 16).

A full calculator reset (`2ND` `RESET` `ENTER`) also zeroes all ten registers, along with
the display, any unfinished calculation, and every worksheet's data (p. 10).

### Memory arithmetic (p. 16-17)

`STO` followed by an arithmetic key and then a digit performs the operation between the
register's current contents and the displayed value, and writes the result back into that
same register in one action. Two invariants are stated explicitly (p. 16):

1. Only the targeted register changes. The display is left exactly as it was.
2. A calculation already in progress is not completed or otherwise advanced.

The five supported operations, with the register named in the guidebook's own examples
(p. 17):

| Operation | Keys | Effect |
|---|---|---|
| Add | `STO` `+` `9` | `M9` becomes `M9` + displayed value |
| Subtract | `STO` `-` `3` | `M3` becomes `M3` − displayed value |
| Multiply | `STO` `×` `0` | `M0` becomes `M0` × displayed value |
| Divide | `STO` `÷` `5` | `M5` becomes `M5` ÷ displayed value |
| Power | `STO` `Y^X` `4` | `M4` becomes `M4` raised to the displayed value |

The register is always the left-hand operand and the display is always the right-hand
operand. This is only observable for the three non-commutative operations (subtract,
divide, power), and the guidebook's wording pins it down for each of them individually
(p. 17).

### Constant calculations (p. 18)

Arming a constant requires a number, an operator, the constant operand, and `2ND` `K` — but
**the guidebook prints two conflicting orders for these on p. 18** and never reconciles
them:

- Worked-example order: `n` `OP` `c` `2ND` `K` (e.g. `3` `×` `8` `2ND` `K`).
- Template-table order: `n` `OP` `2ND` `K` `c` (e.g. `10` `+` `2ND` `K` `5`).

See "Contradictions between printed formulas and worked examples" below; both are treated as
valid here. Under either order, from that point each `=` applies the stored operator/operand
pair to whatever is in the display, and the first `=` after arming also finishes the original
calculation that armed the constant.

Re-running the constant on a new value is just: key the value, press `=`. The guidebook's
footnote states the repeat form as `n` `=` (p. 18).

The constant survives only while you press digits or `=`. Any other key discards it
(p. 18).

Templates for each operator, using `c` for the constant operand and `n` for the seed value
(p. 18):

| Goal | Keys |
|---|---|
| Add `c` to each later entry | `n` `+` `2ND` `K` `c` `=` |
| Subtract `c` from each later entry | `n` `-` `2ND` `K` `c` `=` |
| Multiply each later entry by `c` | `n` `×` `2ND` `K` `c` `=` |
| Divide each later entry by `c` | `n` `÷` `2ND` `K` `c` `=` |
| Raise each later entry to the power `c` | `n` `Y^X` `2ND` `K` `c` `=` |
| Add `c`% of each later entry to that entry | `n` `+` `2ND` `K` `c` `%` `=` |
| Subtract `c`% of each later entry from it | `n` `-` `2ND` `K` `c` `%` `=` |

Note the last two: the percent forms make the constant *relative* to the operand it is
applied to, not a fixed addend.

### Last Answer (p. 19)

`2ND` `ANS` puts the most recently produced result back into the display. Its stated
purpose is to carry a value between two points in one worksheet, between worksheets,
between a worksheet and standard-calculator mode, and back again — and to avoid rekeying a
figure a problem needs more than once.

`ANS` is refreshed on any of the following (p. 19):

- `ENTER`, when it commits a value to a variable.
- `CPT`, when it computes a value.
- `=`, when it closes out a calculation.
- Any automatic computation the calculator performs on its own (this covers the
  automatic-compute variables described on p. 22, e.g. Amortization `BAL`, `PRN`, `INT`).

The worked example on p. 19 shows `ANS` acting as an ordinary operand: it can be dropped
into the middle of a pending operation and the operation then closed with `=`.

### Worksheet navigation model (p. 19-23)

- Each worksheet carries its own embedded formulas and its own variables. Worksheets are
  mutually isolated: work in one does not perturb another's variables (p. 19).
- All worksheet data persists across leaving a worksheet and across power-off (p. 19).
- Every variable is prompted except the TVM variables, which live in standard-calculator
  mode and are reached with the five TVM keys directly (p. 19, p. 21).
- Inside a prompted worksheet, `↓` and `↑` step through the variable list (p. 21). The `↓`
  and `↑` display indicators signal that more variables exist in that direction.
- `2ND` `QUIT` returns to standard-calculator mode (p. 21).
- An `=` sign between the label and the value means the variable currently holds that value
  (p. 21).
- Worksheet keys (p. 20): TVM = the five TVM keys or `2ND` `P/Y`; `2ND` `AMORT`;
  `2ND` `CF`; `2ND` `BOND`; `2ND` `DEPR`; `2ND` `STAT`; `2ND` `Δ%`; `2ND` `ICONV`;
  `2ND` `DATE`; `2ND` `PROFIT`; `2ND` `BRKEVN`; `2ND` `MEM`.

#### Variable types (p. 21-22)

| Type | How it is driven | Indicator shown | Example |
|---|---|---|---|
| Enter-only | must be keyed and committed with `ENTER`; cannot be computed | `ENTER` | `P/Y`, `C/Y`, `M0`-`M9` |
| Compute-only | cannot be keyed; press `CPT` | `COMPUTE` | `NPV` |
| Automatic-compute | computed and shown the moment you scroll onto it; no `CPT` needed | none required | Amortization `INT` |
| Enter-or-compute | either keyed and committed, or computed with `CPT` | `ENTER` and `COMPUTE` together | `N`, `I/Y`, `PV`, `PMT`, `FV`; Bond `YLD`/`PRI` |
| Setting | cycled through its options with `2ND` `SET`, one press per option | `SET` | Date `ACT/360` |

An enter-only variable will accept a value keyed straight from the keyboard, produced by a
math calculation, pulled out of a memory register with `RCL`, or carried across from
another worksheet via `ANS` (p. 21) — which is the hook that ties this section's memory and
Last Answer features into every worksheet.

TVM values may be *assigned* from inside a prompted worksheet, but computing them or
clearing the TVM worksheet requires being back in standard-calculator mode (p. 21, p. 22).

#### Result-provenance indicators (p. 22-23)

- `◁` appears after `ENTER` and means the shown value is the one now held by the variable.
- `∗` appears after `CPT` and means the shown value was computed.
- Either indicator vanishes as soon as some other change makes that value stale.

---

## Formulas

There are no vector-drawn equations on pages 16-23; every rendered page image in this range
was checked and the pages carry prose and tables only. The relations below are written in
this document's own notation to make the documented behaviour executable. They are
restatements of the p. 17 and p. 18 tables, not transcriptions of printed equations.

### Memory arithmetic (p. 17)

Let `Mn` be the register's value before the keystroke and `D` the displayed value. In every
case the register is the left operand:

```
STO +   n   ->   Mn' = Mn + D
STO -   n   ->   Mn' = Mn - D
STO ×   n   ->   Mn' = Mn × D
STO ÷   n   ->   Mn' = Mn ÷ D
STO Y^X n   ->   Mn' = Mn ^ D
```

In all five, the display is unchanged (`D' = D`) and any pending operation stays pending
(p. 16).

### Storing and recalling (p. 16)

```
STO n   ->   Mn' = D ;  D' = D
RCL n   ->   D'  = Mn ;  Mn' = Mn
```

### Constant calculations (p. 18)

Arming (`n OP 2ND K c` per the template table, or `n OP c 2ND K` per the worked example —
the two printed orders conflict, see above) stores the pair `(OP, c)`. Thereafter, for a
displayed value `x`:

```
x  =   ->   result = x OP c
```

with the special case that the `=` immediately following `2ND` `K` is applied to the seed
value `n`, producing `n OP c`. The percent variants store the pair `(OP, c%)` and evaluate
against the current entry:

```
n + 2ND K c % =   ->   result = x + (x × c / 100)
n - 2ND K c % =   ->   result = x - (x × c / 100)
```

### Sign conventions

Nothing in this section imposes a cash-flow sign convention. Values are stored and recalled
with their sign intact; the display's `-` indicator (p. 8) is the only sign presentation.

### Contradictions between printed formulas and worked examples

**The constant-arming key order is self-contradictory on p. 18.** The page prints two
mutually incompatible grammars for the same feature, roughly two inches apart:

| Source on p. 18 | Order | Literal keys |
|---|---|---|
| Worked example, "Multiply 3, 7, and 45 by 8" | `2ND` `K` **after** the constant operand | `3` `×` `8` │ `2ND` `K` `=` → `24.00` |
| "Keystrokes for Constant Calculations" table (all 7 rows) | `2ND` `K` **before** the constant operand | `n` `×` `2ND` `K` `c` `=` |

The example's own row labels make its order unambiguous: `× 8` is captioned "Enter the
operation and a constant value", and `2ND K =` is captioned "Store the operation and value,
and then calculate" — so `8` is keyed *before* `2ND` `K`. The template rows are equally
unambiguous in the rendered image: `2nd` `[K]` is typeset between the operator and the
italic `c`.

The intro prose ("enter a number and an operation, and then press `2ND` `[K]`") names only
two items before `K`, which leans toward the template order, giving prose + table (2) versus
worked example (1). The guidebook never reconciles them and no printed example exercises
the template order end-to-end.

**Resolution taken here:** neither order is treated as authoritative, because both are
printed. The golden corpus carries both families — six cases transcribing the worked
example verbatim and six derived from the template table — and every one of them is tagged
`DISPUTED KEY ORDER` in its notes. A parity implementation must accept `2ND` `K` on either
side of the constant operand to pass the corpus. This is the sharpest conflict in the range
and is load-bearing for any constant-calculation parser.

No *sign* conflicts exist in this range. The formula/worked-example sign conflicts
documented elsewhere in this project (e.g. the appendix `PMT` formula) do not touch pages
16-23. Other presentation-level discrepancies are listed under "Edge cases & ambiguities".

---

## Key sequences

Memory (p. 16):

```
STO n                 store display into Mn                (n = 0..9)
RCL n                 recall Mn into the display
0 STO n               clear Mn only
2ND MEM 2ND CLR WORK  clear all ten registers
2ND MEM               open the Memory worksheet at M0
2ND MEM ↓ ↓ ↓ ↓       scroll to M4
```

Memory arithmetic (p. 17):

```
STO + n
STO - n
STO × n
STO ÷ n
STO Y^X n
```

Constants (p. 18):

```
2ND QUIT              clear to standard-calculator mode
n OP c 2ND K =        arm + finish seeding calc  (worked-example order, p. 18)
n OP 2ND K c =        arm + finish seeding calc  (template-table order, p. 18)
                      ^ the guidebook prints BOTH; see "Contradictions"
x =                   apply the armed constant to x
n + 2ND K c % =       percent-add form      (template order; no printed example)
n - 2ND K c % =       percent-subtract form (template order; no printed example)
```

Last Answer (p. 19):

```
2ND ANS               recall the last answer into the display
```

Navigation (p. 19-22):

```
↓ / ↑                 previous / next variable inside a prompted worksheet
ENTER                 commit the keyed value to the displayed variable
CPT                   compute the displayed variable
2ND SET               advance a settings variable to its next option
2ND QUIT              leave the worksheet, return to standard-calculator mode
```

Worked-example sequences, exactly as printed:

```
Constants, "Multiply 3, 7, and 45 by 8" (p. 18)
  2ND QUIT      -> 0.00
  3             -> 3
  × 8           -> 8
  2ND K =       -> 24.00
  7 =           -> 56.00
  45 =          -> 360.00

Last Answer in a calculation (p. 19)
  3 + 1 =       -> 4.00
  2 Y^X         -> 2.00
  2ND ANS       -> 4.00
  =             -> 16.00

Memory examples (p. 16; the table prints no Display column)
  0 STO 4       clear M4
  14.95 STO 3   store 14.95 into M3
  RCL 7         recall M7
```

---

## Clearing/reset

| Action | Effect on this section's state | What it leaves alone |
|---|---|---|
| `2ND` `CLR WORK` inside the Memory worksheet (`2ND` `MEM` `2ND` `CLR WORK`) | zeroes all ten registers (p. 16, p. 73) | display, `ANS`, constant register, every other worksheet |
| `2ND` `CLR WORK` inside any *other* prompted worksheet | nothing — it resets that worksheet's own variables only (p. 11) | all ten registers, `ANS`, constant register |
| `0` `STO` `n` | zeroes register `n` only (p. 11, p. 16) | the other nine registers, display, `ANS` |
| `2ND` `CLR TVM` (reached via `2ND` `QUIT` `2ND` `CLR TVM`) | nothing here — it resets `N`, `I/Y`, `PV`, `PMT`, `FV` to defaults (p. 11, p. 25) | all ten registers, `ANS`, constant register |
| `2ND` `QUIT` | drops all pending operations and returns to standard-calculator mode (p. 11); display shows `0.00`. Because it is not a digit and not `=`, it also discards any armed constant (p. 18) | all ten registers, `ANS`, worksheet data |
| `CE/C` `CE/C` | discards a keyed-but-uncommitted worksheet value (the prior value reappears) and any calculation started but not finished (p. 11). Discards an armed constant (p. 18) | all ten registers, `ANS` |
| `CE/C` (single) | clears an incorrect entry, an error condition, or an error message (p. 11, p. 84) | registers, `ANS` |
| `2ND` `FORMAT` `2ND` `CLR WORK` | resets format settings, including `DEC`, to defaults (p. 10, p. 11). Changes how registers are *displayed*, not what they hold | stored values themselves |
| `2ND` `RESET` `ENTER` | zeroes all ten registers, clears the display and any unfinished calculation, wipes all worksheet data, restores every default, and returns to standard-calculator mode (p. 10-11) | nothing in this section survives |
| Power-off | nothing is lost: Constant Memory preserves all stored values (p. 16) and worksheet data (p. 19) | — |

`2ND` `RESET` can be cancelled at the `RST ?` prompt with `2ND` `QUIT` (p. 11). If an error
is on screen, `CE/C` must clear it before reset will proceed (p. 11).

---

## Errors

Which of Errors 1-8 this section can raise (definitions from p. 84-85; any error message is
dismissed with `CE/C`):

- **Error 1 — Overflow.** Raised when a memory-arithmetic result or a constant-calculation
  result lands outside `±9.9999999999999E99`, and when `STO` `÷` `n` is executed with zero
  in the display (division by zero). The appendix also notes division by zero can arise
  internally.
- **Error 2 — Invalid argument.** Raised by `STO` `Y^X` `n` when the register holds a
  negative value and the displayed exponent is neither an integer nor the inverse of an
  integer. The same restriction is stated for the universal power key on p. 14. The
  `Y^X`-form constant (`n` `Y^X` `2ND` `K` `c` `=`) can raise it for the same reason.
- **Error 3 — Too many pending operations.** Reachable from standard-calculator mode when a
  constant calculation is embedded in an expression that exceeds 15 levels of parentheses
  or 8 pending operations. Memory arithmetic itself cannot cause this: it explicitly does
  not add to the pending stack (p. 16).

Not reachable from this section:

- **Error 4 — Out of range.** The memory address space is `0`-`9` and there is no keystroke
  that can address a register outside it, so no out-of-range register error can be
  produced. The `DEC` clause of Error 4 belongs to the format section.
- **Errors 5, 6, 7, 8.** All causes listed are specific to the TVM, Cash Flow, Bond, Date,
  Amortization, and Depreciation worksheets (no-solution, invalid-date, iteration-limit,
  and user-cancelled-iteration conditions). Nothing in memory, constants, Last Answer, or
  navigation iterates or parses dates.

---

## Edge cases & ambiguities

1. **`2ND` `MEM` `2ND` `CLR WORK` leaves you inside the Memory worksheet.** Page 16
   presents this as a plain "clear all memories" action, but the first half of the sequence
   is a worksheet entry. The guidebook never says on p. 16 that a following `2ND` `QUIT` is
   needed to get back to standard-calculator mode. Implementations must decide the
   post-state; the Memory worksheet chapter (p. 72-73) implies `M0` is displayed afterwards.

2. **Entry echoes are not formatted to the `DEC` setting.** The constants example (p. 18)
   is run at the default two decimals yet shows `3` and `8` — the raw keyed digits —
   while every computed result in the same table shows two decimals (`24.00`, `56.00`,
   `360.00`). The Last Answer example (p. 19) shows `2.00` after `2` `Y^X`, i.e. the
   pending operand *is* formatted once an operator key is pressed. The guidebook never
   states this rule; it is only inferable from the two tables read together. This is the
   sharpest display-model ambiguity in the range and the golden tests pin both cases.

3. **Two different memory-arithmetic mechanisms exist, with opposite display behaviour.**
   Standard-calculator mode uses `STO` `OP` `n` and explicitly does *not* change the display
   (p. 16). The Memory worksheet uses `OP` `value` `ENTER` while parked on a register, and
   its example table shows the display updating to the new register value each time, e.g.
   `M4= 160.00` after adding 65 to 95 (p. 73). Both are legitimate; a parity implementation
   needs both, and they cannot share a code path naively.

4. **Where `2ND` `K` goes relative to the constant operand is contradicted, not merely
   under-specified.** The p. 18 worked example arms with `3` `×` `8` `2ND` `K` `=`; the
   template table on the same page prints `n` `×` `2ND` `K` `c` `=`. This is a printed
   self-contradiction rather than an omission, so it is documented in full under
   "Contradictions between printed formulas and worked examples" above. Implementations must
   accept both orders. Listed here so the ambiguity index is complete.

5. **Which keys clear an armed constant is under-specified.** Page 18 says only "a key
   other than a number or `=`". It is not stated whether the decimal point, `+/-`, the
   backspace key, `2ND` itself, `STO`, or `RCL` count as "a number" for this purpose. The
   safest reading is that only the ten digit keys and `=` preserve the constant, but the
   guidebook does not confirm it.

6. **Interaction of `STO`/`RCL` with an armed constant is undocumented.** By the strict
   reading of rule (5), pressing `STO` would discard the constant — which would make
   "store the running result then continue the constant" impossible. No example exercises
   this.

7. **Does `STO` or `RCL` update `ANS`?** Page 19 lists exactly three triggers plus
   automatic computation, and neither `STO` nor `RCL` is among them, so the answer should be
   no. But `RCL` visibly changes the display, and the guidebook never states the negative
   case explicitly.

8. **Does scrolling onto an automatic-compute variable overwrite `ANS`?** Page 19 says
   `ANS` changes whenever the calculator "calculates a value automatically", and p. 22
   defines automatic-compute variables as computing on scroll without `CPT`. Read together
   this means merely pressing `↓` in the Amortization worksheet clobbers `ANS` — a real
   trap, and never called out.

9. **`ANS` default at reset is not stated.** Page 10 lists what reset clears (display,
   memories, unfinished calculations, worksheet data) and `ANS` is not named. Defaulting it
   to `0` is an assumption.

10. **Memory arithmetic on a pending operand.** Since memory arithmetic does not complete a
   calculation in progress (p. 16), the sequence `3` `+` `5` `STO` `+` `9` `=` should apply
   `5` to `M9` and still yield `8.00`. No example demonstrates this; it is derived from the
   stated invariant and is covered by a golden test flagged as derived.

11. **The p. 17 table is a text-extraction hazard.** In the extracted text the Press column
    wraps, making `STO - 3` look like `STO -` followed by a stray `3` on the next line. The
    page image confirms the register digit is part of the sequence. Anyone re-deriving this
    table from text alone will get it wrong.

12. **Constant plus `%` ordering.** The percent templates place `%` after `c` and before
    `=` (`n` `+` `2ND` `K` `c` `%` `=`), meaning the constant register holds a percentage
    rather than a plain operand. Whether the stored constant is `(+, 10%)` or the already
    evaluated `(+, 20)` from the seed is not stated; the table's promise ("add `c`% of each
    subsequent entry to that entry") requires the former, so the percentage must be
    re-evaluated against each new entry.

13. **`RCL` into a worksheet variable.** Page 21 permits recalling from memory to supply an
    enter-only variable's value, but does not say whether `ENTER` is still required
    afterwards. By the general enter-only rule (`ENTER` commits, `◁` confirms) it is.

14. **Register range vs. display range.** Page 16 permits storing "any numeric value within
    the range of the calculator". Since internal precision is 13 digits (p. 9) but the
    display shows at most 10, a stored value can legitimately be more precise than anything
    that can be shown. `RCL` therefore recalls the full internal value even though the
    display truncates it.

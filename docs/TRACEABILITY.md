# Traceability Matrix

> **This is a living document.** It is the Phase 0 deliverable required by the project brief, and it
> stays open for the life of the project. Every row is a contract between a documented behaviour, the
> guidebook passage that defines it, and the golden test that proves it. Rows are added as behaviours
> are discovered and the **Status** column is advanced as they are implemented and verified. A row
> whose Status is anything but `Verified` is not done, regardless of what the code looks like.

**Status vocabulary**

| Status | Meaning |
|---|---|
| `Not started` | No implementation. This is the Phase 0 baseline — every row starts here. |
| `In progress` | Implementation exists; golden tests not yet green. |
| `Implemented` | Golden tests green. |
| `Verified` | Golden tests green **and** the row's open questions are closed (or explicitly accepted as risk). |
| `Blocked` | Cannot be implemented from the guidebook alone — see `OPEN-QUESTIONS.md`. |

**Page-number convention.** All `p. N` citations are **PDF/extraction page numbers** (the
`========== PAGE N ==========` markers in `research/guidebook.txt` and the `research/pages/pageNN.png`
images). The guidebook's printed footer folio runs **five lower** — PDF p. 6 carries footer "1", PDF
p. 84 carries footer "79". Every spec file in `docs/spec/` uses the same convention.
(One spec, `overview-display-formats.md`, describes the offset as "six lower" while its own worked
examples show five; logged in `OPEN-QUESTIONS.md` as **DOC-1**.)

**Key-token convention.** The engine consumes key *tokens*, not physical key positions. Tokens are
uppercase and match the golden corpus: `2ND`, `CPT`, `ENTER`, `UP`/`DOWN` (`↑`/`↓`), `BKSP` (`→`),
`CE/C`, `+`, `-`, `×`, `÷`, `=`, `Y^X`, `√X`, `X^2`, `1/X`, `%`, `(`, `)`, `LN`, `INV`, `+/-`, `STO`,
`RCL`, `N`, `I/Y`, `PV`, `PMT`, `FV`, `CF`, `NPV`, `IRR`. Do **not** use ASCII `*` or `/` for the
multiply/divide keys — the guidebook prints `×` and `÷`, and divergent tokens defeat cross-file dedupe.

**Which primary key each second function is printed above is deliberately not asserted here.** The
specs record the second-function *names* and their key sequences, not the physical keyboard layout.
The engine is layout-independent; the pairing matters only for the Phase 4 UI and needs a keyboard
photo or hardware check before the key-cap art is drawn (logged as **KEY-1**).

**Coverage summary at Phase 0 baseline**

| Area | Rows | Golden cases | Notes |
|---|---|---|---|
| 1. Standard math | 27 | 43 | `clearing-and-math-ops.json` |
| 2. Display / format | 15 | 8 | `overview-display-formats.json` |
| 3. Memory / constants / ANS | 12 | 29 | `memory-and-last-answer.json` |
| 4. TVM | 15 | 23 | `tvm-and-amortization.json` (TVM subset) |
| 5. Amortization | 10 | 14 | `tvm-and-amortization.json` (amort subset) |
| 6. Cash Flow | 12 | 37 | `cash-flow.json` |
| 7. Bond | 12 | 17 | `bond.json` |
| 8. Depreciation | 14 | 15 | `depreciation.json` |
| 9. Statistics | 15 | **0** | **No oracle in the guidebook — see STAT-1** |
| 10. Other worksheets | 19 | 37 | `other-worksheets.json` (6 sub-worksheets) |
| 11. Errors / clearing | 23 | 3 | `errors-accuracy-aos.json` |
| Appendix cross-checks | — | 30 | `appendix-formulas.json` (arbiter cases, cross-referenced — see DEDUPE-1) |
| **Total** | **174** | **256** | |

At the Phase 0 baseline: **151 rows `Not started`, 23 rows `Blocked`.** Of the 23 blocked, **15 are the
entire Statistics worksheet** (no oracle exists — STAT-1) and the remaining 8 are individually
undecidable from this source: Depreciation `DBX` / `SLF`+`DBF` / `FSTYR` / method-cycle-order,
Bond `CPT YLD` navigation, Error 4's dropped comparison operators, Error 7's unquantified trigger, and
scientific-notation entry under the default CHN method.

---

## 1. Standard math (standard-calculator mode)

> Spec: `docs/spec/clearing-and-math-ops.md` (pp. 11-15), `docs/spec/errors-accuracy-aos.md` (p. 87).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `0`-`9`, `.` (digit entry) | p. 12 | Builds the entry buffer. Mid-entry display applies the thousands separator and keeps a bare trailing decimal point (`1,234.`); it is **not** padded to `DEC`. | display | — | `clearing-and-math-ops-entry-error-typo`, `-entry-error-backspace` | Not started |
| `+/-` (sign change) | p. 12, p. 26 | Negates the value after the digits are keyed. | display | — | `clearing-and-math-ops-arccosine-neg-0-5`, `tvm-basic-loan-interest` | Not started |
| `+` (add) | p. 12 | Infix binary; resolves on `=`. `6 + 4 =` → `10.00`. | display, pending stack | E1 overflow | `clearing-and-math-ops-add-6-plus-4` | Not started |
| `-` (subtract) | p. 12 | Infix binary; resolves on `=`. `6 - 4 =` → `2.00`. | display, pending stack | E1 | `clearing-and-math-ops-subtract-6-minus-4` | Not started |
| `×` (multiply) | p. 12 | Infix binary; resolves on `=`. `6 × 4 =` → `24.00`. | display, pending stack | E1 | `clearing-and-math-ops-multiply-6-times-4` | Not started |
| `÷` (divide) | p. 12 | Infix binary; resolves on `=`. `6 ÷ 4 =` → `1.50`. | display, pending stack | E1 (divide by zero) | `clearing-and-math-ops-divide-6-by-4` | Not started |
| `=` (equals) | p. 12, p. 14, p. 87 | Lowest AOS priority. Resolves every pending operation and closes all open parentheses. Refreshes `ANS`. | display, pending stack, ANS | E1, E3 | all `clearing-and-math-ops-*` arithmetic | Not started |
| `%` (percent) | pp. 12-13 | **Context-sensitive, no printed formula.** After `×`/`÷`: scales operand by 1/100 (`453 × 4 %` → `18.12`; `14 ÷ 25 %` → `56.00`). After `+`/`-`: resolves to that percentage *of the first operand* and displays the amount **before** `=` (`498 + 7 %` → `34.86`, then `=` → `532.86`). | display, pending stack | E1 | `clearing-and-math-ops-percent-of-453`, `-percent-ratio-14-to-25`, `-percent-add-on-amount`, `-percent-add-on-total`, `-percent-discount-amount`, `-percent-discount-total` | Not started |
| `Y^X` (universal power) | p. 12, p. 14 | Infix; resolves on `=`. `3 Y^X 1.25 =` → `3.95`. Negative base legal only with an integer exponent or the reciprocal of an odd number. | display, pending stack | **E2** (`y<0` and `x` neither integer nor 1/integer), E1 | `clearing-and-math-ops-universal-power-3-pow-1-25` | Not started |
| `(` `)` (parentheses) | p. 12, p. 14 | Override evaluation order. ≤15 nesting levels, ≤8 pending operations. Trailing `)` optional — `=` closes all. Each explicit `)` reveals one intermediate result. `7 × ( 3 + 5 ) =` → `56.00`. | parenLevels (0-15), pending stack (0-8) | **E3** (>15 levels or >8 pending) | `clearing-and-math-ops-parentheses-7-times-3-plus-5` | Not started |
| `X^2` (square) | p. 13 | **Immediate unary** — resolves on keypress, no `=`. `6.3 X^2` → `39.69`. (Printed in the "requires `=`" table, but its own Press column has no `=`; the example wins.) | display | E1 | `clearing-and-math-ops-square-6-3` | Not started |
| `√X` (square root) | p. 13 | Immediate unary. `15.5 √X` → `3.94`. | display | **E2** (`x < 0`) | `clearing-and-math-ops-square-root-15-5` | Not started |
| `1/X` (reciprocal) | p. 13 | Immediate unary. `3.2 1/X` → `0.31` (exact 0.3125). | display | **E1** (`x = 0`) | `clearing-and-math-ops-reciprocal-3-2` | Not started |
| `LN` (natural log) | p. 13 | Immediate unary. `203.45 LN` → `5.32`. | display | **E2** (`x` not > 0 — so `LN 0` is E2, not E1) | `clearing-and-math-ops-natural-log-203-45` | Not started |
| `2ND E^X` (antilog) | p. 13 | Immediate unary. `.69315 2ND E^X` → `2.00`. | display | E1 (overflow) | `clearing-and-math-ops-natural-antilog-0-69315` | Not started |
| `2ND X!` (factorial) | pp. 13-14 | Immediate unary. `5 2ND X!` → `120.00`. | display | **E2** (`x` not an integer 0-69). **p. 14 says "positive integer ≤ 69" (excludes 0); p. 84 says "integer 0-69" (admits 0). Contradiction — see MATH-1.** | `clearing-and-math-ops-factorial-5` | Not started |
| `2ND NCR` (combinations) | pp. 13-15 | Infix; requires `=`. `52 2ND NCR 5 =` → `2,598,960.00`. Formula `n!/((n-r)!·r!)` (p. 14, vector image). | display | Domain `n>0, r>0` stated but **no error code assigned** — see MATH-4 | `clearing-and-math-ops-combinations-52-choose-5` | Not started |
| `2ND NPR` (permutations) | pp. 13-15 | Infix; requires `=`. `8 2ND NPR 3 =` → `336.00`. Formula `n!/(n-r)!` (p. 15 image, orphaned above the *Rounding* heading). | display | as above | `clearing-and-math-ops-permutations-8-p-3` | Not started |
| `2ND ROUND` | p. 13, p. 15 | Replaces the **internal** 13-digit value with its displayed, rounded form; the display itself does not change. `783.6498340833` shown as `783.65` becomes internal `783.6500000000`. Applied to a *completed* result: `2 ÷ 3 = 2ND ROUND` → `0.67`. | display, internal value, reads `DEC` | — | `clearing-and-math-ops-round-2-divided-by-3` | Not started |
| `2ND RAND` (random) | pp. 13-14 | Returns a uniform real strictly in `(0,1)`. Printed `0.86` is footnoted non-reproducible. | display | — | `clearing-and-math-ops-random-number` (asserts range only) | Not started |
| `STO 2ND RAND` (seed) | p. 14 | Seeds the generator for a reproducible sequence. Seed must be an integer > 0 (p. 14) — **but the p. 13 example seeds with `0.86`. Contradiction — see MATH-2.** | random seed | none documented | `clearing-and-math-ops-store-seed` (marked NOT EXECUTABLE) | Not started |
| `2ND SIN` / `2ND COS` / `2ND TAN` | pp. 13-14 | Immediate. Argument in the selected angle unit (`DEG` default). `11.54 2ND SIN` → `0.20`; `120 2ND COS` → `-0.50`; `76 2ND TAN` → `4.01`. | display, reads angle unit | E1 (e.g. `tan 90°`) | `clearing-and-math-ops-sine-11-54-deg`, `-cosine-120-deg`, `-tangent-76-deg` | Not started |
| `INV SIN` / `INV COS` / `INV TAN` | p. 13 | Inverse trig. **The guidebook prints `INV` with no `2ND` before the function key** (`.2 INV SIN` → `11.54`). `INV` is itself a second-level prefix (p. 7). See MATH-3. | display, reads angle unit | E2 (domain) | `clearing-and-math-ops-arcsine-0-2`, `-arccosine-neg-0-5`, `-arctangent-4` | Not started |
| `2ND HYP SIN/COS/TAN` | p. 13 | Hyperbolic. Operand is a pure number — angle unit is irrelevant. `.5 2ND HYP SIN` → `0.52`. | display | E1; **acosh/atanh domain errors are undocumented — see MATH-5** | `clearing-and-math-ops-hyperbolic-sine-0-5`, `-hyperbolic-cosine-0-5`, `-hyperbolic-tangent-0-5` | Not started |
| `2ND HYP INV SIN/COS/TAN` | p. 13 | Inverse hyperbolic; chains `HYP` then `INV`, again with no `2ND` on the function key. `5 2ND HYP INV SIN` → `2.31`. | display | as above | `clearing-and-math-ops-hyperbolic-arcsine-5`, `-hyperbolic-arccosine-5`, `-hyperbolic-arctangent-0-5` | Not started |
| Scientific-notation display | p. 15 | A result too large/small for standard decimal renders automatically as mantissa, blank space, exponent. | display | E1 outside `±9.9999999999999E99` | — (no printed display value) | Not started |
| Scientific-notation **entry** | p. 15 | `Y^X` doubles as the exponent key **only under AOS**: `3 × 10 Y^X 3`. Under the default CHN this evaluates `(3×10)^3 = 27,000`. **No display printed — no golden case derivable. See MATH-6.** | display, reads calcMethod | E1 | — (deliberately absent) | Blocked |

## 2. Display and format (FORMAT worksheet)

> Spec: `docs/spec/overview-display-formats.md` (pp. 6-11).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `ON/OFF` (power) | p. 6 | Off-then-on lands in standard-calculator mode at zero with the error cleared. Powering off clears the displayed value, the error condition, and any in-progress operation or worksheet calculation. Constant Memory retains all worksheet values, the 10 memories, and every format setting. | display, error state, pending stack | — | — | Not started |
| APD (auto power down) | p. 6 | Fires after ~5 min idle. On wake, restores display settings, stored memory, pending operations **and** live error conditions. **The two wake paths differ — state restoration must be conditioned on how the machine powered down.** | all transient state | — | — | Not started |
| `2ND` (second-function prefix) | p. 7 | Arms the second function and lights the `2nd` annunciator. Pressing `2ND` again **disarms** — that is the documented cancel. There is no `2ND 2ND` compound function. | 2nd annunciator | — | — | Not started |
| `2ND QUIT` | p. 7, p. 11 | Exits the selected worksheet to standard-calculator mode **and drops all pending operations**. Does **not** revert format settings changed with `2ND SET`. Cancels an armed reset. | pending stack, mode | — | `overview-display-formats-reset-cancel` | Not started |
| Display model / annunciators | pp. 7-8 | ≤3-char variable label, `=` sign, numeric field ≤10 digits; >10 digits → scientific. Annunciator row (p. 7 LCD figure, L→R): `2nd INV HYP COMPUTE ENTER SET ↑↓ DEL INS BGN RAD`. Two markers over the numeric field: entered (`◄`) clears after a computation; computed (`✱`) clears when a change invalidates the value. `=` means the variable holds the displayed value. | all indicators | — | — | Not started |
| `2ND FORMAT` (open worksheet) | p. 9 | Opens at `DEC` showing the current decimal setting. | — | — | `overview-display-formats-select-aos-via-format` | Not started |
| FORMAT navigation `↓`/`↑` | p. 9 | Steps one format per press over the fixed order `DEC(1) → angle(2) → date(3) → separator(4) → method(5)`. **`↓↓↓` reaches separators; the guidebook's `↑↑↑` claim is arithmetically impossible — see FMT-1.** | — | — | `overview-display-formats-nav-dec-to-angle-units`, `-nav-dec-to-separators` | Not started |
| `DEC` (decimal places) | p. 9 | Internals held to 13 digits; `DEC` governs **display only**. `0`-`8` = fixed places; **`9` = floating decimal, not nine places**. Changing `DEC` does not round internal values **except** amortization and depreciation results. All guidebook examples assume `DEC = 2`. | `DEC` (default 2) | **E4** (outside 0-9); E1 | pinned via `setup.decimals` in 169/256 cases | Not started |
| Angle units `DEG`/`RAD` | pp. 8-10 | Affects display of trig results. `RAD` lights the upper-right indicator; `DEG` (default) lights nothing. When `RAD` is dark, angles are both displayed **and entered** in degrees. | angle unit (default `DEG`) | — | `overview-display-formats-nav-dec-to-angle-units` | Not started |
| Date format `US`/`Eur` | pp. 9-10 | **Entry** grammar `mm.ddyy` (US) / `dd.mmyy` (Eur) + `ENTER`. **Display** grammar `mm-dd-yyyy` / `dd-mm-yyyy` — two-digit year in, four-digit year out. Consumed by Bond, Date, and the French depreciation methods. | date format (default `US`) | **E6** (invalid date, or `MM.DDYYYY` where `MM.DDYY` required) | `other-worksheets-date-enter-dt1` | Not started |
| Number separators `US`/`Eur` | p. 9 | `US` renders `1,000.00` (group `,`, radix `.`); `Eur` renders `1.000,00`. **Display-side rule only — whether the entry radix key follows the setting is unstated (FMT-4).** | separators (default `US`) | — | `overview-display-formats-nav-dec-to-separators` | Not started |
| Calculation method `Chn`/`AOS` | pp. 9-10 | `Chn` (default) evaluates strictly in entry order; `AOS` applies algebraic hierarchy. Same keystrokes `3 + 2 × 4 =` give **20** (Chn) vs **11** (AOS). | calcMethod (default `Chn`) | E3 (AOS is the more exposed method) | `overview-display-formats-chn-3-plus-2-times-4`, `-aos-3-plus-2-times-4` | Not started |
| `2ND SET` (toggle a format) | p. 9 | Toggles the displayed two-state setting. `DEC` instead takes a keyed value + `ENTER`. **What `2ND SET` does on `DEC` is unstated (FMT-3).** | the displayed setting | — | `overview-display-formats-select-aos-via-format` | Not started |
| `2ND FORMAT` + `2ND CLR WORK` | p. 10 | With **any one** of the five formats displayed, restores defaults for **all five** — not merely the one showing. Does not touch the 10 memories, worksheet data, or the displayed value. | all five formats | — | — | Not started |
| `2ND RESET ENTER` | pp. 10-11 | `2ND RESET` shows the `RST ?` prompt with `ENTER` lit; `ENTER` commits and shows `RST` with `0.00`; `2ND QUIT` at the prompt cancels leaving `0.00`. **`CE/C` must clear a live error before reset is accepted.** Clears display, all 10 memories, unfinished calculations, all worksheet data; restores all defaults; returns to standard-calculator mode. | everything | — | `overview-display-formats-reset-prompt`, `-reset-confirm`, `-reset-cancel`, `clearing-and-math-ops-reset-arm-prompt`, `-reset-cancel`, `-reset-confirm` | Not started |

## 3. Memory, constants, and Last Answer

> Spec: `docs/spec/memory-and-last-answer.md` (pp. 16-23).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `M0`-`M9` (ten registers) | p. 16, pp. 72-73 | Ten independent registers addressed by digit keys `0`-`9`. Any representable value. Survive power-off via Constant Memory. Enter-only when reached via the Memory worksheet. | `M0`-`M9` (default 0) | **E4 unreachable** — no keystroke can address a register outside 0-9 | `memory-and-last-answer-store-value-in-m3` | Not started |
| `STO` *n* | p. 16 | Copies the displayed value into register *n*, overwriting unconditionally with no confirmation. Display unchanged; pending operations unaffected. | `Mn` | — | `memory-and-last-answer-store-value-in-m3`, `-store-then-recall-round-trip` | Not started |
| `RCL` *n* | p. 16, p. 21 | Brings the register into the display non-destructively; repeatable. A documented source for enter-only worksheet variables. **Recalls the full 13-digit internal value even though the display shows ≤10 (MEM-6).** | display | — | `memory-and-last-answer-store-then-recall-round-trip` | Not started |
| `0 STO` *n* (clear one) | p. 11, p. 16 | Clears register *n* only; the other nine untouched. There is no dedicated clear-memory key. | `Mn` | — | `memory-and-last-answer-clear-memory-4-by-storing-zero`, `other-worksheets-memory-clear-m4` | Not started |
| `2ND MEM 2ND CLR WORK` | p. 16, p. 73 | Clears **all ten** registers at once. **Leaves you inside the Memory worksheet at `M0` — p. 16 never says a `2ND QUIT` is needed (MEM-1).** | `M0`-`M9` | — | `memory-and-last-answer-clear-all-ten-memories` | Not started |
| `STO + - × ÷ Y^X` *n* (memory arithmetic) | pp. 16-17 | Computes register-OP-display and writes back in one action. **The register is ALWAYS the left operand.** Two explicit invariants: the display never changes, and a calculation in progress is never completed. | `Mn` | E1 (overflow; `STO ÷ n` with 0 displayed); E2 (`STO Y^X n`, negative register + non-integer exponent). **E3 impossible — adds nothing to the pending stack.** | `memory-and-last-answer-sto-add-to-m9`, `-sto-subtract-from-m3`, `-sto-multiply-m0`, `-sto-divide-m5`, `-sto-power-m4`, `-memory-arithmetic-leaves-display-untouched`, `-memory-arithmetic-does-not-complete-pending-calculation` | Not started |
| Memory-worksheet arithmetic (`OP` *value* `ENTER`) | p. 73 | **A second, distinct mechanism with opposite display behaviour**: while parked on a register, `OP` *value* `ENTER` applies in place and **redisplays the new register value**. Cannot share a naive code path with `STO OP n` (MEM-3). | `Mn`, display | E1, E2 | `other-worksheets-memory-add`, `-memory-subtract`, `-memory-multiply`, `-memory-divide`, `-memory-power` | Not started |
| `2ND K` (constant calculations) | p. 18 | Arms an (operator, operand) pair; the first `=` both finishes the seeding calculation and stores the pair. Thereafter *x* `=` applies the pair to any entry. Only digit keys and `=` preserve the constant; **any other key discards it (MEM-2 — under-specified)**. **The arming key order is printed two contradictory ways on the same page — see MEM-5. Implementations must accept `2ND K` on either side of the operand.** | constant register | E1; E2 (`Y^X` form); E3 | `memory-and-last-answer-constants-arm-and-first-result`, `-constants-second-application`, `-constants-third-application`, `-constant-add-template`, `-constant-subtract-template-operand-order`, `-constant-divide-template-operand-order`, `-constant-power-template-operand-order` | Not started |
| `2ND K` percent forms | p. 18 | `n + 2ND K c % =` stores `(OP, c%)` and **re-evaluates the percentage against each new entry** — it does not store the seed-derived absolute value. `50 =` must give `55.00`, not `70.00`. | constant register | — | `memory-and-last-answer-constant-add-percent-template`, `-constant-subtract-percent-template` | Not started |
| `2ND ANS` (Last Answer) | p. 19 | Recalls the most recent result; usable mid-expression as an ordinary operand. Refreshed by **exactly three keys — `ENTER`, `CPT`, `=`** — plus any automatic computation. | `ANS` (default 0 assumed — **not stated, MEM-4**) | — | `memory-and-last-answer-last-answer-seed-calculation`, `-last-answer-operand-is-formatted`, `-last-answer-recall-mid-expression`, `-last-answer-complete-with-recalled-value` | Not started |
| Entry echo vs. result formatting | pp. 18-19, p. 9 | **Keyed entries echo unformatted** (`3`, `8`); computed results **and operands committed by an operator keypress** are formatted to `DEC` (`24.00`, `2.00`). The rule is inferable only by reading two tables together; it is never stated in prose. | display, reads `DEC` | — | `memory-and-last-answer-constants-entry-echo-unformatted`, `-constants-operand-echo-unformatted`, `-last-answer-operand-is-formatted` | Not started |
| Worksheet variable-type model | pp. 21-22 | Five types: **enter-only** (`ENTER` indicator), **compute-only** (`COMPUTE`, `CPT`), **automatic-compute** (evaluates on scroll, no `CPT`), **enter-or-compute** (both), **settings** (`SET`, cycled with `2ND SET`). Enter-only values may come from the keyboard, a calculation, `RCL`, or `ANS`. | — | — | — | Not started |

## 4. TVM (standard-calculator mode, not a prompted worksheet)

> Spec: `docs/spec/tvm-and-amortization.md` (pp. 24-41), `docs/spec/appendix-formulas.md` (pp. 74-75).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `N` | pp. 24-27 | Number of periods. Key value then `N` to store; `RCL N` to read; `CPT N` to solve. **Not restricted to integers.** | `N` (default 0) | E2 (`LN` of non-positive in the `N` solve) | `appendix-formulas-tvm-n-payment-multiplier` | Not started |
| `I/Y` | pp. 24-27 | **Always keyed as a nominal ANNUAL rate.** The worksheet derives the per-period rate from `P/Y` and `C/Y`. | `I/Y` (default 0) | **E5** (no sign change); **E7** (iteration limit); **E8** (`ON/OFF` cancel) | `tvm-basic-loan-interest` (→ `5.50`) | Not started |
| `PV` / `PMT` / `FV` | pp. 24-27 | Enter-or-compute, signed. | `PV`, `PMT`, `FV` (default 0) | E1, E5 | `tvm-savings-future-value`, `-savings-present-value`, `-monthly-loan-payment` | Not started |
| **Sign convention** | pp. 26-27 | **Money received is positive; money paid out is negative.** Symmetric on entry and on results: computed inflows come back positive, outflows negative. Every `CPT PMT` in the range returns negative. | `PV`, `PMT`, `FV` | **E5 is the direct consequence of violating it when solving `I/Y`** | `tvm-mortgage-payment` (→ `-729.13`), `appendix-formulas-tvm-pmt-sign-convention` | Not started |
| `2ND P/Y` | pp. 24-26, pp. 38-39 | Payments per year. **Entering `P/Y` silently overwrites `C/Y` with the same value — so `C/Y` must be set AFTERWARDS via `↓`.** Order matters. | `P/Y` (default 1), `C/Y` | **E4** (`P/Y ≤ 0` — operator glyph dropped in source, see ERR-2) | `tvm-monthly-loan-payment` | Not started |
| `C/Y` (via `2ND P/Y` `↓`) | pp. 24-26, p. 39 | Compounding periods per year. Only one worked example in the whole guidebook sets `C/Y ≠ P/Y` (p. 39). | `C/Y` (default 1) | E4 | `tvm-regular-deposits-for-future-amount`, `appendix-formulas-tvm-rate-conversion-cy-ne-py-bgn` | Not started |
| `2ND BGN` + `2ND SET` (END/BGN) | pp. 24-26 | `END` = ordinary annuity (most loans, default); `BGN` = annuity due (most leases). Only `BGN` lights an indicator. Implemented via `G_i = 1 + i·k`, `k=0` END, `k=1` BGN. **At `i = 0`, `G_i = 1` regardless — END and BGN are indistinguishable and must not be special-cased.** | END/BGN (default `END`) | — | `tvm-pv-ordinary-annuity`, `tvm-pv-annuity-due`, `appendix-formulas-tvm-gi-annuity-due-bgn` | Not started |
| `2ND xP/Y` | p. 27, p. 41 | Multiplies the displayed number by stored `P/Y`, converting years to periods. **Writes to the display only** — the following `N` keypress commits it. Also usable inside AMORT to fill `P2`. | display → `N`, `P2` | — | `appendix-formulas-tvm-n-payment-multiplier` | Not started |
| `CPT` + TVM key | p. 27 | Solves for that variable — **only in standard-calculator mode**. In worksheet mode TVM values may be *assigned* but not computed. | the target variable | E5, E7, E8 | all `tvm-*` compute cases | Not started |
| The unused fifth variable | p. 26 | **All five variables participate in every solve.** A four-variable problem requires keying `0` into the unused one (e.g. `0 PMT`). The calculator will not infer it. | all five | — | `tvm-savings-future-value` (`setup.PMT: 0`) | Not started |
| Values persist between problems | p. 25, p. 29 | Nothing is cleared between problems. **The p. 29 quarterly example deliberately inherits `I/Y` and `PV` from the monthly example above it.** | all | — | `tvm-quarterly-loan-payment` (inherited values in `setup`) | Not started |
| Display rounding vs. internal precision | p. 35, p. 39 | **Load-bearing.** Keying `6.125 I/Y` displays `6.13` yet yields `PMT = -729.13` (storing `6.13` gives `-729.52`). Keying `22 ÷ 12 = I/Y` displays `1.83` yet yields `PV = 40,573.18` (storing `1.83` gives `40,601.33`). | `I/Y`, all TVM | — | `appendix-formulas-tvm-iy-display-vs-stored`, `tvm-lease-total-present-value` | Not started |
| Perpetual annuities | pp. 32-33 | `PV = PMT / ((I/Y)/100)` ordinary; `PV = PMT + PMT/((I/Y)/100)` due. **Pencil-and-paper aids, not worksheet behaviour** — the p. 32 example runs on the arithmetic keys and returns *positive* prices, opposite to the TVM sign convention. **Must not be routed through the TVM solver.** | none (arithmetic only) | — | `tvm-perpetual-ordinary-annuity`, `tvm-perpetual-annuity-due` | Not started |
| Variable cash flows via TVM | pp. 33-34 | Unequal flows handled by discounting each as a lump sum (`PMT=0`) and accumulating in memory with `STO`/`STO +`. **Memory arithmetic must carry full precision** — summing the displayed values gives `23,171.22` instead of `23,171.23`. | `N`, `I/Y`, `FV`, `PV`, `M1` | — | `tvm-variable-cash-flow-pv-year-1`…`-year-4`, `-total-pv`, `-net-gain` | Not started |
| `2ND CLR TVM` | p. 25 | Resets `N`, `I/Y`, `PV`, `PMT`, `FV` to 0. **Does NOT touch `P/Y`, `C/Y`, END/BGN, `P1`, `P2`, formats, or memories.** | five TVM vars | — | — | Not started |

## 5. Amortization (`2ND AMORT`)

> Spec: `docs/spec/tvm-and-amortization.md` (pp. 27-28, 40-41), `docs/spec/appendix-formulas.md` (p. 76).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND AMORT` (open) | pp. 27-28 | Opens at `P1`. Cyclic field order `P1 → P2 → BAL → PRN → INT → P1`. | — | — | — | Not started |
| `P1` / `P2` | pp. 27-28 | Starting / ending payment. Enter-only. Manual: key `P1` `ENTER`, `↓`, key `P2` `ENTER`, then `↓` thrice for `BAL`/`PRN`/`INT`. | `P1`, `P2` (default 1) | **E4** (outside 1-9,999); **E2** (`P2 < P1`). **Fractional entry unspecified — AMORT-3.** | `amort-year3-auto-advance-p1`, `-auto-advance-p2` | Not started |
| Auto-advance (`CPT` on `P1`/`P2`) | p. 28 | `CPT` on `P1` advances **both** `P1` and `P2` preserving window *width* (10-21 → 22-33). `CPT` on `P2` enters both for the next range. | `P1`, `P2` | — | `amort-year3-auto-advance-p1`, `-auto-advance-p2` | Not started |
| `BAL` (balance) | p. 26, pp. 40-41, p. 76 | Auto-compute on scroll. `bal(pmt2)` from the simulated loop. | `BAL` | E1; **E8** (`ON/OFF` cancel) | `amort-year1-balance`, `-year2-balance`, `-year3-balance`, `amort-balloon-balance` | Not started |
| `PRN` (principal) | p. 76, p. 40 | **`ΣPrn() = bal(pmt2) - bal(pmt1 - 1)`. The printed formula omits the `- 1` and reproduces NONE of the guidebook's own results — see AMORT-1.** | `PRN` | E2 (`P2 < P1`) | `amort-year1-principal`, `-year2-principal`, `-year3-principal`, `appendix-formulas-amort-year1-prn-offset` | Not started |
| `INT` (interest) | p. 76, p. 40 | `ΣInt() = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()` — **as printed, correct.** Negative for a standard loan. | `INT` | **E8** (`ON/OFF` cancel) | `amort-year1-interest`, `-year2-interest`, `-year3-interest`, `amort-balloon-interest` | Not started |
| **Amortization rounding rule** | p. 9, p. 26, p. 76 | **The highest-risk detail in the project.** `bal(0) = RND(PV)`; loop `m = 1..pmt2` with `I_m = RND[RND12(-i × bal(m-1))]` and `bal(m) = bal(m-1) - I_m + RND(PMT)`. **`RND` rounds to the DISPLAYED decimal setting**, so a schedule is a function of `DEC`. Uses **`PMT` rounded**; `FV` uses the unrounded `PMT`. **The load-bearing detail is the outer `RND` on `I_m`** — dropping it gives `118,928.64 / 117,421.62 / 115,819.66` against the guidebook's `118,928.63 / 117,421.60 / 115,819.62`, failing the *first* range. | `BAL`, `PRN`, `INT`; reads `DEC` | E1 | `amort-year1-balance` is a sufficient tripwire | Not started |
| **`BAL` vs `FV` divergence** | p. 26 | **Specified behaviour, not a rounding artefact.** `BAL`/`PRN`/`INT` use `PMT` rounded to `DEC`; `FV` uses the unrounded `PMT`. The two legitimately differ. **Must not be papered over with a loose epsilon.** | `BAL` vs `FV` | — | `tvm-balloon-monthly-payment` + `amort-balloon-balance` | Not started |
| Iteration always starts at `m = 1` | p. 76 | Even for a large `P1`, the balance is walked forward from the origin — the rounding accumulates from period 1 and cannot be short-cut with a closed form. | — | — | `amort-year3-balance` | Not started |
| `2ND CLR WORK` in AMORT | p. 26 | `P1 = 1`, `P2 = 1`, `BAL = PRN = INT = 0`. Does not touch the five TVM variables, `P/Y`, `C/Y`, or END/BGN. | `P1`, `P2`, `BAL`, `PRN`, `INT` | — | — | Not started |

## 6. Cash Flow (`CF`, `NPV`, `IRR` — primary keys, no `2ND`)

> Spec: `docs/spec/cash-flow.md` (pp. 42-49), `docs/spec/appendix-formulas.md` (pp. 76-77).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `CF` (open worksheet) | pp. 42-43 | **Primary key, no `2ND` prefix.** Opens on `CFo`. | — | **Unlike Bond, navigating before entering values is normal — E6 does not apply here.** | `cash-flow-open-worksheet-shows-cfo` | Not started |
| `CFo` | pp. 42-43 | Initial cash flow. **Mandatory, always entered, has no frequency**, occurs exactly once. | `CFo` (default 0) | E1 | `cash-flow-machine-enter-cfo` | Not started |
| `C01`-`C24` (amounts) | pp. 42-44, p. 47 | Up to 24 flows beyond `CFo`. Outflows keyed as magnitude + `+/-` **before** `ENTER`. Slots may be skipped, retaining existing values. | `Cnn` (default 0) | E1 | `cash-flow-machine-enter-c01`, `-enter-c02`, `-enter-c03` | Not started |
| `F01`-`F24` (frequencies) | p. 43, p. 47, p. 49 | Consecutive equal flows occupy one `Cnn` slot with `Fnn` = repeat count. **The only way to fit long streams into 24 slots** — the p. 49 lease covers 36 months in six groups. Frequency travels with its amount when flows shift. | `Fnn` (default 1) | **E4** (outside **0.5-9,999** — note p. 43 says "occurrences", implying integers; see CF-3) | `cash-flow-machine-f01-defaults-to-1`, `-enter-f02-grouped` | Not started |
| Navigation `↓`/`↑` | pp. 43-44 | Alternating list `CFo, C01, F01, C02, F02, …` — stepping from a `Cnn` reaches **its own** `Fnn`, and stepping again reaches `C(nn+1)`. | — | — | `cash-flow-machine-navigate-up-to-c03`, `-navigate-up-to-c02` | Not started |
| `2ND DEL` | pp. 43-44, p. 47 | Removes the displayed amount **and its frequency together**; all later flows shift down one slot. Deleting the last flow leaves the display on a now-vacant slot reading `0.00`. **Behaviour on `CFo` unstated (CF-8).** | `Cnn`, `Fnn` | none documented | `cash-flow-machine-delete-c03` | Not started |
| `2ND INS` | pp. 43-45, p. 47 | Places the new flow **AT** the selected slot; everything from there renumbers upward, capped at 24. An inserted slot takes the `Fnn` default of 1. **Behaviour on a full 24-slot list unspecified (CF-2).** | `Cnn`, `Fnn` | none documented | `cash-flow-machine-insert-c02`, `-inserted-flow-gets-frequency-1`, `-verify-c03-shifted`, `-verify-f03-shifted` | Not started |
| `NPV` key → `I` (discount rate) | p. 42, p. 45, pp. 48-49 | **`NPV` opens `I`, not `NPV`.** `I` is a rate **per cash-flow period**, independent of TVM's `I/Y`. **No `P/Y` conversion exists here** — an annual rate must be divided by hand. Stored at full precision, displayed rounded. | `I` (default 0) | — | `cash-flow-machine-open-npv-shows-i`, `-enter-discount-rate`, `cash-flow-lease-enter-monthly-rate` | Not started |
| `CPT NPV` | p. 45, pp. 48-49, p. 76 | `NPV = CF_0 + Σ CF_j (1+i)^(-S_{j-1}) · [(1-(1+i)^(-n_j))/i]`. **The printed exponent `-S_j-1` is wrong — see CF-1.** Positive result marks the investment profitable. | `NPV` (compute-only) | E5 (`LN` input not > 0). **No `i = 0` branch is published — and `I = 0` is the default, so `NPV ↓ CPT` after a reset hits this path (CF-4).** | `cash-flow-machine-compute-npv` (→ `7,266.44`), `cash-flow-lease-compute-npv` (→ `-138,088.44`), `appendix-formulas-npv-discount-exponent` | Not started |
| `IRR` + `CPT` | pp. 45-46, p. 48, p. 77 | `IRR = 100 × i` where `i` satisfies `npv() = 0`. Consumes no discount rate. Iterative; may run seconds to minutes. **Root count follows sign changes across `CFo` and all `Cnn`**: none → no solution; exactly one → the single root; two or more → up to as many roots as sign changes, and the calculator reports **the one closest to zero**, which the guidebook warns carries no financial meaning. | `IRR` (compute-only) | **E5** (no sign change); **E7** (complex problem — explicitly possible even when a solution exists); **E8** (`ON/OFF` cancel) | `cash-flow-machine-compute-irr` (→ `52.71`), `appendix-formulas-irr-root-of-npv` | Not started |
| `2ND CLR WORK` (scoped) | pp. 42-43 | **Scoped to the view you are standing in**: from `CF` resets `CFo`/`Cnn`/`Fnn`; from `NPV` resets `NPV`; from `IRR` resets `IRR`. **Whether `I` is cleared alongside `NPV` is not stated (CF-5).** `CLR TVM` never touches this worksheet. | scoped | — | `cash-flow-lease-reset-defaults` | Not started |
| Independence from `BGN`/`END` | p. 49 | **The TVM `BGN`/`END` setting has no effect here.** Beginning-of-period timing is modelled **structurally**: promote the first payment into `CFo` and shift the rest back one slot. | `CFo`, `C01`, `F01` | — | `cash-flow-lease-c01-left-at-zero`, `-f01` | Not started |

## 7. Bond (`2ND BOND`)

> Spec: `docs/spec/bond.md` (pp. 50-54), `docs/spec/appendix-formulas.md` (pp. 77-78).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND BOND` (open) | p. 50, p. 52 | Opens showing the current `SDT`. Nine display positions in fixed order. Values and settings persist until cleared or overwritten. | — | **E6 when navigating a freshly-reset worksheet** (`SDT = RDT = 12-31-1990` **is** the "RDT not later than SDT" condition) | `bond-example-open-worksheet`, `bond-error6-on-default-dates` | Not started |
| `SDT` (settlement date) | pp. 51-52 | Keyed `mm.ddyy` (US) / `dd.mmyy` (Eur) + `ENTER`. Window 01-01-1980 … 12-31-2079. | `SDT` (default `12-31-1990`) | **E6** (invalid date; `MM.DDYYYY` format; `RDT ≤ SDT`) | `bond-defaults-clr-work-sdt`, `bond-example-settlement-date-display` | Not started |
| `CPN` (coupon rate) | p. 51 | **Annual coupon rate as a percentage of par — not the dollar coupon.** A 7% bond is entered as `7`. Feeds `R = CPN/100`. | `CPN` (default 0) | **E4** (`CPN` vs 0 — **operator glyph missing from source, see ERR-2**) | `bond-defaults-cpn`, `bond-example-coupon-rate-display` | Not started |
| `RDT` (redemption date) | pp. 51-52 | **Assumed to coincide with a coupon date**: maturity for to-maturity, call date for to-call. **What happens off-cycle is unstated (BOND-4).** | `RDT` (default `12-31-1990`) | E6 | `bond-defaults-rdt`, `bond-example-redemption-date-display` | Not started |
| `RV` (redemption value) | pp. 51-52 | **Percentage of par.** 100 for to-maturity; the call price for to-call (par plus any call premium). | `RV` (default 100) | E4 | `bond-defaults-rv`, `bond-example-redemption-value-untouched` | Not started |
| `ACT`/`360` toggle | p. 50, p. 51, p. 53 | `↓` until `ACT` or `360` shows, then `2ND SET`. `ACT` = actual/actual; `360` = 30/360. Governs how `A`, `E`, `DSC`, `DSR` are measured. **One toggle occupying one display position — the p. 50 table's two rows are not two variables (BOND-3).** | `ACT/360` (default `ACT`) | — | `bond-defaults-daycount-act`, `bond-example-daycount-set-to-360` | Not started |
| `2/Y`/`1/Y` toggle | p. 50, p. 51, p. 53 | `↓` until shown, then `2ND SET`. Supplies `M` (1 or 2). **Independent of TVM `P/Y` and `C/Y`.** | `2/Y,1/Y` (default `2/Y`) | — | `bond-defaults-coupon-freq`, `bond-example-coupon-freq-untouched` | Not started |
| `YLD` (enter) | p. 53 | `↓` to `YLD`, key the yield, `ENTER`. Annual nominal yield in percent. | `YLD` (default 0) | — | `bond-example-yield-entry` | Not started |
| `CPT PRI` (price from yield) | p. 53, p. 54, pp. 77-78 | **Two closed-form regimes.** ≤1 coupon period: simple interest. >1: three terms — redemption over `N-1+DSC/E`, the `N`-coupon summation, minus accrued interest. **`N` is rounded UP (ceiling; 2.4 → 3).** Quoted in dollars per $100 of par. | `PRI` | E4; E5 (`LN` not > 0); E1 | `bond-example-compute-price` (→ `98.56`), `appendix-formulas-bond-price-multi-coupon` | Not started |
| `CPT YLD` (yield from price) | p. 53, p. 78 | Closed form only when ≤1 coupon period remains; **otherwise found by iterative search on the multi-period price formula.** | `YLD` | E5; **E7** (iteration limit); **E8** (`ON/OFF` cancel). **Errors 7 and 8 attach to `YLD` only, never `PRI`.** | — (**the printed `PRI`→`YLD` navigation is unreachable as written — BOND-1**) | Blocked |
| `AI` (accrued interest) | p. 50, p. 53, p. 54, p. 78 | **Auto-computed on a single `↓` — never entered, never requires `CPT`.** `AI = PAR × R/M × A/E` with `PAR = 100`, so it equals the third term of the multi-period price formula. | `AI` | — | `bond-example-accrued-interest` (→ `3.15`), `appendix-formulas-bond-accrued-interest` | Not started |
| **No sign convention** | p. 50, p. 52, pp. 77-78 | **Unlike TVM, nothing in Bond is signed by direction.** `PRI`, `AI`, `RV`, `CPN` are positive magnitudes per $100 par. **The printed bond formulas AGREE with the worked example** — no analogue of the `PMT` defect. | — | — | `appendix-formulas-bond-price-multi-coupon` | Not started |

## 8. Depreciation (`2ND DEPR`)

> Spec: `docs/spec/depreciation.md` (pp. 55-58), `docs/spec/appendix-formulas.md` (pp. 78-79).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND DEPR` (open) | p. 55, p. 57 | Opens showing the currently active method. `↓`/`↑` move between variables and auto-repeat when held. `↓` from `RDV` wraps back to `YR`. | — | — | `depreciation-sl-open-worksheet-shows-default-method` | Not started |
| Method selection (`2ND SET`) | p. 55, p. 57 | Cycles the method list and wraps. **The two pages print DIFFERENT orders (p. 55: `SL SYD DB DBX SLF DBF`; p. 57: `SL SLF SYD DB DBX DBF`), neither claims to be the cycle order, and no worked example cycles the method. Unresolved — DEPR-2.** | method | — | — | Blocked |
| `SL` (straight line) | p. 55, p. 57, p. 79 | `DEP = (CST-SAL)/LIF`; first year × `FSTYR`; last year or later `DEP = RDV`. `LIF` may be a positive real. | `DEP`, `RBV`, `RDV` | E2 (`SAL > CST`); E4 | `depreciation-sl-year1-dep`, `-year2-dep`, `appendix-formulas-depreciation-sl-normal-year` | Not started |
| `SYD` (sum-of-years'-digits) | p. 55, p. 79 | `DEP = (LIF+2-YR-FSTYR)×(CST-SAL) / (LIF(LIF+1)/2)`. `LIF` must be a positive integer. **Printed parentheses are unbalanced (typesetting) and there is NO worked example to arbitrate.** | `DEP`, `RBV`, `RDV` | E2; E4 | — | Not started |
| `DB` (declining balance) | pp. 55-57, p. 79 | `DEP = (RBV × DB%)/(LIF × 100)` with **`RBV` taken for `YR-1`**. Three guards: first year capped at `RDV × FSTYR`; any year's `DEP` capped at `RDV`; last year `DEP = RDV`. **Unlike SL/SYD, DB never reaches `SAL` on its own — the caps make it terminate.** | `DB%` (default 200) | **E4** (`DB% ≤ 0`) | — | Not started |
| `DBX` (DB with crossover to SL) | pp. 55-57 | Selected like `DB`, carries its own percent (default 200). **Described in prose only — the crossover trigger is NEVER specified anywhere in the guidebook or appendix. Parity unreachable from this source — DEPR-3.** | `DBX%` (default 200) | E4 | — | Blocked |
| `SLF` / `DBF` (French methods) | p. 55, p. 57 | Available **only** once the European date **or** European separator format is set. `SLF` additionally exposes `DT1` (`dd.mmyy`). **No computational behaviour is documented for either. Parity unreachable — DEPR-4.** | `DT1`, method | E4 | — | Blocked |
| `LIF` (life) | pp. 56-57 | `↓`, value, `ENTER`. Positive real under `SL`/`SLF`; positive **integer** required under `SYD`/`DB`/`DBX`/`DBF`. **Fractional `LIF` under SYD is unspecified (DEPR-6).** | `LIF` (default 1) | **E4** (`LIF ≤ 0`) | `depreciation-sl-enter-life-31-5` | Not started |
| `M01` (starting month) | p. 56 | **Packs two facts into one number:** integer part = calendar month the asset enters service; fractional part = fraction of that month elapsed before depreciation begins (`1.5` = mid-January, `4.25` = a quarter into April). Drives `FSTYR`. | `M01` (default 1) | **E4** (`M01 < 1` or `M01 ≥ 13` — operators reconstructed, see ERR-2) | `depreciation-sl-enter-starting-month-3-5` | Not started |
| `CST` / `SAL` | pp. 55-57 | Both enter-only, both default 0, both **unsigned magnitudes**. Rounded to the displayed decimals. | `CST`, `SAL` | **E4** (`CST < 0`, `SAL < 0`); **E2** (calculation with `SAL > CST` — **entry appears permitted; the error surfaces on compute, DEPR-7**) | `depreciation-sl-enter-cost-1000000`, `-salvage-left-at-default-zero` | Not started |
| `YR` + schedule generation | pp. 57-58 | `YR` is a positive integer. From `RDV`, `↓` wraps to `YR` and **`CPT` increments `YR` by one**. Three `↓` presses then recompute `DEP`/`RBV`/`RDV`. Schedule complete when `RDV` reaches zero. **The p. 58 example prints `2ND SET` rather than `CPT` for this increment — contradiction, DEPR-1.** | `YR` (default 1) | **E4** (`YR ≤ 0`) | `depreciation-sl-year-left-at-default-one`, `-wrap-from-rdv-back-to-yr`, `-increment-yr-as-printed-2nd-set`, `-increment-yr-via-cpt` | Not started |
| **`FSTYR`** | p. 79 | **Used by every first-year formula and DEFINED NOWHERE in the guidebook.** Reconstructed as `FSTYR = (13 - M01)/12` by back-solving the p. 58 example. **One example cannot distinguish it from alternatives agreeing at `M01 = 3.5` — DEPR-5.** | — | — | `appendix-formulas-depreciation-fstyr` | Blocked |
| `DEP`/`RBV`/`RDV` + **rounding** | p. 9, p. 56, p. 57, p. 78 | **Auto-compute the moment `↓` scrolls onto them**; the `✱` annunciator marks a computed display. One year per pass. **`DEP`, `RDV`, `CST`, `SAL` are rounded to the display decimal setting — depreciation and amortization are the ONLY worksheets whose internal values are rounded.** `RDV = CST - SAL - accumulated depreciation`. **`RBV` has no published formula** — inferred `CST - accumulated depreciation`, and the only example uses `SAL = 0` so it cannot discriminate (DEPR-8). **Where in the computation the rounding lands is unstated (DEPR-9).** | `DEP`, `RBV`, `RDV`; reads `DEC` | **E8** (`ON/OFF` cancel of `DEP`/`RDV`); E1 | `depreciation-sl-year1-rbv`, `-year1-rdv`, `-year2-rbv`, `-year2-rdv`, `appendix-formulas-depreciation-rdv-first-year`, `-rdv-second-year` | Not started |
| `2ND CLR WORK` in DEPR | p. 56 | Clears **exactly four** variables — `LIF`, `YR`, `CST`, `SAL` → `1, 1, 0, 0`. Explicitly does **not** touch the method. **`M01`, the `DB`/`DBX` percent and `DT1` are NOT named despite having reset defaults — scope under-specified (DEPR-10).** | `LIF`, `YR`, `CST`, `SAL` | — | — | Not started |

## 9. Statistics (`2ND DATA`, `2ND STAT`)

> Spec: `docs/spec/statistics.md` (pp. 59-62), `docs/spec/appendix-formulas.md` (p. 80).
>
> **⚠ THIS SECTION HAS NO PARITY ORACLE IN THE GUIDEBOOK.** Pages 59-62 are entirely procedural.
> Statistics is the only worksheet chapter with no `Example:` subsection, and no example elsewhere
> drives the worksheet. `tests/golden/statistics.json` therefore has `cases: []` — **this is correct,
> not an extraction gap.** Every row below is `Blocked` on an external oracle. See **STAT-1**.

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND DATA` (data entry) | pp. 59-62 | Opens showing `X01` with its prior value. Key value, `ENTER`, `↓` to `Ynn`, `↓` to next `Xnn`. Up to **50** (x,y) pairs. Holding `↓`/`↑` scrolls continuously. | `Xnn`, `Ynn` | **Unnamed error** when `↓`/`↑` scrolls into the results portion with no data entered (p. 60 — **the guidebook does not name it, STAT-4**) | — | Blocked |
| `Xnn` | p. 59, p. 60 | Enter-only, no default. `nn` = 01-50. | `Xnn` | — | — | Blocked |
| `Ynn` | p. 60 | Enter-only. **Defaults to 1 when an `Xnn` is keyed in.** In 1-V mode it is the **frequency** (number of occurrences). **The default applies in 2-V mode too — keying an X and scrolling past Y silently contributes a Y of 1 (STAT-5).** | `Ynn` | **No range and no error printed for a fractional/zero/negative frequency (STAT-3)** | — | Blocked |
| `2ND STAT` + `2ND SET` | p. 59, p. 62 | Opens the calculation portion showing the method selected last; `2ND SET` cycles `LIN`, `Ln`, `EXP`, `PWR`, `1-V`. `↓` begins computing results. | method (default `LIN`) | — | — | Blocked |
| `1-V` (one-variable) | pp. 59-62 | `Xnn` = data value, `Ynn` = frequency. **Exactly six results**: `n`, `x̄`, `Sx`, `σx`, `ΣX`, `ΣX2`. All 2-V-only variables suppressed. | six outputs | **E1** when all X values are identical | — | Blocked |
| `LIN` | p. 61 | `Y = a + bX`. No restriction. Fitted on untransformed data. | `a`, `b`, `r` | — | — | Blocked |
| `Ln` | p. 61 | `Y = a + b·ln(X)`. **All X > 0.** Fitted on `(ln X, Y)`. | `a`, `b`, `r` | **E2** via `LN` of non-positive (**linkage inferred — the guidebook never joins the restriction to the error, STAT-6**) | — | Blocked |
| `EXP` | p. 61 | `Y = a·b^X`. **All Y > 0.** Fitted on `(X, ln Y)`. **Printed as `Y = a bx` with the X as a lowered pseudo-subscript — it is an EXPONENT (self-proving from the transform table on the same page).** | `a`, `b`, `r` | E2 | — | Blocked |
| `PWR` | p. 61 | `Y = a·X^b`. **All X > 0 and all Y > 0.** Fitted on `(ln X, ln Y)`. Same pseudo-subscript defect. | `a`, `b`, `r` | E2 | — | Blocked |
| Auto-computed results | p. 59, p. 60, p. 62 | **Every result except `X'`/`Y'` computes and displays the moment it is scrolled to** — no `CPT`. Display order `… a, b, r, X', Y', ΣX …`. | `n`, `x̄`, `Sx`, `σx`, `ȳ`, `Sy`, `σy`, `a`, `b`, `r`, `ΣX`, `ΣX2`, `ΣY`, `ΣY2`, `ΣXY` | **E1** when all X or all Y identical, or a result exceeds `±9.9999999999999E99` | — | Blocked |
| `X'` / `Y'` (predictions) | p. 60, p. 62 | **The only non-auto-computed outputs.** Enter `X'`, `↓`, `CPT` → `Y'`; or enter `Y'`, `↑`, `CPT` → `X'`. **Note the deliberate `↓`/`↑` asymmetry** — it matches the display order. | `X'`, `Y'` | E1; **undefined when `b = 0` (STAT-7)** | — | Blocked |
| `r` (correlation) | p. 61, p. 80 | `r = b · σx / σy`. Near ±1 = good fit, near 0 = poor. Computed on the **transformed** data. **Population vs sample weighting is unstated but numerically immaterial — the factor cancels in the ratio.** | `r` | **E1**: all-X-identical zeroes the `b` denominator; all-Y-identical gives `σy = 0` and `b = 0`, so `r` evaluates `0/0`. **`σx` is in the NUMERATOR — `σx = 0` alone does not make `r` divide by zero.** | — | Blocked |
| Frequency weighting | p. 60, p. 80 | **The guidebook never states that `n = ΣYnn` or `ΣX = Σ(Ynn·Xnn)`** — the appendix formulas are written in bare `Σx`, `Σx²`, `n` with no weight term, yet both are required for the frequency feature to mean anything. **Implement frequency-weighted; STAT-2.** | `n`, `ΣX`, `ΣX2` | — | — | Blocked |
| `2ND DEL` / `2ND INS` | p. 8 | Delete / insert a statistical data point; `DEL`/`INS` annunciators mark availability. **Behaviour of `INS` at the 50-point limit unstated (STAT-8).** | `Xnn`/`Ynn` positions | none documented | — | Blocked |
| `2ND CLR WORK` (scoped) | p. 60 | In the **DATA** portion: clears all X/Y and all statistics values, **preserving the method**. In the **STAT** portion: resets the method to `LIN` and clears all values **except** X and Y. **The latter is self-defeating — results auto-recompute from the retained data on scroll, so the only observable effects are the method reset and `X'`/`Y'` clearing (STAT-9).** | scoped | — | — | Blocked |

## 10. Other worksheets

> Spec: `docs/spec/other-worksheets.md` (pp. 63-73), `docs/spec/appendix-formulas.md` (pp. 80-82).

### 10a. Percent Change / Compound Interest (`2ND Δ%`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND Δ%` (open) | pp. 63-64 | Opens showing the current `OLD`. Order `OLD → NEW → %CH → #PD`. | — | — | `other-worksheets-clr-work-zeroes-old` | Not started |
| One equation, three jobs | pp. 63-64, p. 81 | `NEW = OLD(1 + %CH/100)^#PD` serves **percent change** (`#PD=1`), **compound interest** (all four), and **cost-sell-markup** (`#PD=1`, markup measured against **cost**). Enter the knowns, land on the unknown, `CPT`. | `OLD`, `NEW`, `%CH`, `#PD` | E1 (`OLD = 0` divides by zero); E2 (`NEW/OLD < 0` with fractional `#PD`; `ln` of non-positive) | `other-worksheets-pct-change-compute-pct` (→ `6.38`), `-compute-new-from-negative` (→ `611.94`), `-compound-interest-growth-rate` (→ `8.45`), `-cost-sell-markup` (→ `25.00`) | Not started |
| **`#PD` is an EXPONENT** | p. 81 | Printed flat on the baseline as if a trailing factor. **It is the exponent — proven by the p. 65 example: only `100×((750/500)^(1/5)-1) = 8.45` works; a multiplier gives `10.00`. See OW-2.** | `#PD` | — | `appendix-formulas-pct-change-pd-is-exponent` | Not started |
| **`#PD` default** | p. 63 vs p. 64 vs p. 65 | **The p. 63 reset table prints `#PD` default = 0. The p. 64 prose says twice to leave `#PD` at 1, and the cost-sell-markup example presses `2ND CLR WORK`, enters only `OLD`/`NEW`, and gets `%CH = 25.00` — unreachable unless `#PD` is 1 after the clear. WORKED EXAMPLE WINS: `#PD` clears to 1. See OW-1.** | `#PD` (default **1**) | — | `other-worksheets-cost-sell-markup` | Not started |
| `2ND CLR WORK` | p. 63 | `OLD=0`, `NEW=0`, `%CH=0`, **`#PD=1`**. | all four | — | `other-worksheets-clr-work-zeroes-old` | Not started |

### 10b. Interest Conversion (`2ND ICONV`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND ICONV` (open) | pp. 66-67 | Opens showing the current `NOM`. Order `NOM → EFF → C/Y`. | — | — | `other-worksheets-iconv-enter-nom` | Not started |
| `NOM` ↔ `EFF` | pp. 66-67, p. 80 | `EFF = 100 × (e^((C/Y)·ln(x+1)) - 1)`, `x = .01×NOM÷C/Y`. `NOM = 100 × C/Y × (e^((1÷C/Y)·ln(x+1)) - 1)`, `x = .01×EFF`. **Both rates entered as ANNUAL percentages. The `x` means something DIFFERENT in each direction** (periodic vs annual). **The printed `EFF` formula has three defects — see OW-3.** | `NOM`, `EFF` (default 0) | E1 (large `NOM × C/Y`); **E2** (`x+1 ≤ 0`, i.e. `NOM ≤ -100×C/Y` or `EFF ≤ -100`) | `other-worksheets-iconv-eff-from-nom` (→ `15.87`), `appendix-formulas-eff-from-nom-plus-one` | Not started |
| `C/Y` (ICONV's own) | pp. 66-67 | **ENTER-ONLY — never a `CPT` target.** `2ND CLR WORK` clears `NOM` and `EFF` but **deliberately leaves `C/Y` alone** — the one asymmetry worth implementing carefully. **Whether this `C/Y` is shared with TVM's is NEVER stated; treat as separate storage (OW-4).** | `C/Y` (default 1) | **E4** (`C/Y ≤ 0` — operator glyph dropped) | `other-worksheets-iconv-enter-cy` | Not started |

### 10c. Date (`2ND DATE`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND DATE` (open) | pp. 68-69 | Opens on `DT1`. Order `DT1 → DT2 → DBD → ACT/360`. | — | — | `other-worksheets-date-default-dt1` | Not started |
| `DT1` / `DT2` | pp. 68-69, p. 81 | Entered in the selected date format; displayed `MM-DD-YYYY` with **unpadded month** (`9-04-2003`). Computing a date also shows a three-letter weekday (e.g. `WED`). **`DT1` is "assumed" earlier than `DT2` — what happens if not is unstated (OW-6).** | `DT1`, `DT2` (default `12-31-1990`) | **E6** (invalid date; `MM.DDYYYY` format); **E4** (computed date outside 1980-01-01 … 2079-12-31) | `other-worksheets-date-enter-dt1`, `-enter-dt2` | Not started |
| `DBD` + `ACT` | p. 69, pp. 81-82 | Actual/actual. Day number = `(Y-YB)×365 + (days MB to M) + DT + (Y-YB)/4`; `DBD` = difference. Base = Jan 1 of the first year **after** a leap year. **The `/4` leap term is printed as a bare fraction with no floor notation — it must be an integer count (OW-7). `YB` is never given a concrete value (OW-8).** | `DBD` (default 0) | E4 | `other-worksheets-date-dbd-act` (→ `58.00`), `appendix-formulas-dbd-actual-actual` | Not started |
| `360` setting | p. 69, pp. 82-83 | 30 days/month, 360 days/year. **Under `360`, `DBD` is computable but `DT1`/`DT2` are NOT** (whether this errors or is silently inert is unstated — OW-9). Four day-of-month adjustments applied **in order**; **rules 1-2 (the February cases) exist ONLY on the scanned p. 83 insert — p. 82's `Note:` is empty. Order matters: rule 1 tests the UNMODIFIED `DT1`. See OW-10.** | `ACT/360` (default `ACT`) | E4 | `other-worksheets-date-act-setting-displayed` | Not started |

### 10d. Profit Margin (`2ND PROFIT`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND PROFIT` | pp. 70-71, p. 81 | Opens on `CST`. Order `CST → SEL → MAR`. `MAR = ((SEL - CST)/SEL) × 100`. **Margin is a percentage of SELLING PRICE — this is what distinguishes it from markup (a percentage of cost), which belongs in the `Δ%` worksheet.** | `CST`, `SEL`, `MAR` (all default 0) | **E1** (divide by zero: `CPT MAR` with `SEL = 0`; `CPT SEL` with `MAR = 100` — the `1 - MAR/100` divisor vanishes) | `other-worksheets-profit-margin-open-cst`, `-enter-sel`, `-enter-mar`, `-compute-cost` (→ `100.00`), `appendix-formulas-profit-margin-solve-cost` | Not started |
| `2ND CLR WORK` | p. 70 | Zeroes all three. | `CST`, `SEL`, `MAR` | — | — | Not started |

### 10e. Breakeven (`2ND BRKEVN`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND BRKEVN` | pp. 71-72, p. 81 | Opens on `FC`. Order `FC → VC → P → PFT → Q`. `PFT = PQ - (FC + VCQ)`. Enter four knowns, land on the fifth, `CPT`. **Enter `PFT = 0` to obtain the classic breakeven quantity — it is not a separate formula.** **`FC`/`VC` are entered as positive magnitudes and subtracted by the formula — NO TVM-style sign convention.** | `FC`, `VC`, `P`, `PFT`, `Q` (all default 0) | **E1** (divide by zero: `CPT Q` when `P = VC` — zero contribution margin; `CPT P`/`CPT VC` when `Q = 0`) | `other-worksheets-breakeven-enter-fc`, `-enter-vc`, `-enter-price`, `-pft-left-at-zero`, `-quantity` (→ `600.00`), `appendix-formulas-breakeven-quantity` | Not started |
| `2ND CLR WORK` | p. 71 | Zeroes all five. | all five | — | — | Not started |

### 10f. Memory worksheet (`2ND MEM`)

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| `2ND MEM` | pp. 72-73 | Browsable view of the same ten memories reachable via `STO`/`RCL` + digit. Opens on `M0`; `↓`/`↑` step `M0`…`M9`. Store by keying a value and pressing `ENTER`. **All ten are ENTER-ONLY — `CPT` has no meaning here.** | `M0`-`M9` | E1, E2 | `other-worksheets-memory-store` | Not started |
| In-worksheet memory arithmetic | p. 73 | With a memory displayed: press an operator (`+ - × ÷ Y^X`), key an operand, press `ENTER` — applies in place with the **stored value as the LEFT operand** and **redisplays**. `M4=190`, `Y^X 2 ENTER` → `36,100.00` (190², not 2¹⁹⁰). | `Mn`, display | E1 (overflow, ÷0); E2 (`Y^X`, negative base) | `other-worksheets-memory-add`…`-memory-power` | Not started |
| `2ND CLR WORK` | p. 73 | **Wipes ALL TEN memories at once.** There is no single-memory clear key — store 0 instead. Worth a confirmation-free warning in any UI. | `M0`-`M9` | — | `memory-and-last-answer-clear-all-ten-memories` | Not started |

## 11. Errors and clearing

> Spec: `docs/spec/errors-accuracy-aos.md` (pp. 84-87).

| Feature / Key | Guidebook § (pages) | Expected behaviour | Variables affected | Error conditions | Golden tests | Status |
|---|---|---|---|---|---|---|
| **Error 1 — Overflow** | p. 84 | Result outside `±9.9999999999999E99`; division by zero **including internally**; `1/x` at `x=0`; Statistics with all X or all Y identical. | — | E1 | — | Not started |
| **Error 2 — Invalid argument** | p. 84 | `x!` for `x` not an integer 0-69; `LN x` for `x` not > 0; `y^x` with `y<0` and `x` neither integer nor reciprocal of an integer; `√x` for `x<0`; Amort `BAL`/`PRN`/`INT` with `P2<P1`; Depreciation with `SAL>CST`. | — | E2 | — | Not started |
| **Error 3 — Too many pending ops** | p. 84 | **Two independent ceilings raising the same error**: >15 active parenthesis levels, **or** >8 pending operations. Either can be breached without the other. | parenLevels, pendingOps | E3 | — | Not started |
| **Error 4 — Out of range** | p. 84 | Amort `P1`/`P2` outside 1-9,999; TVM `P/Y`/`C/Y` vs 0; CF `Fnn` outside 0.5-9,999; Bond `RV`/`CPN`/`PRI` vs 0; Date outside 1980-2079; Depreciation `DB%`/`LIF`/`YR`/`CST`/`SAL`/`M01`; ICONV `C/Y` vs 0; `DEC` outside 0-9. **The comparison operators are DROPPED BY A PDF FONT DEFECT — present in the rendered images too. See ERR-2.** | — | E4 | — | Blocked |
| **Error 5 — No solution** | p. 84 | TVM `I/Y` when `FV`, `(N × PMT)` and `PV` all share one sign; TVM/CF/Bond when an `LN` input not > 0 arises mid-solve; CF `IRR` with no sign change. | — | E5 | — | Not started |
| **Error 6 — Invalid date** | p. 85 | Bond/Date: nonexistent date (January 32) or wrong format (`MM.DDYYYY` where `MM.DDYY` required); Bond: redemption date at or before settlement date. | — | E6 | `bond-error6-on-default-dates` | Not started |
| **Error 7 — Iteration limit** | p. 85 | TVM `I/Y`; CF `IRR` (multiple sign changes); Bond `YLD`. **No numeric iteration ceiling or convergence tolerance is published anywhere — exact parity on WHICH inputs raise E7 is NOT derivable from the guidebook. See ERR-4.** | — | E7 | — | Blocked |
| **Error 8 — Canceled iteration** | p. 85 | **User-initiated. `ON/OFF` acts as a BREAK key during an iterative solve, aborting it rather than powering off.** Applies to TVM `I/Y`, Amort `BAL`/`INT`, CF `IRR`, Bond `YLD`, Depreciation `DEP`/`RDV`. **`CE/C` is NOT the abort key — it only clears the resulting message.** | — | E8 | — | Not started |
| `CE/C` (clear) | p. 11, p. 84 | Clears an incorrect entry, an error condition, or an error message. After an operation key, aborts the calculation in progress. Required to clear a live error before `2ND RESET` is accepted. **Whether it also unwinds pending operations / open parentheses is NOT stated — ERR-3.** | display, error state | — | `clearing-and-math-ops-entry-error-*` | Not started |
| `CE/C CE/C` | p. 11 | Discards a keyed-but-not-`ENTER`ed worksheet value (**the previous value reappears**) and any incomplete calculation. Discards an armed constant. | display, pending stack, constant | — | — | Not started |
| `BKSP` (`→`) | p. 11, p. 12 | Deletes one character from the right-hand end of the number being keyed. **Only valid before the next operation key.** | entry buffer | — | `clearing-and-math-ops-entry-error-backspace` | Not started |
| **Internal precision** | p. 86 | **Results stored internally to 13 significant digits; displayed to 10 or fewer per `DEC`. Chained calculations consume the internal value, NEVER the displayed one.** | — | — | `errors-accuracy-aos-internal-step1-one-div-three`, `-internal-step2-times-three` | Not started |
| **Display rounding** | p. 86 | For results of 11+ significant digits the guard digits decide the display; if the 11th significant digit is ≥ 5 the result rounds up. **Round-half-up, not banker's rounding.** `1 ÷ 3 = 0.3333333333333` internally; `× 3 = 0.9999999999999` internally; **displays `1`**. | — | — | `errors-accuracy-aos-round-one-div-three-times-three` (**display assertion unresolved — see ERR-5**) | Not started |
| **AOS algebraic hierarchy** | p. 87 | Seven levels, highest first: **1** `x²` `x!` `1/x` `%` `√x` `LN` `e^x` `HYP` `INV` `SIN` `COS` `TAN`; **2** `nCr` `nPr`; **3** `y^x`; **4** `×` `÷`; **5** `+` `−`; **6** `)`; **7** `=`. Levels 4 and 5 each group two equal-priority operators that associate left-to-right. | calcMethod | E3 | `overview-display-formats-aos-3-plus-2-times-4` | Not started |
| Battery removal ≡ reset | p. 87 | The calculator cannot retain data when the battery is removed or discharged; replacing it has the same effect as resetting — restoring `DEC = 2` and `calcMethod = CHN`. | `DEC`, `calcMethod`, all | — | — | Not started |

---

## Appendix: cross-cutting invariants that no single row owns

These are properties of the whole engine. They are listed here because a row-by-row reading would let
them fall between the cracks, and each one has failed a real implementation somewhere.

| Invariant | Source | Why it bites | Status |
|---|---|---|---|
| **13 digits in, ≤10 digits out — always.** Every value entering the internal store passes a 13-significant-digit round. IEEE-754 doubles carry ~15-17 and are therefore *more* precise than the hardware. | p. 86 | `(1/3)×3` is exactly `1` in a double but `0.9999999999999` on the machine. Same display, divergent internals, and the divergence compounds through iterative solves. | Not started |
| **Amortization rounds to the DISPLAY setting, inside the loop.** | p. 76 | Makes a schedule a function of `DEC`. The display setting must be threaded into the amortization core, not treated as a formatting concern. | Not started |
| **Depreciation rounds internally too.** | p. 9, p. 78 | The *only* other worksheet that does. Accumulated depreciation accumulates **rounded** yearly figures. | Not started |
| **Entered values keep full precision regardless of the display.** | p. 35, p. 39 | `6.125 I/Y` displays `6.13` but must yield `-729.13`, not `-729.52`. | Not started |
| **Memory arithmetic must not round.** | pp. 33-34 | Summing displayed values gives `23,171.22`; the guidebook's answer is `23,171.23`. | Not started |
| **`STO`/`RCL` round-trip the full 13 digits.** | p. 9, p. 16 | A stored value can legitimately be more precise than anything showable. | Not started |
| **The worked example beats the printed formula, always.** | project rule | The appendix contains at least four confirmed defects (`PMT` sign, `ΣPrn` offset, NPV exponent, `EFF` `ln(x+1)`). | Not started |
| **Golden displays are strings, not numbers.** | throughout | Thousands separators, `-` signs, and decimal padding are all part of the assertion. `-1,071.37` ≠ `-1071.37`. | Not started |

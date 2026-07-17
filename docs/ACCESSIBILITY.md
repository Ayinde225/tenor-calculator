# Accessibility — WCAG 2.2 AA Conformance

Target: **WCAG 2.2 Level AA** for the Tenor calculator UI (`packages/calculator-ui`).

## How it was audited

Two complementary passes:

1. **Contrast, computed.** Every text and non-text colour pair, in all three themes,
   was checked against the AA thresholds (4.5:1 normal text, 3:1 large text and UI
   components) directly from the theme tokens using the WCAG relative-luminance
   formula. This is exact, not eyeballed.
2. **A five-dimension adversarial review.** Independent agents audited keyboard &
   focus, names/roles/states, dialog modality, reflow & target size, and
   motion/gestures against the actual source, and every finding was then
   adversarially verified — four false positives were rejected (e.g. a
   `<header>` nested in `<main>` does not by itself fail 1.3.1; native `<button>`s
   do not require `aria-expanded` at Level A).

## Findings and resolutions

Every confirmed issue was fixed. Each is regression-guarded by an end-to-end test
(`e2e/`) or by the contrast script, as noted.

| WCAG SC | Level | Issue | Resolution | Guarded by |
|---|---|---|---|---|
| 1.4.3 Contrast (Minimum) | AA | Light theme: amber 2nd-labels (3.8:1), white-on-accent equals key (3.5:1), accent headings on shell (3.3:1) | Darkened light `--accent` and `--tone-mod` | contrast script |
| 1.4.11 Non-text Contrast | AA | Key boundary invisible — light *and* dark themes had ~1.2–1.3:1 key borders with near-identical fills | Darkened/lightened `--key-edge` per theme to ≥3:1 vs both fill and shell | contrast script |
| 2.4.11 Focus Not Obscured | AA | Non-modal bottom-sheet dialogs let focus land on the keypad hidden behind them | Background regions set `inert` + `aria-modal="true"` while a dialog is open | e2e: inert test |
| 2.4.3 Focus Order | A | Focus not returned to the trigger on dialog close; dropped to `<body>` | Capture the opener, restore focus on every close path (× and Escape) | e2e: focus-return |
| 4.1.3 Status Messages | AA | Pressing 2ND / BGN / etc. changes no value, so screen readers announced nothing | Dedicated `role="status"` region announces active annunciators on change | — |
| 1.3.4 Orientation | AA | PWA manifest locked `portrait` | `orientation: "any"` | — |
| 1.4.10 Reflow | AA | LCD value clipped with an ellipsis at 320px / 400% zoom (silent content loss) | Lowered the font floor; long values scroll inside the LCD, no page overflow | e2e + 320px check |
| 2.5.2 Pointer Cancellation | A | Keys executed on the pointer *down* event | Activate on pointer *up* over the target; sliding off aborts; CE/C undoes | e2e: 2 pointer tests |
| 2.4.1 Bypass Blocks | A | Skip link targeted a non-focusable container that also held the header | Points at the focusable calculator region; Enter/Space explicitly move focus | e2e: skip-link |
| 4.1.2 Name, Role, Value | A | Settings/Shortcuts triggers exposed no open/closed state | `aria-expanded` + `aria-controls`, kept in sync | e2e: aria-expanded |

### Final contrast (all pass)

Run `node` against the token values, or see the audit commit. Representative pairs:

| Pair | Dark | Light | High-contrast | Need |
|---|---:|---:|---:|---:|
| Body text / background | 16.2 | 13.1 | 21.0 | 4.5 |
| Key label / key | 12.2 | 15.7 | 21.0 | 4.5 |
| 2nd-label / key | 6.3 | 5.9 | 19.6 | 4.5 |
| LCD value / LCD | 11.0 | 14.7 | 15.8 | 3.0 |
| Key border / shell | 3.8 | 3.3 | 21.0 | 3.0 |
| Focus ring / background | 13.8 | 4.3 | 19.6 | 3.0 |

## Conformant by construction

Verified during the audit and not changed because they already met AA:

- **Keyboard**: every control is a real `<button>`/`<a>`/native input — full keyboard
  operability, no traps. The physical keyboard also drives the calculator, with a
  visible shortcut guide.
- **Focus visible (2.4.7)**: a 3px `:focus-visible` outline on every interactive
  element, with a dedicated high-contrast theme.
- **Target size (2.5.8)**: keys are 44px+ (well past the 24px AA minimum); header
  controls are 40px.
- **Name/role (4.1.2)**: every key carries an accessible name including its second
  function; landmarks are `banner` / `main` / `complementary`.
- **Results announced (4.1.3)**: an `aria-live="polite"` region speaks each result.
- **Reduced motion (2.3.3)**: `prefers-reduced-motion` disables key transitions.
- **Pointer gestures (2.5.1)**: long-press auto-repeat is only an accelerator — a
  single press and the keyboard arrows do the same thing.

## Notes and limits

- The modal-background treatment uses the `inert` attribute (supported in all
  current evergreen browsers). Where `inert` is unavailable the dialogs degrade to
  the previous non-modal behaviour rather than breaking.
- This is an authored self-assessment against the success criteria, backed by
  automated tests. It is not a substitute for testing with real assistive
  technology and users, which should precede any formal conformance claim.

## Re-verifying

```bash
npm run test:e2e --workspace @tenor/calculator-ui   # keyboard, focus, pointer, reflow
```
Contrast is re-checked by running the luminance formula over the theme tokens in
`styles.css` (see the audit commit for the script).

/**
 * Application entry: wires the engine, the LCD, the keypad, the physical
 * keyboard, preferences, and session persistence together.
 *
 * The whole app is the engine plus a projection: every input path (button,
 * keyboard) resolves to a single `engine.press(key)`, and every render is driven
 * by the engine's subscription. There is no second source of truth.
 */
import './styles.css';
import {
  INITIAL_STATE,
  parseKeySequence,
  type CalculatorState,
  type DisplayState,
  type Key,
} from '@tenor/calculator-core';
import { Engine } from './engine.js';
import { createLcd } from './lcd.js';
import { createKeypad } from './keypad.js';
import { tokenFor, type KeyDef } from './layout.js';
import { keyFromEvent, SHORTCUT_GUIDE } from './keyboard.js';
import { createGuide } from './guide.js';
import { createHistory } from './history.js';
import { Feedback } from './feedback.js';
import {
  loadPreferences,
  savePreferences,
  loadSession,
  saveSession,
  type Preferences,
  type Theme,
} from './settings.js';

const prefs: Preferences = loadPreferences();
const feedback = new Feedback();
feedback.sound = prefs.sound;
feedback.haptics = prefs.haptics;

const engine = new Engine(loadSession() ?? INITIAL_STATE);
const lcd = createLcd();
const guide = createGuide();
const history = createHistory({ onRecall: recallValue });

// Dialog state, declared before buildHeader() runs since it registers triggers.
let openDialog: string | null = null;
/** The control that opened the current dialog, so focus can return to it (WCAG 2.4.3). */
let dialogTrigger: HTMLElement | null = null;
/** The header buttons that open each dialog, for aria-expanded sync (WCAG 4.1.2). */
const dialogTriggers = new Map<string, HTMLElement>();

const keypad = createKeypad({
  onKey: (def: KeyDef) => {
    // The token the user actually invoked (primary or the armed secondary) is what
    // the key history should show, so the guide records the same key the engine ran.
    const key = tokenFor(def, engine.secondArmed);
    guide.pushKey(labelForToken(def, key));
    sendKey(key);
  },
  onFeedback: () => feedback.press(),
});

/** Press one key, persist, and record a history entry if it produced a result. */
function sendKey(key: Key): void {
  const prev = engine.current;
  const prevDisplay = engine.display;
  engine.press(key);
  saveSession(engine.current);
  recordResult(key, prev, prevDisplay, engine.current, engine.display);
}

/**
 * Recognise a completed calculation and log it. Three shapes produce a result:
 *  - `=` in standard mode,
 *  - a worksheet `CPT` (computes immediately, so the display changes on that press),
 *  - a standard-mode `CPT var` (CPT arms computeArmed; the following variable key
 *    consumes it and computes).
 */
function recordResult(
  key: Key,
  prev: CalculatorState,
  prevDisplay: DisplayState,
  next: CalculatorState,
  nextDisplay: DisplayState,
): void {
  if (nextDisplay.isError) return;

  let title: string | null = null;
  if (key === '=') {
    title = '';
  } else if (
    key === 'CPT' &&
    next.mode.kind === 'worksheet' &&
    nextDisplay.value !== prevDisplay.value
  ) {
    title = nextDisplay.label.replace(/=$/, '');
  } else if (prev.computeArmed && !next.computeArmed) {
    title = nextDisplay.label !== '' ? nextDisplay.label.replace(/=$/, '') : String(key);
  }
  if (title === null) return;

  history.record({ title, display: nextDisplay.value, value: next.displayValue });
}

/** Re-enter a recalled value by keying its digits, as if typed. */
function recallValue(value: number): void {
  const literal = Number.isFinite(value) ? value.toString() : '';
  if (literal === '' || literal.includes('e')) return; // scientific values are not re-keyable
  for (const k of parseKeySequence([literal])) engine.press(k);
  saveSession(engine.current);
}

/** The face text to show in the key history for a token the user invoked. */
function labelForToken(def: KeyDef, key: Key): string {
  if (key === def.secondary && def.secondaryLabel !== undefined) return def.secondaryLabel;
  return def.label;
}

// ---------------------------------------------------------------------------
// Layout scaffolding
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
if (app === null) throw new Error('missing #app root');

const shell = document.createElement('main');
shell.className = 'calculator';
shell.setAttribute('aria-label', 'Tenor financial calculator');

const header = buildHeader();
const controls = buildControls();

// The skip link jumps here — the display, past the header toggles. It is made
// programmatically focusable, and the link explicitly moves focus, since browsers
// do not reliably focus a fragment target on their own (WCAG 2.4.1).
lcd.root.id = 'calculator';
lcd.root.tabIndex = -1;
const skipLink = document.querySelector('.skip-link');
if (skipLink !== null) {
  const activateSkip = (e: Event): void => {
    e.preventDefault();
    lcd.root.scrollIntoView();
    lcd.root.focus();
  };
  skipLink.addEventListener('click', activateSkip);
  // Handle Enter/Space directly rather than relying on the browser to synthesise a
  // click and move focus to the fragment, which is unreliable across browsers.
  skipLink.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') activateSkip(e);
  });
}
shell.append(header, lcd.root, keypad.root);
const disclaimer = buildDisclaimer();
app.append(shell, guide.root, history.root, controls.panel, disclaimer);

engine.subscribe((display, state) => {
  lcd.update(display);
  guide.update(display, state);
  shell.classList.toggle('second-armed', display.indicators.includes('2nd'));
});

guide.setOpen(prefs.guided);

// ---------------------------------------------------------------------------
// Physical keyboard
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  // Let the keypad's own buttons handle Enter/Space themselves.
  if (target?.tagName === 'BUTTON') return;
  const key = keyFromEvent(e);
  if (key === null) return;
  e.preventDefault();
  feedback.press();
  keypad.flash(key);
  sendKey(key);
});

// ---------------------------------------------------------------------------
// Header, theme, and controls
// ---------------------------------------------------------------------------

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
applyTheme(prefs.theme);

function buildHeader(): HTMLElement {
  const el = document.createElement('header');
  el.className = 'app-header';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true">t</span><span class="brand-name">Tenor</span>';

  const nav = document.createElement('div');
  nav.className = 'header-actions';

  const learnBtn = document.createElement('button');
  learnBtn.type = 'button';
  learnBtn.className = 'learn-button';
  learnBtn.textContent = 'Learn';
  learnBtn.setAttribute('aria-pressed', String(prefs.guided));
  learnBtn.addEventListener('click', () => {
    const open = !guide.open;
    guide.setOpen(open);
    learnBtn.setAttribute('aria-pressed', String(open));
    learnBtn.classList.toggle('on', open);
    prefs.guided = open;
    savePreferences(prefs);
  });
  learnBtn.classList.toggle('on', prefs.guided);

  const historyBtn = iconButton('Calculation history', '↺', () => {
    const open = !history.open;
    history.setOpen(open);
    historyBtn.setAttribute('aria-pressed', String(open));
    historyBtn.classList.toggle('on', open);
  });
  historyBtn.setAttribute('aria-pressed', 'false');

  const shortcutsBtn = iconButton('Keyboard shortcuts', '?', () => toggleDialog('shortcuts'));
  const settingsBtn = iconButton('Settings', '⚙', () => toggleDialog('settings'));
  // Expose the toggle state and the panel each controls (WCAG 4.1.2).
  for (const [btn, id] of [
    [shortcutsBtn, 'shortcuts'],
    [settingsBtn, 'settings'],
  ] as const) {
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `dialog-${id}`);
    dialogTriggers.set(id, btn);
  }
  nav.append(learnBtn, historyBtn, shortcutsBtn, settingsBtn);

  el.append(brand, nav);
  return el;
}

function iconButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-button';
  b.setAttribute('aria-label', label);
  b.textContent = glyph;
  b.addEventListener('click', onClick);
  return b;
}

function buildControls(): { panel: HTMLElement } {
  const panel = document.createElement('div');
  panel.append(buildSettingsDialog(), buildShortcutsDialog());
  return { panel };
}

/**
 * The regions made inert while a dialog is open. Inert removes them from the tab
 * order and from assistive tech, so focus cannot land on the keypad sitting behind
 * the opaque bottom sheet (WCAG 2.4.11) — the dialogs live in `controls.panel`,
 * which is deliberately not in this list.
 */
function backgroundRegions(): HTMLElement[] {
  return [shell, guide.root, history.root, disclaimer];
}

function setBackgroundInert(on: boolean): void {
  for (const region of backgroundRegions()) {
    if (on) region.setAttribute('inert', '');
    else region.removeAttribute('inert');
  }
}

function openDialogById(id: string): void {
  const el = document.getElementById(`dialog-${id}`);
  if (el === null) return;
  dialogTrigger = document.activeElement as HTMLElement | null;
  el.classList.add('open');
  el.setAttribute('aria-modal', 'true');
  dialogTriggers.get(id)?.setAttribute('aria-expanded', 'true');
  setBackgroundInert(true);
  openDialog = id;
  (el.querySelector('button, [tabindex]') as HTMLElement | null)?.focus();
}

function closeDialog(): void {
  if (openDialog === null) return;
  const el = document.getElementById(`dialog-${openDialog}`);
  el?.classList.remove('open');
  el?.setAttribute('aria-modal', 'false');
  dialogTriggers.get(openDialog)?.setAttribute('aria-expanded', 'false');
  openDialog = null;
  setBackgroundInert(false); // lift inert before restoring focus, or the focus is refused
  dialogTrigger?.focus();
  dialogTrigger = null;
}

function toggleDialog(id: string): void {
  if (openDialog === id) {
    closeDialog();
    return;
  }
  if (openDialog !== null) closeDialog();
  openDialogById(id);
}

function buildSettingsDialog(): HTMLElement {
  const el = dialog('settings', 'Settings');

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'high-contrast', label: 'High contrast' },
  ];
  const themeGroup = document.createElement('fieldset');
  themeGroup.className = 'field-group';
  themeGroup.innerHTML = '<legend>Theme</legend>';
  for (const t of themes) {
    const id = `theme-${t.value}`;
    const wrap = document.createElement('label');
    wrap.className = 'radio';
    wrap.htmlFor = id;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'theme';
    input.id = id;
    input.value = t.value;
    input.checked = prefs.theme === t.value;
    input.addEventListener('change', () => {
      prefs.theme = t.value;
      applyTheme(t.value);
      savePreferences(prefs);
    });
    wrap.append(input, document.createTextNode(' ' + t.label));
    themeGroup.append(wrap);
  }

  const toggles = document.createElement('fieldset');
  toggles.className = 'field-group';
  toggles.innerHTML = '<legend>Feedback</legend>';
  toggles.append(
    toggle('Key-click sound', prefs.sound, (on) => {
      prefs.sound = on;
      feedback.sound = on;
      savePreferences(prefs);
    }),
    toggle('Vibration', prefs.haptics, (on) => {
      prefs.haptics = on;
      feedback.haptics = on;
      savePreferences(prefs);
    }),
  );

  el.append(themeGroup, toggles);
  return el;
}

function toggle(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(input, text);
  return wrap;
}

function buildShortcutsDialog(): HTMLElement {
  const el = dialog('shortcuts', 'Keyboard shortcuts');
  const list = document.createElement('dl');
  list.className = 'shortcut-list';
  for (const s of SHORTCUT_GUIDE) {
    const dt = document.createElement('dt');
    dt.textContent = s.keys;
    const dd = document.createElement('dd');
    dd.textContent = s.does;
    list.append(dt, dd);
  }
  el.append(list);
  return el;
}

function dialog(id: string, title: string): HTMLElement {
  const el = document.createElement('section');
  el.id = `dialog-${id}`;
  el.className = 'dialog';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', title);

  const head = document.createElement('div');
  head.className = 'dialog-head';
  const h = document.createElement('h2');
  h.textContent = title;
  const close = iconButton('Close', '×', () => toggleDialog(id));
  head.append(h, close);
  el.append(head);
  return el;
}

function buildDisclaimer(): HTMLElement {
  const el = document.createElement('footer');
  el.className = 'disclaimer';
  el.textContent =
    'Tenor is an independent financial calculator. It is not manufactured, ' +
    'sponsored, endorsed, or approved by Texas Instruments.';
  return el;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openDialog !== null) {
    closeDialog();
  }
});

// Register the service worker for offline use (built separately).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is an enhancement, not a requirement */
    });
  });
}

/**
 * The guided-learning panel.
 *
 * A read-only overlay that explains what the calculator is doing right now: which
 * worksheet is open, what the active variable means, every variable's current
 * value, the recent key sequence, and a worked example. It renders from the same
 * engine state the LCD does and computes nothing itself.
 */
import { formatValue, type CalculatorState, type DisplayState } from '@tenor/calculator-core';
import { contextFor, activeVariable, type GuidedVariable } from './guide-content.js';

const MAX_HISTORY = 16;

export interface Guide {
  readonly root: HTMLElement;
  update(display: DisplayState, state: CalculatorState): void;
  pushKey(token: string): void;
  setOpen(open: boolean): void;
  get open(): boolean;
}

export function createGuide(): Guide {
  const root = document.createElement('aside');
  root.className = 'guide';
  root.setAttribute('aria-label', 'Guided learning');
  root.hidden = true;

  const title = el('h2', 'guide-title');
  const intro = el('p', 'guide-intro');

  const activeBox = el('div', 'guide-active');
  const activeLabel = el('span', 'guide-active-label');
  const activeName = el('span', 'guide-active-name');
  const activeText = el('p', 'guide-active-explain');
  const activeHead = el('div', 'guide-active-head');
  activeHead.append(activeLabel, activeName);
  activeBox.append(activeHead, activeText);

  const varsHead = el('h3', 'guide-subhead', 'Variables');
  const vars = el('dl', 'guide-vars');

  const historyHead = el('h3', 'guide-subhead', 'Recent keys');
  const history = el('div', 'guide-history');
  history.setAttribute('aria-live', 'off');

  const exampleBox = el('div', 'guide-example');

  root.append(title, intro, activeBox, varsHead, vars, exampleBox, historyHead, history);

  const keyLog: string[] = [];
  let lastDisplay: DisplayState | null = null;

  function renderVars(context: ReturnType<typeof contextFor>, state: CalculatorState, activeLbl: string): void {
    vars.replaceChildren();
    const fmt = { decimals: state.format.DEC, separator: state.format.separators };
    for (const variable of context.variables) {
      const isActive = matchesActive(variable, activeLbl);
      const dt = el('dt', 'guide-var-label' + (isActive ? ' active' : ''), variable.label);
      const dd = el('dd', 'guide-var-body');
      const name = el('span', 'guide-var-name', variable.name);
      const val = el('span', 'guide-var-value');
      const stored = variable.value(state);
      // The active variable's live value is authoritative — it is exactly what the
      // LCD shows, taken from the engine's own projection so nothing is re-derived.
      // Others read stored state, or a dash for values only computed on scroll.
      val.textContent = isActive
        ? (lastDisplay?.value ?? '')
        : stored === null
          ? '—'
          : formatValue(stored, fmt);
      const explain = el('p', 'guide-var-explain', variable.explain);
      dd.append(name, val, explain);
      vars.append(dt, dd);
    }
  }

  function update(display: DisplayState, state: CalculatorState): void {
    lastDisplay = display;
    const context = contextFor(state);
    title.textContent = context.title;
    intro.textContent = context.intro;

    const active = activeVariable(context, display.label);
    if (active !== null) {
      activeBox.hidden = false;
      activeLabel.textContent = display.label;
      activeName.textContent = active.name;
      activeText.textContent = active.explain;
    } else {
      activeBox.hidden = true;
    }

    renderVars(context, state, display.label);

    exampleBox.replaceChildren();
    if (context.example !== undefined) {
      exampleBox.append(
        el('h3', 'guide-subhead', 'Try it'),
        el('p', 'guide-example-title', context.example.title),
        el('p', 'guide-example-steps', context.example.steps),
      );
    }
  }

  function pushKey(token: string): void {
    keyLog.push(token);
    if (keyLog.length > MAX_HISTORY) keyLog.shift();
    history.replaceChildren();
    for (const t of keyLog) {
      history.append(el('span', 'key-chip', t));
    }
  }

  function setOpen(open: boolean): void {
    root.hidden = !open;
  }

  return {
    root,
    update,
    pushKey,
    setOpen,
    get open() {
      return !root.hidden;
    },
  };
}

function matchesActive(variable: GuidedVariable, activeLabel: string): boolean {
  if (activeLabel === '') return false;
  const bare = activeLabel.replace(/=$/, '');
  return variable.matches ? variable.matches(bare) : variable.label === bare;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

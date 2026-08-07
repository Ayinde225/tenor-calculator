/**
 * Practice mode — interactive walkthroughs of the guidebook's worked examples,
 * played key-by-key on the real calculator.
 *
 * The player owns no calculation: a lesson is a verified key script, and the
 * engine runs every press exactly as if the user were working freely. The player
 * only decides WHICH key comes next, highlights it on the keypad, explains the
 * step, and checks the display against the lesson's recorded checkpoint.
 *
 * Strictness: while a lesson is active, only the expected key is forwarded to the
 * engine — a stray press nudges the highlight instead of derailing the script.
 * Exit is always one click away and leaves the calculator wherever the lesson
 * got to, which is itself instructive.
 */
import { parseKeySequence, type DisplayState, type Key } from '@tenor/calculator-core';
import { AREAS, type Lesson, type LessonStep } from './lessons/index.js';

interface FlatStep {
  readonly tokens: readonly Key[];
  readonly explain: string;
  readonly expect?: LessonStep['expect'];
}

export interface PracticeCallbacks {
  /** Highlight a key by its PRIMARY token (the button identity), or clear with null. */
  readonly onHint: (primary: Key | null) => void;
  /** Forward an accepted token to the engine (the normal send path). */
  readonly onSend: (token: Key) => void;
  /** Reset the calculator to a fresh state for a new lesson. */
  readonly onReset: () => void;
  /** Current display, for checkpoint verification. */
  readonly getDisplay: () => DisplayState;
  /**
   * Map an engine token to the PRIMARY token of the button that produces it
   * (a secondary function maps to its host key), or null if unmapped.
   */
  readonly buttonFor: (token: Key) => Key | null;
}

export interface Practice {
  readonly root: HTMLElement;
  /** True while a lesson is running — the app routes key presses through userPressed. */
  readonly active: boolean;
  /** Handle a user key press; returns nothing — accepted keys are forwarded internally. */
  userPressed(token: Key): void;
  setOpen(open: boolean): void;
  readonly open: boolean;
}

export function createPractice(cb: PracticeCallbacks): Practice {
  const root = document.createElement('aside');
  root.className = 'practice';
  root.setAttribute('aria-label', 'Practice mode');
  root.hidden = true;

  // --- Picker ---------------------------------------------------------------
  const picker = document.createElement('div');
  picker.className = 'practice-picker';
  const pickerTitle = document.createElement('h2');
  pickerTitle.textContent = 'Practice';
  const pickerIntro = document.createElement('p');
  pickerIntro.className = 'practice-intro';
  pickerIntro.textContent =
    'Worked examples from real finance problems, played step by step on the calculator. ' +
    'Pick one — the key to press lights up, and each step explains why.';
  picker.append(pickerTitle, pickerIntro);

  for (const area of AREAS) {
    const h = document.createElement('h3');
    h.className = 'practice-area';
    h.textContent = area.title;
    picker.append(h);
    const list = document.createElement('div');
    list.className = 'practice-list';
    for (const lesson of area.lessons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'practice-item';
      b.textContent = lesson.title;
      b.addEventListener('click', () => start(lesson));
      list.append(b);
    }
    picker.append(list);
  }
  if (AREAS.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'practice-intro';
    empty.textContent = 'No lessons bundled in this build.';
    picker.append(empty);
  }

  // --- Player ---------------------------------------------------------------
  const player = document.createElement('div');
  player.className = 'practice-player';
  player.hidden = true;

  const head = document.createElement('div');
  head.className = 'practice-head';
  const title = document.createElement('h2');
  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className = 'practice-exit';
  exitBtn.textContent = 'Exit';
  exitBtn.addEventListener('click', () => stop());
  head.append(title, exitBtn);

  const source = document.createElement('p');
  source.className = 'practice-source';
  const progress = document.createElement('p');
  progress.className = 'practice-progress';
  const explain = document.createElement('p');
  explain.className = 'practice-explain';
  explain.setAttribute('aria-live', 'polite');
  const mismatch = document.createElement('p');
  mismatch.className = 'practice-mismatch';
  mismatch.hidden = true;

  const controls = document.createElement('div');
  controls.className = 'practice-controls';
  const showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'practice-show';
  showBtn.textContent = 'Press it for me';
  showBtn.addEventListener('click', () => {
    const t = expectedToken();
    if (t !== null) accept(t);
  });
  controls.append(showBtn);

  const done = document.createElement('div');
  done.className = 'practice-done';
  done.hidden = true;

  player.append(head, source, progress, explain, mismatch, controls, done);
  root.append(picker, player);

  // --- State ----------------------------------------------------------------
  let lesson: Lesson | null = null;
  let steps: FlatStep[] = [];
  let stepIdx = 0;
  let tokenIdx = 0;

  function start(l: Lesson): void {
    lesson = l;
    steps = l.steps.map((s) => ({
      tokens: parseKeySequence(s.keys),
      explain: s.explain,
      ...(s.expect ? { expect: s.expect } : {}),
    }));
    stepIdx = 0;
    tokenIdx = 0;
    title.textContent = l.title;
    source.textContent = `${l.intro}  (${l.source})`;
    done.hidden = true;
    mismatch.hidden = true;
    picker.hidden = true;
    player.hidden = false;
    cb.onReset();
    render();
  }

  function stop(): void {
    lesson = null;
    cb.onHint(null);
    player.hidden = true;
    picker.hidden = false;
  }

  function expectedToken(): Key | null {
    const step = steps[stepIdx];
    if (lesson === null || step === undefined) return null;
    return step.tokens[tokenIdx] ?? null;
  }

  function render(): void {
    const step = steps[stepIdx];
    if (lesson === null || step === undefined) return;
    progress.textContent = `Step ${stepIdx + 1} of ${steps.length}`;
    explain.textContent = step.explain;
    const next = expectedToken();
    cb.onHint(next === null ? null : cb.buttonFor(next));
  }

  function finishLesson(): void {
    cb.onHint(null);
    done.textContent = lesson?.answer ?? '';
    done.hidden = false;
    progress.textContent = 'Done';
    explain.textContent = '';
  }

  /** Verify the step's recorded checkpoint against the live display. */
  function checkpoint(step: FlatStep): void {
    if (step.expect === undefined) return;
    const d = cb.getDisplay();
    const ok = d.value === step.expect.value && d.label === step.expect.label;
    mismatch.hidden = ok;
    if (!ok) {
      mismatch.textContent =
        `Heads up: the display reads ${d.label} ${d.value} but this step expected ` +
        `${step.expect.label} ${step.expect.value}. Exit and restart the lesson if things look off.`;
    }
  }

  function accept(token: Key): void {
    const step = steps[stepIdx];
    if (step === undefined) return;
    cb.onSend(token);
    tokenIdx++;
    if (tokenIdx >= step.tokens.length) {
      checkpoint(step);
      stepIdx++;
      tokenIdx = 0;
      if (stepIdx >= steps.length) {
        finishLesson();
        return;
      }
    }
    render();
  }

  function userPressed(token: Key): void {
    const expected = expectedToken();
    if (expected === null) return;
    // Accept an exact token match, or a press of the hinted BUTTON. The second
    // case matters when the script follows the hardware gesture: after `2ND`,
    // a script token of `QUIT` still hints the QUIT button, but pressing it
    // resolves to that button's secondary (`RESET`). The user did exactly what
    // was asked, so accept — and forward the SCRIPT's token, keeping the engine
    // replay identical to the verified lesson.
    const sameButton =
      cb.buttonFor(token) !== null && cb.buttonFor(token) === cb.buttonFor(expected);
    if (token === expected || sameButton) {
      accept(expected);
    } else {
      // Wrong key: don't forward it (the script would derail); re-pulse the hint.
      const target = cb.buttonFor(expected);
      cb.onHint(null);
      requestAnimationFrame(() => cb.onHint(target));
    }
  }

  return {
    root,
    get active() {
      return lesson !== null && !player.hidden && done.hidden;
    },
    userPressed,
    setOpen: (open: boolean) => {
      root.hidden = !open;
      if (!open) stop();
    },
    get open() {
      return !root.hidden;
    },
  };
}

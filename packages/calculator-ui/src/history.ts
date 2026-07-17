/**
 * Calculation history — a tape of completed results the user can recall.
 *
 * The engine has no history of its own (the hardware doesn't either), so the UI
 * keeps one. An entry is recorded only for a genuine result: pressing `=`, or
 * computing an unknown with CPT. Each entry stores the exact numeric value so a
 * click re-enters it losslessly, not the rounded display string.
 *
 * History is a convenience layer, never a source of truth: it is derived from
 * results the engine produced and can be cleared at any time.
 */
export interface HistoryEntry {
  /** A short context tag, e.g. 'PMT' for a computed variable, '' for a plain result. */
  readonly title: string;
  /** The value as it was displayed. */
  readonly display: string;
  /** The exact internal value, for lossless recall. */
  readonly value: number;
}

const STORAGE_KEY = 'tenor.history.v1';
const MAX_ENTRIES = 50;

export interface History {
  readonly root: HTMLElement;
  record(entry: HistoryEntry): void;
  setOpen(open: boolean): void;
  get open(): boolean;
}

export interface HistoryOptions {
  /** Fired when an entry is clicked, with its exact value to re-enter. */
  readonly onRecall: (value: number) => void;
}

export function createHistory(opts: HistoryOptions): History {
  const entries: HistoryEntry[] = load();

  const root = document.createElement('aside');
  root.className = 'history';
  root.setAttribute('aria-label', 'Calculation history');
  root.hidden = true;

  const head = document.createElement('div');
  head.className = 'history-head';
  const title = document.createElement('h2');
  title.textContent = 'History';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'history-clear';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => {
    entries.length = 0;
    save(entries);
    render();
  });
  head.append(title, clear);

  const list = document.createElement('ol');
  list.className = 'history-list';
  list.setAttribute('aria-label', 'Recent results, newest first');

  const empty = document.createElement('p');
  empty.className = 'history-empty';
  empty.textContent = 'Results you compute will appear here.';

  root.append(head, list, empty);

  function render(): void {
    list.replaceChildren();
    empty.hidden = entries.length > 0;
    // Newest first.
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]!;
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-entry';
      button.setAttribute(
        'aria-label',
        `Recall ${entry.title ? entry.title + ' ' : ''}${entry.display}`,
      );
      const tag = document.createElement('span');
      tag.className = 'history-tag';
      tag.textContent = entry.title;
      const val = document.createElement('span');
      val.className = 'history-value';
      val.textContent = entry.display;
      button.append(tag, val);
      button.addEventListener('click', () => opts.onRecall(entry.value));
      li.append(button);
      list.append(li);
    }
  }

  function record(entry: HistoryEntry): void {
    // Skip a no-op duplicate of the most recent entry (e.g. pressing = twice).
    const last = entries[entries.length - 1];
    if (last && last.display === entry.display && last.title === entry.title) return;
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();
    save(entries);
    render();
  }

  render();

  return {
    root,
    record,
    setOpen: (open: boolean) => {
      root.hidden = !open;
    },
    get open() {
      return !root.hidden;
    },
  };
}

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

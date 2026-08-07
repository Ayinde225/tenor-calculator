/**
 * Practice-lesson content: one JSON file per area, curated from the golden-test
 * corpus (the guidebook's worked examples) and replay-verified against the engine
 * so a lesson can never teach a wrong keystroke or display.
 *
 * Loaded with import.meta.glob so the player picks up whatever areas exist — the
 * content ships as data, not code.
 */

export interface LessonStep {
  /** Engine key tokens, same vocabulary as tests/golden (parseKeySequence expands them). */
  readonly keys: readonly string[];
  /** Student-facing: what this step does and why. Original prose. */
  readonly explain: string;
  /** The display after the step's last key, when deterministic. */
  readonly expect?: { readonly label: string; readonly value: string };
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  /** Provenance, e.g. "Guidebook p. 29". */
  readonly source: string;
  readonly steps: readonly LessonStep[];
  /** The takeaway shown on completion. */
  readonly answer: string;
}

export interface LessonArea {
  readonly area: string;
  readonly title: string;
  readonly lessons: readonly Lesson[];
}

/** Display order for areas; anything unlisted sorts after, alphabetically. */
const AREA_ORDER = [
  'getting-started',
  'tvm-loans',
  'amortization',
  'cash-flow',
  'bond',
  'depreciation',
  'everyday',
  'memory-shortcuts',
];

const modules = import.meta.glob<{ default: LessonArea }>('./*.json', { eager: true });

export const AREAS: readonly LessonArea[] = Object.values(modules)
  .map((m) => m.default)
  .filter((a): a is LessonArea => Boolean(a && a.area && Array.isArray(a.lessons)))
  .sort((a, b) => {
    const ia = AREA_ORDER.indexOf(a.area);
    const ib = AREA_ORDER.indexOf(b.area);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.area.localeCompare(b.area);
  });

export const totalLessons = (): number => AREAS.reduce((n, a) => n + a.lessons.length, 0);

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reduceAll,
  project,
  parseKeySequence,
  INITIAL_STATE,
  type CalculatorState,
} from '../../calculator-core/src/index.js';
import type { LessonArea } from './lessons/index.js';

/**
 * Every practice lesson is replayed through the real reducer and every recorded
 * checkpoint asserted. A lesson that would teach a wrong keystroke or display
 * cannot ship: content correctness is CI-enforced, exactly like the golden corpus.
 *
 * Lessons are data (JSON), so this reads the directory directly — the app itself
 * loads the same files via import.meta.glob.
 */
const LESSONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'lessons');

const areaFiles = readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));

describe('practice lessons replay faithfully through the engine', () => {
  it('has lesson content bundled', () => {
    expect(areaFiles.length).toBeGreaterThan(0);
  });

  for (const file of areaFiles) {
    const area = JSON.parse(readFileSync(join(LESSONS_DIR, file), 'utf-8')) as LessonArea;

    describe(`${area.title} (${file})`, () => {
      for (const lesson of area.lessons) {
        it(`${lesson.title} [${lesson.id}]`, () => {
          let state: CalculatorState = INITIAL_STATE;
          for (const [i, step] of lesson.steps.entries()) {
            state = reduceAll(state, parseKeySequence([...step.keys])).state;
            if (step.expect !== undefined) {
              const d = project(state);
              expect(
                { step: i + 1, label: d.label, value: d.value },
                `step ${i + 1} of ${lesson.id}`,
              ).toEqual({ step: i + 1, label: step.expect.label, value: step.expect.value });
            }
          }
        });
      }

      it('has unique, well-formed lesson ids', () => {
        const ids = area.lessons.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
      });
    });
  }
});

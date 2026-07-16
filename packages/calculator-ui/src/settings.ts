/**
 * User preferences and session persistence, both in localStorage.
 *
 * Two separate concerns share this module:
 *  - Preferences (theme, sound, haptics): how the app looks and feels.
 *  - The calculator session (the full engine state): so reopening the app resumes
 *    exactly where the user left off, which the guidebook's Constant Memory does
 *    on the hardware (p. 6).
 *
 * Everything is best-effort: a private-mode or quota failure degrades to defaults
 * rather than breaking the calculator, which must work with no storage at all.
 */
import type { CalculatorState } from '@tenor/calculator-core';

export type Theme = 'light' | 'dark' | 'high-contrast';

export interface Preferences {
  theme: Theme;
  sound: boolean;
  haptics: boolean;
  /** Whether the guided-learning panel is shown. */
  guided: boolean;
}

const PREFS_KEY = 'tenor.prefs.v1';
const SESSION_KEY = 'tenor.session.v1';

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  sound: false, // key-click sound is off by default, per the brief
  haptics: true,
  guided: false,
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preferences simply do not persist */
  }
}

export function loadPreferences(): Preferences {
  const raw = safeGet(PREFS_KEY);
  if (raw === null) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: Preferences): void {
  safeSet(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * The persisted session is the whole engine state. It is versioned by key
 * (`.v1`) so a future state-shape change can bump the key and start clean rather
 * than deserialising an incompatible blob.
 */
export function loadSession(): CalculatorState | null {
  const raw = safeGet(SESSION_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as CalculatorState;
  } catch {
    return null;
  }
}

export function saveSession(state: CalculatorState): void {
  safeSet(SESSION_KEY, JSON.stringify(state));
}

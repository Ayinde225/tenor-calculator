import { type Page, expect } from '@playwright/test';

/**
 * A small page object for the calculator.
 *
 * Keys are pressed by their engine token via the `data-key` hook, so a test reads
 * like the guidebook's keystroke tables. A second-function key is pressed as
 * `2ND` then the key, exactly as a user would.
 */
export class Calc {
  constructor(private readonly page: Page) {}

  /** Load the app with a clean slate — no persisted session, history, or prefs. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await this.page.locator('.keypad').waitFor();
  }

  /** Press one key by its primary token, e.g. '7', 'N', '='. */
  async press(token: string): Promise<void> {
    await this.page.locator(`[data-key="${cssEscape(token)}"]`).click();
  }

  /** Press a sequence of primary-token keys. */
  async keys(...tokens: string[]): Promise<void> {
    for (const t of tokens) await this.press(t);
  }

  /** Type a number as individual digit presses (leading '-' becomes a trailing +/-). */
  async type(literal: string): Promise<void> {
    const negative = literal.startsWith('-');
    for (const ch of negative ? literal.slice(1) : literal) {
      await this.press(ch === '.' ? '.' : ch);
    }
    if (negative) await this.press('+/-');
  }

  /** Press a second function: 2ND then the key holding it. */
  async second(token: string): Promise<void> {
    await this.press('2ND');
    await this.press(token);
  }

  /** The main numeric readout. */
  lcdValue() {
    return this.page.locator('.lcd-value');
  }

  /** The variable label to the left of the readout (empty in standard mode). */
  lcdLabel() {
    return this.page.locator('.lcd-label');
  }

  async expectDisplay(value: string): Promise<void> {
    await expect(this.lcdValue()).toHaveText(value);
  }
}

/** Escape a token for use in a CSS attribute selector (handles '/', '%', etc.). */
function cssEscape(token: string): string {
  return token.replace(/["\\]/g, '\\$&');
}

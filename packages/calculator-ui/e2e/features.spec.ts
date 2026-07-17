import { test, expect } from '@playwright/test';
import { Calc } from './helpers.js';

test.describe('guided learning mode', () => {
  test('opens, explains, and follows the active worksheet', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();

    await page.getByRole('button', { name: 'Learn' }).click();
    const guide = page.locator('.guide');
    await expect(guide).toBeVisible();
    await expect(guide.locator('.guide-title')).toHaveText('Time Value of Money');

    // Entering a value updates that variable's readout in the panel.
    await calc.type('360');
    await calc.press('N');
    await expect(guide.locator('.guide-var-value', { hasText: '360.00' })).toBeVisible();

    // Opening a worksheet switches the whole panel and highlights the active field.
    await calc.press('CF');
    await expect(guide.locator('.guide-title')).toHaveText('Cash Flow');
    await expect(guide.locator('.guide-active-name')).toHaveText('Initial cash flow');
    await expect(guide.locator('.guide-var-label', { hasText: /^CFo$/ })).toHaveClass(/active/);
  });
});

test.describe('calculation history', () => {
  test('records results and recalls them losslessly', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();

    await calc.keys('3', '+', '2', '×', '4', '=');
    await page.getByRole('button', { name: 'Calculation history' }).click();

    const entries = page.locator('.history-entry');
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText('20.00');

    // Recall re-enters the value.
    await calc.press('CE/C');
    await calc.expectDisplay('0.00');
    await entries.first().click();
    await calc.expectDisplay('20');
  });

  test('a computed TVM variable is tagged with its name', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.keys('1', '0', 'N', '5', 'I/Y', '1', '0', '0', '0', 'PV');
    await calc.press('CPT');
    await calc.press('FV');
    await page.getByRole('button', { name: 'Calculation history' }).click();
    await expect(page.locator('.history-entry').first()).toContainText('FV');
  });
});

test.describe('themes and accessibility', () => {
  test('switching to high contrast restyles the whole app', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('High contrast').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  });

  test('every key has an accessible name', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    const buttons = page.locator('.keypad button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(40);
    for (let i = 0; i < count; i++) {
      const name = await buttons.nth(i).getAttribute('aria-label');
      expect(name?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  test('a skip link is the first focusable element', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to calculator' })).toBeFocused();
  });
});

test.describe('the physical keyboard drives the calculator', () => {
  test('typing digits and operators computes a result', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await page.locator('body').focus();
    await page.keyboard.type('7*6');
    await page.keyboard.press('Enter');
    await calc.expectDisplay('42.00');
  });
});

test.describe('persistence', () => {
  test('the session survives a reload', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.keys('5', '+', '3', '=');
    await calc.expectDisplay('8.00');
    await page.reload(); // no localStorage.clear() this time
    await calc.expectDisplay('8.00');
  });
});

test.describe('long-press worksheet scrolling', () => {
  test('holding DOWN cycles through several fields', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.press('AMORT'); // 5 fields: P1, P2, BAL, PRN, INT
    await expect(calc.lcdLabel()).toHaveText('P1=');

    const down = page.locator('[data-key="DOWN"]');
    const seen = new Set<string>();
    await down.dispatchEvent('pointerdown');
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(120);
      seen.add((await calc.lcdLabel().textContent()) ?? '');
    }
    await down.dispatchEvent('pointerup');

    // A single press would move one field; the hold visits several.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test('a single press still moves exactly one field (long-press is only an accelerator)', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.press('AMORT');
    await calc.press('DOWN');
    await expect(calc.lcdLabel()).toHaveText('P2=');
  });
});

test.describe('touch targets', () => {
  test('keys meet the 44px minimum on mobile', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    const box = await page.locator('[data-key="7"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

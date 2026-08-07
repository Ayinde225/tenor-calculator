import { test, expect } from '@playwright/test';
import { Calc } from './helpers.js';

/**
 * Practice mode drives the real keypad, so these tests play a lesson the way a
 * student would: read the hinted key, press it, repeat. They are content-agnostic
 * — whatever lesson is listed first, the walkthrough must complete and every
 * checkpoint must hold (checkpoint correctness itself is unit-enforced in
 * lessons.test.ts; here we prove the PLAYER honours the script).
 */

async function openPractice(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Practice' }).click();
  await expect(page.locator('.practice')).toBeVisible();
}

test.describe('practice mode', () => {
  test('lists lesson areas and lessons', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await openPractice(page);
    expect(await page.locator('.practice-area').count()).toBeGreaterThanOrEqual(5);
    expect(await page.locator('.practice-item').count()).toBeGreaterThanOrEqual(15);
  });

  test('walks EVERY lesson to completion by pressing each hinted key', async ({ page }) => {
    // The unit suite proves every lesson replays through the engine; this proves
    // every lesson is WALKABLE through the UI — hint, press, advance, complete.
    // It exists because a lesson once stalled on `2ND QUIT`: the script token and
    // the hinted button's 2ND-resolution disagreed, a class of bug only clicking
    // the real keypad can catch.
    const calc = new Calc(page);
    await calc.open();
    await openPractice(page);
    const lessonCount = await page.locator('.practice-item').count();
    expect(lessonCount).toBeGreaterThanOrEqual(15);

    for (let l = 0; l < lessonCount; l++) {
      await page.locator('.practice-item').nth(l).click();
      await expect(page.locator('.practice-player')).toBeVisible();

      // Bounded well above any lesson's real key count so a stall fails.
      for (let i = 0; i < 200; i++) {
        if (await page.locator('.practice-done').isVisible()) break;
        const hinted = page.locator('.key.hint');
        await expect(hinted, `lesson #${l} stalled with no hinted key`).toHaveCount(1);
        await hinted.dispatchEvent('pointerdown');
        await hinted.dispatchEvent('pointerup');
      }

      await expect(page.locator('.practice-done'), `lesson #${l} did not complete`).toBeVisible();
      await expect(
        page.locator('.practice-mismatch'),
        `lesson #${l} drifted from its checkpoints`,
      ).toBeHidden();

      await page.locator('.practice-exit').click();
      await expect(page.locator('.practice-picker')).toBeVisible();
    }
  });

  test('a wrong key is not forwarded to the calculator', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await openPractice(page);
    await page.locator('.practice-item').first().click();

    const before = await page.locator('.lcd-value').textContent();
    // Press a key that is NOT hinted.
    const hinted = await page.locator('.key.hint').getAttribute('data-key');
    const wrong = hinted === '9' ? '8' : '9';
    await page.locator(`[data-key="${wrong}"]`).dispatchEvent('pointerdown');
    await page.locator(`[data-key="${wrong}"]`).dispatchEvent('pointerup');
    await expect(page.locator('.lcd-value')).toHaveText(before ?? '');
  });

  test('"Press it for me" advances the script', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await openPractice(page);
    await page.locator('.practice-item').first().click();
    const step0 = await page.locator('.practice-progress').textContent();
    // Press enough times to change the visible step.
    for (let i = 0; i < 30; i++) {
      if ((await page.locator('.practice-progress').textContent()) !== step0) break;
      if (await page.locator('.practice-done').isVisible()) break;
      await page.locator('.practice-show').click();
    }
    const after = await page.locator('.practice-progress').textContent();
    expect(after).not.toBe(step0);
  });

  test('Exit returns to the picker and clears the hint', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await openPractice(page);
    await page.locator('.practice-item').first().click();
    await page.locator('.practice-exit').click();
    await expect(page.locator('.practice-picker')).toBeVisible();
    await expect(page.locator('.key.hint')).toHaveCount(0);
  });
});

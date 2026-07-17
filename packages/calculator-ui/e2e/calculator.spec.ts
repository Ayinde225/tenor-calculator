import { test, expect } from '@playwright/test';
import { Calc } from './helpers.js';

/**
 * The calculator's parity, exercised end-to-end through the real UI. These are the
 * same displayed strings the engine's golden corpus asserts, now produced by
 * actual clicks on actual buttons.
 */
test.describe('calculation parity through the keypad', () => {
  test('3 + 2 x 4 = 20.00 (chain order, the default)', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.keys('3', '+', '2', '×', '4', '=');
    await calc.expectDisplay('20.00');
  });

  test('$120,000 mortgage over 360 months at 6.125% -> PMT -729.13', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();

    // Set P/Y = 12 (2ND then the I/Y key, whose second function is P/Y).
    await calc.second('I/Y');
    await expect(calc.lcdLabel()).toHaveText('P/Y=');
    await calc.type('12');
    await calc.press('ENTER');
    await calc.press('QUIT');

    await calc.type('360');
    await calc.press('N');
    await calc.type('6.125');
    await calc.press('I/Y');
    await calc.type('120000');
    await calc.press('PV');
    await calc.type('0');
    await calc.press('FV');
    await calc.press('CPT');
    await calc.press('PMT');

    await calc.expectDisplay('-729.13');
  });

  test('percent change from 658 to 700 -> 6.38', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();

    // 2ND then the STAT key opens the Percent Change worksheet (its second function).
    await calc.second('STAT');
    await calc.type('658');
    await calc.press('ENTER');
    await calc.press('DOWN');
    await calc.type('700');
    await calc.press('ENTER');
    await calc.press('DOWN');
    await calc.press('CPT');

    await calc.expectDisplay('6.38');
  });

  test('number entry echoes raw, then formats on evaluate', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.type('1234');
    await calc.expectDisplay('1,234'); // grouped while typing, not padded to DEC
    await calc.press('=');
    await calc.expectDisplay('1,234.00'); // formatted once committed
  });

  test('an error latches until CE/C', async ({ page }) => {
    const calc = new Calc(page);
    await calc.open();
    await calc.keys('1', '÷', '0', '=');
    await calc.expectDisplay('Error 1');
    await calc.press('5'); // swallowed while latched
    await calc.expectDisplay('Error 1');
    await calc.press('CE/C');
    await calc.expectDisplay('0.00');
  });
});

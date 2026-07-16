import { describe, it, expect } from 'vitest';
import { formatValue, DEFAULT_DISPLAY_FORMAT, type DisplayFormat } from './format.js';

const fmt = (o: Partial<DisplayFormat> = {}): DisplayFormat => ({
  ...DEFAULT_DISPLAY_FORMAT,
  ...o,
});

describe('fixed decimal display (guidebook p. 9)', () => {
  it('defaults to two decimal places', () => {
    expect(formatValue(729.13)).toBe('729.13');
    expect(formatValue(0)).toBe('0.00');
    expect(formatValue(1)).toBe('1.00');
  });

  it('renders each DEC setting 0-8', () => {
    const v = 1.23456789012;
    expect(formatValue(v, fmt({ decimals: 0 }))).toBe('1');
    expect(formatValue(v, fmt({ decimals: 1 }))).toBe('1.2');
    expect(formatValue(v, fmt({ decimals: 2 }))).toBe('1.23');
    expect(formatValue(v, fmt({ decimals: 4 }))).toBe('1.2346');
    expect(formatValue(v, fmt({ decimals: 8 }))).toBe('1.23456789');
  });

  it('shows negative values with a leading minus', () => {
    expect(formatValue(-729.13)).toBe('-729.13');
  });

  it('never displays negative zero as -0.00', () => {
    expect(formatValue(-0)).toBe('0.00');
    expect(formatValue(-0.0001, fmt({ decimals: 2 }))).toBe('0.00');
  });
});

describe('number separators (guidebook p. 9)', () => {
  it('groups US style as 1,000.00', () => {
    expect(formatValue(1000, fmt({ separator: 'US' }))).toBe('1,000.00');
    expect(formatValue(1234567.89, fmt({ separator: 'US' }))).toBe('1,234,567.89');
    expect(formatValue(-1234567.89, fmt({ separator: 'US' }))).toBe('-1,234,567.89');
  });

  it('groups European style as 1.000,00', () => {
    expect(formatValue(1000, fmt({ separator: 'EUR' }))).toBe('1.000,00');
    expect(formatValue(1234567.89, fmt({ separator: 'EUR' }))).toBe('1.234.567,89');
  });
});

describe('floating decimal, DEC = 9 (guidebook p. 9)', () => {
  it('shows up to 10 significant digits and strips trailing zeros', () => {
    expect(formatValue(1, fmt({ decimals: 9 }))).toBe('1');
    expect(formatValue(1.5, fmt({ decimals: 9 }))).toBe('1.5');
    expect(formatValue(0, fmt({ decimals: 9 }))).toBe('0');
  });

  it('caps at the 10-digit display width', () => {
    // 1/3 internally is 0.3333333333333 (13 digits); the LCD shows 10.
    expect(formatValue(0.3333333333333, fmt({ decimals: 9 }))).toBe('0.3333333333');
  });

  it('displays the guidebook 1 / 3 x 3 result as 1', () => {
    // p. 86: internal 0.9999999999999 displays as 1.
    expect(formatValue(0.9999999999999, fmt({ decimals: 9 }))).toBe('1');
  });
});

describe('scientific notation overflow (guidebook p. 9)', () => {
  it('switches to scientific when a value exceeds the 10-digit display', () => {
    expect(formatValue(1e12, fmt({ decimals: 9 }))).toMatch(/^1 12$/);
    expect(formatValue(1.234e15, fmt({ decimals: 9 }))).toMatch(/^1\.234 15$/);
  });

  it('pads the exponent to two digits', () => {
    expect(formatValue(1e5, fmt({ decimals: 9 }))).toBe('100,000');
    expect(formatValue(5e-11, fmt({ decimals: 9 }))).toBe('5 -11');
  });

  it('keeps small magnitudes in fixed notation when they fit', () => {
    expect(formatValue(0.001, fmt({ decimals: 9 }))).toBe('0.001');
  });
});

import { describe, it, expect } from 'vitest';
import {
  createExpressionState,
  pressOperator,
  pressEquals,
  pressOpenParen,
  pressCloseParen,
  MAX_PENDING_OPS,
  MAX_PAREN_DEPTH,
  type CalculationMethod,
  type ExpressionState,
} from './expression-engine.js';
import { type BinaryOp } from './operators.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/**
 * Drive the engine the way a user drives the keypad: numbers and operators
 * interleaved, terminated by `=`.
 */
function evaluate(method: CalculationMethod, tokens: (number | BinaryOp)[]): number {
  let state: ExpressionState = createExpressionState(method);
  let display = 0;

  for (const t of tokens) {
    if (typeof t === 'number') {
      display = t;
    } else {
      const r = pressOperator(state, display, t);
      state = r.state;
      display = r.display;
    }
  }
  return pressEquals(state, display).display;
}

describe('required parity example: 3 + 2 x 4 (project brief §12)', () => {
  it('CHN evaluates left to right and yields 20', () => {
    expect(evaluate('CHN', [3, 'add', 2, 'mul', 4])).toBe(20);
  });

  it('AOS applies algebraic precedence and yields 11', () => {
    expect(evaluate('AOS', [3, 'add', 2, 'mul', 4])).toBe(11);
  });
});

describe('CHN chain evaluation (guidebook pp. 7-8)', () => {
  it('completes the previous operation on each new operator', () => {
    expect(evaluate('CHN', [1, 'add', 2, 'add', 3])).toBe(6);
    expect(evaluate('CHN', [10, 'sub', 3, 'mul', 2])).toBe(14); // (10-3)*2
    expect(evaluate('CHN', [2, 'add', 3, 'pow', 2])).toBe(25); // (2+3)^2
  });

  it('shows the running subtotal as each operator is pressed', () => {
    let state = createExpressionState('CHN');
    let r = pressOperator(state, 3, 'add');
    expect(r.display).toBe(3); // nothing pending yet
    state = r.state;
    r = pressOperator(state, 2, 'mul');
    expect(r.display).toBe(5); // 3+2 completed on pressing x
  });
});

describe('AOS hierarchy (guidebook p. 87)', () => {
  it('multiplication and division outrank addition and subtraction', () => {
    expect(evaluate('AOS', [3, 'add', 2, 'mul', 4])).toBe(11);
    expect(evaluate('AOS', [10, 'sub', 3, 'mul', 2])).toBe(4); // 10-(3*2)
    expect(evaluate('AOS', [1, 'add', 8, 'div', 2])).toBe(5); // 1+(8/2)
  });

  it('y^x outranks multiplication', () => {
    expect(evaluate('AOS', [2, 'mul', 3, 'pow', 2])).toBe(18); // 2*(3^2)
  });

  it('nCr and nPr outrank y^x', () => {
    // 5 nCr 2 = 10, then 10 ^ 2 -> nCr binds tighter so it resolves first.
    expect(evaluate('AOS', [5, 'ncr', 2, 'pow', 2])).toBe(100);
  });

  it('is left-associative within a priority level', () => {
    expect(evaluate('AOS', [100, 'div', 5, 'div', 2])).toBe(10); // (100/5)/2
    expect(evaluate('AOS', [10, 'sub', 3, 'sub', 2])).toBe(5);
  });

  it('defers a lower-priority pending operator until the end', () => {
    expect(evaluate('AOS', [1, 'add', 2, 'mul', 3, 'add', 4])).toBe(11); // 1+6+4
  });
});

describe('parentheses', () => {
  it('overrides CHN ordering', () => {
    // 3 + (2 x 4) = 11 even in CHN
    let state = createExpressionState('CHN');
    let display = 3;
    let r = pressOperator(state, display, 'add');
    state = r.state;
    state = pressOpenParen(state);
    display = 2;
    r = pressOperator(state, display, 'mul');
    state = r.state;
    display = 4;
    const closed = pressCloseParen(state, display);
    state = closed.state;
    expect(closed.display).toBe(8);
    expect(pressEquals(state, closed.display).display).toBe(11);
  });

  it('ignores an unmatched closing parenthesis', () => {
    const state = createExpressionState('CHN');
    expect(pressCloseParen(state, 7).display).toBe(7);
  });
});

describe('Error 3 limits (guidebook p. 84)', () => {
  it('raises Error 3 beyond 15 parenthesis levels', () => {
    let state = createExpressionState('CHN');
    for (let i = 0; i < MAX_PAREN_DEPTH; i++) state = pressOpenParen(state);
    expect(() => pressOpenParen(state)).toThrow(CalculatorError);
    try {
      pressOpenParen(state);
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.TooManyPendingOperations);
    }
  });

  it('raises Error 3 beyond 8 pending operations', () => {
    // AOS with strictly tightening operators keeps everything pending.
    let state = createExpressionState('AOS');
    let display = 1;
    // add(5) then repeated pow(3) never reduce, so pending grows.
    let r = pressOperator(state, display, 'add');
    state = r.state;
    expect(() => {
      for (let i = 0; i < MAX_PENDING_OPS + 2; i++) {
        const next = pressOperator(state, 2, 'pow');
        state = next.state;
      }
    }).toThrow(CalculatorError);
  });
});

describe('13-digit precision flows through the engine', () => {
  it('applies internal rounding to results', () => {
    // 1 / 3 x 3 -> 0.9999999999999 internally (guidebook p. 86)
    const r = evaluate('CHN', [1, 'div', 3, 'mul', 3]);
    expect(r.toPrecision(13)).toBe('0.9999999999999');
  });
});

describe('division by zero', () => {
  it('raises Error 1', () => {
    expect(() => evaluate('CHN', [1, 'div', 0])).toThrow(CalculatorError);
  });
});

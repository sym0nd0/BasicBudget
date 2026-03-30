import { describe, it, expect } from 'vitest';
import { calculateDelta } from '../../src/utils/delta';

describe('calculateDelta', () => {
  it('returns positive delta and percentage when current > previous', () => {
    const result = calculateDelta(1100, 1000);
    expect(result.delta).toBe(100);
    expect(result.percentage).toBeCloseTo(10);
  });

  it('returns negative delta when current < previous', () => {
    const result = calculateDelta(900, 1000);
    expect(result.delta).toBe(-100);
    expect(result.percentage).toBeCloseTo(-10);
  });

  it('returns zero delta and zero percentage when equal', () => {
    const result = calculateDelta(1000, 1000);
    expect(result.delta).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('returns null percentage when previous is zero and current is non-zero', () => {
    const result = calculateDelta(500, 0);
    expect(result.delta).toBe(500);
    expect(result.percentage).toBeNull();
  });

  it('returns zero delta and zero percentage when both are zero', () => {
    const result = calculateDelta(0, 0);
    expect(result.delta).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('handles negative current values', () => {
    const result = calculateDelta(-200, -100);
    expect(result.delta).toBe(-100);
    expect(result.percentage).toBeCloseTo(100);
  });
});

describe('calculateDelta contract', () => {
  it('provides both absolute delta and percentage for non-zero previous', () => {
    const { delta, percentage } = calculateDelta(11050, 10600);
    // line 1: arrow + formatCurrency(Math.abs(delta)) → "↑ £4.50"
    // line 2: formatPercent(Math.abs(percentage))    → "4.25%"
    expect(delta).toBe(450);
    expect(percentage).toBeCloseTo(4.245, 1);
  });

  it('provides null percentage when previous is zero', () => {
    const { delta, percentage } = calculateDelta(5000, 0);
    expect(delta).toBe(5000);
    expect(percentage).toBeNull();
  });
});

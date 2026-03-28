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

  it('returns zero percentage when previous is zero', () => {
    const result = calculateDelta(500, 0);
    expect(result.delta).toBe(500);
    expect(result.percentage).toBe(0);
  });

  it('handles negative current values', () => {
    const result = calculateDelta(-200, -100);
    expect(result.delta).toBe(-100);
    expect(result.percentage).toBeCloseTo(100);
  });
});

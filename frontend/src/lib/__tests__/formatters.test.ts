import { describe, it, expect } from 'vitest';
import {
  toDateInputLocal,
  shiftDaysLocal,
  parsePositiveNumber,
  parseBoundedInt,
  parseNorwegianNumber,
  formatPercent,
  splitGrossWithMva,
  formatKundenr,
  formatOrgnr,
  isValidOrgnr,
} from '../formatters';

describe('toDateInputLocal', () => {
  it('formats using local date parts, not UTC', () => {
    const date = new Date(2024, 0, 15);
    expect(toDateInputLocal(date)).toBe('2024-01-15');
  });

  it('pads month and day with zeros', () => {
    const date = new Date(2024, 2, 5);
    expect(toDateInputLocal(date)).toBe('2024-03-05');
  });
});

describe('shiftDaysLocal', () => {
  it('returns a date string N days before the reference date', () => {
    const from = new Date(2024, 5, 10);
    expect(shiftDaysLocal(5, from)).toBe('2024-06-05');
  });
});

describe('parsePositiveNumber', () => {
  it('returns null for empty or invalid input', () => {
    expect(parsePositiveNumber('')).toBeNull();
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
  });

  it('returns the number for valid positive input', () => {
    expect(parsePositiveNumber('100')).toBe(100);
    expect(parsePositiveNumber('99.5')).toBe(99.5);
  });
});

describe('parseBoundedInt', () => {
  it('returns min for non-numeric input', () => {
    expect(parseBoundedInt('', 1, 100)).toBe(1);
    expect(parseBoundedInt('abc', 1, 100)).toBe(1);
  });

  it('clamps values to the given range', () => {
    expect(parseBoundedInt('0', 1, 100)).toBe(1);
    expect(parseBoundedInt('150', 1, 100)).toBe(100);
    expect(parseBoundedInt('50', 1, 100)).toBe(50);
  });
});

describe('parseNorwegianNumber', () => {
  it('parses Norwegian-formatted numbers', () => {
    expect(parseNorwegianNumber('1 234,56')).toBe(1234.56);
    expect(parseNorwegianNumber('1.234,56')).toBe(1234.56);
    expect(parseNorwegianNumber('99,5')).toBe(99.5);
    expect(parseNorwegianNumber('1234.56')).toBe(1234.56);
  });

  it('returns null for invalid input', () => {
    expect(parseNorwegianNumber('')).toBeNull();
    expect(parseNorwegianNumber('abc')).toBeNull();
  });
});

describe('formatPercent', () => {
  it('formats as Norwegian percentage', () => {
    expect(formatPercent(12.5)).toContain('12');
    expect(formatPercent(12.5)).toContain('%');
  });
});

describe('splitGrossWithMva', () => {
  it('splits gross amount into netto and mva', () => {
    const result = splitGrossWithMva(1250);
    expect(result.brutto).toBe(1250);
    expect(result.netto).toBeCloseTo(1000);
    expect(result.mva).toBeCloseTo(250);
  });
});

describe('formatKundenr', () => {
  it('zero-pads numeric customer numbers', () => {
    expect(formatKundenr(1)).toBe('000001');
    expect(formatKundenr('42')).toBe('000042');
  });
});

describe('formatOrgnr', () => {
  it('groups 9-digit org numbers', () => {
    expect(formatOrgnr('987654321')).toBe('987 654 321');
  });
});

describe('isValidOrgnr', () => {
  it('validates mod-11 check digit', () => {
    expect(isValidOrgnr('974760673')).toBe(true);
    expect(isValidOrgnr('123456789')).toBe(false);
    expect(isValidOrgnr('12345')).toBe(false);
  });
});

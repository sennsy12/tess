import { describe, it, expect } from 'vitest';
import {
  sanitizeColumnLabels,
  resolveColumnHeader,
  MAX_COLUMN_LABEL_LENGTH,
} from '../../types/tablePreferences';

describe('sanitizeColumnLabels', () => {
  it('returnerer {} for ugyldig input', () => {
    expect(sanitizeColumnLabels(null)).toEqual({});
    expect(sanitizeColumnLabels(undefined)).toEqual({});
    expect(sanitizeColumnLabels('x')).toEqual({});
    expect(sanitizeColumnLabels([['a', 'b']])).toEqual({});
  });

  it('trimmer, dropper tomme og ikke-strenger', () => {
    expect(
      sanitizeColumnLabels({ a: '  Deres ref  ', b: '   ', c: 42, d: null }),
    ).toEqual({ a: 'Deres ref' });
  });

  it('capper lengde og filtrerer mot kjente nøkler', () => {
    const long = 'x'.repeat(MAX_COLUMN_LABEL_LENGTH + 20);
    expect(sanitizeColumnLabels({ a: long, unknown: 'Ok' }, ['a'])).toEqual({
      a: 'x'.repeat(MAX_COLUMN_LABEL_LENGTH),
    });
  });
});

describe('resolveColumnHeader', () => {
  it('overstyring vinner, ellers default', () => {
    expect(resolveColumnHeader('kunderef', 'Kunderef', { kunderef: 'Deres ref' })).toBe('Deres ref');
    expect(resolveColumnHeader('kunderef', 'Kunderef', {})).toBe('Kunderef');
    expect(resolveColumnHeader('kunderef', 'Kunderef', undefined)).toBe('Kunderef');
    expect(resolveColumnHeader('kunderef', 'Kunderef', { kunderef: '  ' })).toBe('Kunderef');
  });
});

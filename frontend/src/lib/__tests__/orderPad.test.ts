import { describe, expect, it } from 'vitest';
import {
  ORDER_PAD_MAX_LINES,
  ORDER_PAD_MAX_QTY,
  parseOrderPadInput,
} from '../orderPad';

describe('parseOrderPadInput', () => {
  it('parses code-only lines with default quantity', () => {
    const result = parseOrderPadInput('ABC-100\nDEF-200');

    expect(result.issues).toHaveLength(0);
    expect(result.lines).toEqual([
      { varekode: 'ABC-100', antall: 1, sourceLine: 1 },
      { varekode: 'DEF-200', antall: 1, sourceLine: 2 },
    ]);
  });

  it('accepts whitespace, tab, semicolon and comma separators', () => {
    const result = parseOrderPadInput('A1 5\nB2\t10\nC3;3\nD4,7');

    expect(result.issues).toHaveLength(0);
    expect(result.lines.map((l) => [l.varekode, l.antall])).toEqual([
      ['A1', 5],
      ['B2', 10],
      ['C3', 3],
      ['D4', 7],
    ]);
  });

  it('skips blank lines and # comments while preserving source line numbers', () => {
    const result = parseOrderPadInput('\n# kommentar\nA1 4\n\n   \nB2');

    expect(result.lines).toEqual([
      { varekode: 'A1', antall: 4, sourceLine: 3 },
      { varekode: 'B2', antall: 1, sourceLine: 6 },
    ]);
  });

  it('reports issues for malformed lines without aborting the rest', () => {
    const result = parseOrderPadInput('A1 5\nB2 to\nC3 0\nD4 -2');

    expect(result.lines.map((l) => l.varekode)).toEqual(['A1']);
    expect(result.issues.map((i) => i.sourceLine)).toEqual([2, 3, 4]);
    expect(result.issues.every((i) => i.reason === 'Ugyldig antall')).toBe(true);
  });

  it('treats single-token lines as codes with default quantity', () => {
    const result = parseOrderPadInput('ABC-100');

    expect(result.lines).toEqual([{ varekode: 'ABC-100', antall: 1, sourceLine: 1 }]);
    expect(result.issues).toHaveLength(0);
  });

  it('sums duplicate codes case-insensitively and clamps to max quantity', () => {
    const result = parseOrderPadInput(`abc ${ORDER_PAD_MAX_QTY}\nABC 5`);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ varekode: 'abc', antall: ORDER_PAD_MAX_QTY });
  });

  it('caps distinct lines and reports a single overflow issue', () => {
    const input = Array.from({ length: ORDER_PAD_MAX_LINES + 10 }, (_, i) => `KODE-${i}`).join('\n');
    const result = parseOrderPadInput(input);

    expect(result.lines).toHaveLength(ORDER_PAD_MAX_LINES);
    expect(result.issues.filter((i) => i.reason === 'Maks antall linjer overskredet')).toHaveLength(1);
  });
});

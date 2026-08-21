import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCsvContent } from '../csv';

describe('downloadCsv content', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes output with UTF-8 BOM and uses semicolon delimiter by default', () => {
    const text = buildCsvContent([{ name: 'Ola', amount: 100 }]);
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).toContain('name;amount');
    expect(text).toContain('"Ola";"100"');
  });

  it('supports comma delimiter override without BOM', () => {
    const text = buildCsvContent([{ a: 1 }], { delimiter: ',', bom: false });
    expect(text.startsWith('\uFEFF')).toBe(false);
    expect(text.split('\n')).toEqual(['a', '"1"']);
  });
});

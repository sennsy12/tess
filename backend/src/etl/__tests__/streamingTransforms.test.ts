import {
  buildColumnPlan,
  formatCopyLine,
  normalizeRecord,
  parseDateLike,
  transformValue,
} from '../streaming/transforms';

describe('streaming transforms', () => {
  it('builds column plan from source keys and defaults', () => {
    const plan = buildColumnPlan(
      ['Ordrenr', 'Dato', 'Valuta', 'NetPris'],
      new Set(['ordrenr', 'dato', 'valutaid', 'nettpris'])
    );
    expect(plan.map((p) => p.dbColumn)).toEqual(['ordrenr', 'dato', 'valutaid', 'nettpris']);
  });

  it('normalizes object keys', () => {
    const normalized = normalizeRecord({ ' Sum Eksl. MVA ': '100,50', Kundenr: 'K001' });
    expect(normalized['sum eksl. mva']).toBe('100,50');
    expect(normalized.kundenr).toBe('K001');
  });

  it('parses date and decimals from localized values', () => {
    expect(parseDateLike('3.1.2026')).toBe('2026-01-03');
    expect(transformValue('sum', '1.234,50', 0)).toBe(1234.5);
  });

  it('formats COPY line with escaped characters', () => {
    const line = formatCopyLine(['hello\tworld', null, 'line\nbreak']);
    expect(line).toBe('hello\\tworld\t\\N\tline\\nbreak\n');
  });
});

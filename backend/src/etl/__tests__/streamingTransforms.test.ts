import {
  buildColumnPlan,
  formatCopyLine,
  getRowValidationError,
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

  it('returns validation error for missing required columns', () => {
    const m = new Map<string, string | number | null>([['ordrenr', null], ['dato', '2026-01-01']]);
    expect(getRowValidationError('ordre', m)).toBe('missing ordrenr');
    m.set('ordrenr', 1);
    expect(getRowValidationError('ordre', m)).toBeNull();
    const m2 = new Map<string, string | number | null>([['ordrenr', 1], ['linjenr', null]]);
    expect(getRowValidationError('ordrelinje', m2)).toBe('missing linjenr');
  });

  it('returns validation error for kunde, vare, firma, lager', () => {
    expect(getRowValidationError('kunde', new Map([['kundenr', null]]))).toBe('missing kundenr');
    expect(getRowValidationError('kunde', new Map([['kundenr', 'K001']]))).toBeNull();
    expect(getRowValidationError('vare', new Map([['varekode', null]]))).toBe('missing varekode');
    expect(getRowValidationError('firma', new Map([['firmaid', null]]))).toBe('missing firmaid');
    expect(getRowValidationError('lager', new Map([['lagernavn', null], ['firmaid', 1]]))).toBe('missing lagernavn');
    expect(getRowValidationError('lager', new Map([['lagernavn', 'L1'], ['firmaid', null]]))).toBe('missing firmaid');
  });
});

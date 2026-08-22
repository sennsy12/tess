import { describe, expect, it } from 'vitest';
import type { OrderLine, OrderDetail } from '../../types/order';
import {
  buildOrderPdfFilename,
  buildPdfLineRows,
  computePdfTotals,
  formatPdfMoney,
} from '../orderPdf';

const makeLine = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  linjenr: 1,
  varekode: 'A-100',
  antall: 2,
  enhet: 'STK',
  nettpris: 10,
  linjesum: 20,
  linjestatus: 1,
  ...overrides,
});

const makeOrder = (
  overrides: Partial<Pick<OrderDetail, 'lines' | 'lineSummary' | 'sum'>> = {},
): Pick<OrderDetail, 'lines' | 'lineSummary' | 'sum'> => ({
  lines: [makeLine(), makeLine({ linjenr: 2, varekode: 'B-200', antall: 1, linjesum: 40 })],
  lineSummary: undefined,
  sum: 75,
  ...overrides,
});

describe('buildOrderPdfFilename', () => {
  it('builds a deterministic filename per order number', () => {
    expect(buildOrderPdfFilename(12345)).toBe('ordre-12345.pdf');
    expect(buildOrderPdfFilename(0)).toBe('ordre-0.pdf');
  });
});

describe('formatPdfMoney', () => {
  it('formats with two decimals and kr suffix', () => {
    const formatted = formatPdfMoney(1234.5);
    expect(formatted).toContain(',');
    expect(formatted.endsWith(' kr')).toBe(true);
    expect(formatted).toBe(formatPdfMoney(1234.5));
  });

  it('falls back to zero for non-finite values', () => {
    expect(formatPdfMoney(Number.NaN)).toBe(formatPdfMoney(0));
    const zero = formatPdfMoney(0);
    expect(zero.startsWith('0,00')).toBe(true);
  });
});

describe('buildPdfLineRows', () => {
  it('maps lines to numbered display rows with formatted money columns', () => {
    const rows = buildPdfLineRows({
      lines: [
        makeLine({ varenavn: 'Bolt M8', antall: 3, nettpris: 4.5, linjesum: 13.5 }),
        makeLine({ linjenr: 2, varekode: 'B-2', varenavn: 'Mutter', antall: 1, linjesum: 2 }),
      ],
    });

    expect(rows.map((row) => row.pos)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({
      varekode: 'A-100',
      betegnelse: 'Bolt M8',
      enhet: 'STK',
      pris: formatPdfMoney(4.5),
      linjesum: formatPdfMoney(13.5),
    });
    expect(rows[0].antall).toBe('3');
  });

  it('falls back through varegruppe to varekode when varenavn is missing', () => {
    const rows = buildPdfLineRows({
      lines: [
        makeLine({ varekode: 'C-1', varenavn: undefined, varegruppe: 'Festemidler' }),
        makeLine({ linjenr: 2, varekode: 'D-2', varenavn: '  ', varegruppe: undefined }),
      ],
    });

    expect(rows[0].betegnelse).toBe('Festemidler');
    expect(rows[1].betegnelse).toBe('D-2');
  });

  it('derives missing linjesum from antall x nettpris and defaults the unit', () => {
    const rows = buildPdfLineRows({
      lines: [makeLine({ varekode: 'E-9', antall: 3, nettpris: 49.9, linjesum: Number.NaN, enhet: '' })],
    });

    expect(rows[0].linjesum).toBe(formatPdfMoney(149.7));
    expect(rows[0].enhet).toBe('stk');
  });

  it('returns an empty list when there are no lines', () => {
    expect(buildPdfLineRows({ lines: [] })).toEqual([]);
  });
});

describe('computePdfTotals', () => {
  it('trusts a complete backend summary', () => {
    const totals = computePdfTotals(
      makeOrder({ lineSummary: { qty: 3, netto: 13.5, mva: 3.38, brutto: 16.88, weightedAvgPrice: 4.5 } }),
    );

    expect(totals).toEqual({ netto: 13.5, mva: 3.38, brutto: 16.88 });
  });

  it('derives mva from the stated order sum when the summary is incomplete', () => {
    const totals = computePdfTotals(makeOrder());

    expect(totals.netto).toBe(60);
    expect(totals.brutto).toBe(75);
    expect(totals.mva).toBe(15);
  });

  it('applies 25 percent mva when no reliable order sum exists', () => {
    const totals = computePdfTotals(makeOrder({ sum: Number.NaN }));

    expect(totals.netto).toBe(60);
    expect(totals.mva).toBe(15);
    expect(totals.brutto).toBe(75);
  });

  it('returns zeros for an empty order', () => {
    const totals = computePdfTotals(makeOrder({ lines: [], sum: 0 }));

    expect(totals).toEqual({ netto: 0, mva: 0, brutto: 0 });
  });
});

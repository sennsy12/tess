import { summarizeOrderLines } from '../orderTotals.js';

describe('summarizeOrderLines', () => {
  it('sums quantity and netto from line items', () => {
    const summary = summarizeOrderLines([
      { antall: 2, nettpris: 100, linjesum: 200 },
      { antall: 1, nettpris: 50, linjesum: 50 },
    ]);

    expect(summary.qty).toBe(3);
    expect(summary.netto).toBe(250);
    expect(summary.mva).toBe(62.5);
    expect(summary.brutto).toBe(312.5);
    expect(summary.weightedAvgPrice).toBeCloseTo(83.33, 2);
  });

  it('computes linjesum from antall * nettpris when missing', () => {
    const summary = summarizeOrderLines([{ antall: 4, nettpris: 25 }]);
    expect(summary.netto).toBe(100);
  });
});

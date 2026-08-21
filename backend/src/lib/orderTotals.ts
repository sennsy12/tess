export interface OrderLineTotalInput {
  antall: number;
  nettpris: number;
  linjesum?: number;
}

export interface OrderLineSummary {
  qty: number;
  netto: number;
  mva: number;
  brutto: number;
  weightedAvgPrice: number;
}

const DEFAULT_MVA_RATE = 0.25;

export function summarizeOrderLines(
  lines: OrderLineTotalInput[],
  mvaRate = DEFAULT_MVA_RATE,
): OrderLineSummary {
  let qty = 0;
  let netto = 0;

  for (const line of lines) {
    const lineQty = Number(line.antall) || 0;
    const lineNetto =
      line.linjesum != null
        ? Number(line.linjesum)
        : lineQty * (Number(line.nettpris) || 0);

    qty += lineQty;
    netto += lineNetto;
  }

  const mva = netto * mvaRate;
  const brutto = netto + mva;
  const weightedAvgPrice = qty > 0 ? netto / qty : 0;

  return {
    qty,
    netto: round2(netto),
    mva: round2(mva),
    brutto: round2(brutto),
    weightedAvgPrice: round2(weightedAvgPrice),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

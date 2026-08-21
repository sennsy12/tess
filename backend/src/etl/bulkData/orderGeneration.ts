import { OrdreRow, OrdrelinjeRow, HenvisningRow } from './rows.js';

/** Shared constants for order generation (used by full generate and by batch generation). */
const FIRMAER = [1, 2, 3, 4, 5];
const LAGER_MAP: Record<number, string> = {
  1: 'Hovedkontor Oslo Hovedlager',
  2: 'Region Vest Hovedlager',
  3: 'Region Sør Hovedlager',
  4: 'Region Midt Hovedlager',
  5: 'Region Nord Hovedlager',
};
const VALUTAER = ['NOK', 'NOK', 'NOK', 'EUR', 'USD', 'SEK'];
const YEARS = [2024, 2025, 2026];
const PROSJEKTER = [
  'Nordsjøen Vedlikehold', 'Mongstad Oppgradering', 'Sverdrup Fase 2',
  'Kårstø Drift', 'Snøhvit LNG', 'Martin Linge', 'Troll A',
  'Hammerfest LNG', 'Oseberg Sør', 'Gullfaks Subsea',
  'Åsgard Turnaround', 'Valemon Drift', 'Gina Krog', 'Edvard Grieg',
  'Sleipner Vest', 'Statfjord C', 'Njord Bravo', 'Heidrun TLP',
];
const AVDELINGER = ['Innkjøp', 'Vedlikehold', 'Drift', 'Prosjekt', 'Lager', 'HMS', 'Mek. Verksted', 'Elektro'];
const KONTAKTPERSONER = [
  'Ole Hansen', 'Kari Nordmann', 'Per Olsen', 'Anne Kristiansen',
  'Eirik Berg', 'Silje Strand', 'Lars Johansen', 'Mette Dahl',
  'Thomas Lie', 'Ingrid Haugen', 'Bjørn Eriksen', 'Hilde Moen',
];

/** Returns rows for a single order (for streaming: no arrays held across orders). */
export function getOrderRows(
  i: number,
  customers: number,
  linesPerOrder: number
): { ordre: OrdreRow; ordrelinjer: OrdrelinjeRow[]; henvisninger: HenvisningRow[] } {
  const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
  const firmaid = FIRMAER[i % FIRMAER.length];
  const ordrenr = 10000 + i;
  const year = YEARS[i % YEARS.length];
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let orderSum = 0;
  const ordrelinjer: OrdrelinjeRow[] = [];
  const henvisninger: HenvisningRow[] = [];
  const numLines = Math.floor(Math.random() * linesPerOrder) + 1;
  for (let j = 1; j <= numLines; j++) {
    const varekode = `V${String((i * j) % 500 + 1).padStart(5, '0')}`;
    const antall = Math.floor(Math.random() * 50) + 1;
    const nettpris = Math.floor(Math.random() * 5000) + 50;
    const linjesum = antall * nettpris;
    orderSum += linjesum;
    ordrelinjer.push([j, ordrenr, varekode, antall, 'stk', nettpris, linjesum, 1]);
    if (i % 5 !== 0 || j <= 2) {
      henvisninger.push([
        ordrenr,
        j,
        PROSJEKTER[(i + j) % PROSJEKTER.length],
        `${AVDELINGER[(i + j) % AVDELINGER.length]}-${kundenr}`,
        `WO-${10000 + ((i * 7 + j * 3) % 90000)}`,
        (i + j) % 3 === 0 ? `TAG-${String.fromCharCode(65 + (i % 26))}${(i * j) % 999 + 1}` : null,
        (i + j) % 4 === 0 ? `Kostnadssted ${1000 + (i % 9000)}` : null,
      ]);
    }
  }
  const kontakt = KONTAKTPERSONER[i % KONTAKTPERSONER.length];
  const ordre: OrdreRow = [
    ordrenr,
    dato,
    kundenr,
    `PO-${year}-${String(ordrenr).padStart(6, '0')}`,
    kontakt,
    firmaid,
    LAGER_MAP[firmaid],
    VALUTAER[i % VALUTAER.length],
    orderSum,
  ];
  return { ordre, ordrelinjer, henvisninger };
}

/**
 * Generate orders from startOrder to endOrder (1-based inclusive) into the given arrays.
 */
export function generateOrdersIntoArrays(
  out: { ordreData: OrdreRow[]; ordrelinjeData: OrdrelinjeRow[]; henvisningData: HenvisningRow[] },
  startOrder: number,
  endOrder: number,
  customers: number,
  linesPerOrder: number
): void {
  const { ordreData, ordrelinjeData, henvisningData } = out;
  for (let i = startOrder; i <= endOrder; i++) {
    const { ordre, ordrelinjer, henvisninger } = getOrderRows(i, customers, linesPerOrder);
    ordreData.push(ordre);
    ordrelinjeData.push(...ordrelinjer);
    henvisningData.push(...henvisninger);
  }
}

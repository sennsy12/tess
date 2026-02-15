import { PassThrough } from 'stream';
import { once } from 'events';
import { query, copyFromLineStream } from '../db/index.js';
import { etlLogger } from '../lib/logger.js';
import { formatCopyLine } from './streaming/transforms.js';

// Pre-calculated hash for 'kunde123' to save CPU time during generation
const KUNDE_PASSWORD_HASH = '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W';

// ── Row tuple types for type-safe bulk data ─────────────────────────
export type KundeRow = [kundenr: string, kundenavn: string];
export type BrukerRow = [username: string, passwordHash: string, role: string, kundenr: string];
export type VareRow = [varekode: string, varenavn: string, varegruppe: string];
export type OrdreRow = [
  ordrenr: number, dato: string, kundenr: string, kundeordreref: string,
  kunderef: string, firmaid: number, lagernavn: string, valutaid: string, sum: number,
];
export type OrdrelinjeRow = [
  linjenr: number, ordrenr: number, varekode: string, antall: number,
  enhet: string, nettpris: number, linjesum: number, linjestatus: number,
];
export type HenvisningRow = [
  ordrenr: number, linjenr: number, henvisning1: string, henvisning2: string,
  henvisning3: string, henvisning4: string | null, henvisning5: string | null,
];

interface BulkData {
  kunder: KundeRow[];
  brukere: BrukerRow[];
  varer: VareRow[];
  ordrer: OrdreRow[];
  ordrelinjer: OrdrelinjeRow[];
  henvisninger: HenvisningRow[];
}

// In-memory storage for generated bulk data
let generatedBulkData: BulkData | null = null;

/** Returns kunde, brukere, and vare arrays for bulk pipeline (shared by generate and staged). */
export function getDimensionData(customers: number): { kundeData: KundeRow[]; brukerData: BrukerRow[]; vareData: VareRow[] } {
  const kundeData: KundeRow[] = [];
  const brukerData: BrukerRow[] = [];
  const sektorer = ['Olje og Gass', 'Marin', 'Prosessindustri', 'Bygg og Anlegg', 'Havbruk', 'Bergverk', 'Energi', 'Transport', 'Verksted', 'Industri'];
  const byer = ['Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Kristiansand', 'Haugesund', 'Ålesund', 'Hammerfest', 'Bodø', 'Sandnes', 'Drammen', 'Fredrikstad', 'Tønsberg', 'Skien', 'Moss'];
  const selskapsformer = ['AS', 'ASA', 'AS', 'AS', 'ANS'];
  for (let i = 1; i <= customers; i++) {
    const kundenr = `K${String(i).padStart(6, '0')}`;
    kundeData.push([kundenr, `${byer[i % byer.length]} ${sektorer[i % sektorer.length]} ${selskapsformer[i % selskapsformer.length]}`]);
    brukerData.push([kundenr, KUNDE_PASSWORD_HASH, 'kunde', kundenr]);
  }
  const vareData: VareRow[] = [];
  const bulkProducts: { gruppe: string; prefix: string; varianter: string[] }[] = [
    { gruppe: 'Slanger', prefix: 'Hydraulikkslange', varianter: ['2-lag 1/4"', '2-lag 3/8"', '2-lag 1/2"', '2-lag 3/4"', '2-lag 1"', '4-lag 1/2"', '4-lag 3/4"', '4-lag 1"', '4-lag 1-1/4"', '6-lag 1"'] },
    { gruppe: 'Slanger', prefix: 'Industrislange EPDM', varianter: ['DN20', 'DN25', 'DN32', 'DN38', 'DN50', 'DN63', 'DN75', 'DN100'] },
    { gruppe: 'Slanger', prefix: 'Trykkslange R2AT', varianter: ['1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"'] },
    { gruppe: 'Slanger', prefix: 'Sugeslange PVC', varianter: ['DN25', 'DN32', 'DN50', 'DN63', 'DN75', 'DN100'] },
    { gruppe: 'Slanger', prefix: 'Kjemikalieslange PTFE', varianter: ['DN15', 'DN20', 'DN25', 'DN32', 'DN50'] },
    { gruppe: 'Slanger', prefix: 'Dampslange', varianter: ['DN20 18bar', 'DN25 18bar', 'DN32 18bar', 'DN50 18bar'] },
    { gruppe: 'Slanger', prefix: 'Matvareslange FDA', varianter: ['DN25', 'DN32', 'DN38', 'DN50'] },
    { gruppe: 'Slanger', prefix: 'Sandblåseslange', varianter: ['DN25', 'DN32', 'DN38', 'DN50'] },
    { gruppe: 'Kuplinger', prefix: 'Hurtigkobling Tema', varianter: ['2600 1/4"', '2600 3/8"', '2600 1/2"', '2600 3/4"', '2600 1"', '2500 1/4"', '2500 3/8"', '2500 1/2"'] },
    { gruppe: 'Kuplinger', prefix: 'Kamlock-kobling', varianter: ['1" Alu', '2" Alu', '3" Alu', '4" Alu', '2" Rustfritt', '3" Rustfritt'] },
    { gruppe: 'Kuplinger', prefix: 'Storz-kobling', varianter: ['A110', 'B75', 'C52', 'D25'] },
    { gruppe: 'Fittings', prefix: 'Flens SAE 3000', varianter: ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'] },
    { gruppe: 'Fittings', prefix: 'Flens SAE 6000', varianter: ['1/2"', '3/4"', '1"', '1-1/4"'] },
    { gruppe: 'Fittings', prefix: 'Nippel JIC', varianter: ['1/4"', '3/8"', '1/2"', '3/4"', '1"', '1-1/4"'] },
    { gruppe: 'Fittings', prefix: 'Nippel BSP', varianter: ['1/4"', '3/8"', '1/2"', '3/4"', '1"'] },
    { gruppe: 'Fittings', prefix: 'T-stykke BSP', varianter: ['1/4"', '3/8"', '1/2"', '3/4"', '1"'] },
    { gruppe: 'Fittings', prefix: 'Vinkelkobling 90°', varianter: ['1/4"', '3/8"', '1/2"', '3/4"', '1"'] },
    { gruppe: 'Hydraulikk', prefix: 'Hydraulikksylinder', varianter: ['40/25-200', '50/30-300', '63/40-400', '63/40-500', '80/50-600', '100/70-800'] },
    { gruppe: 'Hydraulikk', prefix: 'Hydraulikkpumpe', varianter: ['14cc', '20cc', '28cc', '40cc', '63cc'] },
    { gruppe: 'Hydraulikk', prefix: 'Hydraulikkfilter', varianter: ['3 mikron', '5 mikron', '10 mikron', '25 mikron'] },
    { gruppe: 'Tetninger', prefix: 'O-ring Viton', varianter: ['10x2', '15x2.5', '20x3', '25x3', '30x3.5', '40x4', '50x4', '60x5'] },
    { gruppe: 'Tetninger', prefix: 'O-ring NBR', varianter: ['10x2', '15x2.5', '20x2.5', '25x3', '30x3', '40x3.5', '50x4'] },
    { gruppe: 'Tetninger', prefix: 'V-ring', varianter: ['20mm', '30mm', '40mm', '50mm', '60mm', '80mm'] },
    { gruppe: 'Verktøy', prefix: 'Momentnøkkel', varianter: ['1/2" 40-200Nm', '1/2" 100-500Nm', '3/4" 100-500Nm', '3/4" 200-1000Nm'] },
    { gruppe: 'Verktøy', prefix: 'Rørkutter', varianter: ['3-16mm', '6-42mm', '10-60mm'] },
  ];

  let vareTeller = 1;
  for (const template of bulkProducts) {
    for (const variant of template.varianter) {
      if (vareTeller > 500) break;
      vareData.push([
        `V${String(vareTeller).padStart(5, '0')}`,
        `${template.prefix} ${variant}`,
        template.gruppe,
      ]);
      vareTeller++;
    }
    if (vareTeller > 500) break;
  }
  while (vareTeller <= 500) {
    const restGrupper = ['Slanger', 'Kuplinger', 'Fittings', 'Hydraulikk', 'Tetninger', 'Verktøy'];
    vareData.push([`V${String(vareTeller).padStart(5, '0')}`, `Industriprodukt ${vareTeller}`, restGrupper[vareTeller % restGrupper.length]]);
    vareTeller++;
  }
  return { kundeData, brukerData, vareData };
}

/** Max orders for in-memory generate (use runBulkPipelineInStages for more). */
const MAX_ORDERS_IN_MEMORY = 2_000_000;

/**
 * Generate millions of rows of test data (in memory). For >2M orders use runBulkPipelineInStages.
 */
export async function generateBulkTestData(config: {
  customers?: number;
  orders?: number;
  linesPerOrder?: number;
}): Promise<any> {
  const { customers = 1000, orders = 100000, linesPerOrder = 5 } = config;
  if (orders > MAX_ORDERS_IN_MEMORY) {
    throw new Error(
      `orders=${orders} exceeds in-memory limit ${MAX_ORDERS_IN_MEMORY}. Use POST /api/etl/runBulkPipelineStages with totalOrders for 20M+ rows.`
    );
  }
  etlLogger.info(
    { stage: 'bulk-generate-start', customers, orders, estimatedLines: orders * linesPerOrder },
    'Generating bulk data'
  );
  const startTime = Date.now();

  const { kundeData, brukerData, vareData } = getDimensionData(customers);

  const ordreData: OrdreRow[] = [];
  const ordrelinjeData: OrdrelinjeRow[] = [];
  const henvisningData: HenvisningRow[] = [];

  generateOrdersIntoArrays(
    { ordreData, ordrelinjeData, henvisningData },
    1,
    orders,
    customers,
    linesPerOrder
  );

  const duration = Date.now() - startTime;
  etlLogger.info({ stage: 'bulk-generate-complete', durationMs: duration }, 'Bulk data generation completed');

  generatedBulkData = {
    kunder: kundeData,
    brukere: brukerData,
    varer: vareData,
    ordrer: ordreData,
    ordrelinjer: ordrelinjeData,
    henvisninger: henvisningData,
  };

  return {
    customersGenerated: kundeData.length,
    usersGenerated: brukerData.length,
    productsGenerated: vareData.length,
    ordersGenerated: ordreData.length,
    orderLinesGenerated: ordrelinjeData.length,
    orderReferencesGenerated: henvisningData.length,
    generationTimeMs: duration,
  };
}

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
function getOrderRows(
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
function generateOrdersIntoArrays(
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


// ── Shared helpers for dimension setup and index management ─────────

/**
 * Ensure all dimension/seed data exists (firma, valuta, lager, kunde, users, vare).
 * Uses ON CONFLICT DO NOTHING so it is safe to call repeatedly.
 */
export async function ensureDimensionData(customers: number): Promise<{ brukere: number }> {
  const { kundeData, brukerData, vareData } = getDimensionData(customers);
  const { bulkCopy } = await import('../db/index.js');

  await query(`INSERT INTO firma (firmaid, firmanavn) VALUES
    (1, 'Hovedkontor Oslo'), (2, 'Region Vest'), (3, 'Region Sør'),
    (4, 'Region Midt'), (5, 'Region Nord')
    ON CONFLICT DO NOTHING`);

  await query(`INSERT INTO valuta (valutaid) VALUES
    ('NOK'), ('EUR'), ('USD'), ('SEK'), ('DKK'), ('GBP')
    ON CONFLICT DO NOTHING`);

  await query(`INSERT INTO lager (lagernavn, firmaid) VALUES
    ('Hovedkontor Oslo Hovedlager', 1), ('Hovedkontor Oslo Reservelager', 1),
    ('Region Vest Hovedlager', 2), ('Region Vest Reservelager', 2),
    ('Region Sør Hovedlager', 3), ('Region Sør Reservelager', 3),
    ('Region Midt Hovedlager', 4), ('Region Midt Reservelager', 4),
    ('Region Nord Hovedlager', 5), ('Region Nord Reservelager', 5)
    ON CONFLICT DO NOTHING`);

  await bulkCopy('kunde', ['kundenr', 'kundenavn'], kundeData);
  const brukere = await bulkCopy('users', ['username', 'password_hash', 'role', 'kundenr'], brukerData, 'nothing');
  await bulkCopy('vare', ['varekode', 'varenavn', 'varegruppe'], vareData);

  return { brukere };
}

/** Drop the four standard bulk-loading indexes (idempotent). */
export async function dropBulkIndexes(): Promise<void> {
  await query('DROP INDEX IF EXISTS idx_ordrelinje_ordrenr');
  await query('DROP INDEX IF EXISTS idx_ordrelinje_varekode');
  await query('DROP INDEX IF EXISTS idx_ordre_kundenr');
  await query('DROP INDEX IF EXISTS idx_ordre_dato');
}

/** Recreate the four standard bulk-loading indexes (idempotent). */
export async function createBulkIndexes(): Promise<void> {
  await Promise.all([
    query('CREATE INDEX IF NOT EXISTS idx_ordrelinje_ordrenr ON ordrelinje(ordrenr)'),
    query('CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode ON ordrelinje(varekode)'),
    query('CREATE INDEX IF NOT EXISTS idx_ordre_kundenr ON ordre(kundenr)'),
    query('CREATE INDEX IF NOT EXISTS idx_ordre_dato ON ordre(dato)'),
  ]);
}


/**
 * Insert bulk data using parallel COPY for maximum performance
 */
export async function insertBulkTestData(): Promise<any> {
  if (!generatedBulkData) {
    throw new Error('No bulk data generated. Call generateBulkTestData first.');
  }

  const data = generatedBulkData;
  const results: Record<string, any> = {};
  const startTime = Date.now();

  // Payload sizes (before we clear arrays); reported so "inserted < payload" implies ON CONFLICT skips
  results.ordersInPayload = data.ordrer?.length ?? 0;
  results.orderLinesInPayload = data.ordrelinjer?.length ?? 0;
  results.orderRefsInPayload = data.henvisninger?.length ?? 0;

  etlLogger.info({ stage: 'bulk-insert-start' }, 'Starting high-speed bulk insert');

  // 1. Ensure all dimension data exists (firma, valuta, lager, kunde, users, vare)
  const { brukere } = await ensureDimensionData(data.kunder.length);
  results.brukere = brukere;

  // 2. Drop indexes to speed up insertion
  etlLogger.debug({ stage: 'bulk-insert-drop-indexes' }, 'Dropping indexes for maximum speed');
  await dropBulkIndexes();

  try {
    // 3. Parallel COPY for orders and order lines
    const PARALLEL_CHUNKS = 4;
    const { bulkCopy } = await import('../db/index.js');
    
    const splitIntoChunks = (array: any[], chunks: number) => {
      const size = Math.ceil(array.length / chunks);
      return Array.from({ length: chunks }, (_, i) => array.slice(i * size, (i + 1) * size));
    };

    etlLogger.info({ stage: 'bulk-insert-copy-start', parallelChunks: PARALLEL_CHUNKS }, 'Executing parallel COPY');
    
    const ordreChunks = splitIntoChunks(data.ordrer, PARALLEL_CHUNKS);
    const linjeChunks = splitIntoChunks(data.ordrelinjer, PARALLEL_CHUNKS);

    // Run orders in parallel
    const ordreStart = Date.now();
    const ordreResults = await Promise.all(
      ordreChunks.map(chunk => bulkCopy('ordre', ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'], chunk))
    );
    results.ordrer = ordreResults.reduce((sum, count) => sum + count, 0);
    etlLogger.info({ stage: 'bulk-insert-orders-finished', durationMs: Date.now() - ordreStart }, 'Orders copy finished');
    // Free memory before next phase (allow GC to reclaim ~1M order rows)
    data.ordrer = [];

    // Run lines in parallel
    const linjeStart = Date.now();
    const linjeResults = await Promise.all(
      linjeChunks.map(chunk => bulkCopy('ordrelinje', ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'], chunk))
    );
    results.ordrelinjer = linjeResults.reduce((sum, count) => sum + count, 0);
    etlLogger.info({ stage: 'bulk-insert-lines-finished', durationMs: Date.now() - linjeStart }, 'Order lines copy finished');
    // Free memory before henvisninger (allow GC to reclaim ~3M line rows)
    data.ordrelinjer = [];

    // Run ordre_henvisning in parallel
    if (data.henvisninger && data.henvisninger.length > 0) {
      const henvisningStart = Date.now();
      const henvisningChunks = splitIntoChunks(data.henvisninger, PARALLEL_CHUNKS);
      const henvisningResults = await Promise.all(
        henvisningChunks.map(chunk => bulkCopy('ordre_henvisning', ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'], chunk))
      );
      results.ordre_henvisninger = henvisningResults.reduce((sum, count) => sum + count, 0);
      etlLogger.info(
        { stage: 'bulk-insert-references-finished', durationMs: Date.now() - henvisningStart },
        'Order references copy finished'
      );
    }

  } finally {
    // 5. Recreate indexes
    etlLogger.debug({ stage: 'bulk-insert-recreate-indexes' }, 'Recreating indexes');
    const indexStart = Date.now();
    await createBulkIndexes();
    etlLogger.info({ stage: 'bulk-insert-indexes-finished', durationMs: Date.now() - indexStart }, 'Indexes recreated');
  }

  const duration = Date.now() - startTime;
  results.insertionTimeMs = duration;
  results.totalRows = (results.brukere || 0) + results.ordrer + results.ordrelinjer + (results.ordre_henvisninger || 0);
  results.rowsPerSecond = Math.round(results.totalRows / (duration / 1000));
  // When inserted < payload, rows were skipped by ON CONFLICT DO NOTHING (already in DB)
  const ordersSkipped = (results.ordersInPayload ?? 0) - (results.ordrer ?? 0);
  if (ordersSkipped > 0) {
    results.ordersSkippedConflict = ordersSkipped;
  }

  etlLogger.info(
    { stage: 'bulk-insert-complete', totalRows: results.totalRows, durationMs: duration, rowsPerSecond: results.rowsPerSecond },
    'High-speed bulk insert completed'
  );

  return results;
}

/** Safe default: ~50k orders per batch ≈ 150k lines + 140k refs per batch, keeps heap well under 1GB per stage. */
const DEFAULT_ORDERS_PER_BATCH = 50_000;

/**
 * Generate and insert bulk data in stages so we never hold more than one batch in memory.
 * Designed for 20M+ rows without OOM: each batch is generated, copied, then discarded.
 *
 * @param totalOrders - Total number of orders (e.g. 6_700_000 → ~20M order lines + ~18M references)
 * @param ordersPerBatch - Orders per batch (default 50k for low memory); smaller = safer, more stages
 * @param customers - Number of customers for FK (default 1000)
 * @param linesPerOrder - Max lines per order (default 5)
 */
export async function runBulkPipelineInStages(config: {
  totalOrders: number;
  ordersPerBatch?: number;
  customers?: number;
  linesPerOrder?: number;
}): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
  stages: number;
}> {
  const {
    totalOrders,
    ordersPerBatch = DEFAULT_ORDERS_PER_BATCH,
    customers = 1000,
    linesPerOrder = 5,
  } = config;

  const startTime = Date.now();
  const { bulkCopy } = await import('../db/index.js');

  etlLogger.info(
    { stage: 'bulk-stages-start', totalOrders, ordersPerBatch, estimatedStages: Math.ceil(totalOrders / ordersPerBatch) },
    'Starting staged bulk pipeline (generate + insert per batch)'
  );

  await ensureDimensionData(customers);
  await dropBulkIndexes();

  let totalOrdrer = 0;
  let totalOrdrelinjer = 0;
  let totalHenvisninger = 0;
  const numBatches = Math.ceil(totalOrders / ordersPerBatch);

  try {
    for (let b = 0; b < numBatches; b++) {
      const startOrder = b * ordersPerBatch + 1;
      const endOrder = Math.min(startOrder + ordersPerBatch - 1, totalOrders);
      const batchSize = endOrder - startOrder + 1;

      const ordreData: OrdreRow[] = [];
      const ordrelinjeData: OrdrelinjeRow[] = [];
      const henvisningData: HenvisningRow[] = [];
      generateOrdersIntoArrays(
        { ordreData, ordrelinjeData, henvisningData },
        startOrder,
        endOrder,
        customers,
        linesPerOrder
      );

      totalOrdrer += await bulkCopy('ordre', ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'], ordreData);
      ordreData.length = 0;
      totalOrdrelinjer += await bulkCopy('ordrelinje', ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'], ordrelinjeData);
      ordrelinjeData.length = 0;
      if (henvisningData.length > 0) {
        totalHenvisninger += await bulkCopy('ordre_henvisning', ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'], henvisningData);
      }
      henvisningData.length = 0;

      etlLogger.info(
        { stage: 'bulk-stages-batch', batch: b + 1, totalBatches: numBatches, ordersInBatch: batchSize, cumulativeOrdrer: totalOrdrer, cumulativeLinjer: totalOrdrelinjer },
        `Staged bulk: batch ${b + 1}/${numBatches} done`
      );
    }
  } finally {
    await createBulkIndexes();
  }

  const duration = Date.now() - startTime;
  const totalRows = totalOrdrer + totalOrdrelinjer + totalHenvisninger;
  etlLogger.info(
    { stage: 'bulk-stages-complete', totalRows, durationMs: duration, rowsPerSecond: Math.round(totalRows / (duration / 1000)) },
    'Staged bulk pipeline completed'
  );

  return {
    ordrer: totalOrdrer,
    ordrelinjer: totalOrdrelinjer,
    ordre_henvisninger: totalHenvisninger,
    totalRows,
    insertionTimeMs: duration,
    rowsPerSecond: Math.round(totalRows / (duration / 1000)),
    stages: numBatches,
  };
}

const ORDRE_COLS = ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'];
const ORDRELINJE_COLS = ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'];
const HENVISNING_COLS = ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'];

/**
 * Pure streaming bulk: generate one order at a time and pipe to three COPY streams in parallel.
 * O(1) memory – no batches, no arrays. Best for 20M+ rows; single loop feeds ordre + ordrelinje + henvisning.
 */
export async function runBulkPipelineStreaming(config: {
  totalOrders: number;
  customers?: number;
  linesPerOrder?: number;
}): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
}> {
  const { totalOrders, customers = 1000, linesPerOrder = 5 } = config;
  const startTime = Date.now();

  etlLogger.info(
    { stage: 'bulk-streaming-start', totalOrders },
    'Starting streaming bulk pipeline (O(1) memory, parallel COPY)'
  );

  await ensureDimensionData(customers);
  await dropBulkIndexes();

  const ptOrdre = new PassThrough({ objectMode: false });
  const ptOrdrelinje = new PassThrough({ objectMode: false });
  const ptHenvisning = new PassThrough({ objectMode: false });

  const copyOrdreP = copyFromLineStream('ordre', ORDRE_COLS, ptOrdre, 'nothing');
  const copyOrdrelinjeP = copyFromLineStream('ordrelinje', ORDRELINJE_COLS, ptOrdrelinje, 'nothing');
  const copyHenvisningP = copyFromLineStream('ordre_henvisning', HENVISNING_COLS, ptHenvisning, 'nothing');

  for (let i = 1; i <= totalOrders; i++) {
    const { ordre, ordrelinjer, henvisninger } = getOrderRows(i, customers, linesPerOrder);
    let needDrainO = !ptOrdre.write(formatCopyLine(ordre));
    let needDrainL = false;
    let needDrainH = false;
    for (const row of ordrelinjer) needDrainL = !ptOrdrelinje.write(formatCopyLine(row)) || needDrainL;
    for (const row of henvisninger) needDrainH = !ptHenvisning.write(formatCopyLine(row)) || needDrainH;
    if (needDrainO) await once(ptOrdre, 'drain');
    if (needDrainL) await once(ptOrdrelinje, 'drain');
    if (needDrainH) await once(ptHenvisning, 'drain');
  }
  ptOrdre.end();
  ptOrdrelinje.end();
  ptHenvisning.end();

  const [ordrer, ordrelinjer, ordre_henvisninger] = await Promise.all([copyOrdreP, copyOrdrelinjeP, copyHenvisningP]);

  await createBulkIndexes();

  const duration = Date.now() - startTime;
  const totalRows = ordrer + ordrelinjer + ordre_henvisninger;
  etlLogger.info(
    { stage: 'bulk-streaming-complete', totalRows, durationMs: duration, rowsPerSecond: Math.round(totalRows / (duration / 1000)) },
    'Streaming bulk pipeline completed'
  );

  return {
    ordrer,
    ordrelinjer,
    ordre_henvisninger,
    totalRows,
    insertionTimeMs: duration,
    rowsPerSecond: Math.round(totalRows / (duration / 1000)),
  };
}

/**
 * Fast count of all tables
 */
export async function getTableCounts(): Promise<Record<string, number>> {
  const tables = ['kunde', 'vare', 'ordre', 'ordrelinje', 'ordre_henvisning', 'firma', 'lager', 'users'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      // Use estimate for large tables (much faster than COUNT(*))
      const result = await query(`
        SELECT reltuples::bigint AS estimate 
        FROM pg_class 
        WHERE relname = $1
      `, [table]);
      counts[table] = result.rows[0]?.estimate || 0;
    } catch {
      counts[table] = 0;
    }
  }

  return counts;
}

import { query } from '../db/index.js';
import { etlLogger } from '../lib/logger.js';

// Pre-calculated hash for 'kunde123' to save CPU time during generation
const KUNDE_PASSWORD_HASH = '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W';

// In-memory storage for generated bulk data
let generatedBulkData: any = null;

/**
 * Generate millions of rows of test data
 */
export async function generateBulkTestData(config: {
  customers?: number;
  orders?: number;
  linesPerOrder?: number;
}): Promise<any> {
  const {
    customers = 1000,
    orders = 100000,
    linesPerOrder = 5,
  } = config;

  etlLogger.info(
    { stage: 'bulk-generate-start', customers, orders, estimatedLines: orders * linesPerOrder },
    'Generating bulk data'
  );
  const startTime = Date.now();

  // Generate customers with industry-relevant names and their corresponding users
  const kundeData: any[][] = [];
  const brukerData: any[][] = [];
  const sektorer = ['Olje og Gass', 'Marin', 'Prosessindustri', 'Bygg og Anlegg', 'Havbruk', 'Bergverk', 'Energi', 'Transport', 'Verksted', 'Industri'];
  const byer = ['Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Kristiansand', 'Haugesund', 'Ålesund', 'Hammerfest', 'Bodø', 'Sandnes', 'Drammen', 'Fredrikstad', 'Tønsberg', 'Skien', 'Moss'];
  const selskapsformer = ['AS', 'ASA', 'AS', 'AS', 'ANS']; // AS is most common
  for (let i = 1; i <= customers; i++) {
    const kundenr = `K${String(i).padStart(6, '0')}`;
    const by = byer[i % byer.length];
    const sektor = sektorer[i % sektorer.length];
    const form = selskapsformer[i % selskapsformer.length];
    kundeData.push([
      kundenr,
      `${by} ${sektor} ${form}`,
    ]);
    brukerData.push([
      kundenr,
      KUNDE_PASSWORD_HASH,
      'kunde',
      kundenr,
    ]);
  }

  // Generate TESS-relevant products
  const vareData: any[][] = [];
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
  // Fill remaining with generic products if needed
  while (vareTeller <= 500) {
    const restGrupper = ['Slanger', 'Kuplinger', 'Fittings', 'Hydraulikk', 'Tetninger', 'Verktøy'];
    vareData.push([
      `V${String(vareTeller).padStart(5, '0')}`,
      `Industriprodukt ${vareTeller}`,
      restGrupper[vareTeller % restGrupper.length],
    ]);
    vareTeller++;
  }

  // Generate orders, order lines, and order references
  const ordreData: any[][] = [];
  const ordrelinjeData: any[][] = [];
  const henvisningData: any[][] = [];
  
  const firmaer = [1, 2, 3, 4, 5];
  const lagerMap: Record<number, string> = {
    1: 'Hovedkontor Oslo Hovedlager',
    2: 'Region Vest Hovedlager', 
    3: 'Region Sør Hovedlager',
    4: 'Region Midt Hovedlager',
    5: 'Region Nord Hovedlager',
  };
  const valutaer = ['NOK', 'NOK', 'NOK', 'EUR', 'USD', 'SEK'];
  const years = [2024, 2025, 2026];
  const prosjekter = [
    'Nordsjøen Vedlikehold', 'Mongstad Oppgradering', 'Sverdrup Fase 2',
    'Kårstø Drift', 'Snøhvit LNG', 'Martin Linge', 'Troll A',
    'Hammerfest LNG', 'Oseberg Sør', 'Gullfaks Subsea',
    'Åsgard Turnaround', 'Valemon Drift', 'Gina Krog', 'Edvard Grieg',
    'Sleipner Vest', 'Statfjord C', 'Njord Bravo', 'Heidrun TLP',
  ];
  const avdelinger = ['Innkjøp', 'Vedlikehold', 'Drift', 'Prosjekt', 'Lager', 'HMS', 'Mek. Verksted', 'Elektro'];
  const kontaktpersoner = [
    'Ole Hansen', 'Kari Nordmann', 'Per Olsen', 'Anne Kristiansen',
    'Eirik Berg', 'Silje Strand', 'Lars Johansen', 'Mette Dahl',
    'Thomas Lie', 'Ingrid Haugen', 'Bjørn Eriksen', 'Hilde Moen',
  ];

  for (let i = 1; i <= orders; i++) {
    const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
    const firmaid = firmaer[i % firmaer.length];
    const ordrenr = 10000 + i;
    
    // Random date across 2024-2026
    const year = years[i % years.length];
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    let orderSum = 0;
    const numLines = Math.floor(Math.random() * linesPerOrder) + 1;
    
    for (let j = 1; j <= numLines; j++) {
      const varekode = `V${String((i * j) % 500 + 1).padStart(5, '0')}`;
      const antall = Math.floor(Math.random() * 50) + 1;
      const nettpris = Math.floor(Math.random() * 5000) + 50;
      const linjesum = antall * nettpris;
      orderSum += linjesum;
      
      ordrelinjeData.push([
        j,
        ordrenr,
        varekode,
        antall,
        'stk',
        nettpris,
        linjesum,
        1,
      ]);

      // Generate ordre_henvisning for ~60% of lines
      if (i % 5 !== 0 || j <= 2) {
        const prosjekt = prosjekter[(i + j) % prosjekter.length];
        const avdeling = avdelinger[(i + j) % avdelinger.length];
        henvisningData.push([
          ordrenr,
          j,
          prosjekt,
          `${avdeling}-${kundenr}`,
          `WO-${10000 + ((i * 7 + j * 3) % 90000)}`,
          (i + j) % 3 === 0 ? `TAG-${String.fromCharCode(65 + (i % 26))}${(i * j) % 999 + 1}` : null,
          (i + j) % 4 === 0 ? `Kostnadssted ${1000 + (i % 9000)}` : null,
        ]);
      }
    }
    
    const kontakt = kontaktpersoner[i % kontaktpersoner.length];

    ordreData.push([
      ordrenr,
      dato,
      kundenr,
      `PO-${year}-${String(ordrenr).padStart(6, '0')}`,
      kontakt,
      firmaid,
      lagerMap[firmaid],
      valutaer[i % valutaer.length],
      orderSum,
    ]);

    // Progress logging every 10000 orders
    if (i % 10000 === 0) {
      etlLogger.debug({ stage: 'bulk-generate-progress', generatedOrders: i, totalOrders: orders }, 'Bulk generation progress');
    }
  }

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

  etlLogger.info({ stage: 'bulk-insert-start' }, 'Starting high-speed bulk insert');

  // 1. Prepare base data
  await query('INSERT INTO firma (firmaid, firmanavn) VALUES (1, \'Hovedkontor Oslo\'), (2, \'Region Vest\'), (3, \'Region Sør\'), (4, \'Region Midt\'), (5, \'Region Nord\') ON CONFLICT DO NOTHING');
  await query('INSERT INTO valuta (valutaid) VALUES (\'NOK\'), (\'EUR\'), (\'USD\'), (\'SEK\'), (\'DKK\'), (\'GBP\') ON CONFLICT DO NOTHING');
  
  // Ensure lager exists (FK constraint for ordre)
  await query(`
    INSERT INTO lager (lagernavn, firmaid) VALUES 
      ('Hovedkontor Oslo Hovedlager', 1), ('Hovedkontor Oslo Reservelager', 1),
      ('Region Vest Hovedlager', 2), ('Region Vest Reservelager', 2),
      ('Region Sør Hovedlager', 3), ('Region Sør Reservelager', 3),
      ('Region Midt Hovedlager', 4), ('Region Midt Reservelager', 4),
      ('Region Nord Hovedlager', 5), ('Region Nord Reservelager', 5)
    ON CONFLICT DO NOTHING
  `);

  const { bulkCopy } = await import('../db/index.js');

  // 2. Ensure customers and products exist before COPY (FK constraints)
  etlLogger.debug({ stage: 'bulk-insert-prepare-dimensions' }, 'Ensuring customers, users, and products exist');
  await bulkCopy('kunde', ['kundenr', 'kundenavn'], data.kunder);
  
  // Use a transaction-safe way to insert users if they don't exist
  // bulkCopy with 'nothing' uses a temp table and ON CONFLICT DO NOTHING
  results.brukere = await bulkCopy('users', ['username', 'password_hash', 'role', 'kundenr'], data.brukere, 'nothing');
  
  await bulkCopy('vare', ['varekode', 'varenavn', 'varegruppe'], data.varer);

  // 3. Drop indexes to speed up insertion
  etlLogger.debug({ stage: 'bulk-insert-drop-indexes' }, 'Dropping indexes for maximum speed');
  await query('DROP INDEX IF EXISTS idx_ordrelinje_ordrenr');
  await query('DROP INDEX IF EXISTS idx_ordrelinje_varekode');
  await query('DROP INDEX IF EXISTS idx_ordre_kundenr');
  await query('DROP INDEX IF EXISTS idx_ordre_dato');

  try {
    // 4. Parallel COPY for orders and order lines
    const PARALLEL_CHUNKS = 4;
    
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

    // Run lines in parallel
    const linjeStart = Date.now();
    const linjeResults = await Promise.all(
      linjeChunks.map(chunk => bulkCopy('ordrelinje', ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'], chunk))
    );
    results.ordrelinjer = linjeResults.reduce((sum, count) => sum + count, 0);
    etlLogger.info({ stage: 'bulk-insert-lines-finished', durationMs: Date.now() - linjeStart }, 'Order lines copy finished');

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
    await Promise.all([
      query('CREATE INDEX idx_ordrelinje_ordrenr ON ordrelinje(ordrenr)'),
      query('CREATE INDEX idx_ordrelinje_varekode ON ordrelinje(varekode)'),
      query('CREATE INDEX idx_ordre_kundenr ON ordre(kundenr)'),
      query('CREATE INDEX idx_ordre_dato ON ordre(dato)')
    ]);
    etlLogger.info({ stage: 'bulk-insert-indexes-finished', durationMs: Date.now() - indexStart }, 'Indexes recreated');
  }

  const duration = Date.now() - startTime;
  results.insertionTimeMs = duration;
  results.totalRows = (results.brukere || 0) + results.ordrer + results.ordrelinjer + (results.ordre_henvisninger || 0);
  results.rowsPerSecond = Math.round(results.totalRows / (duration / 1000));

  etlLogger.info(
    { stage: 'bulk-insert-complete', totalRows: results.totalRows, durationMs: duration, rowsPerSecond: results.rowsPerSecond },
    'High-speed bulk insert completed'
  );

  return results;
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

import { query } from '../db/index.js';
import bcrypt from 'bcrypt';

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

  console.log(`🔄 Generating bulk data: ${customers} customers, ${orders} orders, ~${orders * linesPerOrder} lines`);
  const startTime = Date.now();

  const defaultCustomerPassword = 'kunde123';
  const defaultCustomerPasswordHash = await bcrypt.hash(defaultCustomerPassword, 10);

  // Generate customers
  const kundeData: any[][] = [];
  const brukerData: any[][] = [];
  for (let i = 1; i <= customers; i++) {
    const kundenr = `K${String(i).padStart(6, '0')}`;
    kundeData.push([
      kundenr,
      `Kunde ${i} AS`,
    ]);
    brukerData.push([
      kundenr,
      defaultCustomerPasswordHash,
      'kunde',
      kundenr,
    ]);
  }

  // Generate products
  const vareData: any[][] = [];
  const varegrupper = ['Elektronikk', 'Møbler', 'Verktøy', 'Kontor', 'IT', 'Sikkerhet'];
  for (let i = 1; i <= 500; i++) {
    vareData.push([
      `V${String(i).padStart(5, '0')}`,
      `Produkt ${i}`,
      varegrupper[i % varegrupper.length],
    ]);
  }

  // Generate orders and order lines
  const ordreData: any[][] = [];
  const ordrelinjeData: any[][] = [];
  
  const firmaer = [1, 2, 3, 4, 5];
  const lagerMap: Record<number, string> = {
    1: 'Hovedkontor Oslo Hovedlager',
    2: 'Region Vest Hovedlager', 
    3: 'Region Sør Hovedlager',
    4: 'Region Midt Hovedlager',
    5: 'Region Nord Hovedlager',
  };
  const valutaer = ['NOK', 'NOK', 'NOK', 'EUR', 'USD', 'SEK'];

  for (let i = 1; i <= orders; i++) {
    const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
    const firmaid = firmaer[i % firmaer.length];
    const ordrenr = 10000 + i;
    
    // Random date in 2024
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
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
    }
    
    ordreData.push([
      ordrenr,
      dato,
      kundenr,
      `PO-${ordrenr}`,
      `Ref-${i}`,
      firmaid,
      lagerMap[firmaid],
      valutaer[i % valutaer.length],
      orderSum,
    ]);

    // Progress logging every 10000 orders
    if (i % 10000 === 0) {
      console.log(`  Generated ${i}/${orders} orders...`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`✅ Data generation completed in ${duration}ms`);

  generatedBulkData = {
    kunder: kundeData,
    brukere: brukerData,
    varer: vareData,
    ordrer: ordreData,
    ordrelinjer: ordrelinjeData,
  };

  return {
    customersGenerated: kundeData.length,
    usersGenerated: brukerData.length,
    productsGenerated: vareData.length,
    ordersGenerated: ordreData.length,
    orderLinesGenerated: ordrelinjeData.length,
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

  console.log('🚀 Starting ULTIMATE high-speed parallel bulk insert...');

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
  console.log('  Ensuring customers, users, and products exist...');
  await bulkCopy('kunde', ['kundenr', 'kundenavn'], data.kunder);
  results.brukere = await bulkCopy('users', ['username', 'password_hash', 'role', 'kundenr'], data.brukere);
  await bulkCopy('vare', ['varekode', 'varenavn', 'varegruppe'], data.varer);

  // 3. Drop indexes to speed up insertion
  console.log('  Dropping indexes for maximum speed...');
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

    console.log(`  Executing parallel COPY with ${PARALLEL_CHUNKS} streams...`);
    
    const ordreChunks = splitIntoChunks(data.ordrer, PARALLEL_CHUNKS);
    const linjeChunks = splitIntoChunks(data.ordrelinjer, PARALLEL_CHUNKS);

    // Run orders in parallel
    const ordreStart = Date.now();
    const ordreResults = await Promise.all(
      ordreChunks.map(chunk => bulkCopy('ordre', ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'], chunk))
    );
    results.ordrer = ordreResults.reduce((sum, count) => sum + count, 0);
    console.log(`    ✓ Orders finished in ${Date.now() - ordreStart}ms`);

    // Run lines in parallel
    const linjeStart = Date.now();
    const linjeResults = await Promise.all(
      linjeChunks.map(chunk => bulkCopy('ordrelinje', ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'], chunk))
    );
    results.ordrelinjer = linjeResults.reduce((sum, count) => sum + count, 0);
    console.log(`    ✓ Order lines finished in ${Date.now() - linjeStart}ms`);

  } finally {
    // 5. Recreate indexes
    console.log('  Recreating indexes (this might take a few seconds)...');
    const indexStart = Date.now();
    await Promise.all([
      query('CREATE INDEX idx_ordrelinje_ordrenr ON ordrelinje(ordrenr)'),
      query('CREATE INDEX idx_ordrelinje_varekode ON ordrelinje(varekode)'),
      query('CREATE INDEX idx_ordre_kundenr ON ordre(kundenr)'),
      query('CREATE INDEX idx_ordre_dato ON ordre(dato)')
    ]);
    console.log(`    ✓ Indexes recreated in ${Date.now() - indexStart}ms`);
  }

  const duration = Date.now() - startTime;
  results.insertionTimeMs = duration;
  results.totalRows = (results.brukere || 0) + results.ordrer + results.ordrelinjer;
  results.rowsPerSecond = Math.round(results.totalRows / (duration / 1000));

  console.log(`✅ ULTIMATE insert completed: ${results.totalRows} rows in ${duration}ms (${results.rowsPerSecond} rows/s)`);

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

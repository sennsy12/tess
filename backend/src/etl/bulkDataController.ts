import { query, batchInsert, transaction, getClient } from '../db/index.js';

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

  // Generate customers
  const kundeData: any[][] = [];
  for (let i = 1; i <= customers; i++) {
    kundeData.push([
      `K${String(i).padStart(6, '0')}`,
      `Kunde ${i} AS`,
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
    varer: vareData,
    ordrer: ordreData,
    ordrelinjer: ordrelinjeData,
  };

  return {
    customersGenerated: kundeData.length,
    productsGenerated: vareData.length,
    ordersGenerated: ordreData.length,
    orderLinesGenerated: ordrelinjeData.length,
    generationTimeMs: duration,
  };
}

/**
 * Insert bulk data using optimized batch inserts
 */
export async function insertBulkTestData(): Promise<any> {
  if (!generatedBulkData) {
    throw new Error('No bulk data generated. Call generateBulkTestData first.');
  }

  const data = generatedBulkData;
  const results: Record<string, any> = {};
  const startTime = Date.now();

  console.log('🔄 Inserting bulk data...');

  // Insert base data first (must exist before FK references)
  console.log('  Inserting firma...');
  await query(`
    INSERT INTO firma (firmaid, firmanavn) VALUES 
      (1, 'Hovedkontor Oslo'),
      (2, 'Region Vest'),
      (3, 'Region Sør'),
      (4, 'Region Midt'),
      (5, 'Region Nord')
    ON CONFLICT DO NOTHING
  `);

  console.log('  Inserting lager...');
  await query(`
    INSERT INTO lager (lagernavn, firmaid) VALUES 
      ('Hovedkontor Oslo Hovedlager', 1), ('Hovedkontor Oslo Reservelager', 1),
      ('Region Vest Hovedlager', 2), ('Region Vest Reservelager', 2),
      ('Region Sør Hovedlager', 3), ('Region Sør Reservelager', 3),
      ('Region Midt Hovedlager', 4), ('Region Midt Reservelager', 4),
      ('Region Nord Hovedlager', 5), ('Region Nord Reservelager', 5)
    ON CONFLICT DO NOTHING
  `);

  console.log('  Inserting valuta...');
  await query(`
    INSERT INTO valuta (valutaid) VALUES ('NOK'), ('EUR'), ('USD'), ('SEK'), ('DKK'), ('GBP')
    ON CONFLICT DO NOTHING
  `);

  // Batch insert customers
  console.log(`  Inserting ${data.kunder.length} customers...`);
  results.kunder = await batchInsert('kunde', ['kundenr', 'kundenavn'], data.kunder);
  
  // Batch insert products
  console.log(`  Inserting ${data.varer.length} products...`);
  results.varer = await batchInsert('vare', ['varekode', 'varenavn', 'varegruppe'], data.varer);

  // Batch insert orders (smaller batch size due to more columns)
  console.log(`  Inserting ${data.ordrer.length} orders...`);
  results.ordrer = await batchInsert(
    'ordre',
    ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'],
    data.ordrer,
    5000 // Smaller batch for orders
  );

  // Batch insert order lines
  console.log(`  Inserting ${data.ordrelinjer.length} order lines...`);
  results.ordrelinjer = await batchInsert(
    'ordrelinje',
    ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'],
    data.ordrelinjer,
    5000
  );

  const duration = Date.now() - startTime;
  console.log(`✅ Bulk insert completed in ${duration}ms`);

  results.insertionTimeMs = duration;
  results.rowsPerSecond = Math.round((data.ordrer.length + data.ordrelinjer.length) / (duration / 1000));

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

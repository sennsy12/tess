import { query } from '../db/index.js';

// In-memory storage for generated test data
let generatedTestData: any = null;

/**
 * Generates test data (customers, products, orders, etc.)
 */
export async function generateTestData() {
  const data = {
    kunder: [
      { kundenr: 'K001', kundenavn: 'Nordisk Handel AS' },
      { kundenr: 'K002', kundenavn: 'Bergen Industri' },
      { kundenr: 'K003', kundenavn: 'Oslo Leverandør' },
      { kundenr: 'K004', kundenavn: 'Trondheim Tech AS' },
      { kundenr: 'K005', kundenavn: 'Stavanger Solutions' },
    ],
    firmaer: [
      { firmaid: 1, firmanavn: 'Hovedkontor' },
      { firmaid: 2, firmanavn: 'Avdeling Nord' },
      { firmaid: 3, firmanavn: 'Avdeling Sør' },
    ],
    lager: [
      { lagernavn: 'Hovedlager', firmaid: 1 },
      { lagernavn: 'Nordlager', firmaid: 2 },
      { lagernavn: 'Sørlager', firmaid: 3 },
    ],
    valutaer: [
      { valutaid: 'NOK' },
      { valutaid: 'EUR' },
      { valutaid: 'USD' },
      { valutaid: 'SEK' },
    ],
    varer: [
      { varekode: 'V001', varenavn: 'Laptop Pro 15"', varegruppe: 'Elektronikk' },
      { varekode: 'V002', varenavn: 'Trådløs Mus', varegruppe: 'Elektronikk' },
      { varekode: 'V003', varenavn: 'Kontorstol Ergo', varegruppe: 'Møbler' },
      { varekode: 'V004', varenavn: 'Skrivebord 160cm', varegruppe: 'Møbler' },
      { varekode: 'V005', varenavn: 'Skrutrekker Sett', varegruppe: 'Verktøy' },
      { varekode: 'V006', varenavn: 'Hammer Pro', varegruppe: 'Verktøy' },
      { varekode: 'V007', varenavn: 'USB-C Kabel 2m', varegruppe: 'Elektronikk' },
      { varekode: 'V008', varenavn: 'Monitor 27" 4K', varegruppe: 'Elektronikk' },
    ],
    ordrer: generateRandomOrders(),
  };

  generatedTestData = data;
  return {
    kunder: data.kunder.length,
    firmaer: data.firmaer.length,
    lager: data.lager.length,
    valutaer: data.valutaer.length,
    varer: data.varer.length,
    ordrer: data.ordrer.length,
  };
}

function generateRandomOrders() {
  const orders = [];
  const kundeNr = ['K001', 'K002', 'K003', 'K004', 'K005'];
  const firmaer = [1, 2, 3];
  const lagerMap: Record<number, string> = { 1: 'Hovedlager', 2: 'Nordlager', 3: 'Sørlager' };
  const valutaer = ['NOK', 'NOK', 'NOK', 'EUR', 'USD']; // NOK more common
  const varer = ['V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008'];
  const priser: Record<string, number> = {
    V001: 15000, V002: 500, V003: 5000, V004: 8000,
    V005: 300, V006: 200, V007: 150, V008: 6000,
  };

  // Generate 20 random orders
  for (let i = 1; i <= 20; i++) {
    const ordrenr = 1000 + i;
    const firmaid = firmaer[Math.floor(Math.random() * firmaer.length)];
    const kundenr = kundeNr[Math.floor(Math.random() * kundeNr.length)];
    
    // Generate 1-4 lines per order
    const numLines = Math.floor(Math.random() * 4) + 1;
    const lines = [];
    let orderSum = 0;

    for (let j = 1; j <= numLines; j++) {
      const varekode = varer[Math.floor(Math.random() * varer.length)];
      const antall = Math.floor(Math.random() * 10) + 1;
      const nettpris = priser[varekode];
      const linjesum = antall * nettpris;
      orderSum += linjesum;

      lines.push({
        linjenr: j,
        ordrenr,
        varekode,
        antall,
        enhet: 'stk',
        nettpris,
        linjesum,
        linjestatus: 1,
      });
    }

    // Random date in 2024
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    orders.push({
      ordrenr,
      dato,
      kundenr,
      kundeordreref: `REF-${ordrenr}`,
      kunderef: `Kontakt ${kundenr}`,
      firmaid,
      lagernavn: lagerMap[firmaid],
      valutaid: valutaer[Math.floor(Math.random() * valutaer.length)],
      sum: orderSum,
      lines,
    });
  }

  return orders;
}

/**
 * Inserts generated test data into database
 */
export async function insertTestData() {
  if (!generatedTestData) {
    await generateTestData();
  }

  const data = generatedTestData;
  const results: Record<string, number> = {};

  // Insert kunder
  for (const kunde of data.kunder) {
    await query(
      'INSERT INTO kunde (kundenr, kundenavn) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [kunde.kundenr, kunde.kundenavn]
    );
  }
  results.kunder = data.kunder.length;

  // Insert firmaer
  for (const firma of data.firmaer) {
    await query(
      'INSERT INTO firma (firmaid, firmanavn) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [firma.firmaid, firma.firmanavn]
    );
  }
  results.firmaer = data.firmaer.length;

  // Insert lager
  for (const lager of data.lager) {
    await query(
      'INSERT INTO lager (lagernavn, firmaid) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [lager.lagernavn, lager.firmaid]
    );
  }
  results.lager = data.lager.length;

  // Insert valutaer
  for (const valuta of data.valutaer) {
    await query(
      'INSERT INTO valuta (valutaid) VALUES ($1) ON CONFLICT DO NOTHING',
      [valuta.valutaid]
    );
  }
  results.valutaer = data.valutaer.length;

  // Insert varer
  for (const vare of data.varer) {
    await query(
      'INSERT INTO vare (varekode, varenavn, varegruppe) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [vare.varekode, vare.varenavn, vare.varegruppe]
    );
  }
  results.varer = data.varer.length;

  // Insert ordrer and ordrelinjer
  let linesInserted = 0;
  for (const ordre of data.ordrer) {
    await query(
      `INSERT INTO ordre (ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
      [ordre.ordrenr, ordre.dato, ordre.kundenr, ordre.kundeordreref, ordre.kunderef, 
       ordre.firmaid, ordre.lagernavn, ordre.valutaid, ordre.sum]
    );

    for (const line of ordre.lines) {
      await query(
        `INSERT INTO ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [line.linjenr, line.ordrenr, line.varekode, line.antall, line.enhet, 
         line.nettpris, line.linjesum, line.linjestatus]
      );
      linesInserted++;
    }
  }
  results.ordrer = data.ordrer.length;
  results.ordrelinjer = linesInserted;

  // Insert default users
  await query(
    `INSERT INTO users (username, password_hash, role) VALUES 
     ('admin', '$2b$10$rQZ7.HxSJvtAcMxGmsDKqO1F3tJ1X6W5H1qKjE5J9q8K7.7Wb5rXe', 'admin'),
     ('analyse', '$2b$10$rQZ7.HxSJvtAcMxGmsDKqO1F3tJ1X6W5H1qKjE5J9q8K7.7Wb5rXe', 'analyse')
     ON CONFLICT (username) DO NOTHING`
  );

  // Insert kunde user for K001
  await query(
    `INSERT INTO users (username, password_hash, role, kundenr) VALUES 
     ('kunde001', '$2b$10$rQZ7.HxSJvtAcMxGmsDKqO1F3tJ1X6W5H1qKjE5J9q8K7.7Wb5rXe', 'kunde', 'K001')
     ON CONFLICT (username) DO NOTHING`
  );

  return results;
}

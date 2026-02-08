import { query } from '../db/index.js';

// In-memory storage for generated test data
let generatedTestData: any = null;

/**
 * Generates test data (customers, products, orders, etc.)
 * Products are based on TESS industrial supply categories (hoses, fittings, hydraulics)
 */
export async function generateTestData() {
  const ordrerAndHenvisninger = generateRandomOrders();

  const data = {
    kunder: [
      { kundenr: 'K001', kundenavn: 'Equinor ASA' },
      { kundenr: 'K002', kundenavn: 'Aker Solutions AS' },
      { kundenr: 'K003', kundenavn: 'Hydro Aluminium AS' },
      { kundenr: 'K004', kundenavn: 'Kongsberg Maritime AS' },
      { kundenr: 'K005', kundenavn: 'Kvaerner AS' },
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
      { varekode: 'V001', varenavn: 'Hydraulikkslange 2-lag 1/2"', varegruppe: 'Slanger' },
      { varekode: 'V002', varenavn: 'Trykkslange R2AT 3/4"', varegruppe: 'Slanger' },
      { varekode: 'V003', varenavn: 'Industrislange EPDM DN50', varegruppe: 'Slanger' },
      { varekode: 'V004', varenavn: 'Hurtigkobling Tema 2600', varegruppe: 'Kuplinger' },
      { varekode: 'V005', varenavn: 'Kamlock-kobling 2" Aluminium', varegruppe: 'Kuplinger' },
      { varekode: 'V006', varenavn: 'Flens SAE 3000 1"', varegruppe: 'Fittings' },
      { varekode: 'V007', varenavn: 'O-ring Viton 25x3', varegruppe: 'Tetninger' },
      { varekode: 'V008', varenavn: 'Hydraulikksylinder 50/30', varegruppe: 'Hydraulikk' },
      { varekode: 'V009', varenavn: 'Sugeslange PVC DN75', varegruppe: 'Slanger' },
      { varekode: 'V010', varenavn: 'Nippel JIC 3/4"', varegruppe: 'Fittings' },
    ],
    ordrer: ordrerAndHenvisninger.ordrer,
    ordre_henvisninger: ordrerAndHenvisninger.henvisninger,
  };

  generatedTestData = data;
  return {
    kunder: data.kunder.length,
    firmaer: data.firmaer.length,
    lager: data.lager.length,
    valutaer: data.valutaer.length,
    varer: data.varer.length,
    ordrer: data.ordrer.length,
    ordre_henvisninger: data.ordre_henvisninger.length,
  };
}

function generateRandomOrders() {
  const orders = [];
  const henvisninger: any[] = [];
  const kundeNr = ['K001', 'K002', 'K003', 'K004', 'K005'];
  const firmaer = [1, 2, 3];
  const lagerMap: Record<number, string> = { 1: 'Hovedlager', 2: 'Nordlager', 3: 'Sørlager' };
  const valutaer = ['NOK', 'NOK', 'NOK', 'EUR', 'USD']; // NOK more common
  const varer = ['V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008', 'V009', 'V010'];
  const priser: Record<string, number> = {
    V001: 850, V002: 1200, V003: 2400, V004: 3500, V005: 1800,
    V006: 450, V007: 35, V008: 12000, V009: 1600, V010: 280,
  };

  const prosjekter = ['Prosjekt Nordsjøen', 'Vedlikehold Mongstad', 'Johan Sverdrup Fase 2', 'Kårstø Oppgradering', 'Snøhvit LNG'];
  const avdelinger = ['Innkjøp', 'Vedlikehold', 'Drift', 'Prosjekt', 'Lager'];
  const years = [2024, 2025, 2026];

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

      // Generate ordre_henvisning for each line (~70% chance)
      if (Math.random() > 0.3) {
        const prosjekt = prosjekter[Math.floor(Math.random() * prosjekter.length)];
        const avdeling = avdelinger[Math.floor(Math.random() * avdelinger.length)];
        henvisninger.push({
          ordrenr,
          linjenr: j,
          henvisning1: prosjekt,
          henvisning2: `${avdeling}-${kundenr}`,
          henvisning3: `WO-${Math.floor(Math.random() * 90000) + 10000}`,
          henvisning4: Math.random() > 0.5 ? `TAG-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 999) + 1}` : null,
          henvisning5: Math.random() > 0.7 ? `Bestilling ${Math.floor(Math.random() * 9000) + 1000}` : null,
        });
      }
    }

    // Random date across 2024-2026
    const year = years[Math.floor(Math.random() * years.length)];
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    orders.push({
      ordrenr,
      dato,
      kundenr,
      kundeordreref: `PO-${year}-${String(ordrenr).padStart(5, '0')}`,
      kunderef: `Kontakt ${kundenr}`,
      firmaid,
      lagernavn: lagerMap[firmaid],
      valutaid: valutaer[Math.floor(Math.random() * valutaer.length)],
      sum: orderSum,
      lines,
    });
  }

  return { ordrer: orders, henvisninger };
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

  // Insert ordre_henvisninger
  let henvisningerInserted = 0;
  for (const h of data.ordre_henvisninger) {
    await query(
      `INSERT INTO ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [h.ordrenr, h.linjenr, h.henvisning1, h.henvisning2, h.henvisning3, h.henvisning4, h.henvisning5]
    );
    henvisningerInserted++;
  }
  results.ordre_henvisninger = henvisningerInserted;

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

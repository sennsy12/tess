import { query } from '../db/index.js';

// In-memory storage for generated real data
let generatedRealData: any = null;

/**
 * Generates real data from predefined sources
 * This would typically connect to external APIs or data sources
 * For now, it generates more realistic sample data
 */
export async function generateRealData() {
  // In a real implementation, this would:
  // 1. Connect to external ERP systems
  // 2. Pull data from CSV files
  // 3. Call external APIs
  
  const data = {
    kunder: generateRealisticCustomers(),
    firmaer: generateRealisticFirms(),
    lager: [] as any[], // Will be generated based on firmaer
    valutaer: [
      { valutaid: 'NOK' },
      { valutaid: 'EUR' },
      { valutaid: 'USD' },
      { valutaid: 'SEK' },
      { valutaid: 'DKK' },
      { valutaid: 'GBP' },
    ],
    varer: generateRealisticProducts(),
    ordrer: [] as any[], // Will be generated
  };

  // Generate lager based on firmaer
  data.lager = data.firmaer.flatMap(f => [
    { lagernavn: `${f.firmanavn} Hovedlager`, firmaid: f.firmaid },
    { lagernavn: `${f.firmanavn} Reservelager`, firmaid: f.firmaid },
  ]);

  // Generate realistic orders
  data.ordrer = generateRealisticOrders(data.kunder, data.firmaer, data.lager, data.varer);

  generatedRealData = data;
  
  return {
    kunder: data.kunder.length,
    firmaer: data.firmaer.length,
    lager: data.lager.length,
    valutaer: data.valutaer.length,
    varer: data.varer.length,
    ordrer: data.ordrer.length,
  };
}

function generateRealisticCustomers() {
  const customers = [];
  const prefixes = ['AS', 'ASA', 'ANS', 'DA', 'ENK'];
  const industries = ['Tech', 'Industri', 'Handel', 'Produksjon', 'Konsulting', 'Logistikk'];
  const cities = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tromsø', 'Drammen', 'Fredrikstad'];

  for (let i = 1; i <= 25; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    
    customers.push({
      kundenr: `K${String(i).padStart(3, '0')}`,
      kundenavn: `${city} ${industry} ${prefix}`,
    });
  }
  
  return customers;
}

function generateRealisticFirms() {
  return [
    { firmaid: 1, firmanavn: 'Hovedkontor Oslo' },
    { firmaid: 2, firmanavn: 'Region Vest' },
    { firmaid: 3, firmanavn: 'Region Sør' },
    { firmaid: 4, firmanavn: 'Region Midt' },
    { firmaid: 5, firmanavn: 'Region Nord' },
  ];
}

function generateRealisticProducts() {
  const varegrupper = ['Elektronikk', 'Møbler', 'Verktøy', 'Kontor', 'IT-Utstyr', 'Sikkerhet'];
  const products = [];
  let counter = 1;

  const productTemplates: Record<string, string[]> = {
    'Elektronikk': ['Laptop', 'Desktop', 'Monitor', 'Tastatur', 'Mus', 'Headset', 'Webkamera'],
    'Møbler': ['Kontorstol', 'Skrivebord', 'Bokhylle', 'Arkivskap', 'Møtebord', 'Resepsjonsdisk'],
    'Verktøy': ['Drill', 'Skrutrekker', 'Hammer', 'Sag', 'Målebånd', 'Avbitertang'],
    'Kontor': ['Notisblokk', 'Penn', 'Papir A4', 'Mapper', 'Stiftemaskin', 'Hullemaskin'],
    'IT-Utstyr': ['Server', 'Switch', 'Router', 'UPS', 'Rack', 'Kabler'],
    'Sikkerhet': ['Kamera', 'Alarm', 'Brannslukker', 'Førstehjelpsskrin', 'Sikkerhetslås'],
  };

  for (const [gruppe, produkter] of Object.entries(productTemplates)) {
    for (const produkt of produkter) {
      products.push({
        varekode: `V${String(counter++).padStart(3, '0')}`,
        varenavn: produkt,
        varegruppe: gruppe,
      });
    }
  }

  return products;
}

function generateRealisticOrders(kunder: any[], firmaer: any[], lager: any[], varer: any[]) {
  const orders = [];
  const valutaer = ['NOK', 'NOK', 'NOK', 'NOK', 'EUR', 'USD']; // NOK more common

  // Generate 50 orders spread across the year
  for (let i = 1; i <= 50; i++) {
    const ordrenr = 2000 + i;
    const kunde = kunder[Math.floor(Math.random() * kunder.length)];
    const firma = firmaer[Math.floor(Math.random() * firmaer.length)];
    const firmaLager = lager.filter(l => l.firmaid === firma.firmaid);
    const lagerItem = firmaLager[Math.floor(Math.random() * firmaLager.length)];

    // Generate 1-6 lines per order
    const numLines = Math.floor(Math.random() * 6) + 1;
    const lines = [];
    let orderSum = 0;

    for (let j = 1; j <= numLines; j++) {
      const vare = varer[Math.floor(Math.random() * varer.length)];
      const antall = Math.floor(Math.random() * 20) + 1;
      const nettpris = Math.floor(Math.random() * 10000) + 100;
      const linjesum = antall * nettpris;
      orderSum += linjesum;

      lines.push({
        linjenr: j,
        ordrenr,
        varekode: vare.varekode,
        antall,
        enhet: 'stk',
        nettpris,
        linjesum,
        linjestatus: Math.random() > 0.1 ? 1 : 0, // 90% active
      });
    }

    // Random date in 2024
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    orders.push({
      ordrenr,
      dato,
      kundenr: kunde.kundenr,
      kundeordreref: `PO-${ordrenr}-${kunde.kundenr}`,
      kunderef: `Innkjøper ${Math.floor(Math.random() * 10) + 1}`,
      firmaid: firma.firmaid,
      lagernavn: lagerItem.lagernavn,
      valutaid: valutaer[Math.floor(Math.random() * valutaer.length)],
      sum: orderSum,
      lines,
    });
  }

  return orders;
}

/**
 * Inserts generated real data into database
 */
export async function insertRealData() {
  if (!generatedRealData) {
    await generateRealData();
  }

  const data = generatedRealData;
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

  return results;
}

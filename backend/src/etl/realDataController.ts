import { query } from '../db/index.js';

// In-memory storage for generated real data
let generatedRealData: any = null;

/**
 * Generates realistic data modeled after TESS industrial supply
 * Products include hoses, couplings, hydraulics, fittings, and seals
 */
export async function generateRealData() {
  const data = {
    kunder: generateRealisticCustomers(),
    firmaer: generateRealisticFirms(),
    lager: [] as any[],
    valutaer: [
      { valutaid: 'NOK' },
      { valutaid: 'EUR' },
      { valutaid: 'USD' },
      { valutaid: 'SEK' },
      { valutaid: 'DKK' },
      { valutaid: 'GBP' },
    ],
    varer: generateRealisticProducts(),
    ordrer: [] as any[],
    ordre_henvisninger: [] as any[],
  };

  // Generate lager based on firmaer
  data.lager = data.firmaer.flatMap(f => [
    { lagernavn: `${f.firmanavn} Hovedlager`, firmaid: f.firmaid },
    { lagernavn: `${f.firmanavn} Reservelager`, firmaid: f.firmaid },
  ]);

  // Generate realistic orders with references
  const ordrerOgHenvisninger = generateRealisticOrders(data.kunder, data.firmaer, data.lager, data.varer);
  data.ordrer = ordrerOgHenvisninger.ordrer;
  data.ordre_henvisninger = ordrerOgHenvisninger.henvisninger;

  generatedRealData = data;
  
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

function generateRealisticCustomers() {
  // Named industrial customers typical for TESS's market
  const namedCustomers = [
    { kundenr: 'K001', kundenavn: 'Equinor ASA' },
    { kundenr: 'K002', kundenavn: 'Aker Solutions AS' },
    { kundenr: 'K003', kundenavn: 'Hydro Aluminium AS' },
    { kundenr: 'K004', kundenavn: 'Kongsberg Maritime AS' },
    { kundenr: 'K005', kundenavn: 'Kvaerner AS' },
    { kundenr: 'K006', kundenavn: 'Subsea 7 Norway AS' },
    { kundenr: 'K007', kundenavn: 'Yara International ASA' },
    { kundenr: 'K008', kundenavn: 'Elkem ASA' },
    { kundenr: 'K009', kundenavn: 'Borregaard AS' },
    { kundenr: 'K010', kundenavn: 'Aibel AS' },
    { kundenr: 'K011', kundenavn: 'Veidekke Industri AS' },
    { kundenr: 'K012', kundenavn: 'AF Gruppen ASA' },
    { kundenr: 'K013', kundenavn: 'Multiconsult ASA' },
    { kundenr: 'K014', kundenavn: 'Havyard Group AS' },
    { kundenr: 'K015', kundenavn: 'Framo AS' },
  ];

  // Generate additional customers with industry-relevant names
  const sectors = ['Marin', 'Olje og Gass', 'Prosessindustri', 'Bygg og Anlegg', 'Havbruk', 'Bergverk'];
  const cities = ['Oslo', 'Bergen', 'Stavanger', 'Trondheim', 'Kristiansand', 'Haugesund', 'Ålesund', 'Hammerfest', 'Bodø', 'Sandnes'];

  for (let i = namedCustomers.length + 1; i <= 25; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    namedCustomers.push({
      kundenr: `K${String(i).padStart(3, '0')}`,
      kundenavn: `${city} ${sector} AS`,
    });
  }

  return namedCustomers;
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
  const products = [];
  let counter = 1;

  // TESS-relevant product categories
  const productTemplates: Record<string, { navn: string; pris: number }[]> = {
    'Slanger': [
      { navn: 'Hydraulikkslange 2-lag 1/2"', pris: 850 },
      { navn: 'Hydraulikkslange 2-lag 3/4"', pris: 1100 },
      { navn: 'Hydraulikkslange 4-lag 1"', pris: 2200 },
      { navn: 'Trykkslange R2AT 3/8"', pris: 650 },
      { navn: 'Trykkslange R2AT 1/2"', pris: 780 },
      { navn: 'Industrislange EPDM DN25', pris: 420 },
      { navn: 'Industrislange EPDM DN50', pris: 780 },
      { navn: 'Industrislange EPDM DN75', pris: 1250 },
      { navn: 'Sugeslange PVC DN50', pris: 380 },
      { navn: 'Sugeslange PVC DN75', pris: 560 },
      { navn: 'Kjemikalieslange PTFE DN25', pris: 1800 },
      { navn: 'Dampslange DN25 18bar', pris: 2400 },
      { navn: 'Matvareslange FDA DN38', pris: 950 },
      { navn: 'Trykkluftslange 13mm 20bar', pris: 320 },
      { navn: 'Sandblåseslange DN32', pris: 680 },
      { navn: 'Slangetrommel 20m 3/8"', pris: 4500 },
      { navn: 'Slangetrommel 15m 1/2"', pris: 5200 },
    ],
    'Kuplinger': [
      { navn: 'Hurtigkobling Tema 2600 1/2"', pris: 350 },
      { navn: 'Hurtigkobling Tema 2600 3/4"', pris: 480 },
      { navn: 'Hurtigkobling Tema 2600 1"', pris: 650 },
      { navn: 'Kamlock-kobling 2" Aluminium', pris: 280 },
      { navn: 'Kamlock-kobling 3" Rustfritt', pris: 850 },
      { navn: 'Storz-kobling B75', pris: 420 },
      { navn: 'Storz-kobling C52', pris: 320 },
      { navn: 'Perrot-kobling 4" Galvanisert', pris: 560 },
      { navn: 'Guildline-kobling 2" Messing', pris: 380 },
    ],
    'Fittings': [
      { navn: 'Flens SAE 3000 1/2"', pris: 280 },
      { navn: 'Flens SAE 3000 3/4"', pris: 350 },
      { navn: 'Flens SAE 6000 1"', pris: 650 },
      { navn: 'Nippel JIC 3/4"', pris: 85 },
      { navn: 'Nippel JIC 1/2"', pris: 65 },
      { navn: 'Nippel BSP 1/2"', pris: 55 },
      { navn: 'T-stykke 3/4" BSP', pris: 120 },
      { navn: 'Vinkelkobling 90° 1/2"', pris: 95 },
      { navn: 'Reduksjon 3/4" til 1/2"', pris: 45 },
      { navn: 'Skotkobling 1/2" BSP', pris: 180 },
    ],
    'Hydraulikk': [
      { navn: 'Hydraulikksylinder 50/30-300', pris: 8500 },
      { navn: 'Hydraulikksylinder 63/40-500', pris: 12000 },
      { navn: 'Hydraulikkpumpe 28cc', pris: 6500 },
      { navn: 'Hydraulikkpumpe 40cc', pris: 8200 },
      { navn: 'Ventilblokk 4/3 Cetop 5', pris: 3800 },
      { navn: 'Retningsventil 4/3 24VDC', pris: 2200 },
      { navn: 'Trykkbegrensningsventil 350bar', pris: 950 },
      { navn: 'Hydraulikkfilter 10 mikron', pris: 280 },
      { navn: 'Hydraulikkolje HLP 46 20L', pris: 850 },
      { navn: 'Hydraulikkaggregat 5.5kW', pris: 28000 },
    ],
    'Tetninger': [
      { navn: 'O-ring Viton 25x3', pris: 35 },
      { navn: 'O-ring Viton 50x4', pris: 55 },
      { navn: 'O-ring NBR 20x2.5', pris: 12 },
      { navn: 'Pakningssett Hydraulikksylinder', pris: 450 },
      { navn: 'V-ring 40mm', pris: 65 },
      { navn: 'V-ring 60mm', pris: 85 },
      { navn: 'Stempelpakn. Turcon 50mm', pris: 280 },
      { navn: 'Stangpakn. Zurcon 30mm', pris: 320 },
      { navn: 'Flatpakning PTFE DN50', pris: 45 },
    ],
    'Verktøy': [
      { navn: 'Slangepress Uniflex P20', pris: 45000 },
      { navn: 'Krympeverktøy manuell', pris: 8500 },
      { navn: 'Momentnøkkel 3/4" 100-500Nm', pris: 2800 },
      { navn: 'Rørkutter 6-42mm', pris: 950 },
      { navn: 'Bøyefjær sett 6-22mm', pris: 680 },
      { navn: 'Slangekutter hydraulisk', pris: 12000 },
      { navn: 'Renseverkøy for slanger', pris: 350 },
    ],
  };

  for (const [gruppe, produkter] of Object.entries(productTemplates)) {
    for (const produkt of produkter) {
      products.push({
        varekode: `V${String(counter++).padStart(3, '0')}`,
        varenavn: produkt.navn,
        varegruppe: gruppe,
        pris: produkt.pris,
      });
    }
  }

  return products;
}

function generateRealisticOrders(kunder: any[], firmaer: any[], lager: any[], varer: any[]) {
  const orders = [];
  const henvisninger: any[] = [];
  const valutaer = ['NOK', 'NOK', 'NOK', 'NOK', 'EUR', 'USD']; // NOK more common
  const years = [2024, 2025, 2026];

  // Reference data for ordre_henvisning
  const prosjekter = [
    'Prosjekt Nordsjøen', 'Vedlikehold Mongstad', 'Johan Sverdrup Fase 2',
    'Kårstø Oppgradering', 'Snøhvit LNG', 'Martin Linge Modifikasjon',
    'Troll A Vedlikehold', 'Hammerfest LNG', 'Oseberg Sør',
    'Gullfaks Subsea', 'Åsgard B Turnaround', 'Valemon Drift',
  ];
  const avdelinger = ['Innkjøp', 'Vedlikehold', 'Drift', 'Prosjekt', 'Lager', 'HMS', 'Mekanisk Verksted'];
  const kontaktpersoner = [
    'Ole Hansen', 'Kari Nordmann', 'Per Olsen', 'Anne Kristiansen',
    'Eirik Berg', 'Silje Strand', 'Lars Johansen', 'Mette Dahl',
    'Thomas Lie', 'Ingrid Haugen',
  ];

  // Generate 50 orders spread across 2024-2026
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
      const nettpris = vare.pris || (Math.floor(Math.random() * 10000) + 100);
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

      // Generate ordre_henvisning for each line (~75% chance)
      if (Math.random() > 0.25) {
        const prosjekt = prosjekter[Math.floor(Math.random() * prosjekter.length)];
        const avdeling = avdelinger[Math.floor(Math.random() * avdelinger.length)];
        henvisninger.push({
          ordrenr,
          linjenr: j,
          henvisning1: prosjekt,
          henvisning2: `${avdeling}-${kunde.kundenr}`,
          henvisning3: `WO-${Math.floor(Math.random() * 90000) + 10000}`,
          henvisning4: Math.random() > 0.4 ? `TAG-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 999) + 1}` : null,
          henvisning5: Math.random() > 0.6 ? `Kostnadssted ${Math.floor(Math.random() * 9000) + 1000}` : null,
        });
      }
    }

    // Random date across 2024-2026
    const year = years[Math.floor(Math.random() * years.length)];
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const kontakt = kontaktpersoner[Math.floor(Math.random() * kontaktpersoner.length)];

    orders.push({
      ordrenr,
      dato,
      kundenr: kunde.kundenr,
      kundeordreref: `PO-${year}-${String(ordrenr).padStart(5, '0')}`,
      kunderef: kontakt,
      firmaid: firma.firmaid,
      lagernavn: lagerItem.lagernavn,
      valutaid: valutaer[Math.floor(Math.random() * valutaer.length)],
      sum: orderSum,
      lines,
    });
  }

  return { ordrer: orders, henvisninger };
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

  return results;
}

import { query } from '../db/index.js';
import {
  generateRealisticCustomers,
  generateRealisticFirms,
  generateRealisticProducts,
  generateRealisticOrders,
} from './realData/generators.js';

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

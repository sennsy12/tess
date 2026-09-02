import { query } from '../../db/index.js';
import { KundeRow, BrukerRow, VareRow } from './rows.js';

// Pre-calculated hash for 'kunde123' to save CPU time during generation
const KUNDE_PASSWORD_HASH = '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W';

// Realistisk prisspenn per varegruppe (eks. mva) brukt som basispris i demodato.
const GROUP_PRICE_RANGE: Record<string, [min: number, max: number]> = {
  Slanger: [320, 2400],
  Kuplinger: [250, 900],
  Fittings: [45, 650],
  Hydraulikk: [1500, 12000],
  Tetninger: [15, 120],
  'Verktøy': [350, 9500],
};

/** Deterministisk basispris per varegruppe — samme pris ved hver generering. */
function priceForGroup(gruppe: string, n: number): number {
  const [min, max] = GROUP_PRICE_RANGE[gruppe] ?? [100, 1000];
  return min + ((n * 137) % (max - min + 1));
}

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
        priceForGroup(template.gruppe, vareTeller),
      ]);
      vareTeller++;
    }
    if (vareTeller > 500) break;
  }
  while (vareTeller <= 500) {
    const restGrupper = ['Slanger', 'Kuplinger', 'Fittings', 'Hydraulikk', 'Tetninger', 'Verktøy'];
    const gruppe = restGrupper[vareTeller % restGrupper.length];
    vareData.push([`V${String(vareTeller).padStart(5, '0')}`, `Industriprodukt ${vareTeller}`, gruppe, priceForGroup(gruppe, vareTeller)]);
    vareTeller++;
  }
  return { kundeData, brukerData, vareData };
}

/**
 * Ensure all dimension/seed data exists (firma, valuta, lager, kunde, users, vare).
 * Uses ON CONFLICT DO NOTHING so it is safe to call repeatedly.
 */
export async function ensureDimensionData(customers: number): Promise<{ brukere: number }> {
  const { kundeData, brukerData, vareData } = getDimensionData(customers);
  const { bulkCopy } = await import('../../db/index.js');

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
  await bulkCopy('vare', ['varekode', 'varenavn', 'varegruppe', 'base_price'], vareData);

  // Backfill: varer som allerede fantes med 0 får generert basispris.
  // Rører ikke priser en admin allerede har satt (kun 0/NULL).
  await query(
    `UPDATE vare AS v SET base_price = c.base_price
     FROM UNNEST($1::text[], $2::numeric[]) AS c(varekode, base_price)
     WHERE v.varekode = c.varekode AND (v.base_price IS NULL OR v.base_price = 0)`,
    [vareData.map((v) => v[0]), vareData.map((v) => v[3])]
  );

  return { brukere };
}

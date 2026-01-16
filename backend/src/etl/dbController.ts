import { query } from '../db/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Creates database tables based on schema
 */
export async function createDB() {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      username text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL CHECK (role IN ('admin', 'kunde', 'analyse')),
      kundenr text,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS public.kunde (
      kundenr text PRIMARY KEY,
      kundenavn text
    )`,
    `CREATE TABLE IF NOT EXISTS public.firma (
      firmaid integer PRIMARY KEY,
      firmanavn text
    )`,
    `CREATE TABLE IF NOT EXISTS public.lager (
      lagernavn text,
      firmaid integer,
      PRIMARY KEY (lagernavn, firmaid),
      FOREIGN KEY (firmaid) REFERENCES public.firma(firmaid)
    )`,
    `CREATE TABLE IF NOT EXISTS public.valuta (
      valutaid text PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS public.vare (
      varekode text PRIMARY KEY,
      varenavn text,
      varegruppe text
    )`,
    `CREATE TABLE IF NOT EXISTS public.ordre (
      ordrenr integer PRIMARY KEY,
      dato date,
      kundenr text,
      kundeordreref text,
      kunderef text,
      firmaid integer,
      lagernavn text,
      valutaid text,
      sum double precision,
      FOREIGN KEY (kundenr) REFERENCES public.kunde(kundenr),
      FOREIGN KEY (firmaid) REFERENCES public.firma(firmaid),
      FOREIGN KEY (lagernavn, firmaid) REFERENCES public.lager(lagernavn, firmaid),
      FOREIGN KEY (valutaid) REFERENCES public.valuta(valutaid)
    )`,
    `CREATE TABLE IF NOT EXISTS public.ordrelinje (
      linjenr integer,
      ordrenr integer,
      varekode text,
      antall real,
      enhet text,
      nettpris double precision,
      linjesum double precision,
      linjestatus integer,
      PRIMARY KEY (linjenr, ordrenr),
      FOREIGN KEY (ordrenr) REFERENCES public.ordre(ordrenr),
      FOREIGN KEY (varekode) REFERENCES public.vare(varekode)
    )`,
    `CREATE TABLE IF NOT EXISTS public.ordre_henvisning (
      ordrenr integer,
      linjenr integer,
      henvisning1 text,
      henvisning2 text,
      henvisning3 text,
      henvisning4 text,
      henvisning5 text,
      PRIMARY KEY (ordrenr, linjenr),
      FOREIGN KEY (ordrenr, linjenr) REFERENCES public.ordrelinje(ordrenr, linjenr)
    )`,
  ];

  const results = [];
  for (const stmt of createStatements) {
    await query(stmt);
    results.push('Created table');
  }

  return { tablesCreated: results.length };
}

/**
 * Truncates all data from database tables
 */
export async function truncateDB() {
  // Disable foreign key checks temporarily by using CASCADE
  const truncateStatements = [
    'TRUNCATE TABLE public.ordre_henvisning CASCADE',
    'TRUNCATE TABLE public.ordrelinje CASCADE',
    'TRUNCATE TABLE public.ordre CASCADE',
    'TRUNCATE TABLE public.lager CASCADE',
    'TRUNCATE TABLE public.firma CASCADE',
    'TRUNCATE TABLE public.vare CASCADE',
    'TRUNCATE TABLE public.valuta CASCADE',
    'TRUNCATE TABLE public.kunde CASCADE',
    // Note: we don't truncate users to keep login credentials
  ];

  const results = [];
  for (const stmt of truncateStatements) {
    try {
      await query(stmt);
      results.push({ statement: stmt, success: true });
    } catch (error: any) {
      results.push({ statement: stmt, success: false, error: error.message });
    }
  }

  return { tablesTruncated: results.filter(r => r.success).length, details: results };
}

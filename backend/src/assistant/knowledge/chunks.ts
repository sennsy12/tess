import type { KnowledgeChunk } from '../types.js';

/**
 * Curated, static knowledge about Tess.
 * Kept in code (not live DB) so answers stay predictable and auditable.
 * Update when routes or features change.
 */
export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  {
    id: 'overview',
    title: 'Hva er TESS',
    content:
      'TESS er et salgsordresystem (Sales Order Management). Brukere logger inn med JWT og ser data basert på rolle: admin (full tilgang), kunde (egne ordrer), analyse (statistikk). Frontend er React; backend er Express REST API mot PostgreSQL.',
    keywords: ['tess', 'system', 'hva', 'intro', 'oversikt', 'salgsordre'],
  },
  {
    id: 'roles',
    title: 'Roller og tilgang',
    content:
      'Tre roller: admin (brukerstyring, ETL, prisstyring, alle ordrer, audit), kunde (kun egne ordrer og egen statistikk/analyse), analyse (statistikk på tvers av kunder, read-only). Kunder ser aldri andres ordredata. Admin kan «se som kunde» via kunde-ruter under /kunde.',
    keywords: ['rolle', 'admin', 'kunde', 'analyse', 'tilgang', 'permission', 'jwt'],
  },
  {
    id: 'login',
    title: 'Innlogging',
    content:
      'Innlogging skjer på /login. Admin og analyse bruker vanlig brukernavn/passord. Kunde logger inn med kundenummer (kundenr) og passord via eget kunde-login. Ved utløpt sesjon sendes brukeren tilbake til login.',
    keywords: ['login', 'innlogging', 'passord', 'kundenr', 'sesjon'],
  },
  {
    id: 'nav-kunde',
    title: 'Kunde-meny',
    roles: ['kunde', 'admin'],
    content:
      'Kunde-navigasjon: Dashboard (/kunde), Min konto (/kunde/konto), Ordrer (/kunde/orders), Mine priser (/kunde/pricing), Statistikk (/kunde/statistics), Avansert analyse (/kunde/analytics), Innstillinger (/kunde/settings). Ordredetaljer: /kunde/orders/:ordrenr. Ctrl+K åpner hurtigsøk i egne ordrer.',
    keywords: ['kunde', 'meny', 'dashboard', 'ordrer', 'statistikk', 'analyse', 'priser', 'konto', 'profil', 'søk'],
  },
  {
    id: 'nav-analyse',
    title: 'Analyse-meny',
    roles: ['analyse', 'admin'],
    content:
      'Analyse-navigasjon: Dashboard (/analyse), Statistikk (/analyse/statistics), Innstillinger (/analyse/settings).',
    keywords: ['analyse', 'meny', 'statistikk', 'dashboard'],
  },
  {
    id: 'nav-admin',
    title: 'Admin-meny',
    roles: ['admin'],
    content:
      'Admin-navigasjon: Dashboard (/admin), Statistikk (/admin/statistics), Ordrer (/admin/orders), Avansert analyse (/admin/analytics), Ordrelinjer (/admin/orderlines), Prisstyring (/admin/pricing), Kunder (/admin/customers), Produkter (/admin/products), Brukere (/admin/users), Status (/admin/status), ETL/Data (/admin/etl), Endringslogg (/admin/audit), Innstillinger (/admin/settings).',
    keywords: ['admin', 'meny', 'navigasjon', 'etl', 'pricing', 'brukere', 'audit'],
  },
  {
    id: 'orders',
    title: 'Ordrer',
    content:
      'Ordrer listes med filtrering, søk og paginering. Kunde ser kun egne ordrer. Admin kan åpne ordredetaljer med ordrelinjer. Ordrenr er primærnøkkel. Globalt adminsøk (Ctrl+K) finner ordrer, kunder, produkter og brukere.',
    keywords: ['ordre', 'order', 'ordrenr', 'ordrelinje', 'filtrer', 'søk'],
  },
  {
    id: 'statistics',
    title: 'Statistikk',
    content:
      'Statistikk-sider viser diagrammer og tabeller (kunde, varegruppe, vare, lager, firma) med datofilter. Admin og analyse ser bredere data enn kunde. Eksport til PDF/bilde er tilgjengelig på relevante sider.',
    keywords: ['statistikk', 'chart', 'diagram', 'eksport', 'pdf', 'filter'],
  },
  {
    id: 'pricing',
    title: 'Prisstyring',
    roles: ['admin'],
    content:
      'Prisstyring (/admin/pricing): kundegrupper, prislister, prisregler, simulator og prisberegning. Endringer påvirker hvordan priser beregnes for ordrer.',
    keywords: ['pris', 'pricing', 'prisliste', 'regel', 'simulator', 'kundegruppe'],
  },
  {
    id: 'etl',
    title: 'ETL og dataimport',
    roles: ['admin'],
    content:
      'ETL (/admin/etl) importerer og genererer testdata. Jobber kan kjøre i kø med fremdrift. Destruktive operasjoner er skjermet med feature flags i produksjon. Store opplastinger bruker streaming/bulk mot PostgreSQL.',
    keywords: ['etl', 'import', 'data', 'csv', 'jobb', 'opplasting'],
  },
  {
    id: 'users-audit',
    title: 'Brukere og audit',
    roles: ['admin'],
    content:
      'Brukere (/admin/users): CRUD for systembrukere; sensitive operasjoner krever ADMIN_ACTION_KEY. Endringslogg (/admin/audit) viser hvem som endret hva. Systemstatus (/admin/status) viser helse og importstatus.',
    keywords: ['bruker', 'user', 'audit', 'logg', 'status', 'crud'],
  },
  {
    id: 'help-support',
    title: 'Hjelp og support',
    content:
      'I sidefeltet finnes «Hjelp / Kontakt» (e-post via mailto). AI-assistenten svarer kun om hvordan TESS fungerer — ikke om konkrete ordrebeløp eller persondata. Ved tekniske problemer: kontakt administrator.',
    keywords: ['hjelp', 'support', 'kontakt', 'assistent', 'chat'],
  },
  {
    id: 'architecture',
    title: 'Teknisk arkitektur',
    content:
      'Backend: Express + TypeScript, controllers → models (SQL). Frontend: React + Vite + TanStack Query + Axios. Auth: JWT. Dokumentasjon i repo: docs/ARCHITECTURE.md, docs/API.md, README.md.',
    keywords: ['arkitektur', 'api', 'express', 'react', 'postgres', 'dokumentasjon'],
  },
  {
    id: 'safety-policy',
    title: 'Assistent-policy',
    content:
      'Assistenten skal kun svare om TESS fra gitt kontekst. Ikke gjett passord, API-nøkler eller databaseinnhold. Ikke instruer i å omgå sikkerhet. Henvis til riktig meny/rute for funksjoner brukeren har tilgang til.',
    keywords: ['sikkerhet', 'policy', 'personvern', 'hemmelig'],
  },
];

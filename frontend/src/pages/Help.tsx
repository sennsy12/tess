import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  ClipboardList,
  BarChart3,
  CircleDollarSign,
  Database,
  Activity,
  Search,
  Download,
  Bell,
  ShoppingCart,
  Users,
  ChevronDown,
  Mail,
  Languages,
  Sparkles,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/useAuth';
import { supportEmail, supportMailto } from '../lib/appConfig';

type HelpLang = 'no' | 'en';
type RoleFilter = 'alle' | 'kunde' | 'analyse' | 'admin';

const LANG_STORAGE_KEY = 'tess-help-lang';

interface Faq {
  q: { no: string; en: string };
  a: { no: string; en: string };
}

interface GlossaryTerm {
  term: string;
  no: string;
  en: string;
}

interface HelpSection {
  id: string;
  roles: Array<'kunde' | 'analyse' | 'admin'>;
  icon: typeof BookOpen;
  title: { no: string; en: string };
  intro: { no: string; en: string };
  bullets: { no: string[]; en: string[] };
}

const SECTIONS: HelpSection[] = [
  {
    id: 'kom-i-gang',
    roles: ['kunde', 'analyse', 'admin'],
    icon: Sparkles,
    title: { no: 'Kom i gang', en: 'Getting started' },
    intro: {
      no: 'Slik logger du inn og finner fram. Alt er på norsk som standard — bytt til engelsk med språkknappen øverst.',
      en: 'How to sign in and find your way around. Norwegian is the default — switch to English with the language button above.',
    },
    bullets: {
      no: [
        'Administrator og analyse logger inn med brukernavn + passord. Kunder logger inn med kundenr + passord (f.eks. K001).',
        'Etter innlogging sendes du automatisk til riktig dashboard for din rolle.',
        'Trykk Ctrl+K (kunde/admin) for globalt søk etter ordre, kunde og produkt.',
        'Passord byttes under Innstillinger. Ved passordbytte logges alle dine andre sesjoner ut av sikkerhetshensyn.',
        'Blir du logget ut av seg selv, har idle-timeren slått inn (30 min i produksjon). Alt ulagret filterarbeid bør lagres som visning først.',
      ],
      en: [
        'Admins and analysts sign in with username + password. Customers sign in with customer number + password (e.g. K001).',
        'After sign-in you are redirected to the correct dashboard for your role.',
        'Press Ctrl+K (customer/admin) for global search across orders, customers and products.',
        'Change your password under Settings. Changing it signs out all your other sessions for security.',
        'If you are signed out automatically, the idle timer fired (30 min in production). Save filter work as a view first.',
      ],
    },
  },
  {
    id: 'kunde-guide',
    roles: ['kunde'],
    icon: ClipboardList,
    title: { no: 'Kunde: ordrer og bestilling', en: 'Customer: orders and ordering' },
    intro: {
      no: 'Du ser kun dine egne ordrer. Slik søker, åpner og bestiller du.',
      en: 'You only see your own orders. How to search, open and order.',
    },
    bullets: {
      no: [
        'Ordrer → Fritekst søker i kundenr, kundenavn, henvisninger og referanser (min 3 tegn). Eget felt for ordrenr gir eksakt treff.',
        'Filtrer på fra/til-dato og ordrestatus. Lagre kombinasjoner som visninger for gjenbruk.',
        'Klikk en rad for ordredetalj: tidslinje, linjer med henvisning 1–5, PDF/CSV-nedlasting og «Bestill igjen».',
        'Ny bestilling → søk vare (kode/navn) + varegruppe, legg i handlekurv (maks 200 linjer) til din kundepris og bekreft. Innsending er idempotent — dobbeltklikk lager ikke duplikat.',
        'Mine priser viser avtalte fastpriser og rabatter for din konto. Min konto viser firma, kundegruppe, valuta, lager og firma.',
        'Kansellering er mulig mens ordren er Til godkjenning eller Godkjent. Etter at behandling har startet, kontakt administrator.',
      ],
      en: [
        'Orders → Free text searches customer number, name, references (min 3 chars). The order-number field gives exact hits.',
        'Filter by from/to date and order status. Save combinations as views for reuse.',
        'Click a row for order detail: timeline, lines with references 1–5, PDF/CSV download and “Order again”.',
        'New order → search product (code/name) + group, fill the cart (max 200 lines) at your customer price and confirm. Submission is idempotent — double-clicks never duplicate.',
        'My prices shows agreed fixed prices and discounts. My account shows company, group, currency, warehouse and company.',
        'Cancellation is possible while Pending approval or Approved. Once processing started, contact an admin.',
      ],
    },
  },
  {
    id: 'analyse-guide',
    roles: ['analyse'],
    icon: BarChart3,
    title: { no: 'Analyse: statistikk', en: 'Analysis: statistics' },
    intro: {
      no: 'Lesetilgang til all statistikk. Velg dimensjon, tidsrom og eksportformat.',
      en: 'Read access to all statistics. Pick a dimension, time range and export format.',
    },
    bullets: {
      no: [
        'Dimensjoner: lager, firma, kunde, vare og varegruppe (varegruppe er MVP-kjernen).',
        'Tidsrom: hurtigvalg 7/30/90 dager eller i år, eller egendefinert fra/til. KPI-stripen sammenligner mot forrige periode.',
        'Klikk en tabellrad for drill-down: varegruppe → vare, kunde → vare.',
        'Eksporter grafer som PDF/PNG (Eksporter-knappen) og tabeller som CSV (alle rader, ikke kun synlig side).',
        'Avansert analyse lar deg kombinere mål (sum/antall/mengde) med dimensjon (dag/måned/år/produkt/kategori) og graftype.',
        'Du har ikke tilgang til bestilling, prisstyring, ETL eller brukeradmin — det er tilsiktet.',
      ],
      en: [
        'Dimensions: warehouse, company, customer, product and product group (group is the MVP core).',
        'Time range: presets 7/30/90 days or year-to-date, or custom from/to. The KPI strip compares to the previous period.',
        'Click a table row to drill down: group → product, customer → product.',
        'Export charts as PDF/PNG (Export button) and tables as CSV (all rows, not just the visible page).',
        'Advanced analysis combines a measure (sum/count/quantity) with a dimension (day/month/year/product/category) and chart type.',
        'You have no access to ordering, pricing, ETL or user admin — by design.',
      ],
    },
  },
  {
    id: 'admin-guide',
    roles: ['admin'],
    icon: Users,
    title: { no: 'Admin: drift og forvaltning', en: 'Admin: operations and management' },
    intro: {
      no: 'Full tilgang. Godkjenn kø, vedlikehold linjer og priser, kjør datajobber og spor alt.',
      en: 'Full access. Approve the queue, maintain lines and prices, run data jobs and track everything.',
    },
    bullets: {
      no: [
        'Ordrekø: faner for Til godkjenning/Ny/Godkjent/Under behandling. Bulk-velg er mulig; ulovlige overganger blokkeres og avvisning krever kommentar.',
        'Ordrelinjer: velg blant 100 siste ordrer, legg til/endre/slett linje (varekode, antall, enhet, nettpris, linjestatus). Ordresum rekalkuleres automatisk. Henvisning 1–5 redigeres per linje.',
        'Prisstyring i 4 steg: kundegrupper → prislister (prioritet + periode) → prisregler (fastpris/rabatt per vare, varegruppe eller alle) → tildeling av kunde til gruppe. Bruk konflikt-sjekk før lagring og simulator for hva-hvis.',
        'Produkter: søk på kode/navn, filtrer på gruppe, rediger base-pris inline (rabatter regnes fra denne). Kunder: søk, gruppefilter og ordre-modal per kunde.',
        'Brukere: opprett/rediger/slett (brukernavn, passord, rolle, kundenr). Endringslogg viser hvem som gjorde hva, med diff og CSV-eksport.',
        'Status og ETL/Data: se system, import, uttrekk, ferskhet, API-metrikk og jobber med sanntidsprogresjon. Destruktive handlinger er blokkert i produksjon uten eksplisitt flagg.',
      ],
      en: [
        'Approval queue: tabs for Pending/New/Approved/Processing. Bulk select works; illegal transitions are blocked and rejection needs a comment.',
        'Order lines: pick from the 100 latest orders, add/edit/delete lines (code, quantity, unit, net price, line status). Order totals recalculate automatically. References 1–5 are edited per line.',
        'Pricing in 4 steps: customer groups → price lists (priority + period) → rules (fixed/discount per product, group or all) → assign customer to group. Use conflict check before saving and the simulator for what-if.',
        'Products: search code/name, filter by group, edit base price inline (discounts derive from it). Customers: search, group filter and per-customer order modal.',
        'Users: create/edit/delete (username, password, role, customer number). The audit log shows who did what, with diffs and CSV export.',
        'Status and ETL/Data: system, import, extraction, freshness, API metrics and jobs with live progress. Destructive actions are blocked in production without an explicit flag.',
      ],
    },
  },
  {
    id: 'sok-sort',
    roles: ['kunde', 'admin'],
    icon: Search,
    title: { no: 'Søk og sortering i ordretabellen', en: 'Search and sorting in the order table' },
    intro: {
      no: 'Slik treffer du riktig ordre — og én kjent begrensning du bør vite om.',
      en: 'How to hit the right order — plus one known limitation to be aware of.',
    },
    bullets: {
      no: [
        'Ordrenr-feltet gir eksakt treff og deep-link. Fritekst treffer kundenr, kundenavn, kundeordreref, kunderef og henvisning 1–5.',
        'Kombiner med fra/til-dato og status. Aktive filtre vises som chips som kan fjernes enkeltvis.',
        'Klikk kolonneoverskrift for å sortere. Admin sorterer på server (alle sider). Kunde sorterer gjeldende side (50 rader) — kjent begrensning under utbedring.',
        'Kolonnevelger og CSV-eksport finnes i tabellverktøyet. Lagrede visninger (private/delte) bevarer søk + sortering.',
      ],
      en: [
        'The order-number field gives exact hits and deep-links. Free text hits customer number, name, order refs and references 1–5.',
        'Combine with from/to dates and status. Active filters show as removable chips.',
        'Click a column header to sort. Admins sort server-side (all pages). Customers sort the current page (50 rows) — a known limitation being fixed.',
        'Column picker and CSV export live in the table toolbar. Saved views (private/shared) preserve search + sorting.',
      ],
    },
  },
  {
    id: 'statistikk-eksport',
    roles: ['kunde', 'analyse', 'admin'],
    icon: Download,
    title: { no: 'Statistikk og eksport', en: 'Statistics and export' },
    intro: {
      no: 'Samme motor for alle roller — men kunder ser kun egne rader.',
      en: 'The same engine for all roles — but customers only see their own rows.',
    },
    bullets: {
      no: [
        'Velg dimensjon (lager, firma, kunde, vare, varegruppe), tidsrom og evt. kunde/varegruppe-filter.',
        'Grafer: stolpe, linje eller kake. Tabell: klikkbar header, paginering (25/side) og drill-down.',
        'Eksporter-knappen lager PDF eller PNG av det synlige diagrammet. CSV-eksport henter alle rader i bakgrunnen.',
        'Tips: bruk batch-visningen på dashboard for rask oversikt, og Avansert analyse for egne mål × dimensjoner.',
      ],
      en: [
        'Pick a dimension (warehouse, company, customer, product, group), time range and optional customer/group filter.',
        'Charts: bar, line or pie. Table: clickable headers, pagination (25/page) and drill-down.',
        'The Export button renders PDF or PNG of the visible chart. CSV export fetches all rows in the background.',
        'Tip: use the dashboard batch view for a fast overview, and Advanced analysis for custom measures × dimensions.',
      ],
    },
  },
  {
    id: 'status-etl',
    roles: ['admin'],
    icon: Database,
    title: { no: 'Status, import og uttrekk', en: 'Status, import and extraction' },
    intro: {
      no: 'Slik etterprøver du at datagrunnlaget er ferskt og jobbene går.',
      en: 'How to verify data freshness and that jobs are running.',
    },
    bullets: {
      no: [
        'Status-siden viser system (DB-tilkobling + radestimater), import (siste ordre + total), uttrekk (kilde → API) og ferskhet (dager siden siste ordre, fersk/stal-dom).',
        'API-metrikk viser responstid per endepunkt (snitt/min/maks/antall/trege). ETL-metrikk viser rader/sek og minne.',
        'ETL/Data: last opp CSV (kun .csv/.txt, maks 50 MB, streaming COPY), kjør pipelines eller bulk (millioner rader), følg jobb med sanntidsprogresjon og avbryt ved behov.',
        'Scheduler (Europe/Oslo): testdata kl 02:00, realdata hver 6. time, opprydding søndag kl 03:00, statistikkaggregering hver time. Overlapp hoppes over automatisk.',
        'Kjent begrensning: frontend-helse rapporteres som «assumed healthy» med konfigurert URL — ingen aktiv probe ennå.',
      ],
      en: [
        'The Status page shows system (DB + row estimates), import (latest order + total), extraction (source → API) and freshness (days since last order, fresh/stale verdict).',
        'API metrics show latency per endpoint (avg/min/max/count/slow). ETL metrics show rows/sec and memory.',
        'ETL/Data: upload CSV (.csv/.txt only, max 50 MB, streaming COPY), run pipelines or bulk (millions of rows), follow live progress and cancel if needed.',
        'Scheduler (Europe/Oslo): test data 02:00, real data every 6h, cleanup Sunday 03:00, stats aggregation hourly. Overlaps are skipped automatically.',
        'Known limitation: frontend health is reported as “assumed healthy” with the configured URL — no active probe yet.',
      ],
    },
  },
];

const FAQS: Faq[] = [
  {
    q: { no: 'Jeg finner ikke ordren min. Hva gjør jeg?', en: 'I cannot find my order. What do I do?' },
    a: {
      no: 'Søk på eksakt ordrenr først. Prøv deretter fritekst (henvisning/referanse) og utvid datovinduet. Kunder ser kun egne ordrer — be admin sjekke om ordren ligger på annet kundenr. Fremmede ordrer gir 404 av sikkerhetshensyn.',
      en: 'Search the exact order number first. Then try free text (reference) and widen the date window. Customers only see their own orders — ask an admin to check another customer number. Foreign orders return 404 by design.',
    },
  },
  {
    q: { no: 'Hvorfor kan jeg ikke kansellere?', en: 'Why can I not cancel?' },
    a: {
      no: 'Kunder kan kansellere mens status er Til godkjenning eller Godkjent. Når status er Under behandling eller senere, må administrator utføre kanselleringen.',
      en: 'Customers can cancel while Pending approval or Approved. Once Processing or later, an admin must cancel.',
    },
  },
  {
    q: { no: 'Hvorfor blir rabatten min ikke brukt?', en: 'Why is my discount not applied?' },
    a: {
      no: 'Prisen beregnes alltid på server fra base-pris + aktive regler for din kundegruppe og dato. Sjekk Mine priser for hvilke regler som gjelder deg, og at ordredato er innenfor regelens periode. Ved tvil: be admin kjøre konflikt-sjekk.',
      en: 'Prices are always computed server-side from base price + active rules for your group and date. Check My prices for your rules and that the order date is inside the rule period. Ask an admin to run the conflict check.',
    },
  },
  {
    q: { no: 'CSV-en inneholder bare én side?', en: 'My CSV only contains one page?' },
    a: {
      no: 'Bruk statistikkens CSV-eksport (ikke tabellens «Eksporter siden») for alle rader — den paginerer i bakgrunnen. Ordretabellens CSV eksporterer bevisst kun synlig side av ytelseshensyn.',
      en: 'Use the statistics CSV export (not the table “Export page”) for all rows — it paginates in the background. The order table CSV intentionally exports only the visible page for performance.',
    },
  },
  {
    q: { no: 'Dataene ser gamle ut. Hvordan sjekker jeg?', en: 'The data looks stale. How do I check?' },
    a: {
      no: 'Admin: åpne Status → Nylig aktivitet (dager siden siste ordre) og ETL → Jobber (siste kjøringer + progresjon). Se også API-metrikk for trege endepunkt.',
      en: 'Admin: open Status → Recent activity (days since last order) and ETL → Jobs (latest runs + progress). Also check API metrics for slow endpoints.',
    },
  },
  {
    q: { no: 'Hva betyr statusene?', en: 'What do the statuses mean?' },
    a: {
      no: 'Ny → Til godkjenning → Godkjent/Avvist → Under behandling → Sendt → Fakturert (+ Kansellert). Avvisning krever kommentar. Hver overgang logges med hvem/når i tidslinjen.',
      en: 'New → Pending approval → Approved/Rejected → Processing → Shipped → Invoiced (+ Cancelled). Rejection needs a comment. Every transition is logged with who/when in the timeline.',
    },
  },
  {
    q: { no: 'Hvor finner jeg dokumentasjon for utviklere?', en: 'Where is the developer documentation?' },
    a: {
      no: 'I repoet: docs/API.md (endepunkter), docs/FUNKSJONER.md (funksjoner per rolle), docs/PROGRAMLOGIKK.md (forretningsregler), docs/ARCHITECTURE.md (systemdesign) og docs/DEPLOY.md (drift).',
      en: 'In the repo: docs/API.md (endpoints), docs/FUNKSJONER.md (features per role), docs/PROGRAMLOGIKK.md (business rules), docs/ARCHITECTURE.md (design) and docs/DEPLOY.md (operations).',
    },
  },
  {
    q: { no: 'Hvem kontakter jeg ved feil?', en: 'Who do I contact on errors?' },
    a: {
      no: 'Send e-post til support med x-request-id (vises i feilmeldingen), ordrenr, tidspunkt og skjermbilde. Ikke send passord.',
      en: 'Email support with the x-request-id (shown in the error), order number, timestamp and a screenshot. Never send passwords.',
    },
  },
];

const GLOSSARY: GlossaryTerm[] = [
  { term: 'Ordrenr', no: 'Unik nummer per salgsordre. Brukes til eksakt søk og deep-link.', en: 'Unique number per sales order. Used for exact search and deep-links.' },
  { term: 'Kundenr', no: 'Unik kunde-ID (f.eks. K001). Også påloggingsnavn for kunder.', en: 'Unique customer ID (e.g. K001). Also the customer login name.' },
  { term: 'Henvisning 1–5', no: 'Fritekstfelt per ordrelinje for kundens egne referanser. Søkbart via fritekst.', en: 'Free-text fields per order line for your own references. Searchable via free text.' },
  { term: 'Kundeordreref / Kunderef', no: 'Referansefelt på ordrehodet (bestilling/faktura).', en: 'Header-level reference fields (order/invoice).' },
  { term: 'Lager', no: 'Fysisk lager (navn + firma). Dimensjon i statistikk.', en: 'Physical warehouse (name + company). Statistics dimension.' },
  { term: 'Firma', no: 'Selskap som eier lager og ordrer. Dimensjon i statistikk.', en: 'Company owning warehouses and orders. Statistics dimension.' },
  { term: 'Vare / Varegruppe', no: 'Produkt (varekode) og gruppering (f.eks. Elektronikk). Kjerne-MVP-dimensjoner.', en: 'Product (code) and grouping (e.g. Electronics). Core MVP dimensions.' },
  { term: 'Workflow-status', no: 'Ordretilstand (Ny … Fakturert, Kansellert). Styrer hva du kan gjøre.', en: 'Order state (New … Invoiced, Cancelled). Controls allowed actions.' },
  { term: 'Base-pris', no: 'Katalogpris på vare. Rabatter regnes fra denne (admin vedlikeholder).', en: 'Catalog price. Discounts derive from it (maintained by admin).' },
  { term: 'Prisregel', no: 'Fastpris eller rabatt-% for vare, varegruppe eller alle, per kundegruppe og periode.', en: 'Fixed price or discount % for product, group or all, per customer group and period.' },
  { term: 'Idempotensnøkkel', no: 'Klientgenerert nøkkel som hindrer duplikatordre ved dobbeltklikk/retry.', en: 'Client-generated key preventing duplicate orders on double-click/retry.' },
  { term: 'Ferskhet', no: 'Dager siden siste ordre + fersk/stal-dom på Status-siden.', en: 'Days since last order + fresh/stale verdict on the Status page.' },
];

const QUICK_LINKS: Array<{ to: string; icon: typeof BookOpen; no: string; en: string; roles: RoleFilter[] }> = [
  { to: '/kunde/orders', icon: ClipboardList, no: 'Finn ordre', en: 'Find orders', roles: ['alle', 'kunde'] },
  { to: '/kunde/order/new', icon: ShoppingCart, no: 'Ny bestilling', en: 'New order', roles: ['alle', 'kunde'] },
  { to: '/kunde/statistics', icon: BarChart3, no: 'Statistikk', en: 'Statistics', roles: ['alle', 'kunde'] },
  { to: '/kunde/pricing', icon: CircleDollarSign, no: 'Mine priser', en: 'My prices', roles: ['alle', 'kunde'] },
  { to: '/analyse/statistics', icon: BarChart3, no: 'Analyse-statistikk', en: 'Analysis stats', roles: ['alle', 'analyse'] },
  { to: '/admin/approvals', icon: ClipboardList, no: 'Ordrekø', en: 'Approval queue', roles: ['alle', 'admin'] },
  { to: '/admin/orderlines', icon: ClipboardList, no: 'Ordrelinjer', en: 'Order lines', roles: ['alle', 'admin'] },
  { to: '/admin/status', icon: Activity, no: 'Status', en: 'Status', roles: ['alle', 'admin'] },
  { to: '/admin/etl', icon: Database, no: 'ETL / Data', en: 'ETL / Data', roles: ['alle', 'admin'] },
];

function matchesLangText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function Help() {
  const { user } = useAuth();
  const [lang, setLang] = useState<HelpLang>(() => {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'no';
    } catch {
      return 'no';
    }
  });
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('alle');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleLang = () => {
    setLang((prev) => {
      const next: HelpLang = prev === 'no' ? 'en' : 'no';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const t = {
    title: lang === 'no' ? 'Hjelp og dokumentasjon' : 'Help and documentation',
    subtitle:
      lang === 'no'
        ? 'Finn fram, forstå begrepene og løs vanlige problemer — uten å forlate appen.'
        : 'Find your way, understand the terms and solve common issues — without leaving the app.',
    searchLabel: lang === 'no' ? 'Søk i hjelpen' : 'Search help',
    searchPlaceholder: lang === 'no' ? 'F.eks. henvisning, eksport, kansellere…' : 'E.g. reference, export, cancel…',
    roleLabel: lang === 'no' ? 'Vis for rolle' : 'Show for role',
    quickTitle: lang === 'no' ? 'Snarveier' : 'Shortcuts',
    recommended: lang === 'no' ? 'Anbefalt for deg' : 'Recommended for you',
    faqTitle: lang === 'no' ? 'Vanlige spørsmål' : 'Frequently asked questions',
    glossaryTitle: lang === 'no' ? 'Ordliste' : 'Glossary',
    contactTitle: lang === 'no' ? 'Kontakt og videre lesning' : 'Contact and further reading',
    noResults: lang === 'no' ? 'Ingen treff. Prøv et annet søkeord eller nullstill rollefilteret.' : 'No matches. Try another keyword or reset the role filter.',
    langButton: lang === 'no' ? 'English' : 'Norsk',
    sectionsTitle: lang === 'no' ? 'Veiledninger' : 'Guides',
  };

  const myRole = user?.role ?? null;
  const recommendedText =
    myRole === 'kunde'
      ? lang === 'no'
        ? 'Du er logget inn som kunde — start med Kunde-guiden og Søk/sortering.'
        : 'You are signed in as a customer — start with the Customer guide and Search/sorting.'
      : myRole === 'analyse'
        ? lang === 'no'
          ? 'Du er logget inn som analyse — start med Analyse-guiden og Statistikk/eksport.'
          : 'You are signed in as an analyst — start with the Analysis guide and Statistics/export.'
        : myRole === 'admin'
          ? lang === 'no'
            ? 'Du er logget inn som admin — start med Admin-guiden og Status/ETL.'
            : 'You are signed in as an admin — start with the Admin guide and Status/ETL.'
          : null;

  const q = query.trim();
  const filteredSections = useMemo(() => {
    return SECTIONS.filter((s) => {
      if (roleFilter !== 'alle' && !s.roles.includes(roleFilter)) return false;
      if (!q) return true;
      const blob = [
        s.title.no,
        s.title.en,
        s.intro.no,
        s.intro.en,
        ...s.bullets.no,
        ...s.bullets.en,
      ].join('\n');
      return matchesLangText(blob, q);
    });
  }, [roleFilter, q]);

  const filteredFaqs = useMemo(() => {
    const withIndex = FAQS.map((f, i) => ({ f, i }));
    if (!q) return withIndex;
    return withIndex.filter(({ f }) =>
      matchesLangText([f.q.no, f.q.en, f.a.no, f.a.en].join('\n'), q),
    );
  }, [q]);

  const filteredGlossary = useMemo(() => {
    if (!q) return GLOSSARY;
    return GLOSSARY.filter((g) => matchesLangText([g.term, g.no, g.en].join('\n'), q));
  }, [q]);

  const visibleQuickLinks = QUICK_LINKS.filter(
    (l) => roleFilter === 'alle' || l.roles.includes(roleFilter) || l.roles.includes('alle'),
  );

  const roleOptions: Array<{ value: RoleFilter; no: string; en: string }> = [
    { value: 'alle', no: 'Alle', en: 'All' },
    { value: 'kunde', no: 'Kunde', en: 'Customer' },
    { value: 'analyse', no: 'Analyse', en: 'Analysis' },
    { value: 'admin', no: 'Admin', en: 'Admin' },
  ];

  return (
    <Layout title={t.title}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header: subtitle + language toggle */}
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 border border-primary-500/30">
              <BookOpen className="h-5 w-5 text-primary-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-dark-300">{t.subtitle}</p>
              {recommendedText && (
                <p className="mt-1 text-sm text-gold-300/90">
                  <span className="font-medium">{t.recommended}: </span>
                  {recommendedText}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="btn-secondary shrink-0 py-2 text-sm"
            aria-label={lang === 'no' ? 'Switch to English' : 'Bytt til norsk'}
          >
            <Languages className="h-4 w-4" aria-hidden />
            {t.langButton}
          </button>
        </div>

        {/* Search + role filter */}
        <div className="card space-y-4">
          <div>
            <label htmlFor="help-search" className="mb-1 block text-sm font-medium text-dark-200">
              {t.searchLabel}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" aria-hidden />
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg border border-dark-700 bg-dark-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-dark-500 focus:border-primary-500/60 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <span id="help-role-label" className="mb-1 block text-sm font-medium text-dark-200">
              {t.roleLabel}
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="help-role-label">
              {roleOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setRoleFilter(o.value)}
                  aria-pressed={roleFilter === o.value}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    roleFilter === o.value
                      ? 'border-primary-500/60 bg-primary-500/15 text-white'
                      : 'border-dark-700 bg-dark-900 text-dark-300 hover:text-white'
                  }`}
                >
                  {lang === 'no' ? o.no : o.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <section aria-label={t.quickTitle}>
          <h2 className="mb-2 text-lg font-semibold text-white">{t.quickTitle}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQuickLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="card group flex items-center gap-3 hover:border-primary-500/40 transition-colors"
              >
                <l.icon className="h-5 w-5 shrink-0 text-primary-400" aria-hidden />
                <span className="text-sm font-medium text-white group-hover:underline">
                  {lang === 'no' ? l.no : l.en}
                </span>
                <span className="ml-auto text-xs text-dark-500">{l.to}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Guides */}
        <section aria-label={t.sectionsTitle} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">{t.sectionsTitle}</h2>
          {filteredSections.length === 0 && <p className="card text-sm text-dark-300">{t.noResults}</p>}
          {filteredSections.map((s) => (
            <article key={s.id} id={`hjelp-${s.id}`} className="card scroll-mt-24 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-800 border border-dark-700">
                  <s.icon className="h-5 w-5 text-primary-400" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{s.title[lang]}</h3>
                  <p className="text-xs uppercase tracking-wider text-dark-500">
                    {s.roles.join(' · ')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-dark-200">{s.intro[lang]}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-dark-200">
                {s.bullets[lang].map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        {/* FAQ */}
        <section aria-label={t.faqTitle} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Bell className="h-5 w-5 text-primary-400" aria-hidden />
            {t.faqTitle}
          </h2>
          {filteredFaqs.length === 0 && <p className="card text-sm text-dark-300">{t.noResults}</p>}
          <div className="space-y-2">
            {filteredFaqs.map(({ f, i }) => {
              const open = openFaq === i;
              return (
                <div key={i} className="card !p-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="text-sm font-medium text-white">{f.q[lang]}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-dark-400 transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <div id={`faq-panel-${i}`} className="border-t border-dark-800 p-4 text-sm text-dark-200">
                      {f.a[lang]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Glossary */}
        <section aria-label={t.glossaryTitle} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Building2 className="h-5 w-5 text-primary-400" aria-hidden />
            {t.glossaryTitle}
          </h2>
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-dark-800 text-xs uppercase tracking-wider text-dark-400">
                  <th scope="col" className="px-4 py-3">
                    {lang === 'no' ? 'Begrep' : 'Term'}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {lang === 'no' ? 'Forklaring' : 'Explanation'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGlossary.map((g) => (
                  <tr key={g.term} className="border-b border-dark-800/60 last:border-0">
                    <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-medium text-white">
                      {g.term}
                    </th>
                    <td className="px-4 py-2.5 text-dark-200">{g[lang]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Contact */}
        <section aria-label={t.contactTitle} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-white">{t.contactTitle}</p>
              <p className="text-dark-300">
                {supportEmail}
                <span className="text-dark-500">
                  {' — '}
                  {lang === 'no'
                    ? 'oppgi x-request-id, ordrenr og tidspunkt. Send aldri passord.'
                    : 'include x-request-id, order number and timestamp. Never send passwords.'}
                </span>
              </p>
              <p className="mt-1 text-xs text-dark-500">
                {lang === 'no'
                  ? 'Utviklerdokumentasjon: docs/API.md, docs/FUNKSJONER.md, docs/PROGRAMLOGIKK.md, docs/ARCHITECTURE.md, docs/DEPLOY.md.'
                  : 'Developer docs: docs/API.md, docs/FUNKSJONER.md, docs/PROGRAMLOGIKK.md, docs/ARCHITECTURE.md, docs/DEPLOY.md.'}
              </p>
            </div>
          </div>
          <a href={supportMailto} className="btn-secondary shrink-0 py-2 text-sm">
            {lang === 'no' ? 'Kontakt support' : 'Contact support'}
          </a>
        </section>
      </div>
    </Layout>
  );
}

/**
 * Bundle budget gate — fails CI when the frontend critical path regresses.
 *
 * Reads dist/index.html (the real entry graph Vite emitted) and asserts:
 *  1. Heavy deps (MSAL, framer-motion, recharts, jspdf, html2canvas) are
 *     NEVER in the entry modulepreload list — they must stay lazy/async.
 *  2. Entry + preload JS, vendor, query and CSS stay under raw-KB budgets.
 *  3. The lazy chunks for those heavy deps still exist as separate files
 *     (i.e. nobody accidentally statically imported them into a route that
 *     merges them into the shared graph in a harmful way — size checks
 *     below catch the rest).
 *
 * Dependency-free (node:fs/path only). Run: `npm run perf:budget`
 * (requires `npm run build` first).
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const htmlPath = join(dist, 'index.html');

const KB = 1024;
const failures = [];

function kb(bytes) {
  return (bytes / KB).toFixed(1);
}

function fail(message) {
  failures.push(message);
  console.error(`  ✖ ${message}`);
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function sizeOf(relPath) {
  return statSync(join(dist, relPath)).size;
}

// ── Parse dist/index.html ──────────────────────────────────────────────
if (!existsSync(htmlPath)) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}
const html = readFileSync(htmlPath, 'utf8');

const scriptSrc = html.match(/<script[^>]*src="([^"]+)"/)?.[1];
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(
  (m) => m[1],
);
const cssHrefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
  .map((m) => m[1])
  // Google Fonts / external stylesheets are not part of the bundle budget.
  .filter((href) => href.startsWith('/assets/') || href.startsWith('assets/'));

const toDistRel = (href) => href.replace(/^\//, '');
const entryFiles = [scriptSrc, ...preloads].filter(Boolean).map(toDistRel);

console.log('Entry graph (dist/index.html):');
for (const f of entryFiles) {
  console.log(`  - ${f} (${kb(sizeOf(f))} KB raw)`);
}

// ── Rule 1: heavy deps must never be entry-critical ────────────────────
const FORBIDDEN_ENTRY_PATTERNS = [
  { pattern: /msal/i, name: '@azure/msal-browser (must load on Entra click only)' },
  { pattern: /motion/i, name: 'framer-motion (must load with Layout/routes only)' },
  { pattern: /charts?/i, name: 'recharts (must load on chart routes only)' },
  { pattern: /jspdf/i, name: 'jspdf (must load on export only)' },
  { pattern: /html2canvas/i, name: 'html2canvas (must load on export only)' },
  { pattern: /purify/i, name: 'dompurify/jspdf utils (must load on export only)' },
];

for (const file of entryFiles) {
  for (const { pattern, name } of FORBIDDEN_ENTRY_PATTERNS) {
    if (pattern.test(file)) {
      fail(`Heavy dep in entry preload: ${file} — ${name}`);
    }
  }
}
if (!failures.some((f) => f.startsWith('Heavy dep'))) {
  ok('No heavy dep (msal/motion/charts/jspdf/html2canvas) in entry preload');
}

// ── Rule 2: raw-KB budgets (generous headroom over 2026-09 measured) ───
const budgets = [
  // Entry script itself (no vendor/query/motion/msal anymore).
  { match: /^assets\/index-[^/]*\.js$/, label: 'entry JS', maxKb: 95 },
  { match: /^assets\/vendor-.*\.js$/, label: 'vendor chunk', maxKb: 185 },
  { match: /^assets\/query-.*\.js$/, label: 'react-query chunk', maxKb: 55 },
  { match: /^assets\/motion-.*\.js$/, label: 'framer-motion chunk', maxKb: 140 },
  { match: /^assets\/.*\.css$/, label: 'CSS bundle', maxKb: 85 },
];

const assetsDir = join(dist, 'assets');
const assetFiles = readdirSync(assetsDir).map((f) => `assets/${f}`);

for (const { match, label, maxKb } of budgets) {
  const hit = assetFiles.find((f) => match.test(f));
  if (!hit) {
    fail(`Budget check skipped — no file matches ${match} (chunking changed?)`);
    continue;
  }
  const sizeKb = sizeOf(hit) / KB;
  if (sizeKb > maxKb) {
    fail(`${label} budget breached: ${hit} is ${sizeKb.toFixed(1)} KB (max ${maxKb} KB)`);
  } else {
    ok(`${label}: ${hit} ${sizeKb.toFixed(1)} KB (max ${maxKb} KB)`);
  }
}

// Total entry-critical JS (script + modulepreload), raw.
const entryTotalKb = entryFiles
  .filter((f) => f.endsWith('.js'))
  .reduce((sum, f) => sum + sizeOf(f) / KB, 0);
const ENTRY_TOTAL_MAX_KB = 340;
if (entryTotalKb > ENTRY_TOTAL_MAX_KB) {
  fail(
    `Entry-critical JS total is ${entryTotalKb.toFixed(1)} KB (max ${ENTRY_TOTAL_MAX_KB} KB) — something rejoined the critical path`,
  );
} else {
  ok(`Entry-critical JS total ${entryTotalKb.toFixed(1)} KB (max ${ENTRY_TOTAL_MAX_KB} KB)`);
}

// ── Rule 3: lazy chunks still exist as separate files ──────────────────
const requiredLazy = [/msal.*\.js$/, /motion.*\.js$/, /charts.*\.js$/, /jspdf.*\.js$/];
for (const pattern of requiredLazy) {
  if (assetFiles.some((f) => pattern.test(f))) {
    ok(`Separate lazy chunk present: ${pattern}`);
  } else {
    fail(`Expected separate lazy chunk missing: ${pattern} — heavy dep may have merged into shared code`);
  }
}

// ── Result ─────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\nBUNDLE BUDGET: ${failures.length} failure(s).`);
  process.exit(1);
}
console.log('\nBUNDLE BUDGET: all checks passed.');

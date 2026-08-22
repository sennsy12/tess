import type { jsPDF } from 'jspdf';
import type { OrderDetail } from '../types/order';
import { ORDER_WORKFLOW_LABELS, isOrderWorkflowStatus } from './orderWorkflow';

export interface PdfLineRow {
  pos: number;
  varekode: string;
  betegnelse: string;
  antall: string;
  enhet: string;
  pris: string;
  linjesum: string;
}

export interface PdfTotals {
  netto: number;
  mva: number;
  brutto: number;
}

const moneyFormatter = new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });

export function buildOrderPdfFilename(ordrenr: number): string {
  return `ordre-${ordrenr}.pdf`;
}

export function formatPdfMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${moneyFormatter.format(safe)} kr`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineNetSum(line: { antall: number; nettpris: number; linjesum: number }): number {
  if (Number.isFinite(line.linjesum)) return round2(line.linjesum);
  return round2((Number(line.antall) || 0) * (Number(line.nettpris) || 0));
}

/** Maps order lines to display rows for the PDF table. */
export function buildPdfLineRows(order: Pick<OrderDetail, 'lines'>): PdfLineRow[] {
  return (order.lines ?? []).map((line, index) => ({
    pos: index + 1,
    varekode: String(line.varekode ?? ''),
    betegnelse:
      line.varenavn?.trim() || line.varegruppe?.trim() || String(line.varekode ?? ''),
    antall: quantityFormatter.format(Number.isFinite(line.antall) ? line.antall : 0),
    enhet: line.enhet?.trim() || 'stk',
    pris: formatPdfMoney(Number(line.nettpris) || 0),
    linjesum: formatPdfMoney(lineNetSum(line)),
  }));
}

/** Uses backend summary when complete; otherwise derives totals from the lines. */
export function computePdfTotals(
  order: Pick<OrderDetail, 'lines' | 'lineSummary' | 'sum'>,
): PdfTotals {
  const summary = order.lineSummary;
  if (
    summary &&
    Number.isFinite(summary.netto) &&
    Number.isFinite(summary.mva) &&
    Number.isFinite(summary.brutto) &&
    summary.brutto > 0
  ) {
    return { netto: summary.netto, mva: summary.mva, brutto: summary.brutto };
  }

  const netto = round2(
    (order.lines ?? []).reduce((acc, line) => acc + lineNetSum(line), 0),
  );
  const statedBrutto = Number(order.sum);
  let mva: number;
  let brutto: number;
  if (Number.isFinite(statedBrutto) && statedBrutto > netto && statedBrutto > 0) {
    brutto = round2(statedBrutto);
    mva = round2(brutto - netto);
  } else {
    mva = round2(netto * 0.25);
    brutto = round2(netto + mva);
  }
  return { netto, mva, brutto };
}

// ── Drawing constants (A4 portrait, mm) ─────────────────────────
const PAGE_LEFT = 14;
const PAGE_RIGHT = 196;
const PAGE_BOTTOM_MARGIN = 22;
const ROW_BASE_HEIGHT = 6;
const WRAPPED_LINE_HEIGHT = 4;

const COLUMNS = {
  pos: { x: PAGE_LEFT, width: 10 },
  varekode: { x: 26, width: 26 },
  betegnelse: { x: 54, width: 62 },
  antall: { rightEdge: 136 },
  enhet: { x: 139 },
  pris: { rightEdge: 168 },
  sum: { rightEdge: PAGE_RIGHT },
};

function statusLabel(status?: string | null): string {
  const raw = status ?? 'new';
  return isOrderWorkflowStatus(raw) ? ORDER_WORKFLOW_LABELS[raw] : raw;
}

function drawHeader(doc: jsPDF, order: OrderDetail): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30);
  doc.text('ORDREBEKREFTELSE', PAGE_LEFT, 20);

  doc.setFontSize(13);
  doc.text(`Ordre #${order.ordrenr}`, PAGE_RIGHT, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Dato: ${formatDateSafe(order.dato)}    Status: ${statusLabel(order.workflow_status)}`, PAGE_RIGHT, 26, {
    align: 'right',
  });
}

function formatDateSafe(dato: string): string {
  const parsed = new Date(dato);
  return Number.isNaN(parsed.getTime()) ? dato : parsed.toLocaleDateString('nb-NO');
}

function drawParties(doc: jsPDF, order: OrderDetail): void {
  const startY = 36;
  doc.setTextColor(130);
  doc.setFontSize(7);
  doc.text('KUNDE', PAGE_LEFT, startY);
  doc.text('DETALJER', 128, startY);

  doc.setFontSize(10);
  doc.setTextColor(40);

  const leftLines: [string, string][] = [
    ['Kundenr', String(order.kundenr ?? '')],
    ['Kunde', order.kundenavn || '-'],
    ['Firma', order.firmanavn || '-'],
  ];
  if (order.kunderef?.trim()) leftLines.push(['Kunderef', order.kunderef.trim()]);
  if (order.kundeordreref?.trim()) leftLines.push(['Ordre ref', order.kundeordreref.trim()]);

  const rightLines: [string, string][] = [
    ['Lager', order.lagernavn || '-'],
    ['Valuta', order.valutaid || 'NOK'],
  ];

  let y = startY + 6;
  for (const [label, value] of leftLines) {
    doc.setTextColor(120);
    doc.setFontSize(8);
    doc.text(`${label}:`, PAGE_LEFT, y);
    doc.setTextColor(40);
    doc.setFont('helvetica', label === 'Kunde' ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(value || '-', 60), PAGE_LEFT + 20, y);
    y += 5;
  }

  y = startY + 6;
  for (const [label, value] of rightLines) {
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${label}:`, 128, y);
    doc.setTextColor(40);
    doc.setFontSize(9);
    doc.text(String(value ?? '-'), 148, y);
    y += 5;
  }
}

function drawTableHead(doc: jsPDF, y: number): void {
  doc.setFillColor(242, 243, 245);
  doc.rect(PAGE_LEFT - 2, y - 4.2, PAGE_RIGHT - PAGE_LEFT + 4, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text('POS', COLUMNS.pos.x, y);
  doc.text('VAREKODE', COLUMNS.varekode.x, y);
  doc.text('BETEGNELSE', COLUMNS.betegnelse.x, y);
  doc.text('ANTALL', COLUMNS.antall.rightEdge, y, { align: 'right' });
  doc.text('ENHET', COLUMNS.enhet.x, y);
  doc.text('PRIS', COLUMNS.pris.rightEdge, y, { align: 'right' });
  doc.text('SUM', COLUMNS.sum.rightEdge, y, { align: 'right' });

  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(PAGE_LEFT - 2, y + 2.8, PAGE_RIGHT + 2, y + 2.8);
}

/**
 * Builds a print-ready A4 ordrebekreftelse as a text-based PDF
 * (selectable text, small file size).
 */
export async function downloadOrderPdf(order: OrderDetail): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc, order);
  drawParties(doc, order);

  const rows = buildPdfLineRows(order);
  const totals = computePdfTotals(order);
  const tableTop = 66;
  let y = tableTop;

  drawTableHead(doc, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(35);

  for (const row of rows) {
    const betegnelseLines = doc.splitTextToSize(row.betegnelse, COLUMNS.betegnelse.width);
    const rowHeight = Math.max(ROW_BASE_HEIGHT, betegnelseLines.length * WRAPPED_LINE_HEIGHT + 2);

    if (y + rowHeight > 297 - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
      drawTableHead(doc, 20);
      y = 28;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(35);
    }

    doc.setTextColor(35);
    doc.text(String(row.pos), COLUMNS.pos.x + COLUMNS.pos.width, y, { align: 'right' });
    doc.text(row.varekode, COLUMNS.varekode.x, y);
    doc.text(betegnelseLines, COLUMNS.betegnelse.x, y);
    doc.text(row.antall, COLUMNS.antall.rightEdge, y, { align: 'right' });
    doc.text(row.enhet, COLUMNS.enhet.x, y);
    doc.text(row.pris, COLUMNS.pris.rightEdge, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(row.linjesum, COLUMNS.sum.rightEdge, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += rowHeight;
    doc.setDrawColor(228);
    doc.setLineWidth(0.1);
    doc.line(PAGE_LEFT - 2, y - rowHeight / 2 + 1, PAGE_RIGHT + 2, y - rowHeight / 2 + 1);
  }

  if (!rows.length) {
    doc.setTextColor(120);
    doc.text('Ingen ordrelinjer', PAGE_LEFT, y);
    y += ROW_BASE_HEIGHT;
  }

  y += 6;
  if (y > 297 - PAGE_BOTTOM_MARGIN - 24) {
    doc.addPage();
    y = 24;
  }

  const totalsX = 150;
  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(totalsX, y, PAGE_RIGHT, y);

  doc.setFontSize(9);
  doc.setTextColor(80);
  y += 5.5;
  doc.text('Netto', totalsX, y);
  doc.text(formatPdfMoney(totals.netto), PAGE_RIGHT, y, { align: 'right' });

  y += 5.5;
  doc.text('MVA', totalsX, y);
  doc.text(formatPdfMoney(totals.mva), PAGE_RIGHT, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25);
  y += 6;
  doc.text('Brutto', totalsX, y);
  doc.text(formatPdfMoney(totals.brutto), PAGE_RIGHT, y, { align: 'right' });

  const generatedAt = new Date().toLocaleString('nb-NO');
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.line(PAGE_LEFT - 2, 286, PAGE_RIGHT + 2, 286);
    doc.text(`Generert ${generatedAt}`, PAGE_LEFT, 290);
    doc.text(`Side ${pageNumber} av ${pageCount}`, PAGE_RIGHT, 290, { align: 'right' });
  }

  doc.save(buildOrderPdfFilename(order.ordrenr));
}

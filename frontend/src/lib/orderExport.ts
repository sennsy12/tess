import type { OrderDetail } from '../types/order';

/** Build CSV text for a single order (header + lines). */
export function orderToCsv(order: OrderDetail): string {
  const header = [
    'ordrenr',
    'dato',
    'kundenr',
    'kundenavn',
    'firmanavn',
    'lagernavn',
    'sum',
    'kunderef',
    'kundeordreref',
  ];
  const headerRow = [
    order.ordrenr,
    order.dato,
    order.kundenr,
    order.kundenavn,
    order.firmanavn,
    order.lagernavn,
    order.sum,
    order.kunderef ?? '',
    order.kundeordreref ?? '',
  ]
    .map(escapeCsv)
    .join(',');

  const lineHeaders = [
    'linjenr',
    'varekode',
    'varenavn',
    'varegruppe',
    'antall',
    'enhet',
    'nettpris',
    'linjesum',
    'linjestatus',
  ];
  const lineRows = order.lines.map((line) =>
    [
      line.linjenr,
      line.varekode,
      line.varenavn ?? '',
      line.varegruppe ?? '',
      line.antall,
      line.enhet,
      line.nettpris,
      line.linjesum,
      line.linjestatus,
    ]
      .map(escapeCsv)
      .join(','),
  );

  return [
    header.join(','),
    headerRow,
    '',
    lineHeaders.join(','),
    ...lineRows,
  ].join('\n');
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadOrderCsv(order: OrderDetail): void {
  const csv = orderToCsv(order);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ordre-${order.ordrenr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface DownloadCsvOptions {
  delimiter?: ',' | ';';
  bom?: boolean;
  headers?: string[];
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '""';
  const raw = String(value).replace(/"/g, '""');
  return `"${raw}"`;
}

/** Builds CSV text without triggering a browser download — useful for tests and server-side export. */
export function buildCsvContent(
  rows: Array<Record<string, unknown>>,
  opts: DownloadCsvOptions = {},
): string {
  if (rows.length === 0) return '';

  const delimiter = opts.delimiter ?? ';';
  const bom = opts.bom ?? true;
  const headers = opts.headers ?? Object.keys(rows[0]);

  const lines = [
    headers.join(delimiter),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsvValue(row[header]))
        .join(delimiter),
    ),
  ];

  return `${bom ? '\uFEFF' : ''}${lines.join('\n')}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  opts: DownloadCsvOptions = {},
) {
  if (rows.length === 0) return;

  const content = buildCsvContent(rows, opts);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, blob);
}

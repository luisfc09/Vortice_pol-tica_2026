// Exportação de listas para CSV — sem dependências.
//
// - Separador ';' (padrão do Excel pt-BR, onde ',' é decimal).
// - BOM UTF-8 no início → Excel/Sheets reconhecem acentos corretamente.
// - Escapa aspas/; /quebras de linha conforme RFC 4180.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(raw: string | number | null | undefined): string {
  const s = raw === null || raw === undefined ? '' : String(raw);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const sep = ';';
  const header = columns.map((c) => escapeCell(c.header)).join(sep);
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(sep));
  const csv = [header, ...body].join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Nome de arquivo com carimbo de data (yyyymmdd).
export function stampedCsvName(base: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
}

// Formata timestamp ISO para data/hora pt-BR (uso comum nas colunas).
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR');
}

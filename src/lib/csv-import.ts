// Parser de CSV (sem dependência) — usado no import de lideranças do onboarding.
// Detecta separador (';' ou ','), respeita aspas (RFC 4180) e remove BOM.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function tokenize(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\ufeff/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const cells = tokenize(clean, sep).filter((r) => r.length > 0);
  if (cells.length === 0) return { headers: [], rows: [] };
  const headers = cells[0].map((h) => h.trim());
  const rows = cells
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim();
      });
      return obj;
    });
  return { headers, rows };
}

// Lê um campo da linha tolerando acento/caixa e nomes alternativos.
export function pickField(row: Record<string, string>, ...names: string[]): string {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) map.set(norm(k), row[k]);
  for (const n of names) {
    const v = map.get(norm(n));
    if (v != null && v !== '') return v;
  }
  return '';
}

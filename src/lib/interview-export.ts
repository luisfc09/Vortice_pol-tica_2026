// Helpers de exportação de entrevistas. Sem dependências de terceiros —
// PDF acontece via window.print() (CSS print em index.css), JSON é
// um Blob direto.

import type { FieldInterview } from '@/types';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function exportInterviewAsJson(i: FieldInterview): void {
  const stamp = new Date(i.created_at).toISOString().slice(0, 10);
  const filename = `entrevista-${stamp}-${slugify(i.voter_name)}.json`;
  download(filename, JSON.stringify(i, null, 2), 'application/json');
}

export function printInterview(): void {
  window.print();
}

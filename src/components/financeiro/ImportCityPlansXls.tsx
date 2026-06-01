// ImportCityPlansXls — botão "Modelo" + "Importar XLS" com preview de
// validação antes de gravar. Reaproveita o look do ImportCsvButtons —
// nesta versão lê .xlsx via SheetJS (financeImporter.ts) e usa o
// hook useFinanceiro para inserir as cidades aprovadas.

import { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  parseXlsxFile,
  validateCityPlanRows,
  generateXlsxTemplate,
  type CityPlanImportResult,
} from '@/lib/financeImporter';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import type { ImportRowStatus } from '@/lib/csv-import';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  ImportRowStatus,
  { label: string; chip: string; row: string; Icon: typeof CheckCircle2 }
> = {
  valid: {
    label: 'Válido',
    chip: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    row: '',
    Icon: CheckCircle2,
  },
  warning: {
    label: 'Aviso',
    chip: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    row: 'bg-amber-500/5',
    Icon: AlertTriangle,
  },
  duplicate: {
    label: 'Duplicado',
    chip: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300',
    row: 'bg-yellow-500/5',
    Icon: Copy,
  },
  error: {
    label: 'Erro',
    chip: 'border-red-500/30 bg-red-500/15 text-red-300',
    row: 'bg-red-500/5',
    Icon: XCircle,
  },
};

export function ImportCityPlansXls() {
  const { cityPlans, createCityPlan } = useFinanceiro();
  const fileRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<CityPlanImportResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      const { headers, rows } = await parseXlsxFile(file);
      if (rows.length === 0) {
        toast.error('Planilha vazia ou sem linhas de dados.');
        return;
      }
      if (headers.length === 0) {
        toast.error('Planilha sem cabeçalho na primeira linha.');
        return;
      }
      const parsed = validateCityPlanRows(rows, headers, cityPlans);
      setResults(parsed);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao ler a planilha.',
      );
    }
  }

  const counts = results
    ? {
        total: results.length,
        valid: results.filter((r) => r.status === 'valid').length,
        warning: results.filter((r) => r.status === 'warning').length,
        duplicate: results.filter((r) => r.status === 'duplicate').length,
        error: results.filter((r) => r.status === 'error').length,
      }
    : null;
  const importable = counts ? counts.valid + counts.warning : 0;

  async function confirmImport() {
    if (!results || !counts) return;
    const toPersist = results.filter(
      (r) => (r.status === 'valid' || r.status === 'warning') && r.canonical,
    );
    if (toPersist.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: toPersist.length });
    let ok = 0;
    let fail = 0;
    for (const r of toPersist) {
      try {
        const result = await createCityPlan(r.canonical!);
        if (result) ok++;
        else fail++;
      } catch {
        fail++;
      }
      setProgress((p) =>
        p ? { done: p.done + 1, total: p.total } : null,
      );
    }
    setImporting(false);
    setProgress(null);
    toast.success(
      `${ok} cidade(s) importada(s) · ${counts.error} erro(s) · ${counts.duplicate} duplicada(s)${
        fail > 0 ? ` · ${fail} falha(s)` : ''
      }`,
    );
    setResults(null);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={generateXlsxTemplate}
        title="Baixar planilha-modelo (.xlsx)"
      >
        <Download className="mr-1 h-4 w-4" /> Modelo
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet className="mr-1 h-4 w-4" /> Importar XLS
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onPick}
      />

      <DialogPrimitive.Root
        open={results !== null}
        onOpenChange={(o) => {
          if (!o && !importing) setResults(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1200] flex max-h-[88vh] w-[94%] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-vortex-border bg-vortex-surface p-5 shadow-2xl">
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">
              Pré-visualização da importação
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Confira as linhas antes de gravar. Erros e duplicados não serão importados.
            </DialogPrimitive.Description>

            {counts ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-vortex-border px-2 py-1 text-muted-foreground">
                  Total: <strong className="text-foreground">{counts.total}</strong>
                </span>
                <span className={cn('rounded-md border px-2 py-1', STATUS_META.valid.chip)}>
                  Válidas: {counts.valid}
                </span>
                <span className={cn('rounded-md border px-2 py-1', STATUS_META.warning.chip)}>
                  Avisos: {counts.warning}
                </span>
                <span className={cn('rounded-md border px-2 py-1', STATUS_META.duplicate.chip)}>
                  Duplicadas: {counts.duplicate}
                </span>
                <span className={cn('rounded-md border px-2 py-1', STATUS_META.error.chip)}>
                  Erros: {counts.error}
                </span>
              </div>
            ) : null}

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-vortex-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-vortex-surface">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Cidade</th>
                    <th className="px-2 py-2 font-medium">Detalhe</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {results?.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr
                        key={r.line}
                        className={cn(
                          'border-t border-vortex-border/60 align-top',
                          meta.row,
                        )}
                      >
                        <td className="px-2 py-1.5 text-muted-foreground">{r.line}</td>
                        <td className="px-2 py-1.5 text-foreground">
                          {r.primary || (
                            <span className="text-muted-foreground">(sem cidade)</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.secondary}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
                              meta.chip,
                            )}
                          >
                            <meta.Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">
                          {r.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              {progress ? (
                <span className="text-xs text-muted-foreground">
                  Importando {progress.done}/{progress.total}…
                </span>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setResults(null)}
                  disabled={importing}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmImport}
                  disabled={importable === 0 || importing}
                >
                  {importing ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-4 w-4" />
                  )}
                  Importar {importable} cidade{importable === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

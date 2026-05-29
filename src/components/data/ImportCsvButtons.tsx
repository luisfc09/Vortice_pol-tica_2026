import { useRef, useState } from 'react';
import { Upload, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { parseCsv } from '@/lib/csv-import';
import { exportToCsv, type CsvColumn } from '@/lib/csv-export';

interface Props<T extends Record<string, string>> {
  /** Nome do arquivo-modelo (sem .csv). */
  templateName: string;
  /** Linha-exemplo do modelo. */
  templateRow: T;
  /** Colunas do modelo (mesma estrutura do export). */
  templateColumns: CsvColumn<T>[];
  /** Recebe as linhas parseadas e devolve quantos criou/ignorou. */
  onImport: (rows: Record<string, string>[]) => Promise<{ ok: number; skip: number }>;
}

// Botões "Modelo" + "Importar CSV" reutilizáveis (Eleitores e Lideranças).
export function ImportCsvButtons<T extends Record<string, string>>({
  templateName,
  templateRow,
  templateColumns,
  onImport,
}: Props<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (rows.length === 0) {
        toast.error('CSV vazio ou sem linhas de dados.');
        return;
      }
      const res = await onImport(rows);
      toast.success(
        `${res.ok} importado(s).` + (res.skip ? ` ${res.skip} linha(s) ignorada(s).` : ''),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao importar o CSV.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => exportToCsv(templateName, [templateRow], templateColumns)}
        title="Baixar planilha-modelo"
      >
        <Download className="h-4 w-4" /> Modelo
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {importing ? 'Importando…' : 'Importar CSV'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onPick}
      />
    </>
  );
}

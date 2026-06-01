// FinanceRevenueList — aba "Receitas" do módulo financeiro.
// Lista cronológica + form de inclusão + remoção. Cada entrada representa
// um aporte pontual (fundo eleitoral, doação, recursos próprios etc.).

import { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { useFinanceiro, REVENUE_SOURCE_OPTIONS } from '@/hooks/useFinanceiro';
import {
  REVENUE_SOURCE_LABEL,
  type RevenueSourceType,
} from '@/types';

const BR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseNumberBR(s: string): number | null {
  if (!s.trim()) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatDateBR(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

interface FormState {
  source_type: RevenueSourceType;
  description: string;
  amount: string;
  revenue_date: string;
  notes: string;
}

export function FinanceRevenueList() {
  const { revenues, totalReceitas, createRevenue, deleteRevenue } = useFinanceiro();
  const [form, setForm] = useState<FormState>({
    source_type: 'fundo_eleitoral',
    description: '',
    amount: '',
    revenue_date: todayISO(),
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleAdd() {
    const amount = parseNumberBR(form.amount);
    if (amount == null || amount <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    if (!form.revenue_date) {
      toast.error('Informe a data da receita.');
      return;
    }
    setCreating(true);
    const result = await createRevenue({
      source_type: form.source_type,
      description: form.description.trim() || null,
      amount,
      revenue_date: form.revenue_date,
      notes: form.notes.trim() || null,
    });
    setCreating(false);
    if (result) {
      toast.success('Receita registrada.');
      setForm({
        source_type: 'fundo_eleitoral',
        description: '',
        amount: '',
        revenue_date: todayISO(),
        notes: '',
      });
    } else {
      toast.error('Não foi possível registrar a receita.');
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    await deleteRevenue(toDelete);
    setToDelete(null);
    toast.success('Receita removida.');
  }

  // Agrupa total por fonte pra mostrar nos KPIs do cabeçalho.
  const totaisPorFonte = useMemo(() => {
    const map = new Map<RevenueSourceType, number>();
    for (const r of revenues) {
      map.set(r.source_type, (map.get(r.source_type) ?? 0) + r.amount);
    }
    return map;
  }, [revenues]);

  return (
    <div className="space-y-6">
      {/* Card de novo aporte ---------------------------------------- */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg">Registrar nova receita</h3>
          <p className="text-sm text-muted-foreground">
            Cada entrada de caixa do comitê — fundo eleitoral, doação,
            recursos próprios, etc.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Fonte</Label>
            <Select
              value={form.source_type}
              onValueChange={(v) => update('source_type', v as RevenueSourceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {REVENUE_SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              placeholder="Ex.: 50000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.revenue_date}
              onChange={(e) => update('revenue_date', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              type="text"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Ex.: Doação João Silva"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Opcional — CPF/CNPJ do doador, nº do recibo, etc."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleAdd} disabled={creating}>
            <Plus className="mr-1 h-4 w-4" />
            {creating ? 'Registrando…' : 'Registrar receita'}
          </Button>
        </div>
      </Card>

      {/* KPIs por fonte --------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3 w-3" /> Total arrecadado
          </div>
          <div className="mt-1 font-display text-xl text-primary">
            {BR.format(totalReceitas)}
          </div>
        </Card>
        {REVENUE_SOURCE_OPTIONS.map((s) => (
          <Card key={s} className="p-3">
            <div className="text-xs text-muted-foreground truncate">
              {REVENUE_SOURCE_LABEL[s]}
            </div>
            <div className="mt-1 font-display text-lg text-foreground">
              {BR.format(totaisPorFonte.get(s) ?? 0)}
            </div>
          </Card>
        ))}
      </div>

      {/* Lista ------------------------------------------------------ */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-display text-lg">Histórico de receitas</h3>
          <p className="text-xs text-muted-foreground">
            {revenues.length} registro{revenues.length === 1 ? '' : 's'} · ordem mais recente primeiro
          </p>
        </div>
        {revenues.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma receita registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-vortex-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Fonte</th>
                  <th className="px-4 py-2 text-left">Descrição</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {revenues.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDateBR(r.revenue_date)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-vortex-surface/60 px-2 py-0.5 text-xs">
                        {REVENUE_SOURCE_LABEL[r.source_type]}
                      </span>
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate">
                      {r.description || (
                        <span className="text-muted-foreground italic">
                          (sem descrição)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-emerald-400">
                      {BR.format(r.amount)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToDelete(r.id)}
                        aria-label="Excluir receita"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir receita?"
        description="Esta ação não pode ser desfeita. O registro será removido permanentemente."
        onConfirm={handleDelete}
      />
    </div>
  );
}

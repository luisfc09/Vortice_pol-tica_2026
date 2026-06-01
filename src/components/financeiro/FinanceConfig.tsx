// FinanceConfig — formulário da aba "Configurações" do módulo financeiro.
// Edita 1 linha em campaign_finance_config (1 por campanha). Usa upsert
// via hook useFinanceiro.

import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useFinanceiro } from '@/hooks/useFinanceiro';

// Estado do formulário em strings para permitir edição livre. Persistimos
// como number (ou null pra campos vazios opcionais).
interface FormState {
  budget_total: string;
  semaforo_verde_max: string;
  semaforo_amarelo_max: string;
  meta_votos_geral: string;
  notes: string;
}

const BR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function parseNumber(s: string): number | null {
  if (!s.trim()) return null;
  // Aceita "1.234,56" (pt-BR) ou "1234.56" (en-US).
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function FinanceConfig() {
  const { config, upsertConfig } = useFinanceiro();
  const [form, setForm] = useState<FormState>({
    budget_total: '',
    semaforo_verde_max: '25',
    semaforo_amarelo_max: '40',
    meta_votos_geral: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Sincroniza form com o config carregado do banco.
  useEffect(() => {
    if (!config) return;
    setForm({
      budget_total:
        config.budget_total != null ? String(config.budget_total) : '',
      semaforo_verde_max: String(config.semaforo_verde_max),
      semaforo_amarelo_max: String(config.semaforo_amarelo_max),
      meta_votos_geral:
        config.meta_votos_geral != null ? String(config.meta_votos_geral) : '',
      notes: config.notes ?? '',
    });
  }, [config]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const verde = parseNumber(form.semaforo_verde_max);
    const amarelo = parseNumber(form.semaforo_amarelo_max);
    if (verde == null || amarelo == null) {
      toast.error('Faixas do semáforo precisam ser números válidos.');
      return;
    }
    if (verde >= amarelo) {
      toast.error('Faixa verde deve ser MENOR que a amarela.');
      return;
    }
    setSaving(true);
    const result = await upsertConfig({
      budget_total: parseNumber(form.budget_total),
      semaforo_verde_max: verde,
      semaforo_amarelo_max: amarelo,
      meta_votos_geral: form.meta_votos_geral
        ? Math.max(0, Math.round(parseNumber(form.meta_votos_geral) ?? 0))
        : null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (result) {
      toast.success('Configurações salvas.');
    } else {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h3 className="font-display text-lg">Configuração financeira</h3>
        <p className="text-sm text-muted-foreground">
          Defina o orçamento total, a meta de votos e as faixas do semáforo
          de custo/voto. Essas regras determinam a cor de cada cidade nas
          tabelas e widgets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="budget_total">Orçamento total (R$)</Label>
          <Input
            id="budget_total"
            type="text"
            inputMode="decimal"
            value={form.budget_total}
            onChange={(e) => update('budget_total', e.target.value)}
            placeholder="Ex.: 5000000"
          />
          {parseNumber(form.budget_total) != null ? (
            <p className="text-xs text-muted-foreground">
              {BR.format(parseNumber(form.budget_total) ?? 0)}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meta_votos">Meta de votos (geral)</Label>
          <Input
            id="meta_votos"
            type="text"
            inputMode="numeric"
            value={form.meta_votos_geral}
            onChange={(e) => update('meta_votos_geral', e.target.value)}
            placeholder="Ex.: 150000"
          />
          <p className="text-xs text-muted-foreground">
            Opcional — sem valor, usa a meta definida no cadastro da campanha.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-vortex-surface/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-vortex-violet" />
          Faixas do semáforo (R$ por voto)
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="verde">Verde até (R$/voto)</Label>
            <Input
              id="verde"
              type="text"
              inputMode="decimal"
              value={form.semaforo_verde_max}
              onChange={(e) => update('semaforo_verde_max', e.target.value)}
            />
            <p className="text-xs text-emerald-400">
              ≤ {form.semaforo_verde_max || '?'} R$/voto = excelente
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amarelo">Amarelo até (R$/voto)</Label>
            <Input
              id="amarelo"
              type="text"
              inputMode="decimal"
              value={form.semaforo_amarelo_max}
              onChange={(e) => update('semaforo_amarelo_max', e.target.value)}
            />
            <p className="text-xs text-amber-400">
              ≤ {form.semaforo_amarelo_max || '?'} R$/voto = atenção. Acima = vermelho.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Notas internas sobre o orçamento, política de gastos, etc."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </Button>
      </div>
    </Card>
  );
}

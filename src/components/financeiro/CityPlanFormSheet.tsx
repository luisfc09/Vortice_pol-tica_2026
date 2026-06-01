// CityPlanFormSheet — formulário de criação/edição de FinanceCityPlan.
// Usado pelo FinanceCityTable e na aba "Planejamento da Cidade" (single
// city). Em vez de inputs separados, agrupa em 3 seções: identificação,
// planejado, realizado.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import type { FinanceCityPlan } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plano em edição. null = criar novo. */
  plan: FinanceCityPlan | null;
  /** Cidade default na criação (e.g. campaign.target_municipalities[0]) */
  defaultMunicipalityCode?: string;
}

interface F {
  municipality_code: string;
  city_name: string;
  polo_logistico: string;
  meta_votos_2022: string;
  meta_votos_2026: string;
  // PLANEJADO
  coord_name: string;
  coord_value: string;
  cabos_qty: string;
  cabo_unit_value: string;
  vehicles_qty: string;
  vehicles_cost: string;
  fuel_cost: string;
  materials_cost: string;
  others_cost: string;
  // REALIZADO
  coord_value_real: string;
  cabos_cost_real: string;
  vehicles_cost_real: string;
  fuel_cost_real: string;
  materials_cost_real: string;
  others_cost_real: string;
  notes: string;
}

function emptyForm(): F {
  return {
    municipality_code: '',
    city_name: '',
    polo_logistico: '',
    meta_votos_2022: '0',
    meta_votos_2026: '0',
    coord_name: '',
    coord_value: '0',
    cabos_qty: '0',
    cabo_unit_value: '0',
    vehicles_qty: '0',
    vehicles_cost: '0',
    fuel_cost: '0',
    materials_cost: '0',
    others_cost: '0',
    coord_value_real: '',
    cabos_cost_real: '',
    vehicles_cost_real: '',
    fuel_cost_real: '',
    materials_cost_real: '',
    others_cost_real: '',
    notes: '',
  };
}

function parseNum(s: string): number {
  if (!s.trim()) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseNumOrNull(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function CityPlanFormSheet({
  open,
  onOpenChange,
  plan,
  defaultMunicipalityCode,
}: Props) {
  const { createCityPlan, updateCityPlan } = useFinanceiro();
  const [form, setForm] = useState<F>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Carrega valores quando abre.
  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm({
        municipality_code: plan.municipality_code ?? '',
        city_name: plan.city_name,
        polo_logistico: plan.polo_logistico ?? '',
        meta_votos_2022: String(plan.meta_votos_2022),
        meta_votos_2026: String(plan.meta_votos_2026),
        coord_name: plan.coord_name ?? '',
        coord_value: String(plan.coord_value),
        cabos_qty: String(plan.cabos_qty),
        cabo_unit_value: String(plan.cabo_unit_value),
        vehicles_qty: String(plan.vehicles_qty),
        vehicles_cost: String(plan.vehicles_cost),
        fuel_cost: String(plan.fuel_cost),
        materials_cost: String(plan.materials_cost),
        others_cost: String(plan.others_cost),
        coord_value_real:
          plan.coord_value_real != null ? String(plan.coord_value_real) : '',
        cabos_cost_real:
          plan.cabos_cost_real != null ? String(plan.cabos_cost_real) : '',
        vehicles_cost_real:
          plan.vehicles_cost_real != null
            ? String(plan.vehicles_cost_real)
            : '',
        fuel_cost_real:
          plan.fuel_cost_real != null ? String(plan.fuel_cost_real) : '',
        materials_cost_real:
          plan.materials_cost_real != null
            ? String(plan.materials_cost_real)
            : '',
        others_cost_real:
          plan.others_cost_real != null ? String(plan.others_cost_real) : '',
        notes: plan.notes ?? '',
      });
    } else {
      const f = emptyForm();
      if (defaultMunicipalityCode) {
        const m = MG_MUNICIPALITIES.find(
          (mu) => mu.code === defaultMunicipalityCode,
        );
        if (m) {
          f.municipality_code = m.code;
          f.city_name = m.name;
        }
      }
      setForm(f);
    }
  }, [open, plan, defaultMunicipalityCode]);

  function up<K extends keyof F>(k: K, v: F[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.city_name.trim()) {
      toast.error('Selecione um município.');
      return;
    }
    setSaving(true);
    const payload = {
      city_name: form.city_name,
      municipality_code: form.municipality_code || null,
      polo_logistico: form.polo_logistico.trim() || null,
      meta_votos_2022: Math.max(0, Math.round(parseNum(form.meta_votos_2022))),
      meta_votos_2026: Math.max(0, Math.round(parseNum(form.meta_votos_2026))),
      coord_name: form.coord_name.trim() || null,
      coord_value: parseNum(form.coord_value),
      cabos_qty: Math.max(0, Math.round(parseNum(form.cabos_qty))),
      cabo_unit_value: parseNum(form.cabo_unit_value),
      vehicles_qty: Math.max(0, Math.round(parseNum(form.vehicles_qty))),
      vehicles_cost: parseNum(form.vehicles_cost),
      fuel_cost: parseNum(form.fuel_cost),
      materials_cost: parseNum(form.materials_cost),
      others_cost: parseNum(form.others_cost),
      coord_value_real: parseNumOrNull(form.coord_value_real),
      cabos_cost_real: parseNumOrNull(form.cabos_cost_real),
      vehicles_cost_real: parseNumOrNull(form.vehicles_cost_real),
      fuel_cost_real: parseNumOrNull(form.fuel_cost_real),
      materials_cost_real: parseNumOrNull(form.materials_cost_real),
      others_cost_real: parseNumOrNull(form.others_cost_real),
      notes: form.notes.trim() || null,
    };

    const result = plan
      ? await updateCityPlan(plan.id, payload)
      : await createCityPlan(payload);
    setSaving(false);
    if (result) {
      toast.success(plan ? 'Cidade atualizada.' : 'Cidade cadastrada.');
      onOpenChange(false);
    } else {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {plan ? 'Editar cidade' : 'Adicionar cidade ao planejamento'}
          </SheetTitle>
          <SheetDescription>
            Custos planejados (orçamento) e realizados (gasto efetivo).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* IDENTIFICAÇÃO --------------------------------------- */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-vortex-violet">
              Identificação
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Município *</Label>
                <MunicipalityCombobox
                  value={form.municipality_code}
                  onChange={(code, name) => {
                    up('municipality_code', code);
                    up('city_name', name);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Polo logístico</Label>
                <Input
                  value={form.polo_logistico}
                  onChange={(e) => up('polo_logistico', e.target.value)}
                  placeholder="Ex.: Sul de Minas"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Votos 2022</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.meta_votos_2022}
                  onChange={(e) => up('meta_votos_2022', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meta 2026</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.meta_votos_2026}
                  onChange={(e) => up('meta_votos_2026', e.target.value)}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* PLANEJADO ------------------------------------------- */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
              Planejado (orçamento)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Coordenador (nome)</Label>
                <Input
                  value={form.coord_name}
                  onChange={(e) => up('coord_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Custo coordenador (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.coord_value}
                  onChange={(e) => up('coord_value', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cabos eleitorais (qtd)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.cabos_qty}
                  onChange={(e) => up('cabos_qty', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor unitário/cabo (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.cabo_unit_value}
                  onChange={(e) => up('cabo_unit_value', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Veículos (qtd)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.vehicles_qty}
                  onChange={(e) => up('vehicles_qty', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Custo veículos (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.vehicles_cost}
                  onChange={(e) => up('vehicles_cost', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Combustível (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.fuel_cost}
                  onChange={(e) => up('fuel_cost', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Materiais (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.materials_cost}
                  onChange={(e) => up('materials_cost', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Outros (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.others_cost}
                  onChange={(e) => up('others_cost', e.target.value)}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* REALIZADO ------------------------------------------- */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              Realizado (gasto efetivo)
            </h4>
            <p className="text-xs text-muted-foreground">
              Deixe em branco enquanto não houver execução. Quando você
              preencher pelo menos um campo, a cidade passa a usar o
              realizado para calcular o semáforo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Coordenador (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.coord_value_real}
                  onChange={(e) => up('coord_value_real', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cabos eleitorais (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.cabos_cost_real}
                  onChange={(e) => up('cabos_cost_real', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Veículos (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.vehicles_cost_real}
                  onChange={(e) => up('vehicles_cost_real', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Combustível (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.fuel_cost_real}
                  onChange={(e) => up('fuel_cost_real', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Materiais (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.materials_cost_real}
                  onChange={(e) => up('materials_cost_real', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Outros (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.others_cost_real}
                  onChange={(e) => up('others_cost_real', e.target.value)}
                />
              </div>
            </div>
          </section>

          <Separator />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => up('notes', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : plan ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

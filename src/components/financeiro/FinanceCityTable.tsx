// FinanceCityTable — aba "Planejamento por Cidade" do módulo financeiro.
// Tabela com uma linha por município + ações CRUD + semáforo computado
// pelo summarizeCity() do hook. Em modo single-city (Prefeito/Vereador)
// continua usando a mesma tabela — só que a UX típica terá 1 linha só.

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { SemaforoIndicator } from './SemaforoIndicator';
import { CityPlanFormSheet } from './CityPlanFormSheet';
import { ImportCityPlansXls } from './ImportCityPlansXls';
import { isSingleCityScope } from '@/lib/financeScope';
import type { FinanceCityPlan, FinanceCitySummary } from '@/types';

const BR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const NUM = new Intl.NumberFormat('pt-BR');

function normTxt(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function FinanceCityTable() {
  const session = useEffectiveSession();
  const { citySummaries, deleteCityPlan } = useFinanceiro();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<FinanceCityPlan | null>(null);
  const [toDelete, setToDelete] = useState<FinanceCityPlan | null>(null);
  const [query, setQuery] = useState('');

  const office = session?.campaign?.office ?? '';
  const isSingle = isSingleCityScope(office);
  const defaultMuniCode =
    session?.campaign?.target_municipalities?.[0] ?? undefined;

  const filtered = useMemo<FinanceCitySummary[]>(() => {
    const q = normTxt(query.trim());
    if (!q) return citySummaries;
    return citySummaries.filter((s) =>
      normTxt(s.plan.city_name).includes(q),
    );
  }, [citySummaries, query]);

  function handleEdit(p: FinanceCityPlan) {
    setEditing(p);
    setOpenForm(true);
  }
  function handleNew() {
    setEditing(null);
    setOpenForm(true);
  }
  async function handleDelete() {
    if (!toDelete) return;
    await deleteCityPlan(toDelete.id);
    setToDelete(null);
    toast.success('Cidade removida do planejamento.');
  }

  return (
    <div className="space-y-4">
      {/* Toolbar ------------------------------------------------------ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {citySummaries.length} cidade{citySummaries.length === 1 ? '' : 's'}
            {isSingle ? ' · cargo de cidade única' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSingle ? (
            <>
              <Input
                type="search"
                placeholder="Buscar cidade…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full sm:w-64"
              />
              {/* Importação por planilha — só faz sentido em cargos multi-cidade */}
              <ImportCityPlansXls />
            </>
          ) : null}
          <Button
            onClick={handleNew}
            disabled={isSingle && citySummaries.length >= 1}
            title={
              isSingle && citySummaries.length >= 1
                ? 'Cargos de cidade única já têm o planejamento criado'
                : undefined
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            {isSingle ? 'Cadastrar planejamento' : 'Adicionar cidade'}
          </Button>
        </div>
      </div>

      {/* Tabela ------------------------------------------------------- */}
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {citySummaries.length === 0
              ? 'Nenhuma cidade no planejamento ainda.'
              : 'Nenhuma cidade corresponde à busca.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-vortex-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cidade</th>
                  <th className="px-3 py-2 text-left">Polo</th>
                  <th className="px-3 py-2 text-right">Meta 2026</th>
                  <th className="px-3 py-2 text-right">Planejado</th>
                  <th className="px-3 py-2 text-right">Realizado</th>
                  <th className="px-3 py-2 text-right">R$/voto</th>
                  <th className="px-3 py-2 text-center">Semáforo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cpvUsed =
                    s.custo_por_voto_realizado ?? s.custo_por_voto_planejado;
                  return (
                    <tr
                      key={s.plan.id}
                      className="border-t border-border/40 hover:bg-vortex-surface/30"
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.plan.city_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.plan.polo_logistico || '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {NUM.format(s.plan.meta_votos_2026)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {BR.format(s.total_planejado)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.total_realizado != null ? (
                          BR.format(s.total_realizado)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {cpvUsed != null ? (
                          BR.format(cpvUsed)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <SemaforoIndicator color={s.semaforo} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(s.plan)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(s.plan)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CityPlanFormSheet
        open={openForm}
        onOpenChange={setOpenForm}
        plan={editing}
        defaultMunicipalityCode={defaultMuniCode}
      />

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Excluir "${toDelete?.city_name ?? ''}" do planejamento?`}
        description="Os custos planejados e realizados desta cidade serão perdidos. Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
      />
    </div>
  );
}

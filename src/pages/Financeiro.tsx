// Página /financeiro — Módulo Financeiro do Vórtice.
//
// 4 tabs (ordem aprovada): Visão Geral · Planejamento (Cidade/Cidades) ·
// Receitas · Configurações.
//
// O label da aba "Planejamento" muda conforme o cargo (Prefeito/Vereador
// → singular; Governador/Deputado/Senador → plural), via getFinanceLabel().

import {
  LayoutDashboard,
  Building2,
  Wallet,
  Settings as SettingsIcon,
  DollarSign,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceVisaoGeral } from '@/components/financeiro/FinanceVisaoGeral';
import { FinanceCityTable } from '@/components/financeiro/FinanceCityTable';
import { FinanceRevenueList } from '@/components/financeiro/FinanceRevenueList';
import { FinanceConfig } from '@/components/financeiro/FinanceConfig';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { getFinanceLabel } from '@/lib/financeScope';

export default function FinanceiroPage() {
  const session = useEffectiveSession();
  const office = session?.campaign?.office ?? '';
  const { planejamentoTitle, planejamentoSubtitle } = getFinanceLabel(office);

  return (
    <div className="space-y-6">
      {/* Header ------------------------------------------------------ */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Financeiro
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Orçamento, receitas e custo por voto da campanha de{' '}
          {session?.campaign?.candidate_name ?? '—'}.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="mr-1 h-4 w-4" />
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="cities">
            <Building2 className="mr-1 h-4 w-4" />
            {planejamentoTitle}
          </TabsTrigger>
          <TabsTrigger value="revenues">
            <Wallet className="mr-1 h-4 w-4" />
            Receitas
          </TabsTrigger>
          <TabsTrigger value="config">
            <SettingsIcon className="mr-1 h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <FinanceVisaoGeral />
        </TabsContent>

        <TabsContent value="cities" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{planejamentoSubtitle}</p>
          <FinanceCityTable />
        </TabsContent>

        <TabsContent value="revenues" className="mt-4">
          <FinanceRevenueList />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <FinanceConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}

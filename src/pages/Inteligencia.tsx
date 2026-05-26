import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResumoExecutivo } from '@/components/inteligencia/ResumoExecutivo';
import { DistribuicaoVotos } from '@/components/inteligencia/DistribuicaoVotos';
import { CruzamentosEstrategicos } from '@/components/inteligencia/CruzamentosEstrategicos';
import { TemasAnalise } from '@/components/inteligencia/TemasAnalise';
import { InsightsIA } from '@/components/inteligencia/InsightsIA';
import { AgendaRecomendada } from '@/components/inteligencia/AgendaRecomendada';
import { SegmentosCard } from '@/components/inteligencia/SegmentosCard';
import { useIntelligence } from '@/hooks/useIntelligence';
import { reliabilityOf, RELIABILITY_LABEL } from '@/types';

export default function InteligenciaPage() {
  const { intelligence, ai_filled, running, sample, refresh } = useIntelligence();
  const reliability = reliabilityOf(intelligence.total_interviews);

  return (
    <div className="space-y-5">
      {/* Header / resumo executivo — visível em todas as abas */}
      <ResumoExecutivo
        intelligence={intelligence}
        reliability={reliability}
        ai_filled={ai_filled}
        running={running}
        onRefresh={() => void refresh()}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="segments">Segmentos</TabsTrigger>
          <TabsTrigger value="territories">Territórios</TabsTrigger>
          <TabsTrigger value="themes">Temas</TabsTrigger>
          <TabsTrigger value="report">Relatório PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DistribuicaoVotos data={intelligence.vote_intention_dist} />
            <CruzamentosEstrategicos intelligence={intelligence} />
          </div>
          <TemasAnalise
            themes={intelligence.themes_ranking}
            gov={intelligence.gov_ratings}
            sentiment={intelligence.sentiment_analysis}
          />
          <InsightsIA
            insights={intelligence.strategic_insights}
            risks={intelligence.risk_alerts}
            opportunities={intelligence.opportunities}
            limit={4}
          />
          <AgendaRecomendada actions={intelligence.recommended_actions} />
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <SegmentosCard
            conversion={intelligence.segments_to_convert}
            risks={intelligence.segments_at_risk}
            messages={intelligence.mensagens_por_segmento}
          />
          <InsightsIA
            insights={intelligence.strategic_insights}
            risks={[]}
            opportunities={intelligence.opportunities}
          />
        </TabsContent>

        <TabsContent value="territories" className="space-y-4">
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              Temas por município
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Top temas em cada cidade onde a campanha tem cobertura
            </p>
            {Object.keys(intelligence.themes_by_region).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem cobertura territorial suficiente. Amplie a coleta em mais
                municípios pra ver o recorte.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.entries(intelligence.themes_by_region).map(([city, themes]) => (
                  <li
                    key={city}
                    className="rounded-lg border border-vortex-border bg-vortex-bg/30 p-3"
                  >
                    <p className="font-semibold text-foreground">{city}</p>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {themes.slice(0, 4).map((t) => (
                        <li
                          key={t.theme}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-foreground/90">{t.theme}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {t.pct}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              Intenção de voto por município
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Onde está o terreno fértil e onde está disputa
            </p>
            <ul className="space-y-2 text-sm">
              {intelligence.crossings.intention_by_municipality.slice(0, 10).map((row) => (
                <li
                  key={row.rowKey}
                  className="rounded-lg border border-vortex-border bg-vortex-bg/30 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-foreground">{row.rowKey}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.total} respostas
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-vortex-bg/60">
                    {row.cells.map((c) => {
                      const color =
                        /apoiador$/i.test(c.colKey)
                          ? '#A3E635'
                          : /tendência a apoiar/i.test(c.colKey)
                            ? '#84CC16'
                            : /indeciso/i.test(c.colKey)
                              ? '#F59E0B'
                              : /tendência à oposição/i.test(c.colKey)
                                ? '#EF4444'
                                : '#B91C1C';
                      return (
                        <div
                          key={c.colKey}
                          style={{ width: `${c.pct}%`, backgroundColor: color }}
                          title={`${c.colKey}: ${c.pct}%`}
                        />
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="themes" className="space-y-4">
          <TemasAnalise
            themes={intelligence.themes_ranking}
            gov={intelligence.gov_ratings}
            sentiment={intelligence.sentiment_analysis}
          />
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              Temas por perfil
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              O que cada segmento mais cita como prioridade
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(intelligence.themes_by_profile).map(([profile, themes]) => (
                <li
                  key={profile}
                  className="rounded-lg border border-vortex-border bg-vortex-bg/30 p-3"
                >
                  <p className="font-semibold text-foreground">{profile}</p>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {themes.map((t) => (
                      <li
                        key={t.theme}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-foreground/90">{t.theme}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 print:hidden">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              Relatório completo
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Use Cmd+P / Ctrl+P pra gerar PDF no padrão de institutos.
            </p>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>

          {/* Conteúdo do PDF — usa .print-area do index.css */}
          <div className="print-area space-y-4">
            <header className="border-b border-vortex-border pb-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Relatório de Inteligência Eleitoral
              </p>
              <h1 className="font-display text-3xl tracking-wide text-foreground">
                Vórtice · {intelligence.total_interviews} entrevistas
              </h1>
              <p className="text-xs text-muted-foreground">
                Gerado em {new Date(intelligence.generated_at).toLocaleString('pt-BR')} ·{' '}
                {RELIABILITY_LABEL[reliability]}
              </p>
            </header>

            {intelligence.resumo_executivo ? (
              <section className="print-avoid-break">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Resumo executivo
                </p>
                <p className="text-sm text-foreground/90">
                  {intelligence.resumo_executivo}
                </p>
              </section>
            ) : null}

            <DistribuicaoVotos data={intelligence.vote_intention_dist} />
            <TemasAnalise
              themes={intelligence.themes_ranking}
              gov={intelligence.gov_ratings}
              sentiment={intelligence.sentiment_analysis}
            />
            <InsightsIA
              insights={intelligence.strategic_insights}
              risks={intelligence.risk_alerts}
              opportunities={intelligence.opportunities}
            />
            <AgendaRecomendada actions={intelligence.recommended_actions} />
            <SegmentosCard
              conversion={intelligence.segments_to_convert}
              risks={intelligence.segments_at_risk}
              messages={intelligence.mensagens_por_segmento}
            />

            {intelligence.comparacao_institutos ? (
              <section className="print-avoid-break rounded-lg border border-vortex-border bg-vortex-bg/30 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Metodologia</p>
                <p>{intelligence.comparacao_institutos.metodologia}</p>
                <p>
                  Margem de erro estimada:{' '}
                  {intelligence.comparacao_institutos.margem_erro_estimada}
                </p>
                <p>
                  Confiabilidade: {intelligence.comparacao_institutos.confiabilidade}
                </p>
                {intelligence.comparacao_institutos.ressalvas ? (
                  <p>Ressalvas: {intelligence.comparacao_institutos.ressalvas}</p>
                ) : null}
              </section>
            ) : null}

            <footer className="border-t border-vortex-border pt-2 text-[11px] text-muted-foreground">
              Vórtice · {sample.total} entrevistas · {sample.deepenedRatio}% completas
              · gerado em {new Date().toLocaleString('pt-BR')}
            </footer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

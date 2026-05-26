import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  Pencil,
  Printer,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import { collections, useCollection } from '@/lib/data';
import { exportInterviewAsJson, printInterview } from '@/lib/interview-export';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';
import {
  AGE_RANGE_LABEL,
  CANDIDATE_AWARENESS_LABEL,
  CANDIDATE_OPINION_LABEL,
  CITY_PROBLEM_LABEL,
  COUNTRY_DIRECTION_LABEL,
  EDUCATION_LABEL,
  GENDER_LABEL,
  GOV_RATING_LABEL,
  INCOME_LABEL,
  RELIGION_LABEL,
  VOTE_DECISION_LABEL,
  VOTE_INTENTION_LABEL,
  WORK_STATUS_LABEL,
  isInterviewDeepened,
  type FieldInterview,
} from '@/types';

// --------------------------------------------------------------------------
// Helpers visuais
// --------------------------------------------------------------------------

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">
        {value === null || value === undefined || value === ''
          ? <span className="text-muted-foreground">—</span>
          : value}
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-avoid-break rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
      <header className="mb-3">
        <h3 className="font-display text-lg tracking-wide text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Stars({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <span aria-label={`${value} de 5`}>
      {'★'.repeat(value)}
      <span className="text-muted-foreground">{'★'.repeat(5 - value)}</span>{' '}
      <span className="text-xs text-muted-foreground">({value}/5)</span>
    </span>
  );
}

// --------------------------------------------------------------------------

export default function CampoEntrevistaDetalhePage() {
  const params = useParams();
  const interviews = useCollection(collections.interviews);
  const i = useMemo<FieldInterview | null>(() => {
    if (!params.id) return null;
    return interviews.find((x) => x.id === params.id) ?? null;
  }, [interviews, params.id]);

  if (params.id && !i) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/historico">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <EmptyState
          title="Entrevista não encontrada"
          description="O registro pode ter sido removido ou ainda não sincronizou neste dispositivo."
        />
      </div>
    );
  }
  if (!i) return null;

  const deepened = isInterviewDeepened(i);
  const muni = i.municipality_code ? MUNI_COORDS[i.municipality_code]?.name : null;
  const createdAt = new Date(i.created_at);
  const duration = i.interview_duration_seconds;
  const durationLabel =
    duration != null
      ? `${Math.floor(duration / 60)}min ${duration % 60}s`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Barra de ações — escondida na impressão */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/historico">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/campo/entrevista/${i.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              Editar dados
            </Link>
          </Button>
          {deepened ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/campo/entrevista/${i.id}/questionario`}>
                <FileText className="h-3.5 w-3.5" />
                Editar questionário
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to={`/campo/entrevista/${i.id}/questionario`}>
                <Sparkles className="h-3.5 w-3.5" />
                Aprofundar
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={printInterview}>
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportInterviewAsJson(i)}>
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Área que vai pro PDF */}
      <div className="print-area space-y-5">
        {/* Cabeçalho */}
        <header className="print-avoid-break border-b border-vortex-border pb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Entrevista de campo · {format(createdAt, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
          </p>
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            {i.voter_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {deepened ? (
              <Badge variant="success" className="gap-1">
                <Sparkles className="h-3 w-3" /> Completa
              </Badge>
            ) : (
              <Badge variant="outline">Básica</Badge>
            )}
            <Badge variant="outline">{VOTE_INTENTION_LABEL[i.vote_intention]}</Badge>
            {i.vote_decided ? <Badge variant="success">Decidido</Badge> : null}
            {durationLabel ? (
              <Badge variant="outline">⏱ {durationLabel}</Badge>
            ) : null}
          </div>
        </header>

        {/* Identificação */}
        <Section title="Identificação" subtitle="Dados básicos coletados no campo">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Telefone" value={i.voter_phone} />
            <Field label="Município" value={muni ?? '—'} />
            <Field label="Bairro" value={i.neighborhood} />
            <Field
              label="Coordenadas (GPS)"
              value={
                i.lat != null && i.lng != null
                  ? `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}`
                  : '—'
              }
            />
          </div>
          {(i.lat != null && i.lng != null) || muni ? (
            <div className="mt-3 print:hidden">
              <OpenInMapsButton
                size="sm"
                variant="outline"
                label="Ver local no Maps"
                mode="search"
                target={{
                  lat: i.lat,
                  lng: i.lng,
                  bairro: i.neighborhood,
                  cidade: muni ?? null,
                  uf: 'MG',
                }}
              />
            </div>
          ) : null}
        </Section>

        {/* Bloco rápido */}
        <Section title="Resposta inicial" subtitle="Fluxo rápido da entrevista">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Intenção de voto" value={VOTE_INTENTION_LABEL[i.vote_intention]} />
            <Field label="Receptividade" value={`${i.receptivity_score}/5`} />
            <Field
              label="Decidiu o voto?"
              value={i.vote_decided ? 'Sim' : 'Não'}
            />
            <Field
              label="Temas prioritários"
              value={
                i.priority_themes.length > 0 ? i.priority_themes.join(', ') : '—'
              }
              full
            />
            <Field label="Observações iniciais" value={i.notes} full />
          </div>
        </Section>

        {/* Questionário aprofundado — só aparece se preenchido */}
        {deepened ? (
          <>
            <Section
              title="Bloco 1 · Perfil"
              subtitle="Sociodemográfico"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Faixa etária"
                  value={i.age_range ? AGE_RANGE_LABEL[i.age_range] : null}
                />
                <Field
                  label="Gênero"
                  value={i.gender ? GENDER_LABEL[i.gender] : null}
                />
                <Field
                  label="Escolaridade"
                  value={i.education ? EDUCATION_LABEL[i.education] : null}
                />
                <Field
                  label="Renda familiar"
                  value={i.income_range ? INCOME_LABEL[i.income_range] : null}
                />
                <Field
                  label="Situação"
                  value={i.work_status ? WORK_STATUS_LABEL[i.work_status] : null}
                />
                <Field
                  label="Religião"
                  value={i.religion ? RELIGION_LABEL[i.religion] : null}
                />
              </div>
            </Section>

            <Section title="Bloco 2 · Cenário eleitoral" subtitle="Decisão e percepção sobre a candidatura">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Decisão de voto"
                  value={
                    i.vote_decision ? VOTE_DECISION_LABEL[i.vote_decision] : null
                  }
                />
                <Field
                  label="Conhecimento sobre o candidato"
                  value={
                    i.candidate_awareness
                      ? CANDIDATE_AWARENESS_LABEL[i.candidate_awareness]
                      : null
                  }
                />
                <Field
                  label="Opinião"
                  value={
                    i.candidate_opinion
                      ? CANDIDATE_OPINION_LABEL[i.candidate_opinion]
                      : null
                  }
                />
                <Field
                  label="O que poderia convencer"
                  value={i.conversion_argument}
                  full
                />
              </div>
            </Section>

            <Section title="Bloco 3 · Temas e prioridades" subtitle="Pauta local + avaliação de serviços">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Maior problema da cidade"
                  value={
                    i.main_city_problem
                      ? CITY_PROBLEM_LABEL[i.main_city_problem]
                      : null
                  }
                />
                <Field
                  label="Temas importantes p/ deputado"
                  value={
                    i.important_themes && i.important_themes.length > 0
                      ? i.important_themes.join(', ')
                      : null
                  }
                />
                <Field label="Avaliação · Saúde" value={<Stars value={i.health_rating} />} />
                <Field label="Avaliação · Segurança" value={<Stars value={i.security_rating} />} />
                <Field label="Avaliação · Emprego" value={<Stars value={i.employment_rating} />} />
                <Field
                  label="Maior incômodo no bairro"
                  value={i.neighborhood_complaint}
                  full
                />
              </div>
            </Section>

            <Section title="Bloco 4 · Avaliação de governo">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Governo estadual (MG)"
                  value={
                    i.state_gov_rating ? GOV_RATING_LABEL[i.state_gov_rating] : null
                  }
                />
                <Field
                  label="Governo federal"
                  value={
                    i.federal_gov_rating
                      ? GOV_RATING_LABEL[i.federal_gov_rating]
                      : null
                  }
                />
                <Field
                  label="Prefeitura local"
                  value={
                    i.city_gov_rating ? GOV_RATING_LABEL[i.city_gov_rating] : null
                  }
                />
                <Field
                  label="Brasil — caminho"
                  value={
                    i.country_direction
                      ? COUNTRY_DIRECTION_LABEL[i.country_direction]
                      : null
                  }
                />
              </div>
            </Section>

            <Section title="Bloco 5 · Observações de campo">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Receptividade aprofundada"
                  value={`${i.receptivity_score}/5`}
                />
                <Field
                  label="Potencial multiplicador / liderança"
                  value={i.is_potential_leader ? 'Sim' : 'Não'}
                />
                <Field
                  label="Aceitou receber contato"
                  value={i.accepted_contact ? 'Sim' : 'Não'}
                />
                <Field label="Observações detalhadas" value={i.notes} full />
              </div>
            </Section>
          </>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90 print:hidden">
            <strong className="text-amber-200">Esta entrevista ainda é básica.</strong>{' '}
            Os blocos sociodemográficos, de cenário, governo etc. ainda não foram
            respondidos. Use o botão{' '}
            <Link
              to={`/campo/entrevista/${i.id}/questionario`}
              className="underline underline-offset-2"
            >
              Aprofundar
            </Link>{' '}
            no topo desta tela.
          </div>
        )}

        {/* Análise da IA */}
        {i.ai_analysis ? (
          <Section
            title="Análise da IA"
            subtitle="Resumo automático com base nas respostas"
          >
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Perfil:</span>{' '}
                {i.ai_analysis.perfil_resumido}
              </p>
              <p>
                <span className="font-semibold">Argumento-chave:</span>{' '}
                {i.ai_analysis.argumento_chave}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Potencial:</span>{' '}
                <Badge
                  variant={
                    i.ai_analysis.potencial_conversao === 'alto'
                      ? 'success'
                      : i.ai_analysis.potencial_conversao === 'medio'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {i.ai_analysis.potencial_conversao}
                </Badge>
                {i.ai_analysis.tags.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </p>
              <p>
                <span className="font-semibold">Próximo passo:</span>{' '}
                {i.ai_analysis.proximo_passo}
              </p>
            </div>
          </Section>
        ) : null}

        {/* Rodapé do PDF */}
        <footer className="mt-6 border-t border-vortex-border pt-3 text-[11px] text-muted-foreground">
          Vórtice · entrevista #{i.id.slice(0, 8)} · exportado em{' '}
          {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </footer>
      </div>
    </div>
  );
}

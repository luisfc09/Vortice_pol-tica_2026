import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { QuestionarioTimer } from '@/components/field/QuestionarioTimer';
import {
  BLOCK_TITLES,
  CampoBlock,
  CenarioBlock,
  EMPTY_QUESTIONARIO,
  GovernoBlock,
  PerfilBlock,
  TemasBlock,
  type QuestionarioState,
} from '@/components/field/QuestionarioBlocks';
import { collections, useCollection } from '@/lib/data';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { FieldInterview, InterviewAIAnalysis } from '@/types';

export default function CampoQuestionarioPage() {
  const params = useParams();
  const navigate = useNavigate();
  const interviews = useCollection(collections.interviews);

  const interview = useMemo<FieldInterview | null>(() => {
    if (!params.id) return null;
    return interviews.find((i) => i.id === params.id) ?? null;
  }, [interviews, params.id]);

  // Estado do questionário. Hidrata da entrevista quando ela aparece.
  const [state, setState] = useState<QuestionarioState>(EMPTY_QUESTIONARIO);
  const [block, setBlock] = useState(0);
  const startedAtRef = useRef<number>(performance.now());
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<InterviewAIAnalysis | null>(null);

  // Quando a entrevista chega via realtime/hidratação, preenche o estado
  // com o que já estiver salvo (suporta retomar de onde parou).
  useEffect(() => {
    if (!interview) return;
    setState({
      age_range: interview.age_range,
      gender: interview.gender,
      education: interview.education,
      income_range: interview.income_range,
      work_status: interview.work_status,
      religion: interview.religion,
      vote_decision: interview.vote_decision,
      candidate_awareness: interview.candidate_awareness,
      candidate_opinion: interview.candidate_opinion,
      conversion_argument: interview.conversion_argument,
      main_city_problem: interview.main_city_problem,
      important_themes: interview.important_themes ?? [],
      health_rating: interview.health_rating,
      security_rating: interview.security_rating,
      employment_rating: interview.employment_rating,
      neighborhood_complaint: interview.neighborhood_complaint,
      state_gov_rating: interview.state_gov_rating,
      federal_gov_rating: interview.federal_gov_rating,
      city_gov_rating: interview.city_gov_rating,
      country_direction: interview.country_direction,
      notes_extra: null,
      receptivity_field: interview.receptivity_score,
      is_potential_leader: interview.is_potential_leader ?? false,
      accepted_contact: interview.accepted_contact ?? false,
    });
  }, [interview?.id]);

  function patch(next: Partial<QuestionarioState>) {
    setState((s) => ({ ...s, ...next }));
  }

  // Salva o conteúdo do bloco atual em background ao avançar. Mantém
  // status='draft' até a finalização. Se o usuário fechar a página
  // metade do caminho, volta na próxima sessão com o que digitou.
  async function persistDraft() {
    if (!interview) return;
    collections.interviews.update(interview.id, {
      age_range: state.age_range,
      gender: state.gender,
      education: state.education,
      income_range: state.income_range,
      work_status: state.work_status,
      religion: state.religion,
      vote_decision: state.vote_decision,
      candidate_awareness: state.candidate_awareness,
      candidate_opinion: state.candidate_opinion,
      conversion_argument: state.conversion_argument,
      main_city_problem: state.main_city_problem,
      important_themes:
        state.important_themes.length > 0 ? state.important_themes : null,
      health_rating: state.health_rating,
      security_rating: state.security_rating,
      employment_rating: state.employment_rating,
      neighborhood_complaint: state.neighborhood_complaint,
      state_gov_rating: state.state_gov_rating,
      federal_gov_rating: state.federal_gov_rating,
      city_gov_rating: state.city_gov_rating,
      country_direction: state.country_direction,
    });
  }

  function next() {
    void persistDraft();
    setBlock((b) => Math.min(BLOCK_TITLES.length - 1, b + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function back() {
    setBlock((b) => Math.max(0, b - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Chamada à edge function de IA. Falha silenciosa — análise é opcional.
  async function callAI(): Promise<InterviewAIAnalysis | null> {
    if (!interview || USE_MOCKS) return null;
    try {
      const { data, error } = await supabase.functions.invoke('interview-analyze', {
        body: { interview_id: interview.id },
      });
      if (error) {
        console.warn('interview-analyze indisponível:', error.message);
        return null;
      }
      return (data?.analysis as InterviewAIAnalysis | undefined) ?? null;
    } catch (err) {
      console.warn('Falha ao chamar IA:', err);
      return null;
    }
  }

  async function finalize() {
    if (!interview) return;
    setSaving(true);
    try {
      const elapsedSec = Math.floor((performance.now() - startedAtRef.current) / 1000);
      // Salva tudo + status='complete'. Notes preserva o que veio do form
      // rápido + bloco 5 anexa as observações do questionário.
      const combinedNotes = [interview.notes, state.notes_extra]
        .filter((x) => !!x && x!.trim().length > 0)
        .join('\n\n— Questionário aprofundado —\n');

      collections.interviews.update(interview.id, {
        age_range: state.age_range,
        gender: state.gender,
        education: state.education,
        income_range: state.income_range,
        work_status: state.work_status,
        religion: state.religion,
        vote_decision: state.vote_decision,
        candidate_awareness: state.candidate_awareness,
        candidate_opinion: state.candidate_opinion,
        conversion_argument: state.conversion_argument,
        main_city_problem: state.main_city_problem,
        important_themes:
          state.important_themes.length > 0 ? state.important_themes : null,
        health_rating: state.health_rating,
        security_rating: state.security_rating,
        employment_rating: state.employment_rating,
        neighborhood_complaint: state.neighborhood_complaint,
        state_gov_rating: state.state_gov_rating,
        federal_gov_rating: state.federal_gov_rating,
        city_gov_rating: state.city_gov_rating,
        country_direction: state.country_direction,
        is_potential_leader: state.is_potential_leader,
        accepted_contact: state.accepted_contact,
        receptivity_score: state.receptivity_field,
        notes: combinedNotes || null,
        interview_duration_seconds: elapsedSec,
        status: 'complete',
      });

      // IA é opcional. Toast intermediário pra dar feedback.
      const aiToast = toast.loading('Gerando análise da IA…');
      const result = await callAI();
      toast.dismiss(aiToast);

      if (result) {
        setAnalysis(result);
        // Salva o resultado da IA na linha existente.
        collections.interviews.update(interview.id, { ai_analysis: result });
      }
      toast.success('Entrevista completa salva.');
      // Mostra a tela de análise por alguns segundos antes de redirecionar.
      // Se não houve IA, vai direto pra /campo.
      if (!result) {
        navigate('/campo');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao finalizar.');
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------------------------------------------

  if (params.id && !interview) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/historico">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <EmptyState
          title="Entrevista não encontrada"
          description="O registro pode ter sido removido ou ainda não sincronizou."
        />
      </div>
    );
  }

  // Tela de análise pós-save (se IA respondeu).
  if (analysis) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            <p className="font-semibold text-emerald-100">Análise da IA</p>
          </div>
          <p className="mb-3 text-sm text-emerald-100/90">
            <strong>Perfil:</strong> {analysis.perfil_resumido}
          </p>
          <p className="mb-3 text-sm text-emerald-100/90">
            <strong>Argumento-chave:</strong> {analysis.argumento_chave}
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={
                analysis.potencial_conversao === 'alto'
                  ? 'success'
                  : analysis.potencial_conversao === 'medio'
                    ? 'warning'
                    : 'outline'
              }
            >
              Potencial: {analysis.potencial_conversao}
            </Badge>
            {analysis.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-emerald-100/90">
            <strong>Próximo passo:</strong> {analysis.proximo_passo}
          </p>
        </div>

        <Button onClick={() => navigate('/campo')} size="lg" className="w-full">
          <CheckCheck className="h-4 w-4" />
          Voltar ao Campo
        </Button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render principal: stepper + bloco atual + navegação
  // ------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/historico">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <QuestionarioTimer startedAt={startedAtRef.current} />
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Questionário aprofundado
        </p>
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          {interview?.voter_name ?? '…'}
        </h2>
      </div>

      {/* Stepper */}
      <ol className="flex gap-1">
        {BLOCK_TITLES.map((t, i) => {
          const state =
            i < block ? 'done' : i === block ? 'active' : 'pending';
          return (
            <li
              key={t}
              className={cn(
                'flex-1 rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors',
                state === 'active' &&
                  'border-primary bg-primary/10 text-primary',
                state === 'done' &&
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                state === 'pending' &&
                  'border-vortex-border bg-vortex-surface/40 text-muted-foreground',
              )}
            >
              {i + 1}. {t}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
        {block === 0 && <PerfilBlock value={state} onChange={patch} />}
        {block === 1 && <CenarioBlock value={state} onChange={patch} />}
        {block === 2 && <TemasBlock value={state} onChange={patch} />}
        {block === 3 && <GovernoBlock value={state} onChange={patch} />}
        {block === 4 && <CampoBlock value={state} onChange={patch} />}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          disabled={block === 0 || saving}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {block < BLOCK_TITLES.length - 1 ? (
          <Button type="button" onClick={next} disabled={saving}>
            Próximo
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void finalize()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar entrevista completa
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

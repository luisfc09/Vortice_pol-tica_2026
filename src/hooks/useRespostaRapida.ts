// Estado global do stepper de Resposta Rápida.
// - 5 passos com navegação livre
// - Persistência em localStorage (não perde se atualizar a página)
// - Timer ininterrupto desde a publicação da menção
// - Reset ao concluir/cancelar

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { collections } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { analisarMencao, gerarRespostas } from '@/lib/respostaRapida';
import type {
  AnaliseMencao,
  ContextoLegislativo,
  Mention,
  RespostaGerada,
} from '@/types';

export type StepIndex = 1 | 2 | 3 | 4 | 5;

interface PersistedState {
  step: StepIndex;
  mentionId: string | null;
  analise: AnaliseMencao | null;
  contexto: ContextoLegislativo;
  respostas: RespostaGerada[] | null;
  selectedIndex: number | null;
  draftText: string;
  edited: boolean;
  startedAtIso: string | null; // quando o stepper começou (para tempo de resposta)
}

const STORAGE_KEY = 'vortice.resposta-rapida.v1';

const EMPTY_CONTEXT: ContextoLegislativo = {
  votacao_real: '',
  presenca_real: '',
  projetos_apresentados: '',
  fonte: '',
  contexto_extra: '',
};

const INITIAL: PersistedState = {
  step: 1,
  mentionId: null,
  analise: null,
  contexto: { ...EMPTY_CONTEXT },
  respostas: null,
  selectedIndex: null,
  draftText: '',
  edited: false,
  startedAtIso: null,
};

function readPersisted(): PersistedState {
  if (typeof window === 'undefined') return INITIAL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as PersistedState;
    return { ...INITIAL, ...parsed };
  } catch {
    return INITIAL;
  }
}

function writePersisted(s: PersistedState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useRespostaRapida() {
  const session = useAuthStore((s) => s.session);
  const navigate = useNavigate();
  const [state, setState] = useState<PersistedState>(() => readPersisted());

  // Persiste a cada mudança
  useEffect(() => {
    writePersisted(state);
  }, [state]);

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resolve a Mention atual a partir do mentionId persistido
  const mention: Mention | null = useMemo(() => {
    if (!state.mentionId) return null;
    return collections.mentions.get(state.mentionId) ?? null;
  }, [state.mentionId]);

  function set(patch: Partial<PersistedState>) {
    setState((cur) => ({ ...cur, ...patch }));
  }

  function reset() {
    setState(INITIAL);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  // PASSO 1 -------------------------------------------------------------------
  function selectMention(m: Mention) {
    set({
      mentionId: m.id,
      step: 2,
      analise: null,
      contexto: { ...EMPTY_CONTEXT },
      respostas: null,
      selectedIndex: null,
      draftText: '',
      edited: false,
      startedAtIso: new Date().toISOString(),
    });
  }

  // PASSO 2 -------------------------------------------------------------------
  async function runAnalyze() {
    if (!mention || !session?.campaign) return;
    setAnalyzing(true);
    try {
      const res = await analisarMencao(mention, session.campaign);
      set({ analise: res.analise });
      toast.success(`Análise gerada por ${res.provider}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  function skipAnalyze() {
    set({
      analise: state.analise ?? {
        alegacao_central: 'Análise pulada — assessor preencheu manualmente.',
        dados_citados: [],
        tom: 'desconhecido',
        audiencia: 'desconhecida',
        urgencia: 5,
        tipo_ataque: 'desconhecido',
      },
      step: 3,
    });
  }

  // PASSO 3 -------------------------------------------------------------------
  function updateContext(patch: Partial<ContextoLegislativo>) {
    set({ contexto: { ...state.contexto, ...patch } });
  }

  // PASSO 4 -------------------------------------------------------------------
  async function runGenerate() {
    if (!mention || !session?.campaign || !state.analise) return;
    setGenerating(true);
    try {
      const res = await gerarRespostas(
        mention,
        session.campaign,
        state.analise,
        state.contexto,
      );
      set({ respostas: res.respostas });
      toast.success(`${res.respostas.length} respostas geradas por ${res.provider}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function selectResposta(idx: number) {
    const r = state.respostas?.[idx];
    if (!r) return;
    set({ selectedIndex: idx, draftText: r.texto, edited: false, step: 5 });
  }

  function updateDraft(texto: string) {
    const originalTexto = state.respostas?.[state.selectedIndex ?? 0]?.texto;
    set({ draftText: texto, edited: texto !== originalTexto });
  }

  // PASSO 5 -------------------------------------------------------------------
  async function aprovar({
    publicada,
    publicada_em,
  }: {
    publicada: boolean;
    publicada_em: string | null;
  }): Promise<boolean> {
    if (!session?.campaign || !mention) return false;
    if (state.selectedIndex == null || !state.respostas) return false;
    const escolhida = state.respostas[state.selectedIndex];
    const tempoSegundos = state.startedAtIso
      ? Math.round((Date.now() - +new Date(state.startedAtIso)) / 1000)
      : null;
    setSaving(true);
    try {
      collections.mention_responses.create({
        data: {
          campaign_id: session.campaign.id,
          mention_id: mention.id,
          resposta_texto: state.draftText,
          estilo: escolhida.estilo,
          editada: state.edited,
          aprovada_por: session.id,
          aprovada_at: new Date().toISOString(),
          publicada,
          publicada_em,
          tempo_resposta_s: tempoSegundos,
          analise: state.analise,
          contexto: state.contexto,
        },
      });
      toast.success(publicada ? 'Resposta publicada e arquivada.' : 'Rascunho salvo.');
      reset();
      navigate('/mencoes/resposta-rapida/historico');
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function goTo(step: StepIndex) {
    set({ step });
  }

  function copyDraft(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return Promise.resolve();
    }
    return navigator.clipboard.writeText(state.draftText);
  }

  // Tempo decorrido (atualiza a cada segundo)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!state.startedAtIso) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.startedAtIso]);

  const elapsedSeconds = state.startedAtIso
    ? Math.floor((Date.now() - +new Date(state.startedAtIso)) / 1000)
    : 0;
  // referência para silenciar lint sobre tick não usado
  void tick;

  // Janela ideal: até 2h depois da publicação da menção
  const mentionAgeMs = mention ? Date.now() - +new Date(mention.published_at) : 0;
  const janelaExpirada = mention ? mentionAgeMs > 2 * 3_600_000 : false;

  return {
    state,
    mention,
    analyzing,
    generating,
    saving,
    elapsedSeconds,
    janelaExpirada,
    selectMention,
    runAnalyze,
    skipAnalyze,
    updateContext,
    runGenerate,
    selectResposta,
    updateDraft,
    aprovar,
    goTo,
    reset,
    copyDraft,
  };
}

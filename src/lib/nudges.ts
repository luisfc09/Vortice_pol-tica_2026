// ============================================================================
// Nudges pessoais do usuário logado — mensagens motivacionais/gamificadas
// baseadas na atividade da PRÓPRIA rede (não da campanha inteira).
// ----------------------------------------------------------------------------
// Diferente dos alertas da campanha (alertDetector.ts / tabela `alerts`, que
// são gerais: município inativo, meta baixa, financeiro…), estes nudges são
// derivados em tempo real da sub-árvore do usuário e do ranking. Não são
// persistidos — recomputam a cada render. Ficam na Central de Alertas do
// apoiador/liderança que constrói rede em /minha-rede.
//
// Regras (pedido do cliente):
//   • "Você não fez nenhum cadastro hoje" — sem novos indicados hoje.
//   • "Já convidou alguém hoje?" — CTA de multiplicação por link.
//   • "Fulano te ultrapassou no ranking" — caiu de posição desde a última
//     visita (comparado via posição anterior, guardada no localStorage pelo
//     hook useMeusNudges — aqui recebemos só o número).
// ============================================================================

import { computePipScore, indexByParent } from '@/lib/hierarchy';
import type { Supporter } from '@/types';

export type NudgeTone = 'acao' | 'convite' | 'ranking' | 'positivo';

export interface Nudge {
  id: string;
  tone: NudgeTone;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface ComputeNudgesArgs {
  /** Nó do usuário logado em supporters (resolvido por created_by + email). */
  me: Supporter;
  supporters: Supporter[];
  now: Date;
  /** Posição no ranking na última visita (localStorage). null = sem baseline. */
  previousPosition?: number | null;
}

export interface NudgesResult {
  nudges: Nudge[];
  /** Posição atual no ranking (1-based) ou null se fora do ranking. */
  myPosition: number | null;
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function firstName(full: string): string {
  const p = full.trim().split(/\s+/).filter(Boolean);
  return p[0] ?? full;
}

export function computeNudges({
  me,
  supporters,
  now,
  previousPosition,
}: ComputeNudgesArgs): NudgesResult {
  const nudges: Nudge[] = [];
  const byParent = indexByParent(supporters);

  // Novos indicados diretos cadastrados HOJE (referrer_id === me.id).
  const novosHoje = supporters.filter(
    (s) => s.referrer_id === me.id && isSameLocalDay(s.created_at, now),
  ).length;

  // Ranking — MESMA lógica do RankingRede (/minha-rede): indicações desc,
  // desempate por pip_score desc. Só entram quem tem indicação (ou o próprio).
  const rows = supporters
    .map((s) => ({
      id: s.id,
      name: s.name,
      indicacoes: byParent.get(s.id)?.length ?? 0,
      pip: computePipScore(supporters, s.id),
      isMe: s.id === me.id,
    }))
    .filter((r) => r.indicacoes > 0 || r.isMe)
    .sort((a, b) =>
      b.indicacoes !== a.indicacoes ? b.indicacoes - a.indicacoes : b.pip - a.pip,
    );

  const myIndex = rows.findIndex((r) => r.isMe);
  const myPosition = myIndex >= 0 ? myIndex + 1 : null;
  const above = myIndex > 0 ? rows[myIndex - 1] : null;
  const myIndicacoes = myIndex >= 0 ? rows[myIndex].indicacoes : 0;

  // --- 1) Atividade de cadastro hoje --------------------------------------
  if (novosHoje === 0) {
    nudges.push({
      id: 'sem-cadastro-hoje',
      tone: 'acao',
      title: 'Nenhum cadastro hoje',
      message:
        'Você ainda não cadastrou ninguém hoje. Faça agora pra não ficar pra trás no ranking da campanha.',
      actionLabel: 'Cadastrar apoiador',
      actionRoute: '/minha-rede',
    });
  } else {
    nudges.push({
      id: 'cadastro-feito-hoje',
      tone: 'positivo',
      title: 'Boa! 🚀',
      message: `Você já trouxe ${novosHoje} ${
        novosHoje === 1 ? 'pessoa' : 'pessoas'
      } hoje. Continue pra subir no ranking.`,
    });
  }

  // --- 2) Convite / multiplicação -----------------------------------------
  if (me.invite_code) {
    nudges.push({
      id: 'convite-hoje',
      tone: 'convite',
      title: 'Multiplique sua rede',
      message:
        'Já convidou alguém hoje? Envie seu link pros amigos multiplicarem na nossa campanha e você subir de nível no ranking.',
      actionLabel: 'Convidar por link',
      actionRoute: '/minha-rede',
    });
  }

  // --- 3) Ranking ----------------------------------------------------------
  if (
    previousPosition != null &&
    myPosition != null &&
    myPosition > previousPosition &&
    above
  ) {
    // Caiu de posição desde a última visita → alguém te ultrapassou.
    nudges.push({
      id: 'ranking-ultrapassado',
      tone: 'ranking',
      title: 'Você foi ultrapassado',
      message: `${firstName(
        above.name,
      )} te ultrapassou no ranking — você está em Nº ${myPosition}. Convide agora mais pessoas pra recuperar e subir de nível.`,
      actionLabel: 'Convidar',
      actionRoute: '/minha-rede',
    });
  } else if (myPosition === 1 && myIndicacoes > 0) {
    nudges.push({
      id: 'ranking-lider',
      tone: 'positivo',
      title: 'Você lidera! 🏆',
      message: 'Você é o Nº 1 da sua rede. Continue convidando pra manter a liderança.',
    });
  } else if (above) {
    nudges.push({
      id: 'ranking-suba',
      tone: 'ranking',
      title: 'Suba no ranking',
      message: `Você está em Nº ${myPosition} no ranking. ${firstName(
        above.name,
      )} está logo à frente — convide mais pessoas pra ultrapassar e subir de nível.`,
      actionLabel: 'Convidar',
      actionRoute: '/minha-rede',
    });
  } else if (myIndicacoes === 0) {
    nudges.push({
      id: 'ranking-comece',
      tone: 'ranking',
      title: 'Comece sua rede',
      message:
        'Convide alguém pra aparecer no ranking da campanha e começar a subir de nível.',
      actionLabel: 'Convidar',
      actionRoute: '/minha-rede',
    });
  }

  return { nudges, myPosition };
}

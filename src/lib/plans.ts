// Definição dos planos do Vórtice — fonte única de preço, limites e módulos.
//
// IMPORTANTE: as KEYS são as do enum do banco (campaign_plan): basico,
// intermediario, top. O label visível do `top` é "Avançado" (decisão de
// produto — não migramos o enum). Use sempre PLANS[plan].name pra exibir.

import type { CampaignPlan } from '@/types';

export interface PlanDef {
  /** Rótulo visível ao usuário. */
  name: string;
  /** Mensalidade em R$. */
  price: number;
  /** Classe de borda usada nos cards. */
  color: string;
  /** -1 = ilimitado. */
  limits: {
    supporters: number;
    voters: number;
    members: number;
  };
  /** Bullets exibidos no card. */
  features: string[];
  /** Módulos liberados — usados pro gating da Sidebar. */
  modules: string[];
}

export const PLANS: Record<CampaignPlan, PlanDef> = {
  basico: {
    name: 'Básico',
    price: 997.0,
    color: 'border-blue-500',
    limits: { supporters: 500, voters: 1000, members: 3 },
    features: [
      'Dashboard completo',
      'Mapa eleitoral',
      'Pesquisas de campo',
      'FAQ político',
      'Lideranças até 500',
      'Eleitores até 1.000',
      '3 membros na equipe',
      'Suporte por e-mail',
    ],
    modules: ['dashboard', 'mapa', 'campo', 'faq', 'liderancas', 'eleitores'],
  },
  intermediario: {
    name: 'Intermediário',
    price: 1997.0,
    color: 'border-purple-500',
    limits: { supporters: 5000, voters: 20000, members: 15 },
    features: [
      'Tudo do Básico',
      'Monitor de menções',
      'Resposta rápida com IA',
      'Dados TSE integrados',
      'Ranking da equipe',
      'Lideranças até 5.000',
      'Eleitores até 20.000',
      '15 membros na equipe',
      'Suporte por WhatsApp',
    ],
    modules: [
      'dashboard', 'mapa', 'campo', 'faq', 'liderancas', 'eleitores',
      'mencoes', 'resposta_rapida', 'tse', 'ranking',
    ],
  },
  top: {
    name: 'Avançado',
    price: 2497.0,
    color: 'border-primary',
    limits: { supporters: -1, voters: -1, members: -1 },
    features: [
      'Tudo do Intermediário',
      'Inteligência Eleitoral com IA',
      'Análise de 5.000+ entrevistas',
      'Lideranças ilimitadas',
      'Eleitores ilimitados',
      'Membros ilimitados',
      'Suporte WhatsApp prioritário',
    ],
    modules: [
      'dashboard', 'mapa', 'campo', 'faq', 'liderancas', 'eleitores',
      'mencoes', 'resposta_rapida', 'tse', 'ranking', 'inteligencia',
    ],
  },
};

// Ordem pra exibir cards (do mais barato ao mais caro).
export const PLAN_ORDER: CampaignPlan[] = ['basico', 'intermediario', 'top'];

export function getPlan(plan: CampaignPlan): PlanDef {
  return PLANS[plan];
}

export function getPlanLimits(plan: CampaignPlan) {
  return PLANS[plan].limits;
}

export function getPlanModules(plan: CampaignPlan): string[] {
  return PLANS[plan].modules;
}

// Plano libera o módulo? (gating da Sidebar / rotas premium)
export function hasFeature(plan: CampaignPlan | undefined | null, feature: string): boolean {
  if (!plan) return true; // sem plano definido (ex.: super admin) → não bloqueia
  return PLANS[plan].modules.includes(feature);
}

// Formata preço em BRL.
export function formatPlanPrice(plan: CampaignPlan): string {
  return PLANS[plan].price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// -1 vira "Ilimitado".
export function formatLimit(n: number): string {
  return n === -1 ? 'Ilimitado' : n.toLocaleString('pt-BR');
}

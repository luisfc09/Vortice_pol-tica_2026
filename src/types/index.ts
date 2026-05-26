// ============================================================================
// Vórtice — tipos globais
// Alinhados 1:1 ao schema em supabase/schema.sql
// ============================================================================

export type UserRole =
  | 'admin'
  | 'candidate'
  | 'coordinator'
  | 'researcher'
  | 'supporter'
  | 'leader'
  // Mantido para compatibilidade com dados antigos. Não aparece em UI.
  // Usuários existentes com este papel devem ser migrados para 'leader'.
  | 'field_agent';

export type VoteIntention =
  | 'apoiador'
  | 'tendencia_apoio'
  | 'indeciso'
  | 'tendencia_oposicao'
  | 'oposicao';

export type SupporterRoleType = 'lider' | 'cabo' | 'militante' | 'apoiador';

export type SupporterStatus = 'ativo' | 'inativo' | 'pendente';

export type MentionSource = 'twitter' | 'google_news' | 'manual';

export type Sentiment = 'positivo' | 'neutro' | 'negativo';

export type AlertType =
  // legacy (mantidos por compatibilidade)
  | 'spike_negativo'
  | 'municipio_inativo'
  | 'meta_atingida'
  | 'sistema'
  // novos (Central de Alertas)
  | 'municipio_sem_visita'
  | 'mencao_viral_negativa'
  | 'lideranca_inativa'
  | 'meta_municipio_baixa'
  | 'evento_sem_confirmacao'
  | 'cabo_sumido'
  | 'spike_negativo_mencoes'
  | 'municipio_sem_lideranca'
  | 'meta_geral_critica'
  | 'entrevistas_paradas';

export type AlertPriority = 'urgente' | 'critico' | 'atencao' | 'info';

export const ALERT_PRIORITY_LABEL: Record<AlertPriority, string> = {
  urgente: 'Urgente',
  critico: 'Crítico',
  atencao: 'Atenção',
  info: 'Informativo',
};

export type FaqCategory =
  | 'seguranca'
  | 'saude'
  | 'emprego'
  | 'educacao'
  | 'infraestrutura'
  | 'politica'
  | 'partido'
  | 'local_mg';

export type EventType = 'comicio' | 'reuniao' | 'visita' | 'midia' | 'outro';

// ----------------------------------------------------------------------------
// Entidades
// ----------------------------------------------------------------------------

export type CampaignStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export interface Campaign {
  id: string;
  name: string;
  candidate_name: string;
  party: string;
  party_number: string;
  state: string;
  office: string;
  election_year: number;
  logo_url: string | null;
  vote_target: number;
  slogan: string | null;
  status: CampaignStatus;
  trial_ends_at: string | null;
  notes: string | null;
  brand_logo_url: string | null;
  brand_primary_hex: string | null;
  brand_secondary_hex: string | null;
  created_at: string;
}

export interface CampaignOverview {
  id: string;
  candidate_name: string;
  party: string;
  party_number: string;
  state: string;
  office: string;
  election_year: number;
  status: CampaignStatus;
  trial_ends_at: string | null;
  notes: string | null;
  created_at: string;
  members_count: number;
  supporters_count: number;
  voters_count: number;
}

export type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek'
  | 'twitter'
  | 'google_news'
  | 'meta_ads'
  | 'google_ads'
  | 'whatsapp';

export type AiFeature =
  | 'mention_sentiment'
  | 'mention_insights'
  | 'reply_suggestions'
  | 'interview_analysis';

export interface AiFeatureConfig {
  campaign_id: string;
  feature: AiFeature;
  integration_id: string | null;
  model: string | null;
  options: Record<string, unknown>;
  updated_at: string;
}

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  mention_sentiment: 'Classificação de sentimento',
  mention_insights: 'Insights de menções',
  reply_suggestions: 'Sugestões de resposta',
  interview_analysis: 'Análise de entrevista aprofundada',
};

export const AI_FEATURE_HELP: Record<AiFeature, string> = {
  mention_sentiment: 'Avalia cada menção como positiva, neutra ou negativa.',
  mention_insights: 'Resumo agregado das últimas 50 menções (tópicos, sentimento líquido).',
  reply_suggestions: 'Gera respostas sugeridas com tom adequado para o contexto.',
  interview_analysis: 'Analisa entrevista aprofundada e sugere perfil + próximo passo.',
};

export interface Integration {
  id: string;
  campaign_id: string;
  type: IntegrationType;
  is_enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSafe {
  id: string;
  type: IntegrationType;
  is_enabled: boolean;
  config: Record<string, unknown>;
  has_secret: boolean;
  secret_keys: string[];
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  product_name: string;
  product_slogan: string;
  support_email: string;
  default_vote_target: number;
  default_trial_days: number;
  default_state: string;
  terms_url: string | null;
  privacy_url: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface CampaignMember {
  id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  profile: Profile | null;
}

export interface CampaignDetail {
  campaign: Campaign;
  members: CampaignMember[];
  metrics: {
    supporters_count: number;
    voters_count: number;
    interviews_count: number;
    events_count: number;
    mentions_count: number;
    alerts_open: number;
  };
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  trial: 'Trial',
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
};

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  municipality_code: string | null;
  must_change_password: boolean;
  created_at: string;
}

export interface CampaignUser {
  id: string;
  campaign_id: string;
  user_id: string;
  role: UserRole;
  invited_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Municipality {
  ibge_code: string;
  name: string;
  state: string;
  population: number;
  region: string;
}

export interface Supporter {
  id: string;
  campaign_id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  city: string | null; // derivado do município (legado, mantido pra compat)
  neighborhood: string | null;
  municipality_code: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  role: SupporterRoleType;
  status: SupporterStatus;
  created_by: string;
  created_at: string;
}

export interface Voter {
  id: string;
  campaign_id: string;
  name: string;
  phone: string | null;
  address: string | null; // legado — uso novo via cep+logradouro+numero
  city: string | null;
  neighborhood: string | null;
  municipality_code: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  vote_intention: VoteIntention;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_by: string;
  created_at: string;
}

// Status do ciclo de vida do questionário:
//   'basic'    → só formulário rápido salvo
//   'draft'    → usuário escolheu "Salvar e aprofundar" mas não finalizou
//   'complete' → questionário aprofundado respondido (ou registro pré-migration)
export type InterviewStatus = 'basic' | 'draft' | 'complete';

export type AgeRange = '16-24' | '25-34' | '35-44' | '45-59' | '60+';

export type Gender = 'masculino' | 'feminino' | 'outro' | 'prefere_nao_dizer';

export type Education = 'fundamental' | 'medio' | 'superior' | 'pos';

export type IncomeRange = 'ate_1sm' | '1_3sm' | '3_6sm' | '6_10sm' | '10sm_mais';

export type WorkStatus =
  | 'empregado'
  | 'autonomo'
  | 'desempregado'
  | 'aposentado'
  | 'estudante';

export type Religion =
  | 'catolico'
  | 'evangelico'
  | 'espirita'
  | 'sem_religiao'
  | 'outra';

export type VoteDecision =
  | 'decidido'
  | 'inclinado'
  | 'indeciso'
  | 'nao_vai_votar';

export type CandidateAwareness = 'conhece_bem' | 'ja_ouviu' | 'nao_conhece';

export type CandidateOpinion =
  | 'muito_positiva'
  | 'positiva'
  | 'neutra'
  | 'negativa'
  | 'muito_negativa';

export type GovRating = 'otimo' | 'bom' | 'regular' | 'ruim' | 'pessimo';

export type CountryDirection = 'certo' | 'errado' | 'nao_sabe';

export type CityProblem =
  | 'saude'
  | 'seguranca'
  | 'educacao'
  | 'emprego'
  | 'transporte'
  | 'infraestrutura'
  | 'corrupcao'
  | 'outro';

// Resposta da IA ao analisar a entrevista completa.
export interface InterviewAIAnalysis {
  perfil_resumido: string;
  argumento_chave: string;
  potencial_conversao: 'alto' | 'medio' | 'baixo';
  tags: string[];
  proximo_passo: string;
}

export interface FieldInterview {
  id: string;
  campaign_id: string;
  voter_name: string;
  voter_phone: string | null;
  municipality_code: string | null;
  neighborhood: string | null;
  vote_intention: VoteIntention;
  receptivity_score: number;
  priority_themes: string[];
  vote_decided: boolean;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_by: string;
  created_at: string;
  // Questionário aprofundado (migration 018). Todos nullable —
  // registros 'basic' têm tudo isso null.
  status: InterviewStatus;
  age_range: AgeRange | null;
  gender: Gender | null;
  education: Education | null;
  income_range: IncomeRange | null;
  work_status: WorkStatus | null;
  religion: Religion | null;
  vote_decision: VoteDecision | null;
  candidate_awareness: CandidateAwareness | null;
  candidate_opinion: CandidateOpinion | null;
  conversion_argument: string | null;
  main_city_problem: CityProblem | null;
  important_themes: string[] | null;
  health_rating: number | null; // 1-5
  security_rating: number | null; // 1-5
  employment_rating: number | null; // 1-5
  neighborhood_complaint: string | null;
  state_gov_rating: GovRating | null;
  federal_gov_rating: GovRating | null;
  city_gov_rating: GovRating | null;
  country_direction: CountryDirection | null;
  is_potential_leader: boolean | null;
  accepted_contact: boolean | null;
  ai_analysis: InterviewAIAnalysis | null;
  interview_duration_seconds: number | null;
}

// Helper: entrevista é considerada "completa" quando tem questionário
// aprofundado (qualquer campo do bloco Perfil preenchido).
export function isInterviewDeepened(i: FieldInterview): boolean {
  return i.status === 'complete' && !!i.age_range;
}

export interface CampaignEvent {
  id: string;
  campaign_id: string;
  title: string;
  location: string | null;
  city: string | null;
  date: string;
  type: EventType;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Mention {
  id: string;
  campaign_id: string;
  source: MentionSource;
  content: string;
  url: string | null;
  author: string | null;
  sentiment: Sentiment;
  sentiment_score: number;
  published_at: string;
  created_at: string;
}

export interface Alert {
  id: string;
  campaign_id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string | null;
  description: string | null;
  acao_sugerida: string | null;
  acao_label: string | null;
  acao_route: string | null;
  message: string; // legacy
  meta: Record<string, unknown> | null;
  is_read: boolean;
  is_resolved: boolean;
  expires_at: string | null;
  dedup_key: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Resposta Rápida — análise + respostas geradas + registro
// ----------------------------------------------------------------------------

export interface AnaliseMencao {
  alegacao_central: string;
  dados_citados: string[];
  tom: string;
  audiencia: string;
  urgencia: number; // 1-10
  tipo_ataque: string;
}

export interface ContextoLegislativo {
  votacao_real?: string;
  presenca_real?: string;
  projetos_apresentados?: string;
  fonte?: string;
  contexto_extra?: string;
}

export type RespostaEstilo = 'DIRETA' | 'HUMANIZADA' | 'PROPOSITIVA';
export type RespostaRisco = 'baixo' | 'medio' | 'alto';
export type Plataforma = 'X' | 'Instagram' | 'Facebook' | 'WhatsApp' | 'Outros';

export interface RespostaGerada {
  estilo: RespostaEstilo | string;
  titulo: string;
  texto: string;
  caracteres: number;
  adequada_para: string;
  risco: RespostaRisco;
  justificativa: string;
}

export interface MentionResponse {
  id: string;
  campaign_id: string;
  mention_id: string | null;
  resposta_texto: string;
  estilo: string | null;
  editada: boolean;
  aprovada_por: string | null;
  aprovada_at: string;
  publicada: boolean;
  publicada_em: string | null;
  tempo_resposta_s: number | null;
  analise: AnaliseMencao | null;
  contexto: ContextoLegislativo | null;
  created_at: string;
}

export interface FaqItem {
  id: string;
  campaign_id: string | null;
  category: FaqCategory;
  question: string;
  suggested_answer: string;
  support_data: string;
  avoid_saying: string;
  is_active: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Formulários (input shapes)
// ----------------------------------------------------------------------------

export interface FieldInterviewInput {
  voter_name: string;
  voter_phone: string;
  neighborhood: string;
  municipality_code: string;
  vote_intention: VoteIntention;
  receptivity_score: number;
  priority_themes: string[];
  vote_decided: boolean;
  notes: string;
  lat: number | null;
  lng: number | null;
}

export interface QueuedInterview extends FieldInterviewInput {
  local_id: string;
  queued_at: string;
  campaign_id: string;
  created_by: string;
}

// ----------------------------------------------------------------------------
// Sessão
// ----------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
  campaign: Campaign | null;
  role: UserRole | null;
  is_super_admin: boolean;
}

// ----------------------------------------------------------------------------
// Constantes de UI
// ----------------------------------------------------------------------------

export const VOTE_INTENTION_LABEL: Record<VoteIntention, string> = {
  apoiador: 'Apoiador',
  tendencia_apoio: 'Tendência a apoiar',
  indeciso: 'Indeciso',
  tendencia_oposicao: 'Tendência à oposição',
  oposicao: 'Oposição',
};

export const VOTE_INTENTION_COLOR: Record<VoteIntention, string> = {
  apoiador: 'bg-vortex-lime/20 text-vortex-lime border-vortex-lime/40',
  tendencia_apoio: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  indeciso: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  tendencia_oposicao: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  oposicao: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  candidate: 'Candidato/Político',
  coordinator: 'Coordenador',
  researcher: 'Pesquisador',
  supporter: 'Apoiador',
  leader: 'Liderança',
  field_agent: 'Agente de campo (legado)',
};

// Lista canônica de papéis oferecidos em formulários e selects da UI.
// `field_agent` ficou fora propositalmente — só aparece em registros
// antigos enquanto não rodam o UPDATE da migration 015.
export const ROLE_OPTIONS: readonly UserRole[] = [
  'admin',
  'candidate',
  'coordinator',
  'researcher',
  'supporter',
  'leader',
] as const;

// Texto curto explicando o que cada papel pode fazer. Usado nos selects.
export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: 'Controle total da campanha.',
  candidate: 'Visualização executiva; aprovação de respostas.',
  coordinator: 'Gerencia campo, equipe e operação.',
  researcher: 'Leitura + análise de menções e dados.',
  supporter: 'Apoiador estruturado com login.',
  leader: 'Liderança local que registra cadastros em campo.',
  field_agent: 'Papel legado — migrar para Liderança.',
};

export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  seguranca: 'Segurança',
  saude: 'Saúde',
  emprego: 'Emprego',
  educacao: 'Educação',
  infraestrutura: 'Infraestrutura',
  politica: 'Política',
  partido: 'Partido',
  local_mg: 'Local / MG',
};

// ----------------------------------------------------------------------------
// Labels do questionário aprofundado (migration 018)
// ----------------------------------------------------------------------------
export const AGE_RANGE_LABEL: Record<AgeRange, string> = {
  '16-24': '16 a 24 anos',
  '25-34': '25 a 34 anos',
  '35-44': '35 a 44 anos',
  '45-59': '45 a 59 anos',
  '60+': '60 anos ou mais',
};

export const GENDER_LABEL: Record<Gender, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
  prefere_nao_dizer: 'Prefere não dizer',
};

export const EDUCATION_LABEL: Record<Education, string> = {
  fundamental: 'Fundamental',
  medio: 'Médio',
  superior: 'Superior',
  pos: 'Pós-graduação',
};

export const INCOME_LABEL: Record<IncomeRange, string> = {
  ate_1sm: 'Até 1 salário mínimo',
  '1_3sm': '1 a 3 salários',
  '3_6sm': '3 a 6 salários',
  '6_10sm': '6 a 10 salários',
  '10sm_mais': 'Acima de 10 salários',
};

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  empregado: 'Empregado',
  autonomo: 'Autônomo',
  desempregado: 'Desempregado',
  aposentado: 'Aposentado',
  estudante: 'Estudante',
};

export const RELIGION_LABEL: Record<Religion, string> = {
  catolico: 'Católico',
  evangelico: 'Evangélico',
  espirita: 'Espírita',
  sem_religiao: 'Sem religião',
  outra: 'Outra',
};

export const VOTE_DECISION_LABEL: Record<VoteDecision, string> = {
  decidido: 'Já decidi',
  inclinado: 'Inclinado, posso mudar',
  indeciso: 'Indeciso',
  nao_vai_votar: 'Não vou votar',
};

export const CANDIDATE_AWARENESS_LABEL: Record<CandidateAwareness, string> = {
  conhece_bem: 'Conhece bem',
  ja_ouviu: 'Já ouviu falar',
  nao_conhece: 'Não conhece',
};

export const CANDIDATE_OPINION_LABEL: Record<CandidateOpinion, string> = {
  muito_positiva: 'Muito positiva',
  positiva: 'Positiva',
  neutra: 'Neutra/indiferente',
  negativa: 'Negativa',
  muito_negativa: 'Muito negativa',
};

export const GOV_RATING_LABEL: Record<GovRating, string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  regular: 'Regular',
  ruim: 'Ruim',
  pessimo: 'Péssimo',
};

export const COUNTRY_DIRECTION_LABEL: Record<CountryDirection, string> = {
  certo: 'Caminho certo',
  errado: 'Caminho errado',
  nao_sabe: 'Não sabe / não opinou',
};

export const CITY_PROBLEM_LABEL: Record<CityProblem, string> = {
  saude: 'Saúde',
  seguranca: 'Segurança pública',
  educacao: 'Educação',
  emprego: 'Emprego e renda',
  transporte: 'Transporte',
  infraestrutura: 'Infraestrutura urbana',
  corrupcao: 'Combate à corrupção',
  outro: 'Outro',
};

export const PRIORITY_THEMES = [
  'Segurança pública',
  'Saúde',
  'Educação',
  'Emprego e renda',
  'Infraestrutura',
  'Transporte',
  'Habitação',
  'Combate à corrupção',
  'Meio ambiente',
  'Cultura e esporte',
  'Assistência social',
  'Agronegócio',
] as const;

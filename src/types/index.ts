// ============================================================================
// Vórtice — tipos globais
// Alinhados 1:1 ao schema em supabase/schema.sql
// ============================================================================

export type UserRole = 'admin' | 'coordinator' | 'field_agent' | 'researcher';

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
  | 'reply_suggestions';

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
};

export const AI_FEATURE_HELP: Record<AiFeature, string> = {
  mention_sentiment: 'Avalia cada menção como positiva, neutra ou negativa.',
  mention_insights: 'Resumo agregado das últimas 50 menções (tópicos, sentimento líquido).',
  reply_suggestions: 'Gera respostas sugeridas com tom adequado para o contexto.',
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
  city: string;
  neighborhood: string | null;
  municipality_code: string | null;
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
  address: string | null;
  city: string;
  municipality_code: string | null;
  vote_intention: VoteIntention;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_by: string;
  created_at: string;
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
  coordinator: 'Coordenador',
  field_agent: 'Agente de campo',
  researcher: 'Pesquisador',
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

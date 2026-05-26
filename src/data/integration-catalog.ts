import type { IntegrationType } from '@/types';

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  placeholder?: string;
  help?: string;
  required: boolean;
}

export interface IntegrationSpec {
  type: IntegrationType;
  name: string;
  description: string;
  brand: string; // cor hex pra acentuar o card
  category: 'IA' | 'Coleta' | 'Mídia paga' | 'Mensageria';
  status: 'available' | 'soon';
  docsUrl?: string;
  // Para LLMs: modelos sugeridos no seletor
  models?: string[];
  // O que pedimos do usuário (vai pra integrations.secrets)
  fields: IntegrationField[];
  // Campos opcionais de config (vai pra integrations.config)
  configFields?: IntegrationField[];
}

// Provedores capazes de atender features de IA do app
export const LLM_PROVIDERS: IntegrationType[] = [
  'anthropic',
  'openai',
  'gemini',
  'mistral',
  'groq',
  'xai',
  'deepseek',
];

export function isLlmProvider(type: IntegrationType): boolean {
  return LLM_PROVIDERS.includes(type);
}

export const INTEGRATION_CATALOG: IntegrationSpec[] = [
  {
    type: 'anthropic',
    name: 'Anthropic (Claude)',
    description:
      'Modelos Claude — referência em raciocínio e respostas longas. Bom default para sentimento e insights.',
    brand: '#C8772A',
    category: 'IA',
    status: 'available',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-ant-api03-...',
        help: 'Obtenha em console.anthropic.com → Settings → API Keys.',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'model',
        label: 'Modelo padrão',
        type: 'text',
        placeholder: 'claude-sonnet-4-6',
        help: 'Modelo default quando uma feature não tem modelo específico.',
        required: false,
      },
    ],
  },
  {
    type: 'openai',
    name: 'OpenAI (GPT)',
    description:
      'GPT-4o, GPT-5 e variantes. Boa cobertura, ferramentas e function calling maduros.',
    brand: '#10A37F',
    category: 'IA',
    status: 'available',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'o4-mini'],
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-proj-...',
        help: 'Obtenha em platform.openai.com → API keys.',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'model',
        label: 'Modelo padrão',
        type: 'text',
        placeholder: 'gpt-4o-mini',
        required: false,
      },
      {
        key: 'organization',
        label: 'Organization ID (opcional)',
        type: 'text',
        placeholder: 'org-...',
        required: false,
      },
    ],
  },
  {
    type: 'gemini',
    name: 'Google Gemini',
    description:
      'Modelos Gemini do Google. Free tier generoso, bom para começar com baixo custo.',
    brand: '#4285F4',
    category: 'IA',
    status: 'available',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'AIza...',
        help: 'Obtenha em aistudio.google.com → Get API key.',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'model',
        label: 'Modelo padrão',
        type: 'text',
        placeholder: 'gemini-2.5-flash',
        required: false,
      },
    ],
  },
  {
    type: 'mistral',
    name: 'Mistral',
    description: 'Modelos abertos da Mistral. Bom custo-benefício para volume alto.',
    brand: '#FF7000',
    category: 'IA',
    status: 'soon',
    docsUrl: 'https://console.mistral.ai/',
    models: ['mistral-large-latest', 'mistral-small-latest'],
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    type: 'groq',
    name: 'Groq',
    description: 'Inferência ultra-rápida (Llama, Mixtral). Útil para classificação em batch.',
    brand: '#F55036',
    category: 'IA',
    status: 'soon',
    docsUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    type: 'xai',
    name: 'xAI (Grok)',
    description: 'Modelos Grok da xAI. Boa afinidade para análise de conteúdo do X.',
    brand: '#FFFFFF',
    category: 'IA',
    status: 'soon',
    docsUrl: 'https://x.ai/api',
    models: ['grok-2', 'grok-2-mini'],
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    type: 'deepseek',
    name: 'DeepSeek',
    description: 'Modelos chineses muito baratos com qualidade competitiva.',
    brand: '#1A6FF0',
    category: 'IA',
    status: 'soon',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true },
    ],
  },
  {
    type: 'twitter',
    name: 'X (Twitter) API v2',
    description:
      'Coleta de menções públicas ao candidato no X. Requer plano Basic ou superior do X API.',
    brand: '#1DA1F2',
    category: 'Coleta',
    status: 'available',
    docsUrl: 'https://developer.twitter.com/en/portal/products',
    fields: [
      {
        key: 'bearer_token',
        label: 'Bearer Token',
        type: 'password',
        placeholder: 'AAAAAAAAAAAAAA...',
        help: 'Project & App > Keys and tokens > Bearer Token.',
        required: true,
      },
    ],
    configFields: [
      {
        key: 'search_query',
        label: 'Query de busca',
        type: 'text',
        placeholder: '"Maria Andrade" OR @mariaandrade -is:retweet lang:pt',
        help: 'Operadores X API v2. Default: nome do candidato.',
        required: false,
      },
    ],
  },
  {
    type: 'google_news',
    name: 'Google News',
    description:
      'Coleta de notícias via RSS público (sem chave). Você só configura termos de busca.',
    brand: '#4285F4',
    category: 'Coleta',
    status: 'available',
    docsUrl: 'https://news.google.com/',
    fields: [],
    configFields: [
      {
        key: 'query',
        label: 'Termos de busca',
        type: 'text',
        placeholder: 'Maria Andrade governador MG',
        help: 'Frase usada na URL de busca do Google News.',
        required: true,
      },
      {
        key: 'language',
        label: 'Idioma',
        type: 'text',
        placeholder: 'pt-BR',
        required: false,
      },
    ],
  },
  {
    type: 'meta_ads',
    name: 'Meta Ads (Facebook/Instagram)',
    description: 'Métricas de campanha paga no Meta. ROI, alcance, CTR por anúncio.',
    brand: '#1877F2',
    category: 'Mídia paga',
    status: 'soon',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis/',
    fields: [
      {
        key: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
      },
      {
        key: 'ad_account_id',
        label: 'Ad Account ID',
        type: 'text',
        placeholder: 'act_1234567890',
        required: true,
      },
    ],
  },
  {
    type: 'google_ads',
    name: 'Google Ads',
    description: 'Métricas de Google Ads e Search. Necessário para análise de tráfego pago.',
    brand: '#EA4335',
    category: 'Mídia paga',
    status: 'soon',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/oauth/overview',
    fields: [
      {
        key: 'developer_token',
        label: 'Developer Token',
        type: 'password',
        required: true,
      },
      {
        key: 'customer_id',
        label: 'Customer ID',
        type: 'text',
        placeholder: '123-456-7890',
        required: true,
      },
    ],
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp Cloud API',
    description:
      'Envio automático de credenciais provisionadas + comunicação com equipe. Requer Meta Business.',
    brand: '#25D366',
    category: 'Mensageria',
    status: 'soon',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    fields: [
      {
        key: 'phone_number_id',
        label: 'Phone Number ID',
        type: 'text',
        required: true,
      },
      {
        key: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
      },
    ],
  },
];

export function specOf(type: IntegrationType): IntegrationSpec | undefined {
  return INTEGRATION_CATALOG.find((s) => s.type === type);
}

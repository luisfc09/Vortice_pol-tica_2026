// Seed da Inteligência Eleitoral — uma análise plausível pra o modo mock,
// servindo como demonstração visual da página /inteligencia sem precisar
// rodar a IA. Números calibrados pra uma campanha hipotética em MG.

import type { CampaignIntelligence } from '@/types';

export const SEED_INTELLIGENCE: CampaignIntelligence = {
  id: 'demo-intel-1',
  campaign_id: 'demo',
  generated_at: new Date().toISOString(),
  total_interviews: 847,

  vote_intention_dist: [
    { label: 'Apoiador', count: 491, pct: 58.0 },
    { label: 'Tendência a apoiar', count: 178, pct: 21.0 },
    { label: 'Indeciso', count: 102, pct: 12.0 },
    { label: 'Tendência à oposição', count: 50, pct: 6.0 },
    { label: 'Oposição', count: 26, pct: 3.0 },
  ],
  age_dist: [
    { label: '35 a 44 anos', count: 263, pct: 31.0 },
    { label: '45 a 59 anos', count: 220, pct: 26.0 },
    { label: '25 a 34 anos', count: 178, pct: 21.0 },
    { label: '60 anos ou mais', count: 110, pct: 13.0 },
    { label: '16 a 24 anos', count: 76, pct: 9.0 },
  ],
  gender_dist: [
    { label: 'Feminino', count: 466, pct: 55.0 },
    { label: 'Masculino', count: 364, pct: 43.0 },
    { label: 'Outro', count: 17, pct: 2.0 },
  ],
  religion_dist: [
    { label: 'Católico', count: 415, pct: 49.0 },
    { label: 'Evangélico', count: 254, pct: 30.0 },
    { label: 'Sem religião', count: 110, pct: 13.0 },
    { label: 'Espírita', count: 51, pct: 6.0 },
    { label: 'Outra', count: 17, pct: 2.0 },
  ],
  income_dist: [
    { label: '1 a 3 salários', count: 339, pct: 40.0 },
    { label: '3 a 6 salários', count: 254, pct: 30.0 },
    { label: 'Até 1 salário mínimo', count: 169, pct: 20.0 },
    { label: '6 a 10 salários', count: 60, pct: 7.1 },
    { label: 'Acima de 10 salários', count: 25, pct: 3.0 },
  ],
  education_dist: [
    { label: 'Médio', count: 423, pct: 50.0 },
    { label: 'Fundamental', count: 220, pct: 26.0 },
    { label: 'Superior', count: 169, pct: 20.0 },
    { label: 'Pós-graduação', count: 35, pct: 4.1 },
  ],

  crossings: {
    intention_by_age: [
      {
        rowKey: '35 a 44 anos',
        total: 263,
        cells: [
          { colKey: 'Apoiador', count: 174, pct: 66.1 },
          { colKey: 'Tendência a apoiar', count: 50, pct: 19.0 },
          { colKey: 'Indeciso', count: 26, pct: 9.8 },
          { colKey: 'Tendência à oposição', count: 8, pct: 3.0 },
          { colKey: 'Oposição', count: 5, pct: 1.9 },
        ],
      },
      {
        rowKey: '25 a 34 anos',
        total: 178,
        cells: [
          { colKey: 'Apoiador', count: 92, pct: 51.6 },
          { colKey: 'Tendência a apoiar', count: 41, pct: 23.0 },
          { colKey: 'Indeciso', count: 32, pct: 18.0 },
          { colKey: 'Tendência à oposição', count: 9, pct: 5.0 },
          { colKey: 'Oposição', count: 4, pct: 2.2 },
        ],
      },
    ],
    intention_by_religion: [
      {
        rowKey: 'Evangélico',
        total: 254,
        cells: [
          { colKey: 'Indeciso', count: 104, pct: 41.0 },
          { colKey: 'Apoiador', count: 86, pct: 33.8 },
          { colKey: 'Tendência a apoiar', count: 38, pct: 15.0 },
          { colKey: 'Tendência à oposição', count: 18, pct: 7.0 },
          { colKey: 'Oposição', count: 8, pct: 3.1 },
        ],
      },
      {
        rowKey: 'Católico',
        total: 415,
        cells: [
          { colKey: 'Apoiador', count: 274, pct: 66.0 },
          { colKey: 'Tendência a apoiar', count: 96, pct: 23.1 },
          { colKey: 'Indeciso', count: 32, pct: 7.7 },
          { colKey: 'Tendência à oposição', count: 9, pct: 2.2 },
          { colKey: 'Oposição', count: 4, pct: 1.0 },
        ],
      },
    ],
    intention_by_income: [
      {
        rowKey: '3 a 6 salários',
        total: 254,
        cells: [
          { colKey: 'Apoiador', count: 180, pct: 70.9 },
          { colKey: 'Tendência a apoiar', count: 50, pct: 19.7 },
          { colKey: 'Indeciso', count: 18, pct: 7.1 },
          { colKey: 'Tendência à oposição', count: 4, pct: 1.6 },
          { colKey: 'Oposição', count: 2, pct: 0.8 },
        ],
      },
      {
        rowKey: 'Até 1 salário mínimo',
        total: 169,
        cells: [
          { colKey: 'Indeciso', count: 64, pct: 37.9 },
          { colKey: 'Apoiador', count: 51, pct: 30.2 },
          { colKey: 'Tendência a apoiar', count: 32, pct: 18.9 },
          { colKey: 'Tendência à oposição', count: 14, pct: 8.3 },
          { colKey: 'Oposição', count: 8, pct: 4.7 },
        ],
      },
    ],
    intention_by_gender: [
      {
        rowKey: 'Feminino',
        total: 466,
        cells: [
          { colKey: 'Apoiador', count: 298, pct: 64.0 },
          { colKey: 'Tendência a apoiar', count: 98, pct: 21.0 },
          { colKey: 'Indeciso', count: 47, pct: 10.1 },
          { colKey: 'Tendência à oposição', count: 16, pct: 3.4 },
          { colKey: 'Oposição', count: 7, pct: 1.5 },
        ],
      },
      {
        rowKey: 'Masculino',
        total: 364,
        cells: [
          { colKey: 'Apoiador', count: 184, pct: 50.5 },
          { colKey: 'Tendência a apoiar', count: 76, pct: 20.9 },
          { colKey: 'Indeciso', count: 53, pct: 14.6 },
          { colKey: 'Tendência à oposição', count: 33, pct: 9.1 },
          { colKey: 'Oposição', count: 18, pct: 4.9 },
        ],
      },
    ],
    intention_by_municipality: [
      {
        rowKey: 'Belo Horizonte',
        total: 235,
        cells: [
          { colKey: 'Apoiador', count: 140, pct: 59.6 },
          { colKey: 'Tendência a apoiar', count: 56, pct: 23.8 },
          { colKey: 'Indeciso', count: 25, pct: 10.6 },
          { colKey: 'Tendência à oposição', count: 9, pct: 3.8 },
          { colKey: 'Oposição', count: 5, pct: 2.1 },
        ],
      },
      {
        rowKey: 'Montes Claros',
        total: 142,
        cells: [
          { colKey: 'Indeciso', count: 47, pct: 33.1 },
          { colKey: 'Apoiador', count: 56, pct: 39.4 },
          { colKey: 'Tendência a apoiar', count: 22, pct: 15.5 },
          { colKey: 'Tendência à oposição', count: 12, pct: 8.5 },
          { colKey: 'Oposição', count: 5, pct: 3.5 },
        ],
      },
      {
        rowKey: 'Uberlândia',
        total: 105,
        cells: [
          { colKey: 'Apoiador', count: 65, pct: 61.9 },
          { colKey: 'Tendência a apoiar', count: 22, pct: 21.0 },
          { colKey: 'Indeciso', count: 12, pct: 11.4 },
          { colKey: 'Tendência à oposição', count: 4, pct: 3.8 },
          { colKey: 'Oposição', count: 2, pct: 1.9 },
        ],
      },
    ],
    themes_by_intention: [
      {
        rowKey: 'Saúde',
        total: 288,
        cells: [
          { colKey: 'Apoiador', count: 142, pct: 49.3 },
          { colKey: 'Tendência a apoiar', count: 64, pct: 22.2 },
          { colKey: 'Indeciso', count: 56, pct: 19.4 },
          { colKey: 'Tendência à oposição', count: 18, pct: 6.3 },
          { colKey: 'Oposição', count: 8, pct: 2.8 },
        ],
      },
      {
        rowKey: 'Segurança pública',
        total: 186,
        cells: [
          { colKey: 'Apoiador', count: 78, pct: 41.9 },
          { colKey: 'Indeciso', count: 51, pct: 27.4 },
          { colKey: 'Tendência à oposição', count: 28, pct: 15.1 },
          { colKey: 'Tendência a apoiar', count: 21, pct: 11.3 },
          { colKey: 'Oposição', count: 8, pct: 4.3 },
        ],
      },
    ],
  },

  themes_ranking: [
    { theme: 'Saúde', count: 288, pct: 34.0 },
    { theme: 'Segurança pública', count: 186, pct: 22.0 },
    { theme: 'Emprego e renda', count: 152, pct: 18.0 },
    { theme: 'Infraestrutura', count: 102, pct: 12.0 },
    { theme: 'Educação', count: 76, pct: 9.0 },
    { theme: 'Transporte', count: 51, pct: 6.0 },
    { theme: 'Combate à corrupção', count: 42, pct: 5.0 },
    { theme: 'Habitação', count: 25, pct: 3.0 },
  ],
  themes_by_region: {
    'Belo Horizonte': [
      { theme: 'Saúde', count: 86, pct: 36.6 },
      { theme: 'Segurança pública', count: 62, pct: 26.4 },
      { theme: 'Emprego e renda', count: 38, pct: 16.2 },
    ],
    'Montes Claros': [
      { theme: 'Saúde', count: 68, pct: 47.9 },
      { theme: 'Emprego e renda', count: 32, pct: 22.5 },
      { theme: 'Segurança pública', count: 22, pct: 15.5 },
    ],
    'Uberlândia': [
      { theme: 'Educação', count: 25, pct: 23.8 },
      { theme: 'Infraestrutura', count: 21, pct: 20.0 },
      { theme: 'Saúde', count: 18, pct: 17.1 },
    ],
  },
  themes_by_profile: {
    'Jovens 16-24': [
      { theme: 'Emprego e renda', count: 35, pct: 46.1 },
      { theme: 'Educação', count: 22, pct: 28.9 },
      { theme: 'Segurança pública', count: 12, pct: 15.8 },
    ],
    'Mulheres 35-44': [
      { theme: 'Saúde', count: 98, pct: 64.5 },
      { theme: 'Segurança pública', count: 32, pct: 21.1 },
      { theme: 'Educação', count: 14, pct: 9.2 },
    ],
    'Evangélicos': [
      { theme: 'Segurança pública', count: 92, pct: 36.2 },
      { theme: 'Saúde', count: 68, pct: 26.8 },
      { theme: 'Combate à corrupção', count: 38, pct: 15.0 },
    ],
    'Baixa renda (até 3SM)': [
      { theme: 'Emprego e renda', count: 102, pct: 20.1 },
      { theme: 'Saúde', count: 168, pct: 33.1 },
      { theme: 'Habitação', count: 25, pct: 4.9 },
    ],
    'Indecisos': [
      { theme: 'Saúde', count: 56, pct: 36.6 },
      { theme: 'Segurança pública', count: 51, pct: 33.3 },
      { theme: 'Emprego e renda', count: 24, pct: 15.7 },
    ],
  },
  gov_ratings: { state: 2.3, federal: 3.1, city: 2.8 },
  sentiment_analysis: {
    Saúde: { positivo: 142, neutro: 80, negativo: 66 },
    'Segurança pública': { positivo: 56, neutro: 72, negativo: 58 },
    'Emprego e renda': { positivo: 78, neutro: 50, negativo: 24 },
  },

  resumo_executivo:
    'Campanha em trajetória positiva, com base sólida entre mulheres de 35-44 anos (74% favoráveis) e renda 3-6SM. Principal vulnerabilidade: evangélicos masculinos de baixa renda, ainda 41% indecisos. Saúde domina 34% das citações e exige prioridade absoluta na agenda.',
  strategic_insights: [
    {
      titulo: 'Maior segmento conversível: evangélicos indecisos',
      insight:
        '41% dos evangélicos ainda não tomaram decisão. Igrejas locais são o canal natural, pauta família + segurança ressoa.',
      dado_de_suporte: '104 de 254 evangélicos (41%) marcaram intenção indecisa.',
      impacto: 'alto',
      categoria: 'base',
    },
    {
      titulo: 'Mulheres 35-44 subutilizadas como multiplicadoras',
      insight:
        '31% da base e 74% favoráveis. Criar grupo dedicado pode gerar efeito-rede em bairros residenciais.',
      dado_de_suporte: '263 entrevistas nessa faixa, 224 favoráveis ou tendentes.',
      impacto: 'alto',
      categoria: 'mensagem',
    },
    {
      titulo: 'Norte de MG: avaliação de saúde 1.8/5 — pior cluster',
      insight:
        'Não atrelar candidato a defesa de governo estadual nessa região. Posicionar como agente de mudança.',
      dado_de_suporte: 'Avaliação média de saúde na região Norte 1.8 vs 2.6 média estadual.',
      impacto: 'alto',
      categoria: 'territorio',
    },
  ],
  risk_alerts: [
    {
      alerta: 'Homens 25-34 com tendência crescente à oposição',
      evidencia: '5% oposição + 9% tendência oposição = 14% nessa faixa, vs 5% média.',
      severidade: 'alto',
      acao_mitigadora:
        'Conteúdo digital sobre emprego e empreendedorismo direcionado pra esse público.',
    },
  ],
  opportunities: [
    {
      oportunidade: 'Evento conjunto em igrejas evangélicas da região metropolitana',
      potencial_votos: '+2.800 votos estimados',
      como_capturar:
        'Agendar 3 visitas a igrejas com pauta família + segurança + valorização do trabalho.',
      prazo: 'Próximas 3 semanas',
    },
  ],
  recommended_actions: [
    {
      acao: 'Visitar UBS em Montes Claros',
      justificativa: 'Saúde domina 48% das citações na cidade; gov. estadual avaliado 1.8/5.',
      local_sugerido: 'UBS Major Prates · Montes Claros',
      publico_alvo: 'Mulheres 35-44 com filhos',
      prioridade: 5,
    },
    {
      acao: 'Reunião em Igreja Evangélica',
      justificativa: '41% dos evangélicos estão indecisos — maior bolsão conversível.',
      local_sugerido: 'Assembleia · Contagem',
      publico_alvo: 'Famílias evangélicas, renda 1-3SM',
      prioridade: 5,
    },
    {
      acao: 'Visita a comércio local',
      justificativa: 'Emprego citado por 22%, principal pauta de homens 25-34.',
      local_sugerido: 'Mercado Central · BH',
      publico_alvo: 'Pequenos comerciantes',
      prioridade: 4,
    },
  ],
  segments_to_convert: {
    total: 102,
    pct: 12.0,
    by_age: [
      { label: '25 a 34 anos', count: 32, pct: 31.4 },
      { label: '45 a 59 anos', count: 28, pct: 27.5 },
      { label: '35 a 44 anos', count: 26, pct: 25.5 },
    ],
    by_religion: [
      { label: 'Evangélico', count: 56, pct: 54.9 },
      { label: 'Católico', count: 30, pct: 29.4 },
      { label: 'Sem religião', count: 12, pct: 11.8 },
    ],
    by_income: [
      { label: 'Até 1 salário mínimo', count: 38, pct: 37.3 },
      { label: '1 a 3 salários', count: 42, pct: 41.2 },
      { label: '3 a 6 salários', count: 18, pct: 17.6 },
    ],
    themes: [
      { theme: 'Saúde', count: 56, pct: 54.9 },
      { theme: 'Segurança pública', count: 51, pct: 50.0 },
      { theme: 'Emprego e renda', count: 24, pct: 23.5 },
    ],
    top_conversion_argument: 'projeto de mutirão de saúde no bairro',
  },
  segments_at_risk: [
    {
      segmento: 'Homens 25-34 de baixa renda em capitais',
      tamanho_pct: 8.5,
      motivo: 'Aumento de 4pp em tendência à oposição nas últimas 4 semanas.',
      acao_mitigadora: 'Mensagem de empregabilidade + microcrédito.',
    },
  ],
  mensagens_por_segmento: {
    evangelicos:
      'Defesa da família como pilar; apoio a creches em igrejas; segurança nas comunidades.',
    jovens_16_24:
      'Geração de emprego para a primeira oportunidade; conectividade nas escolas; cultura.',
    mulheres_35_44:
      'Acesso à saúde pública sem fila; creche em tempo integral; segurança nos bairros.',
    baixa_renda:
      'Programa local de complemento de renda; transporte mais barato; saúde básica.',
    indecisos_saude:
      'Plano concreto para UBS: mutirão, médico fixo e remédio. Prazos visíveis.',
  },
  comparacao_institutos: {
    metodologia:
      'Amostra de conveniência por agentes de campo + estratificação por município. Quase-quotas por gênero e faixa etária.',
    margem_erro_estimada: '±3,4 pontos (95% confiança)',
    confiabilidade: 'Equivalente a pesquisa regional — referência interna confiável.',
    ressalvas:
      'Amostra concentrada em metropolitana e Norte. Sub-representação de zonas rurais. Recomenda-se expandir cobertura territorial.',
  },
  conversion_probability: 0.72,
  campaign_health_score: 76,
  raw_analysis: null,
};

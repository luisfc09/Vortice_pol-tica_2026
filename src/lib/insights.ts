import type { Mention } from '@/types';

export interface InsightSummary {
  totalAnalyzed: number;
  positive: number;
  neutral: number;
  negative: number;
  netSentiment: number; // -1..1
  topTopics: { topic: string; count: number; sentiment: number }[];
  suggestedReplies: { context: string; reply: string; tone: string }[];
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  Segurança: ['segurança', 'violência', 'crime', 'polícia', 'armado'],
  Saúde: ['saúde', 'sus', 'hospital', 'mental'],
  Educação: ['educação', 'escola', 'aluno', 'professor', 'técnico'],
  Emprego: ['emprego', 'trabalho', 'renda', 'desemprego'],
  Infraestrutura: ['saneamento', 'estrada', 'rodovia', 'bairro', 'esgoto'],
  Agronegócio: ['agro', 'café', 'produtor', 'fazenda'],
  Mídia: ['debate', 'entrevista', 'rádio', 'tv'],
};

// Heurística que simula uma chamada ao Claude. Em produção esta função vira
// uma requisição à /api/claude com o histórico de menções como contexto.
export function buildInsights(mentions: Mention[]): InsightSummary {
  const recent = [...mentions]
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
    .slice(0, 50);

  const total = recent.length || 1;
  const positive = recent.filter((m) => m.sentiment === 'positivo').length;
  const negative = recent.filter((m) => m.sentiment === 'negativo').length;
  const neutral = recent.filter((m) => m.sentiment === 'neutro').length;
  const netSentiment =
    recent.reduce((acc, m) => acc + m.sentiment_score, 0) / total;

  // Contagem por tópico via keyword match
  const topicCounts: Record<string, { count: number; sentimentSum: number }> = {};
  for (const m of recent) {
    const content = m.content.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some((k) => content.includes(k))) {
        topicCounts[topic] = topicCounts[topic] ?? { count: 0, sentimentSum: 0 };
        topicCounts[topic].count += 1;
        topicCounts[topic].sentimentSum += m.sentiment_score;
      }
    }
  }
  const topTopics = Object.entries(topicCounts)
    .map(([topic, v]) => ({
      topic,
      count: v.count,
      sentiment: v.sentimentSum / v.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Sugestões de resposta baseadas em ataques negativos comuns
  const suggestedReplies: InsightSummary['suggestedReplies'] = [];
  const negativeAboutSecurity = recent.find(
    (m) => m.sentiment === 'negativo' && TOPIC_KEYWORDS['Segurança'].some((k) => m.content.toLowerCase().includes(k)),
  );
  if (negativeAboutSecurity) {
    suggestedReplies.push({
      context: 'Crítica sobre proposta de segurança sem plano de financiamento.',
      tone: 'Firme, ancorado em dados',
      reply:
        'Nosso plano de segurança não é promessa vazia: detalha origem do recurso (royalties da mineração + corte de despesas administrativas), prevê valorização das polícias com escala 12x36 e integração com inteligência. A íntegra do plano está em [link]. Confronte propostas — não slogans.',
    });
  }
  const negativeAboutSaneamento = recent.find(
    (m) => m.sentiment === 'negativo' && TOPIC_KEYWORDS['Infraestrutura'].some((k) => m.content.toLowerCase().includes(k)),
  );
  if (negativeAboutSaneamento) {
    suggestedReplies.push({
      context: 'Ceticismo de especialistas sobre saneamento.',
      tone: 'Reconhece + propõe',
      reply:
        'Ceticismo é justo — o histórico de promessas é longo. Por isso publicamos o cronograma do Marco do Saneamento por região e os indicadores trimestrais de cobertura. Audite, cobre, fiscalize. Estamos abertos ao debate técnico.',
    });
  }
  const indifferent = recent.find((m) => m.sentiment === 'neutro' && /faltou|esperava mais/i.test(m.content));
  if (indifferent) {
    suggestedReplies.push({
      context: 'Demanda por agenda específica não abordada.',
      tone: 'Atento + escuta ativa',
      reply:
        'Anotado. O programa contempla esse ponto mas faltou ênfase no discurso — corrigiremos no próximo encontro. Obrigado por sinalizar.',
    });
  }
  if (suggestedReplies.length === 0) {
    suggestedReplies.push({
      context: 'Cenário estável.',
      tone: 'Manutenção da narrativa',
      reply:
        'Sem crises ativas. Continuar reforçando os pilares (emprego, segurança, infraestrutura) com pautas regionais — Norte de Minas e Vale do Aço são oportunidades de ganho líquido nesta semana.',
    });
  }

  return {
    totalAnalyzed: total,
    positive,
    neutral,
    negative,
    netSentiment,
    topTopics,
    suggestedReplies,
  };
}

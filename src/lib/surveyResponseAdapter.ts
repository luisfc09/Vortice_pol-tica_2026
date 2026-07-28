// ============================================================================
// surveyResponseAdapter — mapeia respostas dos Formulários de Pesquisa
// (survey_responses, migration 052/053) para o formato FieldInterview que o
// statsCalculator/Inteligência já entende. (Fase 5B)
//
// ⚠️ Por design, vote_intention fica NULL: os formulários novos são genéricos
// e NÃO capturam intenção de voto. Como tally() e crossTab() ignoram valores
// nulos, essas respostas entram SÓ nas distribuições demográficas (faixa/sexo/
// religião) e são automaticamente excluídas de toda análise de intenção,
// income, educação e temas — sem enfeiar os números das entrevistas antigas.
// ============================================================================

import type { FieldInterview, SurveyResponse, VoteIntention } from '@/types';

export function surveyResponsesToInterviews(rows: SurveyResponse[]): FieldInterview[] {
  return rows.map((r) => ({
    id: r.id,
    campaign_id: r.campaign_id,
    voter_name: r.respondent_name ?? '',
    voter_phone: r.respondent_phone,
    municipality_code: r.municipality_code,
    neighborhood: r.neighborhood,
    // NULL de propósito — ver cabeçalho. Excluído das análises de intenção.
    vote_intention: null as unknown as VoteIntention,
    receptivity_score: 0, // não usado pelo statsCalculator
    priority_themes: [],
    vote_decided: false,
    notes: null,
    lat: r.lat,
    lng: r.lng,
    created_by: r.interviewer_id ?? '',
    created_at: r.submitted_at,
    // 'complete' pra passar no filtro do dataset e contar no tamanho da amostra.
    status: 'complete',
    // Demografia que os formulários capturam:
    age_range: r.age_range,
    gender: r.gender,
    religion: r.religion,
    // Demais campos do questionário antigo não existem no formulário novo:
    education: null,
    income_range: null,
    work_status: null,
    vote_decision: null,
    candidate_awareness: null,
    candidate_opinion: null,
    conversion_argument: null,
    main_city_problem: null,
    important_themes: null,
    health_rating: null,
    security_rating: null,
    employment_rating: null,
    neighborhood_complaint: null,
    state_gov_rating: null,
    federal_gov_rating: null,
    city_gov_rating: null,
    country_direction: null,
    is_potential_leader: null,
    accepted_contact: null,
    ai_analysis: null,
    interview_duration_seconds: null,
  }));
}

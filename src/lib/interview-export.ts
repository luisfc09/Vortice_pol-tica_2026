// Helpers de exportação de entrevistas. Sem dependências de terceiros —
// PDF acontece via window.print() de um HTML próprio (iframe oculto), JSON é
// um Blob direto.

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AGE_RANGE_LABEL,
  CANDIDATE_AWARENESS_LABEL,
  CANDIDATE_OPINION_LABEL,
  CITY_PROBLEM_LABEL,
  COUNTRY_DIRECTION_LABEL,
  EDUCATION_LABEL,
  GENDER_LABEL,
  GOV_RATING_LABEL,
  INCOME_LABEL,
  RELIGION_LABEL,
  VOTE_DECISION_LABEL,
  VOTE_INTENTION_LABEL,
  WORK_STATUS_LABEL,
  isInterviewDeepened,
  type FieldInterview,
} from '@/types';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function exportInterviewAsJson(i: FieldInterview): void {
  const stamp = new Date(i.created_at).toISOString().slice(0, 10);
  const filename = `entrevista-${stamp}-${slugify(i.voter_name)}.json`;
  download(filename, JSON.stringify(i, null, 2), 'application/json');
}

export function printInterview(): void {
  window.print();
}

// ---------------------------------------------------------------------------
// PDF — monta um HTML autossuficiente da entrevista e imprime via iframe
// oculto. O navegador oferece "Salvar como PDF". Mesmo resultado no histórico
// e na tela de detalhe (fonte única de rótulos = enums de @/types).
// ---------------------------------------------------------------------------

function esc(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"]/g,
    (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }) as Record<string, string>)[c],
  );
}

function row(label: string, value: string | null | undefined): string {
  const v = value && value.trim() !== '' ? esc(value) : '—';
  return `<div class="row"><span class="lbl">${esc(label)}</span><span class="val">${v}</span></div>`;
}

function stars(v: number | null | undefined): string {
  if (v == null) return '—';
  return '★'.repeat(v) + '☆'.repeat(Math.max(0, 5 - v)) + ` (${v}/5)`;
}

function section(title: string, subtitle: string | null, rows: string[]): string {
  return `<section>
    <h2>${esc(title)}</h2>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
    <div class="grid">${rows.join('')}</div>
  </section>`;
}

function buildInterviewHtml(i: FieldInterview): string {
  const deepened = isInterviewDeepened(i);
  const muni = i.municipality_code
    ? (MUNI_COORDS[i.municipality_code]?.name ?? i.municipality_code)
    : '—';
  const createdAt = format(new Date(i.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", {
    locale: ptBR,
  });
  const exportedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const duration =
    i.interview_duration_seconds != null
      ? `${Math.floor(i.interview_duration_seconds / 60)}min ${i.interview_duration_seconds % 60}s`
      : null;
  const gps =
    i.lat != null && i.lng != null ? `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}` : '—';

  const tags = [
    deepened ? 'Completa' : 'Básica',
    VOTE_INTENTION_LABEL[i.vote_intention],
    i.vote_decided ? 'Decidido' : null,
    duration ? `⏱ ${duration}` : null,
  ]
    .filter(Boolean)
    .map((t) => `<span class="tag">${esc(t as string)}</span>`)
    .join('');

  const parts: string[] = [];

  parts.push(`<header>
    <p class="eyebrow">Entrevista de campo · ${esc(createdAt)}</p>
    <h1>${esc(i.voter_name)}</h1>
    <div class="tags">${tags}</div>
  </header>`);

  parts.push(
    section('Identificação', 'Dados básicos coletados no campo', [
      row('Telefone', i.voter_phone),
      row('Município', muni),
      row('Bairro', i.neighborhood),
      row('Coordenadas (GPS)', gps),
    ]),
  );

  parts.push(
    section('Resposta inicial', 'Fluxo rápido da entrevista', [
      row('Intenção de voto', VOTE_INTENTION_LABEL[i.vote_intention]),
      row('Receptividade', `${i.receptivity_score}/5`),
      row('Decidiu o voto?', i.vote_decided ? 'Sim' : 'Não'),
      row('Temas prioritários', i.priority_themes.length > 0 ? i.priority_themes.join(', ') : '—'),
      row('Observações iniciais', i.notes),
    ]),
  );

  if (deepened) {
    parts.push(
      section('Bloco 1 · Perfil', 'Sociodemográfico', [
        row('Faixa etária', i.age_range ? AGE_RANGE_LABEL[i.age_range] : '—'),
        row('Gênero', i.gender ? GENDER_LABEL[i.gender] : '—'),
        row('Escolaridade', i.education ? EDUCATION_LABEL[i.education] : '—'),
        row('Renda familiar', i.income_range ? INCOME_LABEL[i.income_range] : '—'),
        row('Situação', i.work_status ? WORK_STATUS_LABEL[i.work_status] : '—'),
        row('Religião', i.religion ? RELIGION_LABEL[i.religion] : '—'),
      ]),
    );
    parts.push(
      section('Bloco 2 · Cenário eleitoral', 'Decisão e percepção sobre a candidatura', [
        row('Decisão de voto', i.vote_decision ? VOTE_DECISION_LABEL[i.vote_decision] : '—'),
        row(
          'Conhecimento sobre o candidato',
          i.candidate_awareness ? CANDIDATE_AWARENESS_LABEL[i.candidate_awareness] : '—',
        ),
        row('Opinião', i.candidate_opinion ? CANDIDATE_OPINION_LABEL[i.candidate_opinion] : '—'),
        row('O que poderia convencer', i.conversion_argument),
      ]),
    );
    parts.push(
      section('Bloco 3 · Temas e prioridades', 'Pauta local + avaliação de serviços', [
        row('Maior problema da cidade', i.main_city_problem ? CITY_PROBLEM_LABEL[i.main_city_problem] : '—'),
        row(
          'Temas importantes p/ deputado',
          i.important_themes && i.important_themes.length > 0 ? i.important_themes.join(', ') : '—',
        ),
        row('Avaliação · Saúde', stars(i.health_rating)),
        row('Avaliação · Segurança', stars(i.security_rating)),
        row('Avaliação · Emprego', stars(i.employment_rating)),
        row('Maior incômodo no bairro', i.neighborhood_complaint),
      ]),
    );
    parts.push(
      section('Bloco 4 · Avaliação de governo', null, [
        row('Governo estadual (MG)', i.state_gov_rating ? GOV_RATING_LABEL[i.state_gov_rating] : '—'),
        row('Governo federal', i.federal_gov_rating ? GOV_RATING_LABEL[i.federal_gov_rating] : '—'),
        row('Prefeitura local', i.city_gov_rating ? GOV_RATING_LABEL[i.city_gov_rating] : '—'),
        row('Brasil — caminho', i.country_direction ? COUNTRY_DIRECTION_LABEL[i.country_direction] : '—'),
      ]),
    );
    parts.push(
      section('Bloco 5 · Observações de campo', null, [
        row('Receptividade aprofundada', `${i.receptivity_score}/5`),
        row('Potencial multiplicador / liderança', i.is_potential_leader ? 'Sim' : 'Não'),
        row('Aceitou receber contato', i.accepted_contact ? 'Sim' : 'Não'),
        row('Observações detalhadas', i.notes),
      ]),
    );
  }

  if (i.ai_analysis) {
    parts.push(
      section('Análise da IA', 'Resumo automático com base nas respostas', [
        row('Perfil', i.ai_analysis.perfil_resumido),
        row('Argumento-chave', i.ai_analysis.argumento_chave),
        row('Potencial de conversão', i.ai_analysis.potencial_conversao),
        row('Próximo passo', i.ai_analysis.proximo_passo),
      ]),
    );
  }

  parts.push(
    `<footer>Vórtice · entrevista #${esc(i.id.slice(0, 8))} · exportado em ${esc(exportedAt)}</footer>`,
  );

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Entrevista — ${esc(i.voter_name)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
    .eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #64748b; margin: 0 0 2px; }
    h1 { font-size: 26px; margin: 0; }
    .tags { margin-top: 8px; }
    .tag { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 10px; font-size: 11px; color: #334155; margin: 0 6px 6px 0; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
    section { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    h2 { font-size: 15px; margin: 0; }
    .sub { font-size: 11px; color: #64748b; margin: 2px 0 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
    .row { display: flex; flex-direction: column; }
    .lbl { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
    .val { font-size: 13px; color: #0f172a; }
    footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head>
  <body>${parts.join('')}</body></html>`;
}

export function exportInterviewAsPdf(i: FieldInterview): void {
  const html = buildInterviewHtml(i);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    // fallback: imprime a página atual
    window.print();
    return;
  }

  const win = iframe.contentWindow;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };

  doc.open();
  doc.write(html);
  doc.close();

  win.onafterprint = cleanup;
  // dá tempo de renderizar fontes/layout antes de chamar o print
  setTimeout(() => {
    win.focus();
    win.print();
    cleanup(); // fallback se onafterprint não disparar
  }, 300);
}

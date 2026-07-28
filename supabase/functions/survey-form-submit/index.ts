// ============================================================================
// Supabase Edge Function — survey-form-submit
// ----------------------------------------------------------------------------
// Recebe submissão pública de um Formulário de Pesquisa (rota /f/:token) do
// eleitor SEM login. Espelha public-survey-submit, mas grava em
// survey_responses (channel='publico') via RPC submit_survey_form_response.
//
// Fluxo: extrai IP (x-forwarded-for) → SHA-256(IP + PUBLIC_SURVEY_SALT) →
// chama a RPC com service_role → devolve { ok, id } ou erro traduzido.
//
// Deploy: supabase functions deploy survey-form-submit --no-verify-jwt
// (reaproveita o secret PUBLIC_SURVEY_SALT já cadastrado)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TAG = '[survey-form-submit]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SubmitPayload {
  token?: string;
  answers?: Record<string, unknown>;
  name?: string;
  age_range?: string;
  gender?: string;
  religion?: string;
  phone?: string;
  municipality_code?: string;
  neighborhood?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? '';
}

function statusForError(err: string | undefined): number {
  switch (err) {
    case 'not_found':
      return 404;
    case 'inactive':
    case 'not_started':
    case 'ended':
      return 410;
    case 'duplicate_ip':
      return 409;
    default:
      return 400;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const SALT = Deno.env.get('PUBLIC_SURVEY_SALT') ?? '';

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(`${TAG} env ausente`);
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }
  if (!SALT) {
    console.error(`${TAG} PUBLIC_SURVEY_SALT ausente`);
    return json({ ok: false, error: 'salt_not_configured' }, 500);
  }

  let body: SubmitPayload;
  try {
    body = (await req.json()) as SubmitPayload;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const token = body.token?.trim();
  if (!token) return json({ ok: false, error: 'token_missing' }, 400);

  const answers = body.answers ?? {};
  if (typeof answers !== 'object' || Array.isArray(answers)) {
    return json({ ok: false, error: 'invalid_answers' }, 400);
  }

  const ip = getClientIp(req);
  const ipHash = ip ? await sha256Hex(`${ip}::${SALT}`) : null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('submit_survey_form_response', {
    p_token: token,
    p_answers: answers,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
    p_name: body.name ?? null,
    p_age_range: body.age_range ?? null,
    p_gender: body.gender ?? null,
    p_religion: body.religion ?? null,
    p_phone: body.phone ?? null,
    p_municipality: body.municipality_code ?? null,
    p_neighborhood: body.neighborhood ?? null,
  });

  if (error) {
    console.error(`${TAG} RPC error:`, error.message);
    return json({ ok: false, error: 'rpc_failed', detail: error.message }, 500);
  }

  const result = data as { ok?: boolean; error?: string; id?: string } | null;
  if (!result?.ok) {
    return json(result ?? { ok: false, error: 'unknown' }, statusForError(result?.error));
  }
  return json({ ok: true, id: result.id }, 200);
});

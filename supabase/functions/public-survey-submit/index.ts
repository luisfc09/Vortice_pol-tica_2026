// ============================================================================
// Supabase Edge Function — public-survey-submit
// ----------------------------------------------------------------------------
// Recebe submissão de pesquisa pública (rota /p/:token) do eleitor SEM login.
//
// Fluxo:
//   POST { token, answers, name?, phone?, email?, municipality_code?, neighborhood? }
//     1. Extrai IP real do x-forwarded-for (fallback: cf-connecting-ip, remoteAddr)
//     2. Hasheia SHA-256(IP + PUBLIC_SURVEY_SALT) — LGPD-friendly (não guardamos IP)
//     3. Chama RPC public.submit_public_response com service_role (bypass RLS)
//     4. RPC valida token, janela temporal e duplicidade por IP; insere ou rejeita.
//     5. Devolve { ok, id } ou { ok:false, error } com HTTP code adequado.
//
// Auth: pública. Deploy com --no-verify-jwt.
//
// Env vars:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY (auto)
//   - PUBLIC_SURVEY_SALT        (custom — cadastrar via supabase secrets set)
//
// Deploy:
//   supabase functions deploy public-survey-submit --no-verify-jwt
//   supabase secrets set PUBLIC_SURVEY_SALT="<random 32+ chars>"
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TAG = '[public-survey-submit]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SubmitPayload {
  token?: string;
  answers?: Record<string, unknown>;
  name?: string;
  phone?: string;
  email?: string;
  municipality_code?: string;
  neighborhood?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// SHA-256 hex → identificador estável do IP sem armazenar o IP em claro.
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Extrai o primeiro IP do x-forwarded-for (formato: "client, proxy1, proxy2").
// Cai pra cf-connecting-ip (Cloudflare) ou string vazia se não achar.
function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? '';
}

// Traduz o error da RPC no HTTP status adequado.
function statusForError(err: string | undefined): number {
  switch (err) {
    case 'not_found':
      return 404;
    case 'inactive':
    case 'not_started':
    case 'ended':
      return 410; // Gone — pesquisa não está mais aceitando
    case 'duplicate_ip':
      return 409; // Conflict
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
    // Sem salt não protege o IP hash — fail-closed pra evitar hash previsível.
    console.error(`${TAG} PUBLIC_SURVEY_SALT ausente — configurar em supabase secrets`);
    return json({ ok: false, error: 'salt_not_configured' }, 500);
  }

  // Parse do payload
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

  // IP hash — vazio se cliente não veio via proxy conhecido (aceita mesmo assim,
  // mas anti-fraude por IP fica sem efeito).
  const ip = getClientIp(req);
  const ipHash = ip ? await sha256Hex(`${ip}::${SALT}`) : null;

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  // Chama a RPC — service_role bypassa RLS.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('submit_public_response', {
    p_token: token,
    p_answers: answers,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
    p_name: body.name ?? null,
    p_phone: body.phone ?? null,
    p_email: body.email ?? null,
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

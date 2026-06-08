// ============================================================================
// Supabase Edge Function — regenerate-access-link
// ----------------------------------------------------------------------------
// Regera a senha temporária de um usuário existente e devolve as credenciais
// pro admin reenviar via canal externo (WhatsApp, email manual).
//
// Fluxo:
//   1. POST { user_id }
//   2. Valida JWT do caller
//   3. Autoriza: caller precisa ser admin da campanha do target OU super admin.
//      (Coordinator NÃO pode — decisão do produto.)
//   4. Guard: caller NÃO pode regenerar a própria senha (faria logout)
//   5. Confirma que o target user pertence a uma campanha do caller
//   6. Reset password pra 123456 via admin.auth.admin.updateUserById
//   7. Seta profiles.must_change_password = true
//   8. Devolve { user_email, temporary_password, login_url }
//
// Padrão alinhado com provision-user — o admin copia/cola pra reenviar.
// Sem SMTP automático; canal de entrega fica a critério do admin.
//
// Deploy: supabase functions deploy regenerate-access-link
//
// Env vars (auto-injetadas):
//   - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Opcional:
//   - APP_LOGIN_URL=https://seu-dominio/login
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface RegenRequest {
  user_id: string;
}

const TEMP_PASSWORD = '123456';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LOGIN_URL = Deno.env.get('APP_LOGIN_URL') ?? 'http://localhost:5173/login';

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  // --- 1) parse payload ---
  let payload: RegenRequest;
  try {
    payload = (await req.json()) as RegenRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const targetUserId = payload.user_id?.trim();
  if (!targetUserId) return json({ error: 'user_id obrigatório' }, 400);

  // --- 2) caller auth ---
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: callerUser },
    error: callerErr,
  } = await caller.auth.getUser();
  if (callerErr || !callerUser) return json({ error: 'Sessão inválida' }, 401);

  // --- 3) guard: não pode regenerar a si mesmo (geraria logout imediato) ---
  if (callerUser.id === targetUserId) {
    return json(
      { error: 'Você não pode regenerar sua própria senha por aqui. Use a troca de senha no perfil.' },
      400,
    );
  }

  // --- 4) autorização: admin/super_admin (coordinator NÃO permitido) ---
  // Service-role client pra ler campaign_users sem barreira RLS.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Caller é super admin?
  const { data: superAdminRow } = await admin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', callerUser.id)
    .maybeSingle();
  const callerIsSuperAdmin = !!superAdminRow;

  // Pega TODAS as campanhas em que o caller é admin ATIVO (pode regenerar
  // só de users dessas campanhas). Coordinator ignorado por design.
  const { data: callerCampaigns } = await admin
    .from('campaign_users')
    .select('campaign_id')
    .eq('user_id', callerUser.id)
    .eq('role', 'admin')
    .eq('is_active', true);
  const callerAdminCampaignIds = new Set(
    ((callerCampaigns ?? []) as Array<{ campaign_id: string }>).map((r) => r.campaign_id),
  );

  if (!callerIsSuperAdmin && callerAdminCampaignIds.size === 0) {
    return json(
      { error: 'Apenas admin da campanha ou super admin pode regenerar acesso.' },
      403,
    );
  }

  // --- 5) confirma que target user existe + pertence a campanha do caller ---
  const { data: targetCampaigns, error: targetCampErr } = await admin
    .from('campaign_users')
    .select('campaign_id')
    .eq('user_id', targetUserId);
  if (targetCampErr) {
    return json({ error: `Falha ao verificar target: ${targetCampErr.message}` }, 500);
  }
  const targetCampaignIds = ((targetCampaigns ?? []) as Array<{ campaign_id: string }>).map(
    (r) => r.campaign_id,
  );
  if (targetCampaignIds.length === 0) {
    return json({ error: 'Usuário alvo não pertence a nenhuma campanha' }, 404);
  }
  // Super admin pula esse check; admin precisa de overlap.
  if (!callerIsSuperAdmin) {
    const overlap = targetCampaignIds.some((id) => callerAdminCampaignIds.has(id));
    if (!overlap) {
      return json(
        { error: 'Você não administra nenhuma campanha em que esse usuário esteja.' },
        403,
      );
    }
  }

  // --- 6) pega o email do target via admin API ---
  const { data: targetAuth, error: targetAuthErr } = await admin.auth.admin.getUserById(
    targetUserId,
  );
  if (targetAuthErr || !targetAuth?.user) {
    return json(
      { error: `Usuário não encontrado em auth.users: ${targetAuthErr?.message ?? 'desconhecido'}` },
      404,
    );
  }
  const targetEmail = targetAuth.user.email ?? null;
  if (!targetEmail) {
    return json({ error: 'Usuário alvo não tem email cadastrado' }, 422);
  }

  // --- 7) reset password pra 123456 ---
  const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
    password: TEMP_PASSWORD,
    email_confirm: true, // garante que login funciona mesmo se a confirmação tinha expirado
  });
  if (updateErr) {
    return json({ error: `Falha ao resetar senha: ${updateErr.message}` }, 500);
  }

  // --- 8) seta must_change_password = true pra forçar troca no próximo login ---
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', targetUserId);
  if (profileErr) {
    // Log mas não falha — o reset de senha já funcionou; só fica sem forçar
    // a troca. O admin pode chamar de novo se necessário.
    console.warn('[regenerate-access-link] profile update falhou:', profileErr.message);
  }

  return json(
    {
      ok: true,
      user_id: targetUserId,
      user_email: targetEmail,
      temporary_password: TEMP_PASSWORD,
      login_url: LOGIN_URL,
    },
    200,
  );
});

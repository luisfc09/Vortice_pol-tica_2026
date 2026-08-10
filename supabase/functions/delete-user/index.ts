// ============================================================================
// Supabase Edge Function — delete-user
// ----------------------------------------------------------------------------
// Exclusão de CONTA COMPLETA de uma pessoa numa campanha, pra o usuário mestre
// (super admin) ou admin/coordenador corrigir cadastros. Diferente do "Remover"
// antigo (que só apagava a linha em campaign_users e deixava o login órfão —
// travando o e-mail pra novos convites com "already registered").
//
//   POST { user_id, campaign_id }
//     1. Valida o JWT do chamador (header Authorization).
//     2. Autoriza: admin/coordenador ATIVO da campanha OU super admin.
//     3. Bloqueia auto-exclusão (evita lockout).
//     4. Apaga supporters (nós próprios do user) da campanha.
//     5. Apaga a linha em campaign_users desta campanha.
//     6. Se o user não for membro de NENHUMA outra campanha → apaga o profile
//        e o auth.user (LIBERA o e-mail pra novo convite). Se ainda for membro
//        de outra campanha, mantém o login (só saiu desta).
//
// Deploy: supabase functions deploy delete-user
//
// Env (auto-injetadas): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface DeleteUserRequest {
  user_id: string;
  campaign_id: string;
}

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
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let payload: DeleteUserRequest;
  try {
    payload = (await req.json()) as DeleteUserRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { user_id, campaign_id } = payload;
  if (!user_id || !campaign_id) {
    return json({ error: 'Campos obrigatórios: user_id, campaign_id' }, 400);
  }

  // 1) Client com o JWT do caller (identidade + autorização)
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: callerUser },
    error: callerError,
  } = await caller.auth.getUser();
  if (callerError || !callerUser) return json({ error: 'Sessão inválida' }, 401);

  // 3) Bloqueia auto-exclusão
  if (callerUser.id === user_id) {
    return json({ error: 'Você não pode excluir a própria conta.' }, 400);
  }

  // 2) Autorização: admin/coord ATIVO da campanha OU super admin
  const { data: callerMembership } = await caller
    .from('campaign_users')
    .select('role, is_active')
    .eq('user_id', callerUser.id)
    .eq('campaign_id', campaign_id)
    .maybeSingle();

  let authorized =
    !!callerMembership &&
    callerMembership.is_active === true &&
    ['admin', 'coordinator'].includes(callerMembership.role as string);

  if (!authorized) {
    const { data: isSuper } = await caller.rpc('is_super_admin');
    if (isSuper === true) authorized = true;
  }
  if (!authorized) {
    return json(
      { error: 'Apenas admin/coordenador desta campanha (ou super admin) pode excluir.' },
      403,
    );
  }

  // 3) Service-role client pras exclusões
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4) Apaga os nós de supporter próprios do user nesta campanha
  const { error: supErr } = await admin
    .from('supporters')
    .delete()
    .eq('created_by', user_id)
    .eq('campaign_id', campaign_id);
  if (supErr) {
    return json({ error: `Falha ao remover liderança: ${supErr.message}` }, 500);
  }

  // 5) Apaga o vínculo desta campanha
  const { error: cuErr } = await admin
    .from('campaign_users')
    .delete()
    .eq('user_id', user_id)
    .eq('campaign_id', campaign_id);
  if (cuErr) {
    return json({ error: `Falha ao remover vínculo: ${cuErr.message}` }, 500);
  }

  // 6) Só apaga o login se o user não for membro de NENHUMA outra campanha
  const { count: remaining, error: countErr } = await admin
    .from('campaign_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id);
  if (countErr) {
    return json({ error: `Falha ao checar vínculos: ${countErr.message}` }, 500);
  }

  let deletedAuth = false;
  if ((remaining ?? 0) === 0) {
    // profile primeiro (FK/trigger), depois o auth.user (libera o e-mail)
    await admin.from('profiles').delete().eq('id', user_id);
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) {
      // Vínculo/supporter já removidos; login persiste. Sinaliza pro front.
      return json(
        {
          ok: true,
          deletedAuth: false,
          warning: `Vínculo removido, mas o login não pôde ser apagado: ${authErr.message}`,
        },
        200,
      );
    }
    deletedAuth = true;
  }

  return json({ ok: true, deletedAuth });
});

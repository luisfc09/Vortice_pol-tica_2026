// ============================================================================
// Supabase Edge Function — delete-user
// ----------------------------------------------------------------------------
// Exclusão de CONTA COMPLETA de uma pessoa numa campanha, pra o usuário mestre
// (super admin) ou admin/coordenador corrigir cadastros. Diferente do "Remover"
// antigo (que só apagava a linha em campaign_users e deixava o login órfão —
// travando o e-mail pra novos convites com "already registered").
//
//   POST { campaign_id, user_id? | email? }
//     • user_id: pessoa que ainda aparece em Usuários (tem vínculo).
//     • email:   conta ÓRFÃ (login que sobrou sem vínculo, travando o e-mail
//                em novos convites) — resolve o id via admin listUsers.
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
  // Um dos dois identifica a pessoa: user_id (linha em campaign_users) OU
  // email (conta órfã — login que sobrou sem vínculo, travando o e-mail).
  user_id?: string;
  email?: string;
  campaign_id: string;
}

// Acha o id do auth.user por e-mail paginando o admin listUsers (não há filtro
// por e-mail na API admin dessa versão). Cap de páginas evita loop infinito.
async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase().trim();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 1000) break; // última página
  }
  return null;
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
  const { user_id: bodyUserId, email, campaign_id } = payload;
  if (!campaign_id || (!bodyUserId && !email)) {
    return json({ error: 'Campos obrigatórios: campaign_id e (user_id ou email)' }, 400);
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

  // Resolve o alvo: por user_id direto, ou por e-mail (conta órfã).
  let targetUserId = bodyUserId ?? null;
  if (!targetUserId && email) {
    targetUserId = await findUserIdByEmail(admin, email);
    if (!targetUserId) {
      return json(
        { error: 'Nenhuma conta encontrada com esse e-mail. O e-mail já está livre.' },
        404,
      );
    }
  }
  if (!targetUserId) {
    return json({ error: 'Não foi possível identificar a conta.' }, 400);
  }

  // 4) Apaga os nós de supporter próprios do user nesta campanha
  const { error: supErr } = await admin
    .from('supporters')
    .delete()
    .eq('created_by', targetUserId)
    .eq('campaign_id', campaign_id);
  if (supErr) {
    return json({ error: `Falha ao remover liderança: ${supErr.message}` }, 500);
  }

  // 5) Apaga o vínculo desta campanha
  const { error: cuErr } = await admin
    .from('campaign_users')
    .delete()
    .eq('user_id', targetUserId)
    .eq('campaign_id', campaign_id);
  if (cuErr) {
    return json({ error: `Falha ao remover vínculo: ${cuErr.message}` }, 500);
  }

  // 6) Só apaga o login se o user não for membro de NENHUMA outra campanha
  const { count: remaining, error: countErr } = await admin
    .from('campaign_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  if (countErr) {
    return json({ error: `Falha ao checar vínculos: ${countErr.message}` }, 500);
  }

  let deletedAuth = false;
  if ((remaining ?? 0) === 0) {
    // profile primeiro (FK/trigger), depois o auth.user (libera o e-mail)
    await admin.from('profiles').delete().eq('id', targetUserId);
    const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId);
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

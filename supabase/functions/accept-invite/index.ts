// ============================================================================
// Supabase Edge Function — accept-invite
// ----------------------------------------------------------------------------
// Fluxo Fase 2 da hierarquia (migration 047):
//
//   POST { code, name, email, phone, city, municipality_code,
//          cep, logradouro, numero, neighborhood, complemento }
//     1. Valida `code` via get_invite_info()  → bloqueia se inválido/usado.
//     2. Cria auth.users com senha 123456 + email_confirm=true.
//        AUTO-CURA: se o e-mail já existir, NÃO dá beco sem saída — religa a
//        conta à campanha (cria nó de rede + vínculo, idempotente). Se a conta
//        nunca foi ativada (senha ainda temporária), faz auto-login; se já tem
//        senha própria, devolve session:null pedindo login com a senha dela.
//        (Nunca redefine senha de conta existente — sem risco de sequestro.)
//     3. Atualiza profile: full_name + phone + must_change_password=true
//        (a row em profiles é criada automaticamente por trigger no insert
//        de auth.users — provavelmente handle_new_user). Em caso de race,
//        fazemos UPSERT defensivo.
//     4. INSERT em supporters: name, email, phone, city, referrer_id (do
//        indicador), campaign_id (do indicador), status='ativo',
//        created_by=novo_user_id.
//     5. INSERT em campaign_users: role='supporter', is_active=true
//        (aprovação automática — convite é a aprovação implícita feita por
//        quem gerou o link).
//     6. Faz sign-in com a senha temp e devolve {access_token, refresh_token,
//        user, supporter_id, must_change_password:true}.
//
//     ⚠️ NÃO queima mais o invite_code — desde a migration-049 o link é
//        reutilizável (a mesma URL aceita N cadastros). A coluna
//        supporters.invite_used_at virou inerte e fica null pra sempre.
//
// Sem JWT do caller (público). Toda a lógica usa service-role.
//
// Deploy: supabase functions deploy accept-invite
//
// Env vars (auto-injetadas pelo Supabase):
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY
//   - SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface AcceptInviteRequest {
  code: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  municipality_code?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  neighborhood?: string;
  complemento?: string;
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

// Acha o auth.user por e-mail (a API admin dessa versão não filtra por e-mail).
// Usado na AUTO-CURA: quando o e-mail já existe, religamos a conta à campanha
// em vez de dar erro de "já cadastrado".
async function findUserByEmail(
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.toLowerCase().trim();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const found = data.users.find(
      (u: { email?: string }) => (u.email ?? '').toLowerCase() === target,
    );
    if (found) return { id: found.id };
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ----- parse + validações básicas -----
  let body: AcceptInviteRequest;
  try {
    body = (await req.json()) as AcceptInviteRequest;
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const code = body.code?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim() || null;
  const city = body.city?.trim() || null;
  const municipality_code = body.municipality_code?.trim() || null;
  // Endereço (colunas já existentes em supporters). Persistidos quando vierem
  // do form do convite; nulos quando ausentes (compat com chamadas antigas).
  const cep = body.cep?.replace(/\D/g, '').slice(0, 8) || null;
  const logradouro = body.logradouro?.trim() || null;
  const numero = body.numero?.trim() || null;
  const neighborhood = body.neighborhood?.trim() || null;
  const complemento = body.complemento?.trim() || null;

  if (!code) return json({ error: 'code obrigatório' }, 400);
  if (!name || name.length < 2) return json({ error: 'Nome obrigatório (mín. 2 chars)' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'E-mail inválido' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) {
    return json({ error: 'Servidor mal configurado' }, 500);
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ----- 1) valida o convite via RPC pública -----
  const { data: inviteRows, error: inviteErr } = await admin.rpc('get_invite_info', { p_code: code });
  if (inviteErr) {
    return json({ error: `Falha ao validar convite: ${inviteErr.message}` }, 500);
  }
  const invite = (inviteRows as Array<{
    referrer_id: string;
    referrer_name: string;
    campaign_id: string;
    candidate_name: string;
  }> | null)?.[0];
  if (!invite) {
    return json({ error: 'Convite inválido, expirado ou já utilizado' }, 410);
  }

  // ----- 2) cria auth.users (ou RELIGA conta existente — auto-cura) -----
  let userId: string;
  let existingUser = false;
  // Auto-login só quando a conta NÃO é um usuário ativo (senha própria). Conta
  // nova, conta nunca ativada (senha temp) ou conta ÓRFÃ (profile removido numa
  // exclusão anterior) são reonboardadas: senha volta pra temporária e entra
  // direto. A temporária é pública → não é bypass. Só uma conta com senha
  // própria (usuário ativo de verdade) é preservada — sem risco de sequestro.
  let canAutoLogin = true;
  // true quando precisamos (re)criar o profile: conta nova OU órfã reclamada.
  let ensureProfile = true;

  const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createdUser?.user) {
    userId = createdUser.user.id;
  } else {
    const already = /already.*(registered|exists)|duplicate|unique/i.test(
      userErr?.message ?? '',
    );
    if (!already) {
      return json({ error: `Falha ao criar usuário: ${userErr?.message ?? 'desconhecido'}` }, 500);
    }
    // AUTO-CURA: o e-mail já existe. Em vez de dar beco sem saída, religamos a
    // conta a esta campanha (cria o nó de rede + vínculo, idempotente).
    const found = await findUserByEmail(admin, email);
    if (!found) {
      return json(
        { error: 'Este e-mail já tem conta, mas não consegui localizá-la. Contate o administrador.' },
        409,
      );
    }
    userId = found.id;
    existingUser = true;
    const { data: prof } = await admin
      .from('profiles')
      .select('must_change_password')
      .eq('id', userId)
      .maybeSingle();
    // Usuário ATIVO de verdade = tem profile e já trocou a senha. Só esse é
    // preservado. Conta nunca ativada (must_change_password=true) ou ÓRFÃ
    // (sem profile) são reclamadas pra reonboarding.
    const isActiveOnboarded = prof?.must_change_password === false;
    canAutoLogin = !isActiveOnboarded;
    ensureProfile = !prof; // recria o profile só quando sumiu (conta órfã)
    if (canAutoLogin) {
      // Reclama a conta: garante que a senha é a temporária pra o auto-login
      // funcionar (sem isso, a pessoa cairia num "faça login" sem ter senha).
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: TEMP_PASSWORD,
      });
      if (pwErr) console.warn('[accept-invite] reset temp password falhou:', pwErr.message);
    }
  }

  // ----- 3) profile — conta NOVA ou conta órfã reclamada (não sobrescreve
  // profile de usuário ativo existente) -----
  if (ensureProfile) {
    const { error: profileErr } = await admin
      .from('profiles')
      .upsert(
        { id: userId, full_name: name, phone, must_change_password: true },
        { onConflict: 'id' },
      );
    if (profileErr) console.warn('[accept-invite] profile upsert falhou:', profileErr.message);
  }

  // ----- 4) supporter (nó de rede) — IDEMPOTENTE -----
  // Se o user já tem nó nesta campanha (religação), atualiza com os dados do
  // form; senão, cria novo filho do convite.
  const { data: existingSup } = await admin
    .from('supporters')
    .select('id')
    .eq('campaign_id', invite.campaign_id)
    .eq('created_by', userId)
    .limit(1)
    .maybeSingle();

  const supFields = {
    name,
    phone,
    email,
    city,
    neighborhood,
    municipality_code,
    cep,
    logradouro,
    numero,
    complemento,
    status: 'ativo',
    whatsapp: phone,
  };

  let supporterId: string;
  if (existingSup) {
    supporterId = existingSup.id as string;
    await admin.from('supporters').update(supFields).eq('id', supporterId);
  } else {
    const { data: supporterRow, error: supporterErr } = await admin
      .from('supporters')
      .insert({
        campaign_id: invite.campaign_id,
        created_by: userId,
        cpf: null,
        role: 'apoiador',
        role_custom: null,
        vote_potential: null,
        social_platform: null,
        social_handle: null,
        referrer_id: invite.referrer_id, // VÍNCULO HIERÁRQUICO
        invite_used_at: null,
        ...supFields,
      })
      .select('id')
      .single();
    if (supporterErr) {
      // Rollback do auth.user SÓ se foi criado agora (nunca apaga conta alheia).
      if (!existingUser) {
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      }
      return json({ error: `Falha ao registrar liderança: ${supporterErr.message}` }, 500);
    }
    supporterId = supporterRow.id as string;
  }

  // ----- 5) campaign_users (APROVAÇÃO AUTOMÁTICA — sem espera de admin) -----
  // Quem gerou o link de convite (admin/coord/leader/supporter da rede) já é
  // a "aprovação implícita" — não faz sentido pedir ao admin pra confirmar
  // de novo. Mudança aplicada em 2026-06-08 a pedido do usuário; o fluxo
  // de provision-user (admin cria usuário manualmente) continua exigindo
  // aprovação por toggle de is_active na lista de Usuários.
  const { data: existingCu } = await admin
    .from('campaign_users')
    .select('id, is_active')
    .eq('campaign_id', invite.campaign_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!existingCu) {
    const { error: cuErr } = await admin.from('campaign_users').insert({
      campaign_id: invite.campaign_id,
      user_id: userId,
      role: 'supporter',
      is_active: true, // ⬅ ATIVO de cara (aprovação implícita do convite)
    });
    if (cuErr) console.warn('[accept-invite] campaign_users insert falhou:', cuErr.message);
  } else if (existingCu.is_active !== true) {
    // Já era membro mas estava desativado — reativa (religação).
    await admin.from('campaign_users').update({ is_active: true }).eq('id', existingCu.id);
  }

  // ----- 6) sign-in com a senha temp pra devolver session -----
  // Só auto-loga quando a conta ainda usa a senha temporária (conta nova, ou
  // conta antiga nunca ativada). Se a pessoa já trocou a senha (canAutoLogin
  // = false), religamos o cadastro mas mandamos ela logar com a própria senha.
  if (canAutoLogin) {
    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData } = await anon.auth.signInWithPassword({
      email,
      password: TEMP_PASSWORD,
    });
    if (signInData?.session) {
      return json(
        {
          ok: true,
          supporter_id: supporterId,
          user_id: userId,
          must_change_password: true,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_at: signInData.session.expires_at,
          },
        },
        201,
      );
    }
  }

  // Sem auto-login: conta com senha própria (religada) OU auto-login falhou.
  return json(
    {
      ok: true,
      supporter_id: supporterId,
      user_id: userId,
      must_change_password: false,
      session: null,
      message: existingUser
        ? 'Você já tinha conta no sistema — seu cadastro foi vinculado à campanha. Faça login com o seu e-mail e senha.'
        : 'Conta criada. Faça login para continuar.',
    },
    201,
  );
});

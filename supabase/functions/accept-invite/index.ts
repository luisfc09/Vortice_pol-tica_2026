// ============================================================================
// Supabase Edge Function — accept-invite
// ----------------------------------------------------------------------------
// Fluxo Fase 2 da hierarquia (migration 047):
//
//   POST { code, name, email, phone, city, municipality_code,
//          cep, logradouro, numero, neighborhood, complemento }
//     1. Valida `code` via get_invite_info()  → bloqueia se inválido/usado.
//     2. Cria auth.users com senha 123456 + email_confirm=true.
//        (Se o e-mail já existir, devolve 409 — usuário deve fazer login.)
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

  // ----- 2) cria auth.users -----
  const { data: createdUser, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (userErr || !createdUser?.user) {
    // Supabase varia a mensagem: "already registered" / "already been
    // registered" / "already exists" / unique/duplicate. `already.*(...)` cobre
    // o "been" no meio.
    if (/already.*(registered|exists)|duplicate|unique/i.test(userErr?.message ?? '')) {
      return json(
        {
          error:
            'Este e-mail já tem conta no sistema. Faça login com ele. Para recadastrar esta pessoa do zero, o administrador deve excluir a conta dela em Usuários antes de reenviar o convite.',
        },
        409,
      );
    }
    return json({ error: `Falha ao criar usuário: ${userErr?.message ?? 'desconhecido'}` }, 500);
  }
  const userId = createdUser.user.id;

  // ----- 3) atualiza profile (handle_new_user trigger já criou row básica) -----
  // UPSERT defensivo: se trigger ainda não rodou ou está em race, garantimos.
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: name,
        phone,
        must_change_password: true,
      },
      { onConflict: 'id' },
    );
  if (profileErr) console.warn('[accept-invite] profile upsert falhou:', profileErr.message);

  // ----- 4) cria supporter (filho do convite) -----
  const { data: supporterRow, error: supporterErr } = await admin
    .from('supporters')
    .insert({
      campaign_id: invite.campaign_id,
      created_by: userId,
      name,
      cpf: null,
      phone,
      email,
      city,
      neighborhood,
      municipality_code,
      cep,
      logradouro,
      numero,
      complemento,
      role: 'apoiador',
      role_custom: null,
      status: 'ativo',
      vote_potential: null,
      whatsapp: phone,                       // assume mesmo número como WhatsApp
      social_platform: null,
      social_handle: null,
      referrer_id: invite.referrer_id,       // VÍNCULO HIERÁRQUICO
      invite_used_at: null,                  // este NOVO supporter começa com seu próprio code ativo
    })
    .select('id')
    .single();
  if (supporterErr) {
    // rollback do auth.user pra não ficar lixo (cuidado: pode falhar se já
    // tem profile; aceitamos como custo de falha rara)
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return json({ error: `Falha ao registrar liderança: ${supporterErr.message}` }, 500);
  }

  // ----- 5) campaign_users (APROVAÇÃO AUTOMÁTICA — sem espera de admin) -----
  // Quem gerou o link de convite (admin/coord/leader/supporter da rede) já é
  // a "aprovação implícita" — não faz sentido pedir ao admin pra confirmar
  // de novo. Mudança aplicada em 2026-06-08 a pedido do usuário; o fluxo
  // de provision-user (admin cria usuário manualmente) continua exigindo
  // aprovação por toggle de is_active na lista de Usuários.
  const { error: cuErr } = await admin
    .from('campaign_users')
    .insert({
      campaign_id: invite.campaign_id,
      user_id: userId,
      role: 'supporter',
      is_active: true,                       // ⬅ ATIVO de cara
      // invited_by: campos do RPC não traz quem indicou no nível de user;
      // deixamos null por ora. O frontend vai mostrar pela hierarquia em
      // supporters.referrer_id quando precisar.
    });
  if (cuErr) {
    console.warn('[accept-invite] campaign_users insert falhou:', cuErr.message);
    // Não rollback aqui — supporter ficou registrado e o supporter pode
    // pedir aprovação manual ao admin.
  }

  // ----- 6) sign-in com a senha temp pra devolver session -----
  // (passo "queima do convite" foi REMOVIDO na migration-049 — link agora
  // é reutilizável, mesma URL aceita N cadastros sem expirar.)
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password: TEMP_PASSWORD,
  });
  if (signInErr || !signInData?.session) {
    // Conta foi criada com sucesso, mas auto-login falhou — usuário pode
    // fazer login manual com a senha temp.
    return json(
      {
        ok: true,
        supporter_id: supporterRow.id,
        user_id: userId,
        must_change_password: true,
        session: null,
        message: 'Conta criada. Faça login com a senha temporária 123456.',
      },
      201,
    );
  }

  return json(
    {
      ok: true,
      supporter_id: supporterRow.id,
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
});

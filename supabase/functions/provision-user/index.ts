// Supabase Edge Function — provision-user
//
// Cria um membro da campanha de forma direta (sem confirmação por e-mail):
//   1. Recebe { email, full_name, role, phone? }
//   2. Valida o JWT do chamador (header Authorization)
//   3. Confirma que o chamador é admin ou coordenador da campanha (ativo)
//   4. Cria auth.user com senha temporária 123456 + email_confirm=true
//   5. Atualiza o profile com nome/telefone + must_change_password=true
//   6. Cria a linha em campaign_users (is_active=true) ligando à campanha
//   7. Retorna { user_id, email, temporary_password, login_url }
//
// O admin então copia as credenciais e envia ao novo membro por canal próprio.
// No primeiro login com email/senha, o membro é forçado a trocar a senha.
// Login com Google funciona normalmente desde que o e-mail bata.
//
// Deploy: supabase functions deploy provision-user
//
// Env vars necessárias no projeto Supabase (auto-injetadas pelo Supabase):
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Variáveis opcionais via `supabase secrets set`:
//   - APP_LOGIN_URL=https://seu-dominio/login

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Role =
  | 'admin'
  | 'candidate'
  | 'coordinator'
  | 'researcher'
  | 'supporter'
  | 'leader'
  // Mantido para compat com chamadas legadas
  | 'field_agent';

interface ProvisionRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: Role;
  campaign_id: string;
}

const ALLOWED_ROLES: Role[] = [
  'admin',
  'candidate',
  'coordinator',
  'researcher',
  'supporter',
  'leader',
  'field_agent',
];

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LOGIN_URL = Deno.env.get('APP_LOGIN_URL') ?? 'http://localhost:5173/login';

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let payload: ProvisionRequest;
  try {
    payload = (await req.json()) as ProvisionRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { email, full_name, phone, role, campaign_id } = payload;
  if (!email || !full_name || !role || !campaign_id) {
    return json({ error: 'Campos obrigatórios: email, full_name, role, campaign_id' }, 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: 'role inválido' }, 400);
  }

  // 1) Client com o JWT do caller
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: callerUser },
    error: callerError,
  } = await caller.auth.getUser();
  if (callerError || !callerUser) {
    return json({ error: 'Sessão inválida' }, 401);
  }

  // 2) Autorização: o caller precisa ser admin/coordenador ATIVO da campanha
  //    informada — OU super admin (que pode provisionar em qualquer campanha).
  //    Escopar por campaign_id evita o erro de "multiple rows" do maybeSingle
  //    quando o usuário é membro de mais de uma campanha, e garante que o novo
  //    usuário entra exatamente na campanha pretendida.
  const { data: callerMembership } = await caller
    .from('campaign_users')
    .select('role, is_active')
    .eq('user_id', callerUser.id)
    .eq('campaign_id', campaign_id)
    .maybeSingle();

  let authorized =
    !!callerMembership &&
    callerMembership.is_active === true &&
    ['admin', 'coordinator'].includes(callerMembership.role);

  if (!authorized) {
    // Super admin pode provisionar em qualquer campanha (ex.: "ver como cliente").
    const { data: isSuper } = await caller.rpc('is_super_admin');
    if (isSuper === true) authorized = true;
  }

  if (!authorized) {
    return json(
      { error: 'Apenas admin/coordenador desta campanha (ou super admin) pode provisionar' },
      403,
    );
  }

  // 3) Service-role client
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4) Cria o auth.user já confirmado, com senha temporária
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, phone: phone ?? null },
  });
  if (createError || !created.user) {
    const raw = createError?.message ?? '';
    const alreadyExists = /already.*(registered|been registered|exists)/i.test(raw);
    return json(
      {
        error: alreadyExists
          ? 'Este e-mail já está cadastrado no sistema (possivelmente em outra campanha). Use um e-mail diferente para este membro, ou mova o usuário existente.'
          : raw || 'Falha ao criar usuário',
      },
      400,
    );
  }

  // 5) Atualiza profile (trigger handle_new_user já criou a linha)
  await admin
    .from('profiles')
    .update({
      full_name,
      phone: phone ?? null,
      must_change_password: true,
    })
    .eq('id', created.user.id);

  // 6) Cria membership ativo NA campanha informada (já autorizada acima)
  const { error: cuError } = await admin.from('campaign_users').insert({
    campaign_id,
    user_id: created.user.id,
    role,
    invited_by: callerUser.id,
    is_active: true,
  });

  if (cuError) {
    // Roll back o usuário criado se não conseguir ligar à campanha
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Falha ao ligar à campanha: ${cuError.message}` }, 500);
  }

  return json({
    ok: true,
    user_id: created.user.id,
    email,
    temporary_password: TEMP_PASSWORD,
    login_url: LOGIN_URL,
  });
});

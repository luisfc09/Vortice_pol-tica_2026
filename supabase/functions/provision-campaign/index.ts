// Supabase Edge Function — provision-campaign
//
// Super admin Vórtice provisiona uma nova campanha (= novo cliente do SaaS):
//   1. Recebe os dados da campanha + e-mail/nome do admin do cliente
//   2. Valida que o chamador está em public.super_admins
//   3. Cria a campanha em campaigns (status='trial')
//   4. Cria o auth.user do admin do cliente com senha temporária 123456
//   5. Atualiza o profile + must_change_password=true
//   6. Vincula o admin como role='admin', is_active=true
//   7. Retorna credenciais para o super admin copiar
//
// Deploy: supabase functions deploy provision-campaign

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CampaignStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

interface ProvisionCampaignRequest {
  // Campos da campanha
  name: string;
  candidate_name: string;
  party: string;
  party_number: string;
  state: string;
  office: string;
  election_year: number;
  vote_target?: number;
  slogan?: string;
  status?: CampaignStatus;
  trial_ends_at?: string | null;

  // Admin inicial do cliente
  admin_email: string;
  admin_full_name: string;
  admin_phone?: string;
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

  let payload: ProvisionCampaignRequest;
  try {
    payload = (await req.json()) as ProvisionCampaignRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    !payload.name ||
    !payload.candidate_name ||
    !payload.party ||
    !payload.party_number ||
    !payload.state ||
    !payload.office ||
    !payload.election_year ||
    !payload.admin_email ||
    !payload.admin_full_name
  ) {
    return json({ error: 'Campos obrigatórios em falta' }, 400);
  }

  // 1) Identifica o caller
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: callerUser },
    error: callerErr,
  } = await caller.auth.getUser();
  if (callerErr || !callerUser) return json({ error: 'Sessão inválida' }, 401);

  // 2) Confirma que o caller é super admin via RPC (security definer, evita
  //    recursão RLS na tabela super_admins).
  const { data: isSuperAdmin, error: superErr } = await caller.rpc('is_super_admin');
  if (superErr) {
    return json({ error: `Falha ao validar super admin: ${superErr.message}` }, 500);
  }
  if (!isSuperAdmin) {
    return json({ error: 'Apenas Super Admin Vórtice pode provisionar campanhas.' }, 403);
  }

  // 3) Service role para cross-tenant
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4) Cria a campanha
  const { data: campaign, error: campaignErr } = await admin
    .from('campaigns')
    .insert({
      name: payload.name,
      candidate_name: payload.candidate_name,
      party: payload.party,
      party_number: payload.party_number,
      state: payload.state,
      office: payload.office,
      election_year: payload.election_year,
      vote_target: payload.vote_target ?? 0,
      slogan: payload.slogan ?? null,
      status: payload.status ?? 'trial',
      trial_ends_at: payload.trial_ends_at ?? null,
    })
    .select()
    .single();
  if (campaignErr || !campaign) {
    return json({ error: campaignErr?.message ?? 'Falha ao criar campanha' }, 500);
  }

  // 5) Cria o admin user com senha temp
  const { data: created, error: createUserErr } = await admin.auth.admin.createUser({
    email: payload.admin_email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: payload.admin_full_name,
      phone: payload.admin_phone ?? null,
    },
  });
  if (createUserErr || !created.user) {
    // Roll back a campanha se o user falhar
    await admin.from('campaigns').delete().eq('id', campaign.id);
    return json({ error: createUserErr?.message ?? 'Falha ao criar admin' }, 500);
  }

  // 6) Atualiza o profile (trigger já criou) com nome/phone/must_change_password
  await admin
    .from('profiles')
    .update({
      full_name: payload.admin_full_name,
      phone: payload.admin_phone ?? null,
      must_change_password: true,
    })
    .eq('id', created.user.id);

  // 7) Vincula como admin ativo
  const { error: cuErr } = await admin.from('campaign_users').insert({
    campaign_id: campaign.id,
    user_id: created.user.id,
    role: 'admin',
    invited_by: callerUser.id,
    is_active: true,
  });
  if (cuErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from('campaigns').delete().eq('id', campaign.id);
    return json({ error: `Falha ao vincular admin: ${cuErr.message}` }, 500);
  }

  return json({
    ok: true,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    candidate_name: campaign.candidate_name,
    admin_user_id: created.user.id,
    admin_email: payload.admin_email,
    temporary_password: TEMP_PASSWORD,
    login_url: LOGIN_URL,
  });
});

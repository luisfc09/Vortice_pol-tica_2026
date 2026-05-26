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
//
// Esta versão tem instrumentação detalhada (console.log/error com prefixo
// [provision-campaign:step]) pra facilitar debug nos logs do Supabase.
// Todo response de erro inclui um `step` apontando exatamente onde quebrou.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CampaignStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
type CampaignPlan = 'basico' | 'intermediario' | 'top';

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
  plan?: CampaignPlan;
  trial_ends_at?: string | null;

  // Admin inicial do cliente
  admin_email: string;
  admin_full_name: string;
  admin_phone?: string;
}

const TEMP_PASSWORD = '123456';
const TAG = '[provision-campaign]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ErrorBody {
  step: string;
  error: string;
  detail?: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(step: string, message: string, status = 500, detail?: unknown) {
  // Log SEMPRE antes de devolver — assim o painel do Supabase mostra o trace
  // mesmo quando o cliente engole o body.
  console.error(`${TAG}[${step}]`, message, detail ?? '');
  const body: ErrorBody = { step, error: message };
  if (detail !== undefined) body.detail = detail;
  return json(body, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method', 'Method not allowed', 405);

  console.log(`${TAG} request received`);

  // -------------------------------------------------------------------------
  // Step 1: ambient
  // -------------------------------------------------------------------------
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LOGIN_URL = Deno.env.get('APP_LOGIN_URL') ?? 'http://localhost:5173/login';

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return fail('env', 'Server misconfigured — falta SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY', 500, {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!ANON_KEY,
      hasServiceKey: !!SERVICE_KEY,
    });
  }

  // -------------------------------------------------------------------------
  // Step 2: auth header
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('auth', 'Missing Authorization header', 401);

  // -------------------------------------------------------------------------
  // Step 3: parse body
  // -------------------------------------------------------------------------
  let payload: ProvisionCampaignRequest;
  try {
    payload = (await req.json()) as ProvisionCampaignRequest;
  } catch (err) {
    return fail('parse', 'Invalid JSON body', 400, { err: String(err) });
  }
  console.log(`${TAG} payload received`, {
    candidate_name: payload.candidate_name,
    admin_email: payload.admin_email,
    party: payload.party,
    state: payload.state,
    office: payload.office,
  });

  // -------------------------------------------------------------------------
  // Step 4: validate required fields
  // -------------------------------------------------------------------------
  const missing: string[] = [];
  if (!payload.name) missing.push('name');
  if (!payload.candidate_name) missing.push('candidate_name');
  if (!payload.party) missing.push('party');
  if (!payload.party_number) missing.push('party_number');
  if (!payload.state) missing.push('state');
  if (!payload.office) missing.push('office');
  if (!payload.election_year) missing.push('election_year');
  if (!payload.admin_email) missing.push('admin_email');
  if (!payload.admin_full_name) missing.push('admin_full_name');
  if (missing.length > 0) {
    return fail('validate', `Campos obrigatórios em falta: ${missing.join(', ')}`, 400, { missing });
  }

  // -------------------------------------------------------------------------
  // Step 5: identifica caller
  // -------------------------------------------------------------------------
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await caller.auth.getUser();
  if (callerErr || !callerData?.user) {
    return fail('caller', 'Sessão inválida (JWT expirado ou ausente)', 401, {
      err: callerErr?.message,
    });
  }
  const callerUser = callerData.user;
  console.log(`${TAG} caller: ${callerUser.id} <${callerUser.email}>`);

  // -------------------------------------------------------------------------
  // Step 6: super admin check
  // -------------------------------------------------------------------------
  const { data: isSuperAdmin, error: superErr } = await caller.rpc('is_super_admin');
  if (superErr) {
    return fail('rpc-is-super-admin', `Falha ao validar super admin: ${superErr.message}`, 500, {
      hint: 'Confira se a função public.is_super_admin() existe (migration 004).',
    });
  }
  if (!isSuperAdmin) {
    return fail('not-super-admin',
      'Apenas Super Admin Vórtice pode provisionar campanhas.',
      403,
      { caller_user_id: callerUser.id, caller_email: callerUser.email });
  }
  console.log(`${TAG} caller is super admin — prosseguindo`);

  // -------------------------------------------------------------------------
  // Step 7: cliente service-role pra cross-tenant
  // -------------------------------------------------------------------------
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // -------------------------------------------------------------------------
  // Step 8: cria campanha
  // -------------------------------------------------------------------------
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
      plan: payload.plan ?? 'basico',
      trial_ends_at: payload.trial_ends_at ?? null,
    })
    .select()
    .single();
  if (campaignErr || !campaign) {
    return fail('insert-campaign',
      campaignErr?.message ?? 'Falha ao criar campanha (insert sem linha)',
      500,
      { campaignErr });
  }
  console.log(`${TAG} campaign created id=${campaign.id}`);

  // -------------------------------------------------------------------------
  // Step 9: cria admin user (idempotente — se já existe, reusa)
  // -------------------------------------------------------------------------
  let adminUserId: string | null = null;
  let adminUserAlreadyExisted = false;

  const { data: created, error: createUserErr } = await admin.auth.admin.createUser({
    email: payload.admin_email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: payload.admin_full_name,
      phone: payload.admin_phone ?? null,
    },
  });

  if (createUserErr) {
    // Caso comum: "User already registered" / "email_exists" / 422.
    // Tenta achar pelo email; se achar, reusa em vez de quebrar a UX.
    const msg = createUserErr.message?.toLowerCase() ?? '';
    const looksLikeDuplicate = /already|exists|duplicate|registered/.test(msg);
    if (looksLikeDuplicate) {
      console.log(`${TAG} createUser disse duplicado — tentando reusar`, msg);
      const { data: existing, error: lookupErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (lookupErr) {
        await admin.from('campaigns').delete().eq('id', campaign.id);
        return fail('lookup-existing-user',
          `Não foi possível localizar usuário existente: ${lookupErr.message}`,
          500,
          { lookupErr });
      }
      const found = existing.users.find(
        (u) => (u.email ?? '').toLowerCase() === payload.admin_email.toLowerCase(),
      );
      if (!found) {
        await admin.from('campaigns').delete().eq('id', campaign.id);
        return fail('create-user',
          `Falha ao criar admin: ${createUserErr.message} (e não achei pelo e-mail)`,
          500);
      }
      adminUserId = found.id;
      adminUserAlreadyExisted = true;
      console.log(`${TAG} reusando user existente id=${adminUserId}`);
    } else {
      // Rollback da campanha e devolve o erro original
      await admin.from('campaigns').delete().eq('id', campaign.id);
      return fail('create-user', createUserErr.message ?? 'Falha ao criar admin', 500, {
        createUserErr,
      });
    }
  } else if (!created?.user) {
    await admin.from('campaigns').delete().eq('id', campaign.id);
    return fail('create-user', 'createUser retornou sem user', 500);
  } else {
    adminUserId = created.user.id;
    console.log(`${TAG} admin user criado id=${adminUserId}`);
  }

  if (!adminUserId) {
    await admin.from('campaigns').delete().eq('id', campaign.id);
    return fail('admin-id-null', 'Falha imprevista: adminUserId nulo', 500);
  }

  // -------------------------------------------------------------------------
  // Step 10: garante profile (trigger normalmente cria, mas se reusou pode
  // ser que precisemos só atualizar)
  // -------------------------------------------------------------------------
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      {
        id: adminUserId,
        full_name: payload.admin_full_name,
        phone: payload.admin_phone ?? null,
        must_change_password: !adminUserAlreadyExisted,
      },
      { onConflict: 'id' },
    );
  if (profileErr) {
    console.warn(`${TAG} profile upsert falhou (não fatal): ${profileErr.message}`);
  }

  // -------------------------------------------------------------------------
  // Step 11: vincula como admin ativo da campanha
  // -------------------------------------------------------------------------
  const { error: cuErr } = await admin.from('campaign_users').insert({
    campaign_id: campaign.id,
    user_id: adminUserId,
    role: 'admin',
    invited_by: callerUser.id,
    is_active: true,
  });
  if (cuErr) {
    // Rollback total: campanha + user (só se nós criamos agora)
    await admin.from('campaigns').delete().eq('id', campaign.id);
    if (!adminUserAlreadyExisted) {
      await admin.auth.admin.deleteUser(adminUserId);
    }
    return fail('link-admin', `Falha ao vincular admin: ${cuErr.message}`, 500, { cuErr });
  }
  console.log(`${TAG} done — campaign=${campaign.id} admin_user=${adminUserId} reused=${adminUserAlreadyExisted}`);

  // -------------------------------------------------------------------------
  // Sucesso
  // -------------------------------------------------------------------------
  return json({
    ok: true,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    candidate_name: campaign.candidate_name,
    admin_user_id: adminUserId,
    admin_email: payload.admin_email,
    temporary_password: adminUserAlreadyExisted ? null : TEMP_PASSWORD,
    admin_already_existed: adminUserAlreadyExisted,
    login_url: LOGIN_URL,
  });
});

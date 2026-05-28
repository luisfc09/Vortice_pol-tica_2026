// Supabase Edge Function — generate-payment
//
// O ADMIN da campanha (cliente logado, em trial) gera o link de pagamento da
// própria campanha pra assinar o Vórtice. Cria/reusa cliente Asaas + assinatura
// recorrente + cobrança avulsa (1º mês) e devolve o link/QR.
//
// Auth: chamada pelo frontend logado (verify_jwt = true). Valida que o caller
// é admin/coordenador da campanha (via RLS no select de campaigns) OU super
// admin. Credenciais Asaas lidas de platform_integrations via service-role.
//
// Deploy: supabase functions deploy generate-payment

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TAG = '[generate-payment]';
type CampaignPlan = 'basico' | 'intermediario' | 'top';
type BillingType = 'CREDIT_CARD' | 'PIX';

const PLAN_PRICE: Record<CampaignPlan, number> = { basico: 997, intermediario: 1997, top: 2497 };
const PLAN_LABEL: Record<CampaignPlan, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  top: 'Avançado',
};

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
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Body {
  campaign_id: string;
  plan: CampaignPlan;
  billing_type: BillingType;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!body.campaign_id || !body.plan || !body.billing_type) {
    return json({ error: 'campaign_id, plan e billing_type são obrigatórios' }, 400);
  }
  const price = PLAN_PRICE[body.plan];
  if (!price) return json({ error: 'plano inválido' }, 400);

  // Caller (RLS aplicada) — confirma acesso à campanha + pega dados do user.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await caller.auth.getUser();
  const callerUser = userData?.user;
  if (!callerUser) return json({ error: 'Sessão inválida' }, 401);

  // Service-role pra ler credenciais Asaas + escrever na campanha. Criado ANTES
  // da verificação de acesso de propósito: a checagem de membership NÃO pode
  // depender do RLS de `campaigns`, que esconde campanhas suspended/pending
  // (current_campaign_id só enxerga trial/active) — justamente os casos que
  // precisam renovar. Confirmamos o vínculo do caller via service-role.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Acesso: super admin OU membro ativo da campanha (qualquer papel).
  const { data: isSuper } = await caller.rpc('is_super_admin');
  if (isSuper !== true) {
    const { data: membership } = await admin
      .from('campaign_users')
      .select('is_active')
      .eq('user_id', callerUser.id)
      .eq('campaign_id', body.campaign_id)
      .maybeSingle();
    if (!membership || membership.is_active !== true) {
      return json({ error: 'Sem acesso a esta campanha' }, 403);
    }
  }

  const { data: campaign, error: campErr } = await admin
    .from('campaigns')
    .select('id, candidate_name, asaas_customer_id')
    .eq('id', body.campaign_id)
    .maybeSingle();
  if (campErr || !campaign) {
    return json({ error: 'Campanha não encontrada' }, 404);
  }

  const { data: cfg } = await admin
    .from('platform_integrations')
    .select('is_enabled, environment, secrets')
    .eq('key', 'asaas')
    .maybeSingle();
  const apiKey = (cfg?.secrets as Record<string, string> | null)?.api_key;
  if (!cfg || !cfg.is_enabled || !apiKey) {
    return json({ error: 'Asaas não está configurado. Fale com a Vórtice.' }, 400);
  }
  const baseUrl =
    cfg.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';

  const asaas = async (method: string, path: string, payload?: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Vortice-SaaS',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Asaas ${res.status}: ${JSON.stringify(data.errors ?? data).slice(0, 200)}`);
    }
    return data;
  };

  try {
    // 1) cliente: reusa se já houver
    let customerId = campaign.asaas_customer_id as string | null;
    if (!customerId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, phone')
        .eq('id', callerUser.id)
        .maybeSingle();
      const customer = await asaas('POST', '/customers', {
        name: (profile?.full_name as string) || campaign.candidate_name,
        email: callerUser.email,
        mobilePhone: ((profile?.phone as string) || '').replace(/\D/g, '') || undefined,
        externalReference: `vortice_${campaign.id}`,
        notificationDisabled: false,
      });
      customerId = customer.id;
      console.log(`✅ Cliente Asaas criado: ${customerId}`);
      await admin.from('campaigns').update({ asaas_customer_id: customerId }).eq('id', campaign.id);
    }

    const planLabel = PLAN_LABEL[body.plan];
    const now = new Date();

    // 2) assinatura recorrente
    const sub = await asaas('POST', '/subscriptions', {
      customer: customerId,
      billingType: body.billing_type,
      value: price,
      nextDueDate: ymd(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      cycle: 'MONTHLY',
      description: `Vórtice ${planLabel} - ${campaign.candidate_name}`,
      externalReference: `vortice_sub_${campaign.id}`,
    });
    console.log(`✅ Assinatura criada: ${sub.id}`);
    await admin
      .from('campaigns')
      .update({ asaas_subscription_id: sub.id, plan: body.plan })
      .eq('id', campaign.id);

    // 3) cobrança avulsa do 1º mês (pagamento imediato) → link + (PIX) QR
    const payment = await asaas('POST', '/payments', {
      customer: customerId,
      billingType: body.billing_type,
      value: price,
      dueDate: ymd(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
      description: `Vórtice ${planLabel} - ${campaign.candidate_name} - Primeiro mês`,
    });
    console.log(`✅ Cobrança gerada: ${payment.id}`);

    let pixQrCode: string | null = null;
    if (body.billing_type === 'PIX') {
      try {
        const qr = await asaas('GET', `/payments/${payment.id}/pixQrCode`);
        pixQrCode = qr.encodedImage ?? qr.payload ?? null;
      } catch (qrErr) {
        console.warn(`${TAG} PIX QR indisponível: ${(qrErr as Error).message}`);
      }
    }

    return json({
      ok: true,
      payment_link: payment.invoiceUrl ?? null,
      pix_qr_code: pixQrCode,
      subscription_id: sub.id,
    });
  } catch (err) {
    console.error(`${TAG} erro: ${(err as Error).message}`);
    return json({ error: (err as Error).message }, 500);
  }
});

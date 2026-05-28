// Supabase Edge Function — asaas-webhook
//
// Recebe os webhooks do Asaas e ativa/suspende campanhas automaticamente:
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → status='active', paid_until=+30d
//   PAYMENT_OVERDUE                      → status='suspended' (só se estava active)
//   SUBSCRIPTION_DELETED                 → status='suspended' (pela assinatura)
//   PAYMENT_REFUNDED                     → status='suspended'
//   PAYMENT_DELETED                      → no-op
//
// Auth: o Asaas não manda JWT — manda o header `asaas-access-token`. Por isso
// esta função é deployada com --no-verify-jwt e valida o secret manualmente
// contra platform_integrations.secrets.webhook_secret.
//
// SEMPRE responde 200 (exceto secret inválido → 401), pra o Asaas não reenviar
// o evento infinitamente. Cada evento é gravado em asaas_webhook_logs.
//
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TAG = '[asaas-webhook]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, asaas-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface AsaasPayment {
  id?: string;
  customer?: string;
  status?: string;
  value?: number;
  paymentDate?: string;
}
interface AsaasSubscription {
  id?: string;
  customer?: string;
  status?: string;
}
interface AsaasWebhookPayload {
  event?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
}

// Linha de log que vamos acumulando e gravar no fim (sempre).
interface LogRow {
  event_type: string;
  asaas_payment_id: string | null;
  asaas_customer_id: string | null;
  campaign_id: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  paid_until_novo: string | null;
  payload: unknown;
  error: string | null;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(`${TAG} env ausente`);
    return json({ received: true, error: 'server misconfigured' }, 200);
  }

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Parse do payload (se falhar, ainda responde 200 pra não reenviar).
  let payload: AsaasWebhookPayload;
  try {
    payload = (await req.json()) as AsaasWebhookPayload;
  } catch {
    return json({ received: true, error: 'invalid json' }, 200);
  }

  const eventType = payload.event ?? 'UNKNOWN';
  const token = req.headers.get('asaas-access-token');

  const log: LogRow = {
    event_type: eventType,
    asaas_payment_id: payload.payment?.id ?? null,
    asaas_customer_id: payload.payment?.customer ?? payload.subscription?.customer ?? null,
    campaign_id: null,
    status_anterior: null,
    status_novo: null,
    paid_until_novo: null,
    payload,
    error: null,
  };

  // -------------------------------------------------------------------------
  // Validação do webhook secret
  // -------------------------------------------------------------------------
  try {
    const { data: cfg } = await admin
      .from('platform_integrations')
      .select('is_enabled, secrets')
      .eq('key', 'asaas')
      .maybeSingle();
    const expected = (cfg?.secrets as Record<string, string> | null)?.webhook_secret;

    if (expected) {
      if (token !== expected) {
        // Tentativa inválida — loga e REJEITA (não processa).
        log.error = 'webhook secret inválido';
        await saveLog(admin, log);
        console.warn(`${TAG} secret inválido — rejeitando`);
        return json({ error: 'unauthorized' }, 401);
      }
    } else {
      // Sem secret configurado: aceita mas avisa.
      console.warn(`${TAG} sem webhook_secret configurado — aceitando sem validar`);
    }
  } catch (e) {
    console.warn(`${TAG} falha ao validar secret (seguindo): ${(e as Error).message}`);
  }

  // -------------------------------------------------------------------------
  // Processa o evento
  // -------------------------------------------------------------------------
  try {
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await activate(admin, payload.payment, log);
        break;
      case 'PAYMENT_OVERDUE':
        await suspendByCustomer(admin, payload.payment, log, /* onlyIfActive */ true);
        break;
      case 'PAYMENT_REFUNDED':
        await suspendByCustomer(admin, payload.payment, log, /* onlyIfActive */ false);
        break;
      case 'SUBSCRIPTION_DELETED':
        await suspendBySubscription(admin, payload.subscription, log);
        break;
      case 'PAYMENT_DELETED':
        // no-op: cobrança avulsa cancelada não suspende.
        console.log(`${TAG} PAYMENT_DELETED — no-op`);
        break;
      default:
        console.log(`${TAG} evento sem handler: ${eventType}`);
    }
  } catch (err) {
    log.error = (err as Error).message;
    console.warn(`${TAG} erro processando ${eventType} (não bloqueante): ${log.error}`);
  }

  // Sempre grava o log e sempre responde 200.
  await saveLog(admin, log);
  return json({ received: true, error: log.error ? true : false }, 200);
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function activate(admin: Admin, payment: AsaasPayment | undefined, log: LogRow) {
  const customer = payment?.customer;
  if (!customer) {
    log.error = 'payload sem payment.customer';
    return;
  }
  const { data: camp } = await admin
    .from('campaigns')
    .select('id, status')
    .eq('asaas_customer_id', customer)
    .maybeSingle();
  if (!camp) {
    log.error = `campanha não encontrada p/ customer ${customer}`;
    return;
  }
  log.campaign_id = camp.id;
  log.status_anterior = camp.status;

  const baseDate = payment?.paymentDate ? new Date(payment.paymentDate) : new Date();
  const paidUntil = new Date(baseDate.getTime() + THIRTY_DAYS_MS).toISOString();

  const { error } = await admin
    .from('campaigns')
    .update({ status: 'active', paid_until: paidUntil })
    .eq('id', camp.id);
  if (error) {
    log.error = `update falhou: ${error.message}`;
    return;
  }
  log.status_novo = 'active';
  log.paid_until_novo = paidUntil;
  console.log(`✅ Campanha ${camp.id} ativada (paid_until=${paidUntil})`);
}

async function suspendByCustomer(
  admin: Admin,
  payment: AsaasPayment | undefined,
  log: LogRow,
  onlyIfActive: boolean,
) {
  const customer = payment?.customer;
  if (!customer) {
    log.error = 'payload sem payment.customer';
    return;
  }
  const { data: camp } = await admin
    .from('campaigns')
    .select('id, status')
    .eq('asaas_customer_id', customer)
    .maybeSingle();
  if (!camp) {
    log.error = `campanha não encontrada p/ customer ${customer}`;
    return;
  }
  log.campaign_id = camp.id;
  log.status_anterior = camp.status;

  // PAYMENT_OVERDUE só suspende se estava 'active' (não mexe em trial).
  if (onlyIfActive && camp.status !== 'active') {
    console.log(`${TAG} não suspende: status atual=${camp.status} (esperava active)`);
    return;
  }
  const { error } = await admin
    .from('campaigns')
    .update({ status: 'suspended' })
    .eq('id', camp.id);
  if (error) {
    log.error = `update falhou: ${error.message}`;
    return;
  }
  log.status_novo = 'suspended';
  console.log(`🔴 Campanha ${camp.id} suspensa (customer ${customer})`);
}

async function suspendBySubscription(
  admin: Admin,
  subscription: AsaasSubscription | undefined,
  log: LogRow,
) {
  const subId = subscription?.id;
  if (!subId) {
    log.error = 'payload sem subscription.id';
    return;
  }
  const { data: camp } = await admin
    .from('campaigns')
    .select('id, status')
    .eq('asaas_subscription_id', subId)
    .maybeSingle();
  if (!camp) {
    log.error = `campanha não encontrada p/ subscription ${subId}`;
    return;
  }
  log.campaign_id = camp.id;
  log.status_anterior = camp.status;
  const { error } = await admin
    .from('campaigns')
    .update({ status: 'suspended' })
    .eq('id', camp.id);
  if (error) {
    log.error = `update falhou: ${error.message}`;
    return;
  }
  log.status_novo = 'suspended';
  console.log(`🔴 Campanha ${camp.id} suspensa (subscription ${subId})`);
}

// ---------------------------------------------------------------------------
async function saveLog(admin: Admin, log: LogRow) {
  try {
    await admin.from('asaas_webhook_logs').insert(log);
  } catch (e) {
    console.error(`${TAG} falha ao gravar log: ${(e as Error).message}`);
  }
}

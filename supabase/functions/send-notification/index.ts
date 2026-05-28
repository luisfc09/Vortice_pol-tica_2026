// Supabase Edge Function — send-notification
//
// Envia e-mail (Resend) + WhatsApp (Evolution API) pro admin de uma campanha.
// Chamada SÓ internamente (provision-campaign, asaas-webhook, jobs) — valida
// o header x-internal-token contra o secret INTERNAL_FN_TOKEN.
//
// WhatsApp é NÃO-BLOQUEANTE: se a Evolution não estiver configurada/ativa em
// platform_integrations, só o e-mail é enviado. E-mail também não derruba o
// caller se falhar — tudo é logado em notification_logs.
//
// Templates: welcome | payment_confirmed | due_reminder (level D-7/D-3/D-1/D+0)
//
// Deploy: supabase functions deploy send-notification --no-verify-jwt
// Secrets: RESEND_API_KEY, INTERNAL_FN_TOKEN, APP_LOGIN_URL (opcional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TAG = '[send-notification]';
const FROM = 'Vórtice <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Template = 'welcome' | 'payment_confirmed' | 'due_reminder';
type Level = 'D-7' | 'D-3' | 'D-1' | 'D+0';

interface Body {
  template: Template;
  campaign_id: string;
  level?: Level;
  vars?: Record<string, string | null | undefined>;
}

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  top: 'Avançado',
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

// número BR → só dígitos com DDI 55.
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return d;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

interface Built {
  subject: string;
  html: string;
  whatsapp: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const INTERNAL_TOKEN = Deno.env.get('INTERNAL_FN_TOKEN');
  if (INTERNAL_TOKEN && req.headers.get('x-internal-token') !== INTERNAL_TOKEN) {
    return json({ error: 'forbidden' }, 403);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const LOGIN_URL = Deno.env.get('APP_LOGIN_URL') ?? 'https://vorticepol-tica2026-production.up.railway.app/login';
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server misconfigured' }, 500);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!body.template || !body.campaign_id) {
    return json({ error: 'template e campaign_id obrigatórios' }, 400);
  }

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- resolve campanha + destinatário ----
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, candidate_name, plan, status, trial_ends_at, paid_until')
    .eq('id', body.campaign_id)
    .maybeSingle();
  if (!campaign) return json({ error: 'campanha não encontrada' }, 404);

  // admin da campanha
  let email = body.vars?.admin_email ?? null;
  let name = body.vars?.admin_name ?? null;
  let phone = body.vars?.admin_phone ?? null;

  if (!email || !phone || !name) {
    const { data: membership } = await admin
      .from('campaign_users')
      .select('user_id')
      .eq('campaign_id', campaign.id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (membership?.user_id) {
      const { data: prof } = await admin
        .from('profiles')
        .select('full_name, phone')
        .eq('id', membership.user_id)
        .maybeSingle();
      if (!name) name = prof?.full_name ?? null;
      if (!phone) phone = prof?.phone ?? null;
      if (!email) {
        const { data: u } = await admin.auth.admin.getUserById(membership.user_id);
        email = u?.user?.email ?? null;
      }
    }
  }

  const ctx = {
    candidate_name: campaign.candidate_name as string,
    admin_name: (name as string) || (campaign.candidate_name as string),
    admin_email: (email as string) || '',
    login_url: LOGIN_URL,
    temporary_password: body.vars?.temporary_password ?? '1234',
    payment_link: body.vars?.payment_link ?? null,
    pix_qr_code: body.vars?.pix_qr_code ?? null,
    trial_ends_at: fmtDate(campaign.trial_ends_at),
    paid_until: fmtDate(campaign.paid_until),
    plan_name: PLAN_LABEL[campaign.plan as string] ?? (campaign.plan as string),
    level: body.level ?? 'D-7',
  };

  const built = buildMessages(body.template, ctx);

  // ---- envia e-mail (Resend) ----
  let emailSent = false;
  let emailError: string | null = null;
  if (!RESEND_API_KEY) {
    emailError = 'RESEND_API_KEY não configurada';
  } else if (!email) {
    emailError = 'sem e-mail do destinatário';
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to: [email], subject: built.subject, html: built.html }),
      });
      if (res.ok) {
        emailSent = true;
        console.log(`${TAG} e-mail enviado p/ ${email}`);
      } else {
        emailError = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
        console.warn(`${TAG} ${emailError}`);
      }
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  // ---- envia WhatsApp (Evolution) — NÃO-BLOQUEANTE ----
  let whatsappSent = false;
  let whatsappSkipped = false;
  let whatsappError: string | null = null;
  try {
    const { data: evo } = await admin
      .from('platform_integrations')
      .select('is_enabled, config, secrets')
      .eq('key', 'evolution')
      .maybeSingle();
    const cfg = (evo?.config as Record<string, string> | null) ?? {};
    const apiKey = (evo?.secrets as Record<string, string> | null)?.api_key;
    const url = cfg.url;
    const instance = cfg.instance;
    const num = normalizePhone(phone);

    if (!evo || !evo.is_enabled || !url || !instance || !apiKey) {
      whatsappSkipped = true;
      console.log(`${TAG} WhatsApp skipped: Evolution não configurada`);
    } else if (!num) {
      whatsappSkipped = true;
      console.log(`${TAG} WhatsApp skipped: sem telefone`);
    } else {
      const res = await fetch(`${url.replace(/\/$/, '')}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, text: built.whatsapp }),
      });
      if (res.ok) {
        whatsappSent = true;
        console.log(`${TAG} WhatsApp enviado p/ ${num}`);
      } else {
        whatsappError = `Evolution ${res.status}: ${(await res.text()).slice(0, 200)}`;
        console.warn(`${TAG} ${whatsappError}`);
      }
    }
  } catch (e) {
    whatsappError = (e as Error).message;
    console.warn(`${TAG} WhatsApp erro (não bloqueante): ${whatsappError}`);
  }

  // ---- log ----
  try {
    await admin.from('notification_logs').insert({
      campaign_id: campaign.id,
      template: body.template,
      level: body.template === 'due_reminder' ? (body.level ?? null) : null,
      email,
      phone,
      email_sent: emailSent,
      whatsapp_sent: whatsappSent,
      whatsapp_skipped: whatsappSkipped,
      email_error: emailError,
      whatsapp_error: whatsappError,
    });
  } catch (e) {
    console.error(`${TAG} falha ao gravar log: ${(e as Error).message}`);
  }

  return json({
    ok: true,
    email_sent: emailSent,
    whatsapp_sent: whatsappSent,
    whatsapp_skipped: whatsappSkipped,
    errors: { email: emailError, whatsapp: whatsappError },
  });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
interface Ctx {
  candidate_name: string;
  admin_name: string;
  admin_email: string;
  login_url: string;
  temporary_password: string;
  payment_link: string | null;
  pix_qr_code: string | null;
  trial_ends_at: string;
  paid_until: string;
  plan_name: string;
  level: Level;
}

function shell(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0A0F1E;color:#E2E8F0;border-radius:12px;overflow:hidden">
    <div style="padding:20px 24px;background:#0F172A;border-bottom:1px solid #1E293B">
      <span style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#fff">V<span style="color:#A3E635">Ó</span>RTICE</span>
    </div>
    <div style="padding:24px">${inner}</div>
    <div style="padding:16px 24px;background:#0F172A;border-top:1px solid #1E293B;font-size:12px;color:#64748B">
      Vórtice — Estratégia que move eleições · suporte: suporte@vortice.app
    </div>
  </div>`;
}
function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#A3E635;color:#0A0F1E;font-weight:bold;padding:12px 20px;border-radius:8px;text-decoration:none;margin:12px 0">${label}</a>`;
}
function box(content: string, accent = '#1E293B'): string {
  return `<div style="background:#0F172A;border:1px solid ${accent};border-radius:8px;padding:14px;margin:12px 0;font-size:14px">${content}</div>`;
}

function buildMessages(template: Template, c: Ctx): Built {
  if (template === 'welcome') {
    const credsBox = box(
      `<strong>🔐 Acesso ao sistema</strong><br/>E-mail: <b>${c.admin_email}</b><br/>Senha temporária: <b>${c.temporary_password}</b><br/><span style="color:#94A3B8;font-size:12px">No primeiro acesso você define sua senha pessoal.</span>`,
    );
    const payBox = c.payment_link
      ? box(
          `<strong>💳 Pagamento</strong><br/>Plano <b>${c.plan_name}</b>.<br/>${btn(c.payment_link, 'Pagar agora')}`,
          '#10b98166',
        )
      : '';
    const trialBox =
      !c.payment_link && c.trial_ends_at
        ? box(`<strong>⏱️ Trial gratuito</strong><br/>Seu acesso de teste vai até <b>${c.trial_ends_at}</b>.`, '#f59e0b66')
        : '';
    const html = shell(
      `<h2 style="margin:0 0 8px;color:#fff">Bem-vindo ao Vórtice, ${c.candidate_name}!</h2>
       <p>Olá, ${c.admin_name}. Sua campanha foi criada e já está pronta pra uso.</p>
       ${credsBox}
       ${btn(c.login_url, 'Acessar o sistema')}
       ${payBox}${trialBox}`,
    );
    let wa = `Olá ${c.admin_name}! 👋\n\nSua campanha *${c.candidate_name}* foi criada no Vórtice.\n\n🔐 *Acesso ao sistema:*\nLink: ${c.login_url}\nEmail: ${c.admin_email}\nSenha temporária: ${c.temporary_password}\n`;
    if (c.payment_link) wa += `\n💳 *Link de pagamento:*\n${c.payment_link}\n`;
    else if (c.trial_ends_at) wa += `\n⏱️ *Trial gratuito até:* ${c.trial_ends_at}\n`;
    wa += `\nQualquer dúvida estamos aqui! 🚀`;
    return { subject: `Bem-vindo ao Vórtice, ${c.candidate_name}!`, html, whatsapp: wa };
  }

  if (template === 'payment_confirmed') {
    const html = shell(
      `<h2 style="margin:0 0 8px;color:#fff">Pagamento confirmado ✅</h2>
       <p>A campanha <b>${c.candidate_name}</b> está ativa.</p>
       ${box(`Plano: <b>${c.plan_name}</b><br/>Próximo vencimento: <b>${c.paid_until || '—'}</b>`)}
       ${btn(c.login_url, 'Acessar o sistema')}`,
    );
    const wa = `✅ Pagamento confirmado!\n\nSua campanha *${c.candidate_name}* está ativa.\nPlano: *${c.plan_name}*\nPróximo vencimento: *${c.paid_until || '—'}*\n\nAcesse: ${c.login_url}`;
    return { subject: 'Pagamento confirmado — Vórtice ativo!', html, whatsapp: wa };
  }

  // due_reminder
  const tone: Record<Level, { title: string; emoji: string; subject: string }> = {
    'D-7': { title: 'Seu plano vence em 7 dias', emoji: '🗓️', subject: 'Seu Vórtice vence em 7 dias' },
    'D-3': { title: 'Faltam 3 dias para o vencimento', emoji: '⚠️', subject: 'Atenção: Vórtice vence em 3 dias' },
    'D-1': { title: 'Seu plano vence amanhã', emoji: '🚨', subject: 'Urgente: Vórtice vence amanhã' },
    'D+0': { title: 'Seu plano venceu hoje', emoji: '⛔', subject: 'Seu Vórtice venceu — renove o acesso' },
  };
  const t = tone[c.level];
  const renewHref = c.payment_link ?? c.login_url;
  const html = shell(
    `<h2 style="margin:0 0 8px;color:#fff">${t.emoji} ${t.title}</h2>
     <p>Campanha <b>${c.candidate_name}</b> — plano ${c.plan_name}.</p>
     ${box(`Vencimento: <b>${c.paid_until || c.trial_ends_at || '—'}</b>`)}
     ${btn(renewHref, 'Renovar agora')}`,
  );
  const wa = `${t.emoji} ${t.title}\n\nCampanha *${c.candidate_name}* (plano ${c.plan_name}).\nRenove pra não perder o acesso:\n${renewHref}`;
  return { subject: t.subject, html, whatsapp: wa };
}

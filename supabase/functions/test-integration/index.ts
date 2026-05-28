// Supabase Edge Function — test-integration
//
// Recebe { type, secrets, config } e testa a integração contra a API real,
// retornando { ok, message }. Não persiste — apenas valida.
//
// Persistência (last_test_at / last_test_ok / last_test_message) é feita
// pelo client após chamada bem-sucedida.

type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek'
  | 'twitter'
  | 'google_news'
  | 'meta_ads'
  | 'google_ads'
  | 'whatsapp'
  | 'asaas'
  | 'evolution';

interface TestRequest {
  type: IntegrationType;
  secrets: Record<string, string>;
  config?: Record<string, unknown>;
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

  // JWT do caller (apenas para verificar que é authenticated; o teste não precisa de RLS)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let payload: TestRequest;
  try {
    payload = (await req.json()) as TestRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { type, secrets, config } = payload;
  if (!type) return json({ error: 'type obrigatório' }, 400);

  try {
    switch (type) {
      case 'anthropic':
        return await testAnthropic(secrets);
      case 'openai':
        return await testOpenAI(secrets, config ?? {});
      case 'gemini':
        return await testGemini(secrets, config ?? {});
      case 'mistral':
        return await testMistral(secrets);
      case 'groq':
        return await testGroq(secrets);
      case 'xai':
        return await testXAi(secrets);
      case 'deepseek':
        return await testDeepSeek(secrets);
      case 'twitter':
        return await testTwitter(secrets);
      case 'google_news':
        return await testGoogleNews(config ?? {});
      case 'meta_ads':
        return await testMetaAds(secrets);
      case 'google_ads':
        return json({ ok: false, message: 'Teste de Google Ads ainda não implementado.' });
      case 'whatsapp':
        return await testWhatsApp(secrets);
      case 'asaas':
        return await testAsaas(secrets, config ?? {});
      case 'evolution':
        return await testEvolution(secrets, config ?? {});
      default:
        return json({ ok: false, message: 'Tipo desconhecido.' }, 400);
    }
  } catch (err) {
    return json({ ok: false, message: (err as Error).message }, 500);
  }
});

// --------- Anthropic ---------------------------------------------------------
async function testAnthropic(secrets: Record<string, string>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });

  // Chamada mínima — 1 token, modelo barato.
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `Anthropic ${res.status}: ${text.slice(0, 200)}` });
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const reply = data.content?.[0]?.text ?? 'sem conteúdo';
  return json({ ok: true, message: `Anthropic respondeu: "${reply.trim()}"` });
}

// --------- OpenAI ------------------------------------------------------------
async function testOpenAI(secrets: Record<string, string>, config: Record<string, unknown>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });

  const model = (config.model as string) || 'gpt-4o-mini';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (secrets.organization || (config.organization as string)) {
    headers['OpenAI-Organization'] =
      (secrets.organization as string) || (config.organization as string);
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `OpenAI ${res.status}: ${text.slice(0, 200)}` });
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content ?? 'sem conteúdo';
  return json({ ok: true, message: `OpenAI (${model}) respondeu: "${reply.trim()}"` });
}

// --------- Google Gemini -----------------------------------------------------
async function testGemini(secrets: Record<string, string>, config: Record<string, unknown>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });

  const model = (config.model as string) || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
      generationConfig: { maxOutputTokens: 8 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `Gemini ${res.status}: ${text.slice(0, 200)}` });
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'sem conteúdo';
  return json({ ok: true, message: `Gemini (${model}) respondeu: "${reply.trim()}"` });
}

// --------- Mistral -----------------------------------------------------------
async function testMistral(secrets: Record<string, string>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });
  if (!res.ok) {
    return json({ ok: false, message: `Mistral ${res.status}: ${(await res.text()).slice(0, 200)}` });
  }
  return json({ ok: true, message: 'Mistral autenticou com sucesso.' });
}

// --------- Groq --------------------------------------------------------------
async function testGroq(secrets: Record<string, string>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });
  if (!res.ok) {
    return json({ ok: false, message: `Groq ${res.status}: ${(await res.text()).slice(0, 200)}` });
  }
  return json({ ok: true, message: 'Groq autenticou com sucesso.' });
}

// --------- xAI Grok ----------------------------------------------------------
async function testXAi(secrets: Record<string, string>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-2-mini',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });
  if (!res.ok) {
    return json({ ok: false, message: `xAI ${res.status}: ${(await res.text()).slice(0, 200)}` });
  }
  return json({ ok: true, message: 'xAI Grok autenticou com sucesso.' });
}

// --------- DeepSeek ----------------------------------------------------------
async function testDeepSeek(secrets: Record<string, string>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta api_key.' });
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    }),
  });
  if (!res.ok) {
    return json({ ok: false, message: `DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}` });
  }
  return json({ ok: true, message: 'DeepSeek autenticou com sucesso.' });
}

// --------- Twitter / X API v2 ------------------------------------------------
async function testTwitter(secrets: Record<string, string>) {
  const bearer = secrets.bearer_token;
  if (!bearer) return json({ ok: false, message: 'Falta bearer_token.' });

  // Endpoint barato: rules de filtered stream — só lista, sem custo.
  const res = await fetch('https://api.twitter.com/2/users/by/username/twitterdev', {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `X API ${res.status}: ${text.slice(0, 200)}` });
  }
  return json({ ok: true, message: 'X API autenticada com sucesso.' });
}

// --------- Google News (RSS público) ----------------------------------------
async function testGoogleNews(config: Record<string, unknown>) {
  const query = (config.query as string) ?? 'Brasil';
  const lang = (config.language as string) ?? 'pt-BR';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=${encodeURIComponent(lang)}&gl=BR&ceid=BR:pt-419`;
  const res = await fetch(url);
  if (!res.ok) {
    return json({ ok: false, message: `Google News ${res.status}` });
  }
  const xml = await res.text();
  const itemCount = (xml.match(/<item>/g) ?? []).length;
  return json({
    ok: true,
    message: `Google News retornou ${itemCount} resultados para "${query}".`,
  });
}

// --------- Meta Ads ----------------------------------------------------------
async function testMetaAds(secrets: Record<string, string>) {
  const token = secrets.access_token;
  const account = secrets.ad_account_id;
  if (!token || !account) {
    return json({ ok: false, message: 'Faltam access_token e/ou ad_account_id.' });
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/${account}?fields=name,id&access_token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `Meta API ${res.status}: ${text.slice(0, 200)}` });
  }
  const data = (await res.json()) as { name?: string };
  return json({ ok: true, message: `Conta conectada: ${data.name ?? account}` });
}

// --------- WhatsApp Cloud API ------------------------------------------------
async function testWhatsApp(secrets: Record<string, string>) {
  const token = secrets.access_token;
  const phoneId = secrets.phone_number_id;
  if (!token || !phoneId) {
    return json({ ok: false, message: 'Faltam access_token e phone_number_id.' });
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=verified_name,display_phone_number`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `WhatsApp ${res.status}: ${text.slice(0, 200)}` });
  }
  const data = (await res.json()) as { verified_name?: string; display_phone_number?: string };
  return json({
    ok: true,
    message: `Conectado: ${data.verified_name ?? 'sem nome'} · ${data.display_phone_number ?? ''}`,
  });
}

// --------- Asaas (cobrança / pagamentos) -------------------------------------
async function testAsaas(secrets: Record<string, string>, config: Record<string, unknown>) {
  const apiKey = secrets.api_key;
  if (!apiKey) return json({ ok: false, message: 'Falta a API Key do Asaas.' });

  const env = (config.environment as string) === 'production' ? 'production' : 'sandbox';
  const base =
    env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';

  // GET /myAccount confirma que a chave é válida e devolve os dados da conta.
  const res = await fetch(`${base}/myAccount`, {
    headers: {
      access_token: apiKey,
      'User-Agent': 'Vortice-SaaS',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, message: `Asaas ${res.status}: ${text.slice(0, 200)}` });
  }

  const data = (await res.json()) as {
    name?: string;
    companyName?: string;
    email?: string;
    tradingName?: string;
  };
  const accountName =
    data.companyName || data.tradingName || data.name || data.email || 'conta Asaas';
  return json({
    ok: true,
    message: `Asaas (${env}) conectado: ${accountName}`,
    account_name: accountName,
  });
}

// --------- Evolution API (WhatsApp) ------------------------------------------
async function testEvolution(secrets: Record<string, string>, config: Record<string, unknown>) {
  const apiKey = secrets.api_key;
  const url = (config.url as string) || '';
  const instance = (config.instance as string) || '';
  if (!apiKey || !url || !instance) {
    return json({ ok: false, message: 'Faltam URL da instância, nome da instância e API Key.' });
  }
  const res = await fetch(
    `${url.replace(/\/$/, '')}/instance/connectionState/${encodeURIComponent(instance)}`,
    { headers: { apikey: apiKey } },
  );
  if (!res.ok) {
    return json({ ok: false, message: `Evolution ${res.status}: ${(await res.text()).slice(0, 200)}` });
  }
  const data = (await res.json()) as { instance?: { state?: string }; state?: string };
  const state = data?.instance?.state ?? data?.state ?? 'desconhecido';
  return json({
    ok: true,
    message: `Evolution conectada — instância "${instance}" (estado: ${state}).`,
  });
}

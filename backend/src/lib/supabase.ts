import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Dois clientes distintos:
//   - sbAnon: usado pelo servidor Express ao responder requests do frontend.
//     RLS aplicada normalmente (tse_resultados tem SELECT público, então
//     queries de leitura funcionam mesmo com anon).
//   - sbAdmin: usado pelo importer (CLI) pra fazer upsert em bulk. Bypassa
//     RLS porque usa a service-role key. NÃO exportar / usar no Express.
//
// WebSocket: o supabase-js inicializa um Realtime client mesmo se a gente
// não usa subscriptions. Em Node < 22 (sem WebSocket nativo) a inicialização
// falha. Passamos o `ws` package como transport pra desbloquear. Quando
// o projeto subir pra Node 22+, isso vira no-op (mas não atrapalha).

let _anon: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

// Cast pra `any` porque o tipo do supabase-js espera o WebSocket nativo
// do browser (WHATWG), mas `ws` é compatível em runtime — só os
// types do `onerror` (ErrorEvent vs Event) divergem ligeiramente,
// nada que afete uso prático.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtimeConfig = { transport: WebSocket as any };

export function sbAnon(): SupabaseClient {
  if (_anon) return _anon;
  _anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: realtimeConfig,
  });
  return _anon;
}

export function sbAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: realtimeConfig,
  });
  return _admin;
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Dois clientes distintos:
//   - sbAnon: usado pelo servidor Express ao responder requests do frontend.
//     RLS aplicada normalmente (tse_resultados tem SELECT público, então
//     queries de leitura funcionam mesmo com anon).
//   - sbAdmin: usado pelo importer (CLI) pra fazer upsert em bulk. Bypassa
//     RLS porque usa a service-role key. NÃO exportar / usar no Express.

let _anon: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export function sbAnon(): SupabaseClient {
  if (_anon) return _anon;
  _anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}

export function sbAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

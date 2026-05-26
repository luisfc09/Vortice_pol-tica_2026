import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const USE_MOCKS =
  import.meta.env.VITE_USE_MOCKS === 'true' || !url || !key;

// In mock mode we expose a placeholder client. Code that talks to Supabase
// MUST gate on USE_MOCKS — never call .from() etc. when in mocks.
export const supabase: SupabaseClient = USE_MOCKS
  ? createClient('https://mock.supabase.co', 'mock-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

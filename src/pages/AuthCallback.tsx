// ============================================================================
// AuthCallback — rota pública /auth/callback usada pelo Supabase Auth quando
// o user volta de um fluxo OAuth (Google, Magic Link, password reset, etc).
// ----------------------------------------------------------------------------
// O Supabase JS detecta automaticamente os tokens no fragment da URL
// (#access_token=...&refresh_token=...) e dispara o evento SIGNED_IN no
// onAuthStateChange (que useAuth.ts já escuta) → hidrata a sessão.
//
// Este componente apenas:
//   1. Confere que o supabase-js conseguiu materializar a sessão
//   2. Espera o useAuth hidratar a store (com timeout de segurança)
//   3. Resolve a home correta pela sessão hidratada e navega
//   4. Em caso de erro, mostra mensagem e cai pro /login após 2s
//
// Por que precisa existir como rota: o redirect_url do OAuth deve apontar
// pra uma rota PÚBLICA (sem ProtectedRoute), porque na hora em que o
// callback chega, a sessão ainda não está populada no Zustand store.
// Se redirecionássemos pra uma rota protegida, o ProtectedRoute redirecionaria
// pra /login antes do hydrate completar.
//
// ⚠️ Chamar useAuth() aqui é obrigatório, não decorativo: é o hook que hidrata
// a store. Antes esta tela navegava pra home logo depois do getSession(), com
// a store ainda vazia — o ProtectedRoute do destino via `session === null` e
// jogava o usuário de volta pro /login. Só funcionava por acidente, porque o
// LoginForm montava o useAuth e redirecionava de novo depois.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { resolveHomeRoute } from '@/lib/homeRoute';

// Teto de espera pela hidratação. Estourou (rede caída, RPC pendurada, ou o
// hydrate deslogou o usuário por regra de negócio) → volta pro /login em vez
// de deixar o spinner girando pra sempre.
const HYDRATE_TIMEOUT_MS = 15000;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // 1) A sessão do Supabase existe mesmo? getSession() só resolve depois do
  // initialize(), então aqui o exchange do `?code=` (PKCE) já terminou.
  useEffect(() => {
    let cancelled = false;

    function bail(message: string) {
      if (cancelled) return;
      setError(message);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    }

    async function checkSession() {
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionErr) {
          bail(`Erro de autenticação: ${sessionErr.message}`);
          return;
        }
        if (!data.session) {
          bail('Sessão não encontrada após callback.');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[AuthCallback] erro inesperado:', err);
        bail(err instanceof Error ? err.message : 'Erro desconhecido na autenticação.');
      }
    }

    void checkSession();
    const timeout = setTimeout(
      () => bail('Não foi possível concluir o login.'),
      HYDRATE_TIMEOUT_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [navigate]);

  // 2) Store hidratada pelo useAuth → agora dá pra resolver a home de verdade,
  // com o role e o is_super_admin reais (antes isto chutava por user_metadata).
  useEffect(() => {
    if (!session) return;
    // Super admin sem campanha vinculada administra pelo painel da Vórtice —
    // mesmo destino que o ProtectedRoute usa.
    const home =
      session.is_super_admin && !session.campaign
        ? '/admin/campaigns'
        : resolveHomeRoute(session.role);
    navigate(home, { replace: true });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-vortex-bg p-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-2xl">❌</p>
            <p className="mt-2 text-sm text-red-300">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Redirecionando para o login…
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Autenticando…</span>
          </div>
        )}
      </div>
    </div>
  );
}

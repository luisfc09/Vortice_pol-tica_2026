// ============================================================================
// AuthCallback — rota pública /auth/callback usada pelo Supabase Auth quando
// o user volta de um fluxo OAuth (Google, Magic Link, password reset, etc).
// ----------------------------------------------------------------------------
// O Supabase JS detecta automaticamente os tokens no fragment da URL
// (#access_token=...&refresh_token=...) e dispara o evento SIGNED_IN no
// onAuthStateChange (que useAuth.ts já escuta) → hidrata a sessão.
//
// Este componente apenas:
//   1. Espera a sessão chegar (com timeout de segurança)
//   2. Resolve a home correta por role e navega
//   3. Em caso de erro, mostra mensagem e cai pro /login após 2s
//
// Por que precisa existir como rota: o redirect_url do OAuth deve apontar
// pra uma rota PÚBLICA (sem ProtectedRoute), porque na hora em que o
// callback chega, a sessão ainda não está populada no Zustand store.
// Se redirecionássemos pra uma rota protegida, o ProtectedRoute redirecionaria
// pra /login antes do hydrate completar.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { resolveHomeRoute } from '@/lib/homeRoute';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // getSession() lê os tokens que o supabase-js já capturou do URL fragment.
        // Não fazemos exchange manual porque o supabase-js já cuidou disso no
        // boot (`detectSessionInUrl: true` é o default).
        const { data, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          setError(`Erro de autenticação: ${sessionErr.message}`);
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        if (!data.session) {
          setError('Sessão não encontrada após callback.');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        // Resolve home por role — supporter → /minha-rede, leader → /agenda,
        // demais → /dashboard. Usa o helper único de src/lib/homeRoute.ts
        // (mesmo padrão de TrocarSenha + HomeRedirect + ProtectedRoute).
        //
        // ATENÇÃO: aqui não temos `session.role` pronto ainda (useAuth precisa
        // de 1 tick a mais pra hidratar membership). Fallback pra /dashboard
        // (que é a home da MAIORIA dos roles); se for supporter/leader, o
        // ProtectedRoute redireciona via fallbackHome — sem loop.
        const userMetaRole = data.session.user?.user_metadata?.role as
          | string
          | undefined;
        const home = resolveHomeRoute(
          (userMetaRole as Parameters<typeof resolveHomeRoute>[0]) ?? null,
        );
        navigate(home, { replace: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[AuthCallback] erro inesperado:', err);
        setError(
          err instanceof Error ? err.message : 'Erro desconhecido na autenticação.',
        );
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    }

    void handleAuthCallback();
  }, [navigate]);

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

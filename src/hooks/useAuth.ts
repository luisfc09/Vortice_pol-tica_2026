import { useCallback, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { resolveMockLogin } from '@/lib/mocks';
import { resetCollections } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { useViewAsStore } from '@/stores/viewAs';
import type { Campaign, Profile, SessionUser, UserRole } from '@/types';

interface LoginResult {
  ok: boolean;
  error?: string;
}

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    let active = true;

    async function hydrateFromSession(sb: Session): Promise<{ ok: boolean; error?: string }> {
      const [profile, membership, isSuperAdmin] = await Promise.all([
        fetchProfile(sb.user.id),
        fetchMembership(),
        fetchIsSuperAdmin(),
      ]);
      if (!active) return { ok: false };

      const gate = evaluateMembership(membership, isSuperAdmin);
      if (gate.signOut) {
        await supabase.auth.signOut();
        setSession(null);
        return { ok: false, error: gate.error };
      }

      // Guarda contra "sessão fantasma": este hydrate roda em paralelo com o
      // login() e com o onAuthStateChange. Se outro caminho deslogou enquanto
      // as RPCs acima estavam no ar, elas voltaram como anon — is_super_admin
      // false e membership null — e gravar isso na store deixava o usuário
      // preso em /aguardando-ativacao com uma sessão que não existe mais.
      const { data: live } = await supabase.auth.getSession();
      if (!active || !live.session) return { ok: false };

      // Caso "aguardando ativação": user logou (auth.user existe + profile pelo
      // trigger handle_new_user) mas ainda não foi vinculado a campanha. Em vez
      // de deslogar, deixa session válida com campaign: null e role: null —
      // ProtectedRoute redireciona pra /aguardando-ativacao.
      setSession({
        id: sb.user.id,
        email: sb.user.email ?? '',
        profile: profile ?? {
          id: sb.user.id,
          full_name:
            (sb.user.user_metadata?.full_name as string | undefined) ??
            sb.user.email ??
            'Novo usuário',
          phone: null,
          avatar_url: null,
          municipality_code: null,
          must_change_password: false,
          created_at: new Date().toISOString(),
        },
        campaign: gate.campaign,
        role: gate.role,
        is_super_admin: isSuperAdmin,
      });
      return { ok: true };
    }

    async function boot() {
      if (USE_MOCKS) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setSession(null);
        return;
      }
      await hydrateFromSession(data.session);
    }

    void boot();

    if (USE_MOCKS) {
      return () => {
        active = false;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (!supaSession) {
        setSession(null);
        resetCollections();
        return;
      }
      void hydrateFromSession(supaSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setLoading]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setLoading(true);
      try {
        if (USE_MOCKS) {
          const mocked = resolveMockLogin(email, password);
          if (!mocked) return { ok: false, error: 'Credenciais inválidas (modo mock).' };
          setSession(mocked);
          return { ok: true };
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          return { ok: false, error: error?.message ?? 'Falha no login.' };
        }
        const [profile, membership, isSuperAdmin] = await Promise.all([
          fetchProfile(data.user.id),
          fetchMembership(),
          fetchIsSuperAdmin(),
        ]);
        const gate = evaluateMembership(membership, isSuperAdmin);
        if (gate.signOut) {
          await supabase.auth.signOut();
          return { ok: false, error: gate.error };
        }
        const next: SessionUser = {
          id: data.user.id,
          email: data.user.email ?? email,
          profile: profile ?? {
            id: data.user.id,
            full_name:
              (data.user.user_metadata?.full_name as string | undefined) ??
              data.user.email ??
              'Novo usuário',
            phone: null,
            avatar_url: null,
            municipality_code: null,
            must_change_password: false,
            created_at: new Date().toISOString(),
          },
          campaign: gate.campaign,
          role: gate.role,
          is_super_admin: isSuperAdmin,
        };
        setSession(next);
        return { ok: true };
      } finally {
        setLoading(false);
      }
    },
    [setSession, setLoading],
  );

  const loginWithGoogle = useCallback(async (): Promise<LoginResult> => {
    if (USE_MOCKS) {
      return { ok: false, error: 'Login Google indisponível em modo demonstração.' };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirect dedicado pra OAuth (commit fa54fe5 criou /auth/callback).
        // Antes apontava pra /login, que funcionava mas dava 1 redirect extra
        // (o LoginPage detectava sessão e mandava pro dashboard). Agora
        // /auth/callback resolve a home certa por role e navega direto.
        // ⚠️ Importante: este URL precisa estar autorizado em
        // Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!USE_MOCKS) {
      await supabase.auth.signOut();
    }
    logout();
    resetCollections();
    // Limpa o view-as do super admin pra não sobrar entre logins.
    useViewAsStore.getState().exit();
  }, [logout]);

  return { session, isLoading, login, loginWithGoogle, signOut };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

interface Membership {
  campaign: Campaign;
  role: UserRole;
  is_active: boolean;
}

interface MembershipGate {
  /** true → derruba a sessão do Supabase e mostra `error` no /login. */
  signOut: boolean;
  error?: string;
  /** Campanha que vira contexto de trabalho da sessão (null = sem contexto). */
  campaign: Campaign | null;
  role: UserRole | null;
}

// Regras de bloqueio da membership, num lugar só (usado pelo boot/onAuthStateChange
// e pelo login por senha — antes estavam duplicadas e podiam divergir).
//
// ⚠️ O super admin da Vórtice NÃO é gated por membership: ele administra todas
// as campanhas e normalmente não é membro de nenhuma. Sem esta exceção, um
// super admin que tenha sobrado como membro de uma campanha `cancelled` (ou
// desativada) era deslogado à força em TODO login — inclusive no retorno do
// OAuth do Google, onde o sintoma era "o botão do Google não faz nada" (o
// Supabase autenticava, o app deslogava em seguida). Era exatamente o caso de
// luisfc09@gmail.com e sanjai.oliveira@gmail.com: ambos com membership ativa
// na campanha cancelada "Deputado Heleno do hospital".
function evaluateMembership(
  membership: Membership | null,
  isSuperAdmin: boolean,
): MembershipGate {
  if (isSuperAdmin) {
    // Campanha terminal não vira contexto de trabalho — o super admin cai em
    // /admin/campaigns e escolhe quem quer ver via "Ver como cliente".
    const usable =
      membership && membership.is_active && membership.campaign.status !== 'cancelled'
        ? membership
        : null;
    return {
      signOut: false,
      campaign: usable?.campaign ?? null,
      role: usable?.role ?? null,
    };
  }

  // Conta desativada explicitamente pelo admin → desloga
  if (membership && !membership.is_active) {
    return {
      signOut: true,
      error: 'Sua conta foi desativada pelo admin da campanha.',
      campaign: null,
      role: null,
    };
  }
  // Campanha CANCELADA (terminal) → desloga. Suspensa/pending continuam
  // logando: ProtectedRoute trava o acesso e manda pra /renovar.
  if (membership && membership.campaign.status === 'cancelled') {
    return {
      signOut: true,
      error: 'Esta campanha foi cancelada. Entre em contato com a Vórtice.',
      campaign: null,
      role: null,
    };
  }
  return {
    signOut: false,
    campaign: membership?.campaign ?? null,
    role: membership?.role ?? null,
  };
}

// Usa a RPC get_my_membership() (security definer) em vez de ler campaign_users
// direto: o RLS de campaign_users/campaigns só enxerga campanhas trial/active
// (via current_campaign_id), então o select na tabela NÃO carregava campanhas
// suspended/pending — e o cliente caía em /aguardando-ativacao em vez de
// /renovar. A RPC devolve a própria membership independente do status (menos
// soft-deleted), sem ampliar acesso a dados operacionais. (migration-035)
async function fetchMembership(): Promise<Membership | null> {
  const { data, error } = await supabase.rpc('get_my_membership');
  if (error || !data) return null;
  const row = data as { campaign?: Campaign | null; role?: UserRole; is_active?: boolean };
  if (!row.campaign) return null;
  return {
    campaign: row.campaign as unknown as Campaign,
    role: row.role as UserRole,
    is_active: row.is_active ?? true,
  };
}

async function fetchIsSuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_super_admin');
  if (error) return false;
  return data === true;
}

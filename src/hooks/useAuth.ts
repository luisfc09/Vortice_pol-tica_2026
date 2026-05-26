import { useCallback, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { resolveMockLogin } from '@/lib/mocks';
import { resetCollections } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
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
        fetchMembership(sb.user.id),
        fetchIsSuperAdmin(),
      ]);
      if (!active) return { ok: false };

      // Super admin sem membership entra no modo /admin (sem campanha)
      if (!profile && !isSuperAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        return { ok: false, error: 'Usuário sem perfil. Fale com o admin.' };
      }
      if (!membership && !isSuperAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        return {
          ok: false,
          error: 'Usuário sem campanha associada. Fale com o admin.',
        };
      }
      if (membership && !membership.is_active) {
        await supabase.auth.signOut();
        setSession(null);
        return { ok: false, error: 'Sua conta foi desativada pelo admin da campanha.' };
      }
      // Status default é 'active' caso a coluna não exista ainda (migration 004
      // pendente). Apenas suspended/cancelled bloqueiam o login.
      const campaignStatus = membership?.campaign.status ?? 'active';
      if (
        membership &&
        campaignStatus !== 'active' &&
        campaignStatus !== 'trial'
      ) {
        await supabase.auth.signOut();
        setSession(null);
        return {
          ok: false,
          error: 'Esta campanha está suspensa. Entre em contato com a Vórtice.',
        };
      }

      setSession({
        id: sb.user.id,
        email: sb.user.email ?? '',
        profile: profile ?? {
          id: sb.user.id,
          full_name: sb.user.email ?? 'Super Admin',
          phone: null,
          avatar_url: null,
          municipality_code: null,
          must_change_password: false,
          created_at: new Date().toISOString(),
        },
        campaign: membership?.campaign ?? null,
        role: membership?.role ?? null,
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
          fetchMembership(data.user.id),
          fetchIsSuperAdmin(),
        ]);
        if (!profile && !isSuperAdmin) {
          await supabase.auth.signOut();
          return { ok: false, error: 'Usuário sem perfil. Fale com o admin.' };
        }
        if (!membership && !isSuperAdmin) {
          await supabase.auth.signOut();
          return { ok: false, error: 'Usuário sem campanha associada. Fale com o admin.' };
        }
        if (membership && !membership.is_active) {
          await supabase.auth.signOut();
          return { ok: false, error: 'Conta desativada pelo admin da campanha.' };
        }
        if (
          membership &&
          membership.campaign.status !== 'active' &&
          membership.campaign.status !== 'trial'
        ) {
          await supabase.auth.signOut();
          return {
            ok: false,
            error: 'Campanha suspensa. Entre em contato com a Vórtice.',
          };
        }
        const next: SessionUser = {
          id: data.user.id,
          email: data.user.email ?? email,
          profile: profile ?? {
            id: data.user.id,
            full_name: data.user.email ?? 'Super Admin',
            phone: null,
            avatar_url: null,
            municipality_code: null,
            must_change_password: false,
            created_at: new Date().toISOString(),
          },
          campaign: membership?.campaign ?? null,
          role: membership?.role ?? null,
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
        redirectTo: `${window.location.origin}/login`,
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

async function fetchMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('campaign_users')
    .select('role, is_active, campaign:campaigns(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || !data.campaign) return null;
  return {
    campaign: data.campaign as unknown as Campaign,
    role: data.role as UserRole,
    is_active: data.is_active ?? true,
  };
}

async function fetchIsSuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_super_admin');
  if (error) return false;
  return data === true;
}

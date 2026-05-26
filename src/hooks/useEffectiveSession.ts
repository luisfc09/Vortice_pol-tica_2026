// Hook que devolve a sessão "efetiva" — combina o auth real com o
// override de "ver como cliente" do super admin.
//
// Regras:
//   - Se o user NÃO é super admin → devolve a session original (sem override)
//   - Se é super admin E setou uma campanha em useViewAsStore → devolve
//     uma cópia da session com `campaign` = a campanha do view-as e
//     role = 'admin' (pra liberar todas as ações dentro da campanha)
//
// Componentes que dependem de `session.campaign` ou `session.role`
// devem usar este hook em vez de `useAuthStore` direto pra respeitar
// o modo "view as".

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useViewAsStore } from '@/stores/viewAs';
import type { SessionUser } from '@/types';

export function useEffectiveSession(): SessionUser | null {
  const session = useAuthStore((s) => s.session);
  const viewAs = useViewAsStore((s) => s.campaign);

  return useMemo<SessionUser | null>(() => {
    if (!session) return null;
    // Só super admin pode entrar como cliente
    if (!session.is_super_admin) return session;
    if (!viewAs) return session;
    // Já está logado como admin daquela mesma campanha — sem override
    if (session.campaign?.id === viewAs.id) return session;
    return {
      ...session,
      campaign: viewAs,
      role: 'admin', // super admin tem privilégio total dentro do view-as
    };
  }, [session, viewAs]);
}

// Store que permite ao Super Admin Vórtice "entrar" numa campanha
// específica e ver o sistema como se fosse o cliente daquela campanha.
//
// O hook `useAuth` consulta essa store: quando o usuário é super_admin
// E há um `viewAsCampaign` setado, o session.campaign retornado fica
// "overridado" para essa campanha — o que destrava todos os módulos
// (Dashboard, Lideranças, etc.) no Sidebar/ProtectedRoute.
//
// Importante: é só uma "lente" do super admin. Não muda RLS do Supabase
// (a maioria das queries do super admin já contorna RLS porque
// is_super_admin retorna true). Não muda o usuário logado.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Campaign } from '@/types';

interface ViewAsState {
  campaign: Campaign | null;
  enter: (c: Campaign) => void;
  exit: () => void;
}

export const useViewAsStore = create<ViewAsState>()(
  persist(
    (set) => ({
      campaign: null,
      enter: (c) => set({ campaign: c }),
      exit: () => set({ campaign: null }),
    }),
    {
      name: 'vortice.view-as',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ campaign: state.campaign }),
    },
  ),
);

// ============================================================================
// useFormInterviewers — lista os membros da campanha que podem ser
// entrevistadores (roles com acesso a campo) + quem já está autorizado no
// formulário. Usado no builder pra o admin marcar/desmarcar (migration 052).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { UserRole } from '@/types';

// Papéis que APLICAM pesquisa em campo. Admin/coordenador gerenciam (não batem
// porta), então não aparecem na lista de autorizáveis. field_agent =
// "Entrevistador", researcher = "Pesquisador".
const FIELD_ROLES: UserRole[] = ['researcher', 'field_agent'];

export interface AssignableMember {
  user_id: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  assigned: boolean;
}

export function useFormInterviewers(formId: string | undefined) {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!formId || !campaignId || USE_MOCKS) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cuRes, assignRes] = await Promise.all([
      supabase
        .from('campaign_users')
        .select('user_id, role, is_active')
        .eq('campaign_id', campaignId),
      supabase.from('survey_form_assignments').select('user_id').eq('form_id', formId),
    ]);
    if (cuRes.error) console.warn('useFormInterviewers(cu):', cuRes.error.message);
    if (assignRes.error) console.warn('useFormInterviewers(assign):', assignRes.error.message);

    const rows = (cuRes.data ?? []) as { user_id: string; role: UserRole; is_active: boolean }[];
    const eligible = rows.filter((r) => FIELD_ROLES.includes(r.role));
    const assignedSet = new Set(
      ((assignRes.data ?? []) as { user_id: string }[]).map((a) => a.user_id),
    );

    // Nomes via profiles.
    const ids = eligible.map((r) => r.user_id);
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
        names[p.id] = p.full_name;
      }
    }

    setMembers(
      eligible.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        full_name: names[r.user_id] ?? 'Usuário',
        is_active: r.is_active,
        assigned: assignedSet.has(r.user_id),
      })),
    );
    setLoading(false);
  }, [formId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (member: AssignableMember) => {
      if (!formId) return;
      setBusy(true);
      try {
        if (member.assigned) {
          const { error } = await supabase
            .from('survey_form_assignments')
            .delete()
            .eq('form_id', formId)
            .eq('user_id', member.user_id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('survey_form_assignments').insert({
            form_id: formId,
            user_id: member.user_id,
            assigned_by: session?.id ?? null,
          });
          if (error) throw new Error(error.message);
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [formId, session?.id, load],
  );

  // Marca todos os elegíveis que ainda não estão autorizados (bulk insert).
  const markAll = useCallback(async () => {
    if (!formId) return;
    const toAdd = members.filter((m) => !m.assigned);
    if (toAdd.length === 0) return;
    setBusy(true);
    try {
      const rows = toAdd.map((m) => ({
        form_id: formId,
        user_id: m.user_id,
        assigned_by: session?.id ?? null,
      }));
      const { error } = await supabase.from('survey_form_assignments').insert(rows);
      if (error) throw new Error(error.message);
      await load();
    } finally {
      setBusy(false);
    }
  }, [formId, members, session?.id, load]);

  // Remove todas as autorizações deste formulário.
  const clearAll = useCallback(async () => {
    if (!formId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('survey_form_assignments')
        .delete()
        .eq('form_id', formId);
      if (error) throw new Error(error.message);
      await load();
    } finally {
      setBusy(false);
    }
  }, [formId, load]);

  return { members, loading, busy, toggle, markAll, clearAll, reload: load };
}

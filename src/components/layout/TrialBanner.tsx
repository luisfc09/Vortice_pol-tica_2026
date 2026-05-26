import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

interface ExpiringRow {
  id: string;
  candidate_name: string;
  trial_ends_at: string;
  days_remaining: number;
}

const WARN_DAYS = 14;

// Banner exibido no topo quando a campanha do user está em trial e perto de
// expirar. Super admins não veem (eles têm o card próprio em /admin/campaigns).
export function TrialBanner() {
  const session = useAuthStore((s) => s.session);
  const [info, setInfo] = useState<ExpiringRow | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (USE_MOCKS) return;
      if (!session?.campaign) return;
      if (session.campaign.status !== 'trial') return;
      if (session.is_super_admin) return; // ele tem visão própria

      const { data, error } = await supabase.rpc('trial_campaigns_expiring', {
        p_days: WARN_DAYS,
      });
      if (!active || error) return;
      const rows = (data ?? []) as ExpiringRow[];
      const mine = rows.find((r) => r.id === session.campaign?.id) ?? null;
      setInfo(mine);
    }

    void load();
    return () => {
      active = false;
    };
  }, [session?.campaign?.id, session?.campaign?.status, session?.is_super_admin]);

  if (!info) return null;

  const urgent = info.days_remaining <= 3;
  const color = urgent
    ? 'border-red-500/40 bg-red-500/10 text-red-200'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  const Icon = urgent ? AlertTriangle : Clock;

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${color}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          {info.days_remaining === 0
            ? 'Seu trial expira ainda hoje. Fale com a Vórtice para ativar a conta.'
            : info.days_remaining === 1
              ? 'Seu trial expira amanhã. Renove para não perder acesso.'
              : `Seu trial expira em ${info.days_remaining} dias. Fale com a Vórtice para renovar.`}
        </span>
      </div>
      <span className="hidden text-[10px] uppercase tracking-widest sm:inline">
        suporte@vortice.app
      </span>
    </div>
  );
}

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CentralAlertas } from './CentralAlertas';
import { useAlertas } from '@/hooks/useAlertas';
import { useMeusNudges } from '@/hooks/useMeusNudges';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { cn } from '@/lib/utils';

const GESTOR_ROLES = ['admin', 'coordinator', 'candidate'];

export function AlertsBadge() {
  const [open, setOpen] = useState(false);
  const session = useEffectiveSession();
  const { counts } = useAlertas();
  const { nudges } = useMeusNudges();

  // Gestor conta alertas da campanha; demais roles só os nudges pessoais.
  const isGestor =
    session?.is_super_admin === true ||
    (session?.role ? GESTOR_ROLES.includes(session.role) : false);
  const campaignUnread = isGestor ? counts.unread : 0;
  const unread = nudges.length + campaignUnread;
  const hasUrgent = isGestor && counts.urgente > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label={`Central de Alertas — ${unread} não lidos`}
      >
        <Bell
          className={cn(
            'h-5 w-5',
            hasUrgent && 'text-red-400',
            !hasUrgent && unread > 0 && 'text-amber-300',
          )}
        />
        {unread > 0 ? (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white',
              hasUrgent
                ? 'animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                : 'bg-amber-500',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Button>

      <CentralAlertas open={open} onOpenChange={setOpen} />
    </>
  );
}

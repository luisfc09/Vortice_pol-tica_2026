import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CentralAlertas } from './CentralAlertas';
import { useAlertas } from '@/hooks/useAlertas';
import { cn } from '@/lib/utils';

export function AlertsBadge() {
  const [open, setOpen] = useState(false);
  const { counts } = useAlertas();
  const unread = counts.unread;
  const hasUrgent = counts.urgente > 0;

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

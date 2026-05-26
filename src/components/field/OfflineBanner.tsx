import { useEffect, useState } from 'react';
import { CloudOff, CloudUpload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/useOnline';
import { getQueue } from '@/lib/offline-queue';

interface OfflineBannerProps {
  onSyncRequest: () => void;
  syncing: boolean;
}

export function OfflineBanner({ onSyncRequest, syncing }: OfflineBannerProps) {
  const online = useOnline();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const update = () => setPending(getQueue().length);
    update();
    const id = window.setInterval(update, 1500);
    window.addEventListener('storage', update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-vortex-border bg-vortex-surface/60 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {online ? (
          <Badge variant="secondary" className="gap-1">
            <CloudUpload className="h-3 w-3" /> Pendentes
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <CloudOff className="h-3 w-3" /> Sem conexão
          </Badge>
        )}
        <span className="text-muted-foreground">
          {pending === 0
            ? 'Tudo sincronizado.'
            : `${pending} entrevista${pending > 1 ? 's' : ''} aguardando envio.`}
        </span>
      </div>
      {online && pending > 0 ? (
        <Button size="sm" variant="outline" onClick={onSyncRequest} disabled={syncing}>
          {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
        </Button>
      ) : null}
    </div>
  );
}

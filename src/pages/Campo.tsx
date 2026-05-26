import { Link } from 'react-router-dom';
import { ClipboardCheck, BookOpenText, History, MapPin, Sunrise } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OfflineBanner } from '@/components/field/OfflineBanner';
import { useState } from 'react';
import { toast } from 'sonner';
import { getQueue } from '@/lib/offline-queue';
import { flushInterviewQueue } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';

export default function CampoHubPage() {
  const session = useAuthStore((s) => s.session);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const queue = getQueue();
      if (queue.length === 0) {
        toast.info('Nada para sincronizar.');
        return;
      }
      const flushed = await Promise.resolve(flushInterviewQueue());
      toast.success(
        `${flushed} entrevista${flushed > 1 ? 's' : ''} sincronizada${
          flushed > 1 ? 's' : ''
        }.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Olá, {session?.profile.full_name.split(' ')[0]}.</p>
        <h2 className="font-display text-3xl tracking-wide text-foreground">Pronto para ir a campo?</h2>
      </div>

      <OfflineBanner onSyncRequest={handleSync} syncing={syncing} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <HubAction
          to="/campo/entrevista"
          title="Nova entrevista"
          description="Registre o contato com GPS, intenção de voto e observações."
          icon={<ClipboardCheck className="h-7 w-7 text-primary" />}
        />
        <HubAction
          to="/campo/hoje"
          title="Campo Hoje"
          description="Visão em tempo real: mapa, sentimento, temas e ranking da equipe."
          icon={<Sunrise className="h-7 w-7 text-primary" />}
        />
        <HubAction
          to="/campo/historico"
          title="Minhas entrevistas"
          description="Reabra entrevistas anteriores para corrigir ou complementar."
          icon={<History className="h-7 w-7 text-primary" />}
        />
        <HubAction
          to="/campo/faq"
          title="FAQ de argumentação"
          description="Respostas prontas com dados de apoio para qualquer tema."
          icon={<BookOpenText className="h-7 w-7 text-primary" />}
        />
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <MapPin className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-muted-foreground">
            <p className="text-foreground">Dica</p>
            <p>
              Mantenha o GPS ligado. As entrevistas são salvas localmente e sincronizam
              automaticamente quando você reconectar.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HubAction({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 transition-all hover:border-primary/50 hover:bg-vortex-surface"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

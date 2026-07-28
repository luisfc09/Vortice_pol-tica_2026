import { Link } from 'react-router-dom';
import { ClipboardList, FileStack, MapPin, Sunrise } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OfflineBanner } from '@/components/field/OfflineBanner';
import { useState } from 'react';
import { toast } from 'sonner';
import { getQueue } from '@/lib/offline-queue';
import { discardInterviewQueue, flushInterviewQueue } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';

export default function CampoHubPage() {
  const session = useAuthStore((s) => s.session);
  const effective = useEffectiveSession();
  const isAdmin = effective?.role === 'admin' || effective?.is_super_admin === true;
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const queue = getQueue();
      if (queue.length === 0) {
        toast.info('Nada para sincronizar.');
        return;
      }
      const result = await flushInterviewQueue();
      if (result.succeeded > 0) {
        toast.success(
          `${result.succeeded} pesquisa${result.succeeded > 1 ? 's' : ''} sincronizada${
            result.succeeded > 1 ? 's' : ''
          }.`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} pesquisa${result.failed > 1 ? 's' : ''} falhou: ${
            result.errors[0]
          }`,
          {
            description:
              result.errors.length > 1
                ? `e mais ${result.errors.length - 1} erro(s). Veja o console.`
                : 'Registro mantido na fila — corrija e tente de novo.',
            action: {
              label: 'Descartar fila',
              onClick: () => {
                const removed = discardInterviewQueue();
                toast.message(`${removed} pesquisa(s) descartada(s).`);
              },
            },
          },
        );
        if (result.errors.length > 1) console.error('flush errors:', result.errors);
      }
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
          to="/campo/aplicar"
          title="Aplicar Formulário"
          description="Aplique um formulário que o admin te autorizou — demografia + perguntas."
          icon={<ClipboardList className="h-7 w-7 text-primary" />}
        />
        <HubAction
          to="/campo/hoje"
          title="Campo Hoje"
          description="Visão em tempo real: mapa, sentimento, temas e ranking da equipe."
          icon={<Sunrise className="h-7 w-7 text-primary" />}
        />
        {isAdmin ? (
          <HubAction
            to="/pesquisas/formularios"
            title="Formulários de Pesquisa"
            description="Monte formulários (demografia + perguntas) pra aplicar em campo ou publicar por link."
            icon={<FileStack className="h-7 w-7 text-primary" />}
          />
        ) : null}
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <MapPin className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-muted-foreground">
            <p className="text-foreground">Dica</p>
            <p>
              Mantenha o GPS ligado. As pesquisas são salvas localmente e sincronizam
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
  badge,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 transition-all hover:border-primary/50 hover:bg-vortex-surface"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        {badge != null && badge > 0 ? (
          <span className="rounded-full bg-vortex-lime/20 px-2 py-0.5 text-[10px] font-semibold text-vortex-lime">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InterviewForm } from '@/components/field/InterviewForm';
import { OfflineBanner } from '@/components/field/OfflineBanner';
import { EmptyState } from '@/components/data/EmptyState';
import { toast } from 'sonner';
import { getQueue } from '@/lib/offline-queue';
import { collections, flushInterviewQueue, useCollection } from '@/lib/data';

export default function CampoEntrevistaPage() {
  const params = useParams();
  const navigate = useNavigate();
  const interviews = useCollection(collections.interviews);
  const editing = useMemo(() => {
    if (!params.id) return null;
    return interviews.find((i) => i.id === params.id) ?? null;
  }, [interviews, params.id]);

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

  // Quando o usuário pediu pra editar mas o id não bate, mostra um aviso útil.
  if (params.id && !editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/historico">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao histórico
          </Link>
        </Button>
        <EmptyState
          title="Entrevista não encontrada"
          description="O registro pode ter sido removido ou ainda não sincronizou neste dispositivo."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to={editing ? '/campo/historico' : '/campo'}>
          <ArrowLeft className="h-4 w-4" />
          {editing ? 'Voltar ao histórico' : 'Voltar'}
        </Link>
      </Button>

      {editing ? (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Editando entrevista
          </p>
          <h2 className="font-display text-2xl tracking-wide text-foreground">
            {editing.voter_name}
          </h2>
        </div>
      ) : null}

      {!editing ? <OfflineBanner onSyncRequest={handleSync} syncing={syncing} /> : null}

      <InterviewForm
        editing={editing}
        onSaved={() => {
          if (editing) navigate('/campo/historico');
        }}
      />
    </div>
  );
}

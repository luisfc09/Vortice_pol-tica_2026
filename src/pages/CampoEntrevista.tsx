import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InterviewForm } from '@/components/field/InterviewForm';
import { OfflineBanner } from '@/components/field/OfflineBanner';
import { BoasPraticasCard } from '@/components/field/BoasPraticasCard';
import { EmptyState } from '@/components/data/EmptyState';
import { toast } from 'sonner';
import { getQueue } from '@/lib/offline-queue';
import {
  collections,
  discardInterviewQueue,
  flushInterviewQueue,
  useCollection,
} from '@/lib/data';

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
      const result = await flushInterviewQueue();
      if (result.succeeded > 0) {
        toast.success(
          `${result.succeeded} entrevista${result.succeeded > 1 ? 's' : ''} sincronizada${
            result.succeeded > 1 ? 's' : ''
          }.`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} entrevista${result.failed > 1 ? 's' : ''} falhou: ${
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
                toast.message(`${removed} entrevista(s) descartada(s).`);
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

      {!editing ? (
        <>
          <BoasPraticasCard />
          <OfflineBanner onSyncRequest={handleSync} syncing={syncing} />
        </>
      ) : null}

      <InterviewForm
        editing={editing}
        onSaved={() => {
          if (editing) navigate('/campo/historico');
        }}
        onDeepen={
          editing
            ? undefined
            : (id) => {
                toast.success('Entrevista salva. Vamos aprofundar.');
                navigate(`/campo/entrevista/${id}/questionario`);
              }
        }
      />
    </div>
  );
}

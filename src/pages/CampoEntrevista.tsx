import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InterviewForm } from '@/components/field/InterviewForm';
import { OfflineBanner } from '@/components/field/OfflineBanner';
import { toast } from 'sonner';
import { getQueue } from '@/lib/offline-queue';
import { flushInterviewQueue } from '@/lib/data';
import { USE_MOCKS } from '@/lib/supabase';

export default function CampoEntrevistaPage() {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const queue = getQueue();
      if (queue.length === 0) {
        toast.info('Nada para sincronizar.');
        return;
      }
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 600));
        const flushed = flushInterviewQueue();
        toast.success(
          `${flushed} entrevista${flushed > 1 ? 's' : ''} sincronizada${flushed > 1 ? 's' : ''} para o banco mock.`,
        );
        return;
      }
      // Real sync happens via Supabase — implementação plugada quando o
      // schema estiver provisionado.
      toast.info('Sincronização real será habilitada após conectar o Supabase.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <OfflineBanner onSyncRequest={handleSync} syncing={syncing} />

      <InterviewForm />
    </div>
  );
}

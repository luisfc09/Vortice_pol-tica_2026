import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Eye,
  FileText,
  ListChecks,
  MapPin,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { collections, useCollection } from '@/lib/data';
import { exportInterviewAsJson, exportInterviewAsPdf } from '@/lib/interview-export';
import { useAuthStore } from '@/stores/auth';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';
import { VOTE_INTENTION_LABEL, isInterviewDeepened } from '@/types';

export default function CampoHistoricoPage() {
  const session = useAuthStore((s) => s.session);
  const interviews = useCollection(collections.interviews);

  // Lista as entrevistas do próprio agente, mais recentes primeiro.
  // Admin/coord veem todas as da campanha.
  const visible = useMemo(() => {
    if (!session) return [];
    const isPriv =
      session.is_super_admin ||
      session.role === 'admin' ||
      session.role === 'coordinator';
    const filtered = isPriv
      ? interviews
      : interviews.filter((i) => i.created_by === session.id);
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [interviews, session]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Minhas entrevistas
        </h2>
        <p className="text-sm text-muted-foreground">
          {visible.length} entrevista{visible.length === 1 ? '' : 's'} no histórico.
          Clique em Editar para corrigir qualquer campo.
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhuma entrevista ainda"
          description="Suas entrevistas vão aparecer aqui assim que você registrar a primeira."
          icon={<ClipboardList className="h-5 w-5" />}
          action={
            <Button asChild>
              <Link to="/campo/entrevista">Nova entrevista</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((i) => {
            const muni = i.municipality_code
              ? MUNI_COORDS[i.municipality_code]?.name ?? null
              : null;
            return (
              <li
                key={i.id}
                className="flex flex-col gap-3 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {i.voter_name}
                    </p>
                    {isInterviewDeepened(i) ? (
                      <Badge variant="success" className="gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        Completa
                      </Badge>
                    ) : (
                      <Link
                        to={`/campo/entrevista/${i.id}/questionario`}
                        className="inline-flex items-center rounded-full border border-vortex-border bg-vortex-surface/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        title="Clique para responder o questionário aprofundado"
                      >
                        Básica
                      </Link>
                    )}
                    <Badge variant="outline">
                      {VOTE_INTENTION_LABEL[i.vote_intention]}
                    </Badge>
                    {i.vote_decided ? <Badge variant="success">Decidido</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {muni ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {muni}
                        {i.neighborhood ? ` · ${i.neighborhood}` : ''}
                      </span>
                    ) : (
                      'Sem município'
                    )}
                    {' · '}
                    {formatDistanceToNow(new Date(i.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to={`/campo/entrevista/${i.id}/ver`}>
                      <Eye className="h-3.5 w-3.5" />
                      Ver tudo
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/campo/entrevista/${i.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar dados
                    </Link>
                  </Button>
                  {isInterviewDeepened(i) ? null : (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/campo/entrevista/${i.id}/questionario`}>
                        <ListChecks className="h-3.5 w-3.5" />
                        Aprofundar
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportInterviewAsPdf(i)}
                    title="Baixar PDF desta entrevista"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => exportInterviewAsJson(i)}
                    aria-label="Exportar dados (JSON)"
                    title="Baixar dados crus (JSON)"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

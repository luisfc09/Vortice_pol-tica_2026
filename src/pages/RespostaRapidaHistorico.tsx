import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Download,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { collections, useCollection } from '@/lib/data';
import { SEED_TEAMMATE_PROFILES } from '@/data/seeds';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MentionResponse } from '@/types';

type Filter = 'todos' | 'publicadas' | 'rascunho';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

function exportToText(rows: MentionResponse[]): string {
  const lines: string[] = [];
  lines.push('=== Histórico de respostas — Vórtice ===');
  lines.push(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`);
  lines.push('');
  for (const r of rows) {
    lines.push(`--- ${format(new Date(r.aprovada_at), 'dd/MM/yyyy HH:mm')} ---`);
    lines.push(`Estilo: ${r.estilo ?? '—'}`);
    lines.push(`Publicada: ${r.publicada ? 'Sim' : 'Não'}${r.publicada_em ? ' (' + r.publicada_em + ')' : ''}`);
    lines.push(
      `Tempo de resposta: ${r.tempo_resposta_s != null ? formatElapsed(r.tempo_resposta_s) : '—'}`,
    );
    lines.push('');
    lines.push(r.resposta_texto);
    lines.push('');
  }
  return lines.join('\n');
}

export default function RespostaRapidaHistoricoPage() {
  const session = useAuthStore((s) => s.session);
  const responses = useCollection(collections.mention_responses);
  const mentions = useCollection(collections.mentions);
  const teammates = useCollection(collections.campaign_users);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  function nameOf(userId: string | null): string {
    if (!userId) return 'Anônimo';
    if (userId === session?.id) return session.profile.full_name;
    const fromTeam = teammates.find((t) => t.user_id === userId);
    if (fromTeam) {
      return SEED_TEAMMATE_PROFILES[userId]?.full_name ?? `Membro ${userId.slice(-4)}`;
    }
    return SEED_TEAMMATE_PROFILES[userId]?.full_name ?? `Membro ${userId.slice(-4)}`;
  }

  const filtered = useMemo(() => {
    return responses
      .filter((r) => {
        if (filter === 'publicadas') return r.publicada;
        if (filter === 'rascunho') return !r.publicada;
        return true;
      })
      .filter((r) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const m = r.mention_id ? mentions.find((x) => x.id === r.mention_id) : null;
        const haystack = `${r.resposta_texto} ${m?.content ?? ''} ${r.estilo ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => +new Date(b.aprovada_at) - +new Date(a.aprovada_at));
  }, [responses, mentions, filter, query]);

  const counts = {
    todos: responses.length,
    publicadas: responses.filter((r) => r.publicada).length,
    rascunho: responses.filter((r) => !r.publicada).length,
  };

  function downloadExport() {
    const blob = new Blob([exportToText(filtered)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vortice-respostas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/mencoes/resposta-rapida">
              <ArrowLeft className="h-4 w-4" /> Voltar à Resposta Rápida
            </Link>
          </Button>
          <div className="mb-1 flex items-center gap-2">
            <History className="h-4 w-4 text-vortex-violet" />
            <span className="text-xs uppercase tracking-widest text-vortex-violet">
              Histórico
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Respostas registradas
          </h2>
          <p className="text-sm text-muted-foreground">
            {counts.publicadas} publicadas · {counts.rascunho} em rascunho · usado em relatório de
            crise
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadExport} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Exportar TXT
        </Button>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por conteúdo, estilo ou menção"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        <FilterPill
          label="Todos"
          count={counts.todos}
          active={filter === 'todos'}
          onClick={() => setFilter('todos')}
        />
        <FilterPill
          label="Publicadas"
          count={counts.publicadas}
          active={filter === 'publicadas'}
          onClick={() => setFilter('publicadas')}
        />
        <FilterPill
          label="Rascunhos"
          count={counts.rascunho}
          active={filter === 'rascunho'}
          onClick={() => setFilter('rascunho')}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center text-sm text-muted-foreground">
          {responses.length === 0
            ? 'Nenhuma resposta registrada ainda. Use o stepper para gerar a primeira.'
            : 'Nenhuma resposta corresponde aos filtros atuais.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const m = r.mention_id ? mentions.find((x) => x.id === r.mention_id) : null;
            const author = nameOf(r.aprovada_por);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{initials(author)}</AvatarFallback>
                    </Avatar>
                    <div className="text-xs">
                      <p className="font-medium text-foreground">{author}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(r.aprovada_at), "dd 'de' MMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.estilo ? <Badge variant="outline">{r.estilo}</Badge> : null}
                    {r.publicada ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Publicada{r.publicada_em ? ` (${r.publicada_em})` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" />
                        Rascunho
                      </Badge>
                    )}
                    {r.editada ? <Badge variant="warning">Editada</Badge> : null}
                    {r.tempo_resposta_s != null ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatElapsed(r.tempo_resposta_s)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {m ? (
                  <div className="mb-2 rounded-lg border border-vortex-border bg-vortex-bg/40 p-2 text-xs">
                    <p className="text-muted-foreground">Menção original ({m.source})</p>
                    <p className="mt-0.5 text-foreground/80">"{m.content}"</p>
                  </div>
                ) : null}

                <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground/90">
                  {r.resposta_texto}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

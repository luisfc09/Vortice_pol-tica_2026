import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, MapPin, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { VoterFormSheet } from '@/components/voters/VoterFormSheet';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import {
  VOTE_INTENTION_COLOR,
  VOTE_INTENTION_LABEL,
  type Voter,
  type VoteIntention,
} from '@/types';

type IntentionFilter = 'all' | VoteIntention;

export default function EleitoresPage() {
  const session = useAuthStore((s) => s.session);
  const voters = useCollection(collections.voters);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<IntentionFilter>('all');
  const [editing, setEditing] = useState<Voter | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Voter | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voters.filter((v) => {
      if (filter !== 'all' && v.vote_intention !== filter) return false;
      if (!q) return true;
      const haystack = `${v.name} ${v.city} ${v.address ?? ''} ${v.phone ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [voters, query, filter]);

  const counts = useMemo(() => {
    const base: Record<IntentionFilter, number> = {
      all: voters.length,
      apoiador: 0,
      tendencia_apoio: 0,
      indeciso: 0,
      tendencia_oposicao: 0,
      oposicao: 0,
    };
    for (const v of voters) base[v.vote_intention] += 1;
    return base;
  }, [voters]);

  const canManage = session?.role === 'admin' || session?.role === 'coordinator';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {voters.length} {voters.length === 1 ? 'eleitor cadastrado' : 'eleitores cadastrados'}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Novo eleitor
        </Button>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nome, cidade, endereço ou telefone"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        <FilterPill label="Todos" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        {(Object.keys(VOTE_INTENTION_LABEL) as VoteIntention[]).map((v) => (
          <FilterPill
            key={v}
            label={VOTE_INTENTION_LABEL[v]}
            count={counts[v]}
            active={filter === v}
            onClick={() => setFilter(v)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum eleitor encontrado"
          description="Cadastre contatos de eleitores e acompanhe a evolução da intenção de voto."
          icon={<UserCheck className="h-5 w-5" />}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.city}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    VOTE_INTENTION_COLOR[v.vote_intention],
                  )}
                >
                  {VOTE_INTENTION_LABEL[v.vote_intention]}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                {v.phone ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${v.phone}`} className="hover:text-primary">
                      {v.phone}
                    </a>
                  </p>
                ) : null}
                {v.address ? (
                  <p className="flex items-start gap-2 text-foreground/80">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{v.address}</span>
                  </p>
                ) : null}
                {v.notes ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{v.notes}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-vortex-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(v);
                    setSheetOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <OpenInMapsButton
                  target={{
                    lat: v.lat,
                    lng: v.lng,
                    logradouro: v.logradouro,
                    numero: v.numero,
                    bairro: v.neighborhood,
                    cidade: v.city,
                    uf: 'MG',
                    cep: v.cep,
                  }}
                />
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(v)}
                    className="text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <VoterFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir eleitor?"
        description={`Remover ${deleteTarget?.name ?? ''} da base. Essa ação não pode ser desfeita.`}
        onConfirm={() => deleteTarget && collections.voters.remove(deleteTarget.id)}
      />
    </div>
  );
}

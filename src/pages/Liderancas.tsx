import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, MapPin, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { SupporterFormSheet } from '@/components/supporters/SupporterFormSheet';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import type { Supporter, SupporterRoleType } from '@/types';

type RoleFilter = 'all' | SupporterRoleType;

const ROLE_LABEL: Record<SupporterRoleType, string> = {
  lider: 'Líder',
  cabo: 'Cabo',
  militante: 'Militante',
  apoiador: 'Apoiador',
};

const ROLE_BADGE: Record<SupporterRoleType, 'default' | 'secondary' | 'outline' | 'warning'> = {
  lider: 'default',
  cabo: 'secondary',
  militante: 'outline',
  apoiador: 'outline',
};

export default function LiderancasPage() {
  const session = useAuthStore((s) => s.session);
  const supporters = useCollection(collections.supporters);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editing, setEditing] = useState<Supporter | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supporter | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return supporters.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = `${s.name} ${s.city} ${s.neighborhood ?? ''} ${s.phone ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [supporters, query, roleFilter]);

  const counts = useMemo(() => {
    const base: Record<RoleFilter, number> = {
      all: supporters.length,
      lider: 0,
      cabo: 0,
      militante: 0,
      apoiador: 0,
    };
    for (const s of supporters) base[s.role] += 1;
    return base;
  }, [supporters]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(s: Supporter) {
    setEditing(s);
    setSheetOpen(true);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    collections.supporters.remove(deleteTarget.id);
  }

  const canManage = session?.role === 'admin' || session?.role === 'coordinator';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {supporters.length} {supporters.length === 1 ? 'liderança cadastrada' : 'lideranças cadastradas'}
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova liderança
        </Button>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nome, cidade, bairro ou telefone"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        <FilterPill label="Todas" count={counts.all} active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
        {(Object.keys(ROLE_LABEL) as SupporterRoleType[]).map((r) => (
          <FilterPill
            key={r}
            label={ROLE_LABEL[r]}
            count={counts[r]}
            active={roleFilter === r}
            onClick={() => setRoleFilter(r)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma liderança encontrada"
          description="Cadastre líderes, cabos e militantes para começar a montar sua base."
          icon={<Users className="h-5 w-5" />}
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.city}
                    {s.neighborhood ? ` · ${s.neighborhood}` : ''}
                  </p>
                </div>
                <Badge variant={ROLE_BADGE[s.role]}>{ROLE_LABEL[s.role]}</Badge>
              </div>

              <div className="space-y-1.5 text-sm">
                {s.phone ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${s.phone}`} className="hover:text-primary">
                      {s.phone}
                    </a>
                  </p>
                ) : null}
                {s.email ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{s.email}</span>
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    Status: {s.status === 'ativo' ? 'Ativo' : s.status === 'pendente' ? 'Pendente' : 'Inativo'}
                  </span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-vortex-border pt-3">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <OpenInMapsButton
                  target={{
                    logradouro: s.logradouro,
                    numero: s.numero,
                    bairro: s.neighborhood,
                    cidade: s.city,
                    uf: 'MG',
                    cep: s.cep,
                  }}
                />
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(s)}
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

      <SupporterFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir liderança?"
        description={`Remover ${deleteTarget?.name ?? ''} da base. Essa ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

import { useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { ProvisionSheet } from '@/components/team/ProvisionSheet';
import { collections, useCollection } from '@/lib/data';
import { SEED_TEAMMATE_PROFILES } from '@/data/seeds';
import { initials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABEL, type CampaignUser, type UserRole } from '@/types';

export default function EquipePage() {
  const session = useAuthStore((s) => s.session);
  const members = useCollection(collections.campaign_users);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignUser | null>(null);

  function profileFor(userId: string) {
    if (userId === session?.id) {
      return { full_name: session.profile.full_name, phone: session.profile.phone };
    }
    return (
      SEED_TEAMMATE_PROFILES[userId] ?? {
        full_name: `Membro ${userId.slice(-4)}`,
        phone: null,
      }
    );
  }

  function changeRole(id: string, role: UserRole) {
    collections.campaign_users.update(id, { role });
  }

  function toggleActive(member: CampaignUser) {
    collections.campaign_users.update(member.id, { is_active: !member.is_active });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? 'membro' : 'membros'} ·{' '}
          {session?.campaign?.candidate_name ?? '—'}
        </p>
        <Button onClick={() => setProvisionOpen(true)}>
          <UserPlus className="h-4 w-4" /> Provisionar membro
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="Sem membros ainda"
          description="Provisione admin, coordenadores e agentes de campo. Cada um recebe link e senha temporária."
          icon={<Plus className="h-5 w-5" />}
          action={
            <Button onClick={() => setProvisionOpen(true)}>
              <UserPlus className="h-4 w-4" /> Provisionar
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const p = profileFor(m.user_id);
            const isSelf = m.user_id === session?.id;
            return (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3 min-w-0">
                  <Avatar>
                    <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{p.full_name}</p>
                      {isSelf ? <Badge variant="outline">Você</Badge> : null}
                      {!m.is_active ? <Badge variant="destructive">Desativado</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.phone ?? 'Sem telefone cadastrado'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m.id, v as UserRole)}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant={m.is_active ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleActive(m)}
                    disabled={isSelf}
                  >
                    {m.is_active ? 'Desativar' : 'Reativar'}
                  </Button>

                  {!isSelf ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(m)}
                      className="text-red-300 hover:text-red-200"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProvisionSheet open={provisionOpen} onOpenChange={setProvisionOpen} />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remover membro?"
        description="A pessoa perderá acesso imediatamente. Para suspender temporariamente, use Desativar."
        onConfirm={() => deleteTarget && collections.campaign_users.remove(deleteTarget.id)}
      />
    </div>
  );
}

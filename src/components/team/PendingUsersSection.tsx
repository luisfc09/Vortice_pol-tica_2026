import { useEffect, useState } from 'react';
import { Clock, RefreshCw, ShieldCheck, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { initials } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ROLE_LABEL, ROLE_DESCRIPTION, ROLE_OPTIONS, type UserRole } from '@/types';

interface PendingRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

const ROLE_VALUES: UserRole[] = [...ROLE_OPTIONS];

interface Props {
  onApproved?: () => void;
}

export function PendingUsersSection({ onApproved }: Props) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PendingRow | null>(null);
  const [role, setRole] = useState<UserRole>('leader');
  const [fullName, setFullName] = useState('');
  const [approving, setApproving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_pending_users');
    setLoading(false);
    if (error) {
      // Não toast — pode ser que a migration 012 ainda não foi rodada
      console.warn('list_pending_users:', error.message);
      return;
    }
    setRows((data ?? []) as PendingRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function startApprove(row: PendingRow) {
    setTarget(row);
    setFullName(row.full_name);
    setRole('leader');
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!fullName.trim()) {
      toast.error('Informe o nome completo.');
      return;
    }
    setApproving(true);
    try {
      const { data, error } = await supabase.rpc('approve_user', {
        p_user_id: target.id,
        p_role: role,
        p_full_name: fullName.trim(),
      });
      if (error) {
        toast.error(`Falha ao ativar: ${error.message}`);
        return;
      }
      const payload = data as { ok?: boolean; error?: string };
      if (payload?.error) {
        toast.error(payload.error);
        return;
      }
      toast.success(`${fullName} ativado como ${ROLE_LABEL[role]}.`);
      setOpen(false);
      setTarget(null);
      void load();
      onApproved?.();
    } finally {
      setApproving(false);
    }
  }

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-300" />
            <p className="font-semibold text-amber-200">
              {rows.length} usuário{rows.length > 1 ? 's' : ''} aguardando ativação
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <p className="mb-3 text-xs text-amber-100/80">
          Estes usuários já logaram (via Google ou e-mail/senha), mas não estão vinculados a
          nenhuma campanha. Atribua um papel para liberar acesso.
        </p>

        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-vortex-bg/40 p-3 sm:flex-row sm:items-center"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials(r.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  Logou{' '}
                  {formatDistanceToNow(new Date(r.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Badge variant="warning" className="hidden sm:inline-flex">
                Pendente
              </Badge>
              <Button size="sm" onClick={() => startApprove(r)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Ativar
                <ChevronRight className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="mb-5">
            <SheetTitle>Ativar usuário</SheetTitle>
            <SheetDescription>
              Atribua um papel para liberar o acesso à campanha. O usuário receberá acesso
              imediatamente após salvar.
            </SheetDescription>
          </SheetHeader>

          {target ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-lg border border-vortex-border bg-vortex-bg/40 p-3 text-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  E-mail confirmado pelo provedor
                </p>
                <p className="mt-0.5 font-mono text-foreground">{target.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_VALUES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {ROLE_DESCRIPTION[role]}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={approving}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={approving}>
                  <ShieldCheck className="h-4 w-4" />
                  {approving ? 'Ativando…' : 'Ativar'}
                </Button>
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

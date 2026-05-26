import { Eye, LogOut, Menu, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertsBadge } from '@/components/alerts/AlertsBadge';
import { initials } from '@/lib/utils';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsStore } from '@/stores/viewAs';
import { ROLE_LABEL } from '@/types';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { session, signOut } = useAuth();
  const online = useOnline();
  const viewAsCampaign = useViewAsStore((s) => s.campaign);
  const exitViewAs = useViewAsStore((s) => s.exit);

  if (!session) return null;

  // Banner amber acima do header quando o super admin está visualizando
  // como cliente. Sair restaura a sessão original.
  return (
    <>
      {viewAsCampaign && session.is_super_admin ? (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-100">
          <span className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Visualizando como cliente:{' '}
              <strong>{viewAsCampaign.candidate_name}</strong> · plano{' '}
              <strong>{viewAsCampaign.plan}</strong>
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              exitViewAs();
              toast.message('Modo Super Admin restaurado.');
            }}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-medium hover:bg-amber-500/30"
          >
            <X className="h-3 w-3" />
            Sair do modo cliente
          </button>
        </div>
      ) : null}
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-vortex-border bg-background/80 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl tracking-wide text-foreground md:text-3xl">
          {title}
        </h1>
      </div>

      {!online ? (
        <Badge variant="warning" className="hidden gap-1 sm:inline-flex">
          <WifiOff className="h-3 w-3" /> Offline
        </Badge>
      ) : null}

      <div className="hidden items-center gap-2 sm:flex">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-foreground">{session.profile.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {session.is_super_admin
              ? 'Super Admin Vórtice'
              : session.role
                ? ROLE_LABEL[session.role]
                : 'Sem papel'}
          </p>
        </div>
        <Avatar className="ring-1 ring-vortex-border">
          {session.profile.avatar_url ? (
            <AvatarImage
              src={session.profile.avatar_url}
              alt={session.profile.full_name}
            />
          ) : null}
          <AvatarFallback>{initials(session.profile.full_name)}</AvatarFallback>
        </Avatar>
      </div>

      <AlertsBadge />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          void signOut();
        }}
        aria-label="Sair"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
    </>
  );
}

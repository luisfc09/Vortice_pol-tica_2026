import { Menu, LogOut, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { initials } from '@/lib/utils';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABEL } from '@/types';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { session, signOut } = useAuth();
  const online = useOnline();

  if (!session) return null;

  return (
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
        <Avatar>
          <AvatarFallback>{initials(session.profile.full_name)}</AvatarFallback>
        </Avatar>
      </div>

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
  );
}

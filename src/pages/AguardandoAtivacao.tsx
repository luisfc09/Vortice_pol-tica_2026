import { Navigate } from 'react-router-dom';
import { Clock, LogOut, Mail, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { VorticeLogo } from '@/components/brand/VorticeLogo';
import { useAuth } from '@/hooks/useAuth';
import { initials } from '@/lib/utils';
import { toast } from 'sonner';

export default function AguardandoAtivacaoPage() {
  const { session, signOut } = useAuth();

  // Se o usuário já foi aprovado e voltou aqui por engano, manda pro dashboard
  if (!session) return <Navigate to="/login" replace />;
  if (session.campaign || session.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function copyEmail() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.email);
      toast.success('E-mail copiado. Envie ao coordenador.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-vortex-surface/40 vortex-glow">
            <VorticeLogo size={44} />
          </div>
        </div>

        <div className="rounded-2xl border border-vortex-border bg-vortex-surface/70 p-6 backdrop-blur sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(session.profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Conta reconhecida
              </p>
              <p className="truncate font-semibold text-foreground">
                {session.profile.full_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{session.email}</p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-semibold text-amber-200">
                Aguardando ativação por um administrador
              </p>
            </div>
            <p className="text-sm text-amber-100/90">
              Seu login foi feito com sucesso, mas ainda não há uma campanha vinculada à sua
              conta. Avise o coordenador da campanha — ele precisa atribuir um papel antes do
              acesso ser liberado.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-vortex-border bg-vortex-bg/40 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                O que enviar ao coordenador
              </p>
              <p className="text-foreground">
                "Já fiz login em <strong>{window.location.host}</strong> com{' '}
                <strong>{session.email}</strong>. Você consegue me ativar?"
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyEmail}>
                <Mail className="h-4 w-4" /> Copiar e-mail
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" /> Já fui ativado, tentar de novo
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-vortex-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Acesso liberado por um administrador da campanha · powered by Vórtice
        </p>
      </div>
    </div>
  );
}

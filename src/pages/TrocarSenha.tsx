import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { resolveHomeRoute } from '@/lib/homeRoute';

const MIN_LENGTH = 8;

export default function TrocarSenhaPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Toggle de visibilidade (ícone de olho) — o usuário confere a senha
  // digitada antes de confirmar. Independente por campo.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!session) return <Navigate to="/login" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (password.length < MIN_LENGTH) {
      toast.error(`A senha precisa ter ao menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      toast.error('A confirmação não confere com a senha.');
      return;
    }
    if (password === '123456') {
      toast.error('Escolha uma senha diferente da temporária.');
      return;
    }

    setSubmitting(true);
    try {
      if (USE_MOCKS) {
        // Mock: apenas marca como trocada localmente.
        setSession({
          ...session,
          profile: { ...session.profile, must_change_password: false },
        });
        toast.success('Senha atualizada (modo demonstração).');
        // Resolve home por role — supporter → /minha-rede, leader → /agenda,
        // demais → /dashboard. Sem isso, supporter cai em /dashboard e o
        // ProtectedRoute redireciona, gerando 1 hop a mais (funciona, mas
        // este branch direto é mais limpo).
        navigate(resolveHomeRoute(session.role), { replace: true });
        return;
      }

      // ⚠️ Webview do WhatsApp (Hipótese 2 do diagnóstico) às vezes perde
      // a sessão entre /convite/[code] → setSession → navigate('/trocar-senha').
      // O Zustand mostra session OK (UI renderizada) mas o cliente Supabase
      // perdeu o token internamente — updateUser falha com "Auth session
      // missing".
      //
      // Defesa: verificar a sessão IN-CLIENT antes do updateUser e, se
      // ausente, tentar re-login SILENCIOSO com a senha temp 123456 (sabemos
      // que é o caso recém-criado pelo accept-invite). Se o re-login falhar
      // aí sim mostra mensagem amigável e manda pro /login.
      const { data: liveSession } = await supabase.auth.getSession();
      if (!liveSession.session) {
        const { error: reLoginErr } = await supabase.auth.signInWithPassword({
          email: session.email,
          password: '123456',
        });
        if (reLoginErr) {
          toast.error(
            'Sua sessão expirou. Faça login com a senha temporária 123456.',
          );
          navigate('/login', { replace: true });
          return;
        }
        // Re-login OK — segue silenciosamente.
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', session.id);
      if (profileError) {
        toast.error(`Senha trocada, mas falha ao limpar a flag: ${profileError.message}`);
        return;
      }
      setSession({
        ...session,
        profile: { ...session.profile, must_change_password: false },
      });
      toast.success('Senha atualizada. Bem-vindo!');
      // Mesmo branch do mock acima — supporter vai direto pra /minha-rede.
      navigate(resolveHomeRoute(session.role), { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl tracking-wide">Definir nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Primeiro acesso da conta {session.email}. Escolha uma senha pessoal antes de
            continuar.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-vortex-border bg-vortex-surface/70 p-6 backdrop-blur sm:p-8"
        >
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_LENGTH}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mínimo {MIN_LENGTH} caracteres. Não use a senha temporária.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirme a senha</Label>
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={MIN_LENGTH}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showConfirm}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            <KeyRound className="h-4 w-4" />
            {submitting ? 'Salvando...' : 'Salvar e continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

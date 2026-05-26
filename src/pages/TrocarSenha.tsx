import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const MIN_LENGTH = 8;

export default function TrocarSenhaPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        navigate('/dashboard', { replace: true });
        return;
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
      navigate('/dashboard', { replace: true });
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
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_LENGTH}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Mínimo {MIN_LENGTH} caracteres. Não use a senha temporária.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirme a senha</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={MIN_LENGTH}
              required
            />
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { USE_MOCKS } from '@/lib/supabase';
import { MOCK_CREDENTIALS } from '@/lib/mocks';

export function LoginForm() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) {
      toast.success('Bem-vindo ao Vórtice');
      navigate('/dashboard', { replace: true });
    } else {
      toast.error(res.error ?? 'Não foi possível entrar.');
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    const res = await loginWithGoogle();
    setGoogleLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Login Google indisponível.');
    }
    // Em sucesso, o browser é redirecionado para o Google.
  }

  function fillMock(role: 'admin' | 'field') {
    const creds = role === 'admin' ? MOCK_CREDENTIALS.admin : MOCK_CREDENTIALS.field;
    setEmail(creds.email);
    setPassword(creds.password);
  }

  return (
    <div className="space-y-5">
      {!USE_MOCKS ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full bg-white text-vortex-bg hover:bg-white/90"
          disabled={googleLoading || submitting}
          onClick={onGoogle}
        >
          <GoogleIcon />
          {googleLoading ? 'Abrindo Google...' : 'Continuar com Google'}
        </Button>
      ) : null}

      {!USE_MOCKS ? (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-vortex-border" />
          ou e-mail e senha
          <span className="h-px flex-1 bg-vortex-border" />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@campanha.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting || isLoading || googleLoading}
        >
          {submitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {USE_MOCKS ? (
        <div className="space-y-2 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Modo demonstração</p>
          <p>
            Credenciais ainda não conectadas ao Supabase. Use os botões abaixo para entrar com
            usuários simulados.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => fillMock('admin')}>
              Preencher admin
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fillMock('field')}>
              Preencher agente de campo
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          O acesso é por convite. Fale com o coordenador da campanha.
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21.35 11.1H12v2.8h5.35c-.23 1.27-1.4 3.7-5.35 3.7-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.74 3.3 14.62 2.4 12 2.4 6.97 2.4 2.9 6.45 2.9 11.5s4.07 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.88 0-.6-.06-1.06-.13-1.62z"
        fill="#4285F4"
      />
    </svg>
  );
}

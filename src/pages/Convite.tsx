// ============================================================================
// Página /convite/[code] — auto-cadastro vinculado a um indicador.
// ----------------------------------------------------------------------------
// Rota PÚBLICA (sem AppLayout, sem ProtectedRoute).
//
// Fluxo:
//   1) Carrega get_invite_info(code) via RPC pública (anon).
//   2) Se inválido/usado: tela de erro com CTA pra voltar ao /login.
//   3) Se válido: mostra "Você foi convidado por [Nome] pra campanha de
//      [Candidato]" + form (nome, e-mail, telefone, cidade).
//   4) Submit → POST edge function accept-invite.
//   5) Recebe session tokens, salva no supabase-js client e navega pra
//      /trocar-senha (já existe) — usuário troca a senha temp 123456,
//      depois cai em /aguardando-ativacao (admin aprova).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, UserPlus, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { VorticeLogo } from '@/components/brand/VorticeLogo';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';

interface InviteInfo {
  referrer_id: string;
  referrer_name: string;
  campaign_id: string;
  candidate_name: string;
  party: string;
  party_number: string;
  state: string;
  office: string;
  plan: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  municipality_code: string;
  city: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  municipality_code: '',
  city: '',
};

export default function ConvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // -------- carrega o convite via RPC pública ------------------------
  useEffect(() => {
    let active = true;
    async function load() {
      if (!code) {
        setLoadError('Código de convite ausente na URL.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc('get_invite_info', { p_code: code });
      if (!active) return;
      setLoading(false);
      if (error) {
        setLoadError(`Falha ao validar convite: ${error.message}`);
        return;
      }
      const first = (data as InviteInfo[] | null)?.[0] ?? null;
      if (!first) {
        setLoadError('Convite inválido, expirado ou já utilizado por outra pessoa.');
        return;
      }
      setInvite(first);
    }
    void load();
    return () => {
      active = false;
    };
  }, [code]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!invite || !code) return;
      if (form.name.trim().length < 2) return toast.error('Informe seu nome completo.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return toast.error('E-mail inválido.');

      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke('accept-invite', {
          body: {
            code,
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone || null,
            city: form.city || null,
            municipality_code: form.municipality_code || null,
          },
        });
        if (error) {
          toast.error(error.message || 'Falha ao processar convite.');
          return;
        }
        const resp = data as {
          ok?: boolean;
          session?: { access_token: string; refresh_token: string } | null;
          message?: string;
          error?: string;
        };
        if (!resp?.ok) {
          toast.error(resp?.error || 'Não foi possível concluir o cadastro.');
          return;
        }

        // Faz login do user usando os tokens devolvidos pela edge function.
        if (resp.session) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: resp.session.access_token,
            refresh_token: resp.session.refresh_token,
          });
          if (setErr) {
            toast.error('Conta criada, mas falhou ao logar. Use o login com sua senha temporária 123456.');
            navigate('/login');
            return;
          }
          toast.success('Cadastro concluído! Troque a senha temporária agora.');
          navigate('/trocar-senha');
        } else {
          // Sem session — admin precisa logar manualmente
          toast.success(resp.message || 'Conta criada. Faça login com a senha temporária 123456.');
          navigate('/login');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [invite, code, form, navigate],
  );

  function handleMunicipalityChange(muniCode: string, name: string) {
    setForm((p) => ({
      ...p,
      municipality_code: muniCode || '',
      city: muniCode ? name : '',
    }));
  }

  // Pre-popula city quando o usuário escolhe município pela 1ª vez
  const cityName = useMemo(() => {
    if (form.municipality_code) {
      return MG_MUNICIPALITIES.find((m) => m.code === form.municipality_code)?.name ?? form.city;
    }
    return form.city;
  }, [form.municipality_code, form.city]);

  // -------- render: loading / erro / form ----------------------------
  return (
    <div className="flex min-h-screen items-center justify-center bg-vortex-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-vortex-surface/40 vortex-glow">
            <VorticeLogo size={44} />
          </div>
          <h1 className="font-display text-3xl tracking-[0.15em] text-foreground">
            V<span className="text-vortex-lime">Ó</span>RTICE
          </h1>
        </div>

        <div className="rounded-2xl border border-vortex-border bg-vortex-surface/70 p-6 shadow-xl backdrop-blur sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Validando seu convite…</p>
            </div>
          ) : loadError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <div className="text-sm text-red-200">{loadError}</div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : invite ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-vortex-violet" />
                <p className="text-xs uppercase tracking-widest text-vortex-violet">Você foi convidado(a)</p>
                <h2 className="font-display text-2xl text-foreground">
                  Junte-se à campanha de
                </h2>
                <p className="text-lg font-semibold text-primary">{invite.candidate_name}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.party} {invite.party_number} · {invite.office} {invite.state} · indicado(a) por{' '}
                  <strong className="text-foreground/90">{invite.referrer_name}</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome completo *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                  autoComplete="email"
                />
                <p className="text-[11px] text-muted-foreground">
                  Vamos criar sua conta com a senha temporária <strong className="font-mono">123456</strong>.
                  Você troca no primeiro acesso.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', formatPhone(e.target.value))}
                  placeholder="(31) 99999-9999"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Município</Label>
                <MunicipalityCombobox
                  value={form.municipality_code}
                  onChange={handleMunicipalityChange}
                  placeholder="Buscar município…"
                />
                {cityName ? (
                  <p className="text-[11px] text-muted-foreground">Selecionado: {cityName}</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {submitting ? 'Criando sua conta…' : 'Aceitar convite e criar conta'}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                Após criar a conta, um administrador da campanha precisa aprovar seu acesso. Você receberá
                acesso completo ao painel quando isso for feito.
              </p>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
import { formatCep, lookupCep, onlyCepDigits } from '@/lib/cep';
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
  candidate_photo_url: string | null;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  municipality_code: string;
  city: string;
  cep: string;
  logradouro: string;
  numero: string;
  neighborhood: string;
  complemento: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  municipality_code: '',
  city: '',
  cep: '',
  logradouro: '',
  numero: '',
  neighborhood: '',
  complemento: '',
};

export default function ConvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

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

  // Busca ativa por CEP (ViaCEP). Dispara quando o CEP fica completo (8 díg).
  // Preenche rua + bairro e tenta auto-selecionar o município pelo IBGE.
  const runCepLookup = useCallback(async (rawCep: string) => {
    if (onlyCepDigits(rawCep).length !== 8) return;
    setCepLoading(true);
    try {
      const addr = await lookupCep(rawCep);
      if (!addr) {
        toast.error('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      setForm((p) => {
        const muni = addr.ibge
          ? MG_MUNICIPALITIES.find((m) => m.code === addr.ibge)
          : undefined;
        return {
          ...p,
          logradouro: addr.logradouro || p.logradouro,
          neighborhood: addr.bairro || p.neighborhood,
          // Só sobrescreve o município se o CEP for de MG (casou no IBGE).
          municipality_code: muni ? muni.code : p.municipality_code,
          city: muni ? muni.name : p.city,
        };
      });
    } finally {
      setCepLoading(false);
    }
  }, []);

  function handleCepChange(raw: string) {
    const masked = formatCep(raw);
    update('cep', masked);
    if (onlyCepDigits(masked).length === 8) void runCepLookup(masked);
  }

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!invite || !code) return;
      if (form.name.trim().length < 2) return toast.error('Informe seu nome completo.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return toast.error('E-mail inválido.');
      // Endereço obrigatório (pedido do cliente): CEP, rua, número e bairro.
      if (onlyCepDigits(form.cep).length !== 8)
        return toast.error('Informe um CEP válido (8 dígitos).');
      if (!form.logradouro.trim()) return toast.error('Informe o nome da rua.');
      if (!form.numero.trim()) return toast.error('Informe o número.');
      if (!form.neighborhood.trim()) return toast.error('Informe o bairro.');
      if (!form.municipality_code) return toast.error('Selecione o município.');

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
            cep: onlyCepDigits(form.cep) || null,
            logradouro: form.logradouro.trim() || null,
            numero: form.numero.trim() || null,
            neighborhood: form.neighborhood.trim() || null,
            complemento: form.complemento.trim() || null,
          },
        });
        if (error) {
          // supabase-js coloca só "Edge Function returned a non-2xx status code"
          // em error.message. A mensagem real (ex: "E-mail já cadastrado...")
          // vem no corpo da resposta, acessível via error.context (o Response).
          // Lemos pra mostrar o texto amigável em vez do erro técnico.
          let msg = 'Falha ao processar convite.';
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            try {
              const body = (await ctx.json()) as { error?: string };
              if (body?.error) msg = body.error;
            } catch {
              /* corpo não-JSON: mantém a mensagem padrão */
            }
          } else if (error.message && !/non-2xx/i.test(error.message)) {
            msg = error.message;
          }
          toast.error(msg);
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
                {invite.candidate_photo_url ? (
                  <img
                    src={invite.candidate_photo_url}
                    alt={invite.candidate_name}
                    className="mx-auto h-24 w-24 rounded-full border-2 border-vortex-violet/40 object-cover shadow-lg"
                  />
                ) : (
                  <Sparkles className="mx-auto h-5 w-5 text-vortex-violet" />
                )}
                <p className="text-xs uppercase tracking-widest text-vortex-violet">Você foi convidado(a)</p>
                <h2 className="font-display text-xl text-foreground">
                  Junte-se à campanha de
                </h2>
                <p className="font-display text-2xl font-semibold text-primary">
                  {invite.candidate_name}
                </p>
                {/* Nome + NÚMERO em destaque (pedido do cliente) */}
                <div className="flex items-center justify-center gap-2">
                  <span className="rounded-md bg-primary/15 px-2.5 py-1 text-sm font-bold tracking-wide text-primary">
                    {invite.party} {invite.party_number}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {invite.office} · {invite.state}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  indicado(a) por{' '}
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

              {/* -------- Endereço (obrigatório) -------------------------- */}
              <div className="space-y-1.5 rounded-lg border border-vortex-border/60 bg-vortex-bg/30 p-3">
                <p className="text-xs font-medium uppercase tracking-widest text-vortex-violet">
                  Endereço
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="cep">CEP *</Label>
                  <div className="relative">
                    <Input
                      id="cep"
                      inputMode="numeric"
                      value={form.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onBlur={() => runCepLookup(form.cep)}
                      placeholder="00000-000"
                      autoComplete="postal-code"
                      required
                    />
                    {cepLoading ? (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Digite o CEP que preenchemos rua, bairro e cidade automaticamente.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="logradouro">Rua *</Label>
                    <Input
                      id="logradouro"
                      value={form.logradouro}
                      onChange={(e) => update('logradouro', e.target.value)}
                      placeholder="Nome da rua"
                      autoComplete="address-line1"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="numero">Número *</Label>
                    <Input
                      id="numero"
                      inputMode="numeric"
                      value={form.numero}
                      onChange={(e) => update('numero', e.target.value)}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(e) => update('neighborhood', e.target.value)}
                    placeholder="Seu bairro"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Município *</Label>
                  <MunicipalityCombobox
                    value={form.municipality_code}
                    onChange={handleMunicipalityChange}
                    placeholder="Buscar município…"
                  />
                  {cityName ? (
                    <p className="text-[11px] text-muted-foreground">Selecionado: {cityName}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={form.complemento}
                    onChange={(e) => update('complemento', e.target.value)}
                    placeholder="Apto, bloco, referência (opcional)"
                    autoComplete="address-line2"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {submitting ? 'Criando sua conta…' : 'Aceitar convite e criar conta'}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

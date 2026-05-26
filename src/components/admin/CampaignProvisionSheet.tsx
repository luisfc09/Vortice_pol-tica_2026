import { useState } from 'react';
import { Loader2, ShieldCheck, Copy, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

interface FormState {
  // Campanha
  name: string;
  candidate_name: string;
  party: string;
  party_number: string;
  state: string;
  office: string;
  election_year: string;
  vote_target: string;
  slogan: string;
  status: 'trial' | 'active';
  // Admin do cliente
  admin_email: string;
  admin_full_name: string;
  admin_phone: string;
}

const EMPTY: FormState = {
  name: '',
  candidate_name: '',
  party: '',
  party_number: '',
  state: 'MG',
  office: 'Governador',
  election_year: '2026',
  vote_target: '350000',
  slogan: 'Estratégia que move eleições.',
  status: 'trial',
  admin_email: '',
  admin_full_name: '',
  admin_phone: '',
};

interface ProvisionResult {
  campaign_id: string;
  candidate_name: string;
  admin_email: string;
  // Null quando o admin já existia (reusamos o user) — não há senha
  // temporária pra exibir nesse caso.
  temporary_password: string | null;
  admin_already_existed?: boolean;
  login_url: string;
}

const OFFICES = ['Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual', 'Prefeito', 'Vereador'];
const STATES = ['MG', 'SP', 'RJ', 'ES', 'BA', 'PR', 'SC', 'RS', 'GO', 'DF', 'Outro'];

export function CampaignProvisionSheet({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(EMPTY);
    setResult(null);
    setCopied(false);
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.candidate_name || !form.admin_email || !form.admin_full_name) {
      toast.error('Preencha nome do candidato, e-mail e nome do admin.');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-campaign', {
        body: {
          name: form.name || `Campanha ${form.candidate_name}`,
          candidate_name: form.candidate_name,
          party: form.party,
          party_number: form.party_number,
          state: form.state,
          office: form.office,
          election_year: Number(form.election_year) || new Date().getFullYear(),
          vote_target: Number(form.vote_target) || 0,
          slogan: form.slogan || undefined,
          status: form.status,
          admin_email: form.admin_email.trim(),
          admin_full_name: form.admin_full_name.trim(),
          admin_phone: form.admin_phone || undefined,
        },
      });

      // Quando a edge function retorna non-2xx, supabase-js seta `error` mas
      // engole o body. A gente extrai pela `context.response` que está no
      // FunctionsHttpError. Assim recuperamos { step, error, detail } gerado
      // no servidor — a mensagem real que ajuda a debugar.
      if (error) {
        type FnErr = typeof error & {
          context?: { response?: Response };
        };
        let serverMsg: string | null = null;
        let serverStep: string | null = null;
        let serverDetail: unknown = undefined;
        try {
          const resp = (error as FnErr).context?.response;
          if (resp) {
            const body = await resp.clone().json();
            serverMsg = typeof body?.error === 'string' ? body.error : null;
            serverStep = typeof body?.step === 'string' ? body.step : null;
            serverDetail = body?.detail;
            console.error('[provision-campaign] server error body:', body);
          }
        } catch (parseErr) {
          console.error('[provision-campaign] não consegui ler body:', parseErr);
        }
        const human = serverMsg
          ? `Falha em ${serverStep ?? '?'}: ${serverMsg}`
          : `Falha: ${error.message}`;
        toast.error(human, {
          description: serverDetail
            ? `Detalhe: ${JSON.stringify(serverDetail).slice(0, 200)}`
            : 'Veja o console + Edge Function Logs no Supabase Dashboard.',
        });
        return;
      }
      const payload = data as { ok?: boolean; error?: string; step?: string } & ProvisionResult;
      if (payload.error) {
        toast.error(`Falha em ${payload.step ?? '?'}: ${payload.error}`);
        return;
      }
      setResult({
        campaign_id: payload.campaign_id,
        candidate_name: payload.candidate_name,
        admin_email: payload.admin_email,
        temporary_password: payload.temporary_password,
        admin_already_existed: payload.admin_already_existed,
        login_url: payload.login_url,
      });
      onCreated?.();
      toast.success(
        payload.admin_already_existed
          ? 'Campanha provisionada. Admin já existia — sem senha temporária.'
          : 'Campanha provisionada com sucesso.',
      );
    } finally {
      setSending(false);
    }
  }

  async function copyCreds() {
    if (!result) return;
    const pwdLine = result.temporary_password
      ? `Senha temporária: ${result.temporary_password}\n`
      : `(Admin já existia — use a senha atual.)\n`;
    const text = `Acesso ao Vórtice — campanha ${result.candidate_name}\nE-mail: ${result.admin_email}\n${pwdLine}Link: ${result.login_url}\n\nNo primeiro acesso a senha precisará ser alterada (quando aplicável).`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-5">
          <SheetTitle>Provisionar campanha</SheetTitle>
          <SheetDescription>
            Cria a instância do cliente + admin com senha temporária. O candidato/coordenador
            recebe o link e troca a senha no primeiro acesso.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-semibold">Campanha criada</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Candidato:{' '}
                <span className="font-medium text-foreground">{result.candidate_name}</span>
              </p>
              <div className="mt-3 space-y-2 text-foreground/90">
                <Row label="E-mail do admin" value={result.admin_email} />
                {result.temporary_password ? (
                  <Row
                    label="Senha temporária"
                    value={result.temporary_password}
                    mono
                  />
                ) : (
                  <Row
                    label="Senha"
                    value="Admin já existia — use a senha atual."
                  />
                )}
                <Row label="Link de acesso" value={result.login_url} mono breakAll />
              </div>
            </div>

            <Button className="w-full" onClick={copyCreds}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar credenciais'}
            </Button>

            {result.temporary_password ? (
              <p className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3 text-xs text-muted-foreground">
                Envie ao candidato/coordenador. A senha{' '}
                <Badge variant="warning" className="mx-1 align-middle">
                  {result.temporary_password}
                </Badge>
                expira no primeiro acesso — o sistema obrigará a definição de senha pessoal.
              </p>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                O e-mail já existia no Vórtice — o usuário foi apenas vinculado a essa
                campanha como admin. Use a senha atual dele para login.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => reset()}>
                Provisionar outra
              </Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Campanha
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="candidate_name">Nome do candidato</Label>
                <Input
                  id="candidate_name"
                  value={form.candidate_name}
                  onChange={(e) => update('candidate_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nome interno da campanha</Label>
                <Input
                  id="name"
                  placeholder="Ex: Coligação MG 2026"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party">Partido</Label>
                <Input
                  id="party"
                  value={form.party}
                  onChange={(e) => update('party', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party_number">Número</Label>
                <Input
                  id="party_number"
                  inputMode="numeric"
                  value={form.party_number}
                  onChange={(e) => update('party_number', e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={form.office} onValueChange={(v) => update('office', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={form.state} onValueChange={(v) => update('state', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="election_year">Ano</Label>
                <Input
                  id="election_year"
                  inputMode="numeric"
                  value={form.election_year}
                  onChange={(e) => update('election_year', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote_target">Meta de votos</Label>
                <Input
                  id="vote_target"
                  inputMode="numeric"
                  value={form.vote_target}
                  onChange={(e) => update('vote_target', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status inicial</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update('status', v as 'trial' | 'active')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="slogan">Slogan (opcional)</Label>
                <Textarea
                  id="slogan"
                  rows={2}
                  value={form.slogan}
                  onChange={(e) => update('slogan', e.target.value)}
                />
              </div>
            </div>

            <p className="pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin inicial do cliente
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="admin_full_name">Nome completo</Label>
                <Input
                  id="admin_full_name"
                  value={form.admin_full_name}
                  onChange={(e) => update('admin_full_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="admin_email">E-mail</Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => update('admin_email', e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Para login Google, deve ser o mesmo e-mail da conta Google do candidato.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="admin_phone">Telefone (opcional)</Label>
                <Input
                  id="admin_phone"
                  inputMode="tel"
                  value={form.admin_phone}
                  onChange={(e) => update('admin_phone', formatPhone(e.target.value))}
                  placeholder="(31) 99999-9999"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Provisionando...' : 'Criar campanha'}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 ${mono ? 'font-mono' : ''} ${breakAll ? 'break-all' : ''} text-foreground`}
      >
        {value}
      </p>
    </div>
  );
}

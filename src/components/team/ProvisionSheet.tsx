import { useState } from 'react';
import { Copy, Check, Send, Loader2, ShieldCheck } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collections, isMockMode } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { ROLE_LABEL, ROLE_DESCRIPTION, ROLE_OPTIONS, type UserRole } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProvisionResult {
  email: string;
  temporary_password: string;
  login_url: string;
  user_id: string;
}

const ROLE_VALUES: UserRole[] = [...ROLE_OPTIONS];

const MOCK_TEMP_PASSWORD = '123456';

export function ProvisionSheet({ open, onOpenChange }: Props) {
  // Sessão efetiva: respeita o "ver como cliente" do super admin, garantindo
  // que o membro é provisionado na campanha em que o usuário está atuando.
  const session = useEffectiveSession();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('leader');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState<'creds' | 'link' | null>(null);

  function reset() {
    setEmail('');
    setName('');
    setPhone('');
    setRole('field_agent');
    setResult(null);
    setCopied(null);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !session.campaign) return;
    if (!email.trim() || !name.trim()) {
      toast.error('Informe nome e e-mail.');
      return;
    }

    setSending(true);
    try {
      if (isMockMode()) {
        const userId = `user-mock-${Date.now()}`;
        collections.campaign_users.create({
          data: {
            campaign_id: session.campaign.id,
            user_id: userId,
            role,
            invited_by: session.id,
            is_active: true,
          },
        });
        setResult({
          email,
          temporary_password: MOCK_TEMP_PASSWORD,
          login_url: `${window.location.origin}/login`,
          user_id: userId,
        });
        toast.success('Membro provisionado (modo demonstração).');
        return;
      }

      const { data, error } = await supabase.functions.invoke('provision-user', {
        body: {
          email: email.trim(),
          full_name: name.trim(),
          phone: phone || undefined,
          role,
          campaign_id: session.campaign.id,
        },
      });
      if (error) {
        // supabase.functions.invoke devolve sempre a mensagem genérica
        // ("non-2xx status code"). O motivo real vem no corpo da resposta,
        // exposto em error.context (um Response). Extraímos para o toast.
        let reason = error.message;
        const res = (error as { context?: Response }).context;
        if (res && typeof res.text === 'function') {
          try {
            const raw = await res.text();
            if (raw) {
              try {
                reason = (JSON.parse(raw) as { error?: string }).error || raw;
              } catch {
                reason = raw;
              }
            }
          } catch {
            /* mantém error.message */
          }
        }
        toast.error(`Falha ao provisionar: ${reason}`);
        return;
      }
      const payload = data as { ok?: boolean; error?: string } & ProvisionResult;
      if (payload.error) {
        toast.error(payload.error);
        return;
      }
      setResult({
        email: payload.email,
        temporary_password: payload.temporary_password,
        login_url: payload.login_url,
        user_id: payload.user_id,
      });
      toast.success(`Membro criado. Envie as credenciais a ${payload.email}.`);
    } finally {
      setSending(false);
    }
  }

  async function copyCreds() {
    if (!result) return;
    const text = `Acesso ao Vórtice\nE-mail: ${result.email}\nSenha temporária: ${result.temporary_password}\nLink: ${result.login_url}\n\nNo primeiro acesso a senha precisará ser alterada.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied('creds');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.login_url);
      setCopied('link');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>Provisionar membro</SheetTitle>
          <SheetDescription>
            Admin cria a conta direto. O membro entra com a senha temporária (e troca no primeiro
            acesso) ou usa Google com o mesmo e-mail.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-semibold">Conta criada com sucesso</span>
              </div>
              <div className="space-y-2 text-foreground/90">
                <Row label="E-mail" value={result.email} />
                <Row label="Senha temporária" value={result.temporary_password} mono />
                <Row label="Link de acesso" value={result.login_url} mono breakAll />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={copyCreds}>
                {copied === 'creds' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'creds' ? 'Copiado' : 'Copiar credenciais completas'}
              </Button>
              <Button variant="outline" onClick={copyLink}>
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'link' ? 'Link copiado' : 'Copiar apenas o link'}
              </Button>
            </div>

            <p className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3 text-xs text-muted-foreground">
              Envie por WhatsApp ou outro canal seguro. A senha temporária{' '}
              <Badge variant="warning" className="mx-1 align-middle">
                {result.temporary_password}
              </Badge>
              só funciona uma vez — no primeiro acesso o sistema obriga a definir uma senha
              pessoal.
            </p>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => reset()}>
                Provisionar outro
              </Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Para login com Google, deve ser o mesmo e-mail da conta Google da pessoa.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(31) 99999-9999"
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
                onClick={() => handleClose(false)}
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Provisionando...' : 'Criar conta'}
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

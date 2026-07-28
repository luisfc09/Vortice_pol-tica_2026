// ============================================================================
// InviteInterviewerSheet — convida um Entrevistador (role field_agent) direto
// do builder do formulário. Provisiona o acesso (provision-user) e JÁ autoriza
// a pessoa naquele formulário (survey_form_assignments). Um lugar só.
// ============================================================================

import { useState } from 'react';
import { Check, Copy, Loader2, MessageSquare, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  campaignId: string;
  onInvited: () => void; // recarrega a lista de entrevistadores
}

interface Result {
  email: string;
  temporary_password: string;
  login_url: string;
}

export function InviteInterviewerSheet({
  open,
  onOpenChange,
  formId,
  campaignId,
  onInvited,
}: Props) {
  const session = useEffectiveSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName('');
    setEmail('');
    setPhone('');
    setResult(null);
    setCopied(false);
  }

  async function handleInvite() {
    if (name.trim().length < 2) return toast.error('Informe o nome do entrevistador.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return toast.error('E-mail inválido.');
    setSaving(true);
    try {
      // 1) Provisiona o acesso como Entrevistador (field_agent).
      const { data, error } = await supabase.functions.invoke('provision-user', {
        body: {
          full_name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role: 'field_agent',
          campaign_id: campaignId,
        },
      });
      if (error) {
        // Lê a mensagem real do corpo (ex: e-mail já cadastrado).
        let msg = 'Falha ao convidar.';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = (await ctx.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            /* mantém padrão */
          }
        } else if (error.message && !/non-2xx/i.test(error.message)) {
          msg = error.message;
        }
        toast.error(msg);
        return;
      }
      const resp = data as {
        user_id?: string;
        email?: string;
        temporary_password?: string;
        login_url?: string;
        error?: string;
      };
      if (!resp?.user_id) {
        toast.error(resp?.error || 'Não foi possível criar o acesso.');
        return;
      }

      // 2) Autoriza a pessoa neste formulário.
      const { error: assignErr } = await supabase.from('survey_form_assignments').insert({
        form_id: formId,
        user_id: resp.user_id,
        assigned_by: session?.id ?? null,
      });
      if (assignErr) {
        // Acesso criado, mas falhou a autorização — avisa (dá pra marcar na lista).
        toast.error(
          `Acesso criado, mas falhou ao autorizar no formulário: ${assignErr.message}. Marque manualmente na lista.`,
        );
      }

      setResult({
        email: resp.email ?? email.trim(),
        temporary_password: resp.temporary_password ?? '123456',
        login_url: resp.login_url ?? window.location.origin,
      });
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao convidar.');
    } finally {
      setSaving(false);
    }
  }

  const accessText = result
    ? `Acesso ao Vórtice (Entrevistador)\nE-mail: ${result.email}\nSenha temporária: ${result.temporary_password}\nLink: ${result.login_url}\n\nNo primeiro acesso a senha precisará ser alterada.`
    : '';

  async function copyAccess() {
    await navigator.clipboard.writeText(accessText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(accessText)}`, '_blank', 'noopener');
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-5">
          <SheetTitle>Convidar entrevistador</SheetTitle>
          <SheetDescription>
            Cria o acesso (perfil Entrevistador) e já autoriza a pessoa a aplicar este
            formulário. Ela verá apenas as pesquisas designadas a ela.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-primary">
                <Check className="h-4 w-4" /> Acesso criado e autorizado!
              </p>
              <div className="mt-3 space-y-1 text-foreground">
                <p>
                  <span className="text-muted-foreground">E-mail:</span> {result.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Senha temporária:</span>{' '}
                  <span className="font-mono">{result.temporary_password}</span>
                </p>
                <p className="truncate">
                  <span className="text-muted-foreground">Link:</span> {result.login_url}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void copyAccess()} variant="secondary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar dados'}
              </Button>
              <Button onClick={shareWhatsApp}>
                <MessageSquare className="h-4 w-4" /> Enviar via WhatsApp
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={reset}>
                Convidar outro
              </Button>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nome completo *</Label>
              <Input
                id="inv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do entrevistador"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail *</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-phone">Telefone / WhatsApp (opcional)</Label>
              <Input
                id="inv-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 90000-0000"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleInvite()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Convidar e autorizar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

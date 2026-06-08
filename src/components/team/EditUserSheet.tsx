// ============================================================================
// EditUserSheet — edita campos do profile (full_name + phone) + permite
// regenerar o link de acesso (senha temp + URL pra reenviar via WhatsApp).
// ----------------------------------------------------------------------------
// Diferenças do ProvisionSheet:
//   • Não cria user — edita existente
//   • Email read-only (mudar email auth.users tem implicações de login)
//   • Botão "Reenviar link de acesso" → chama edge function regenerate-access-link
//   • Após regenerar, mostra card com email/senha_temp/URL + botões copiar
//     (mesmo padrão visual do ProvisionSheet pra consistência)
//
// Permissões (gateadas na UI E na edge function):
//   • Editar profile: super_admin OU admin/coord da campanha do target
//   • Reenviar link: super_admin OU admin (coord NÃO — coordinator é
//     intencionalmente excluído por decisão do produto)
//
// Guard frontend: o botão "Reenviar link" não aparece quando o user logado
// está editando a si mesmo (evita logout imediato — a edge function tem
// o mesmo guard server-side, defesa em profundidade).
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Save,
  Loader2,
  Send,
  Copy,
  Check,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
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
import { AvatarUpload } from '@/components/team/AvatarUpload';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';

interface EditUserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User alvo da edição. Quando null, sheet fica vazio (caller controla open). */
  target: {
    user_id: string;
    full_name: string;
    phone: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  /** Callback após save bem-sucedido (pai re-fetch profiles, mostra toast etc). */
  onSaved?: (patch: { full_name: string; phone: string | null }) => void;
}

/**
 * Card de credenciais devolvido pela edge function regenerate-access-link.
 * Mesma forma do ProvisionResult — mantido sincronizado pra UX consistente.
 */
interface RegenResult {
  user_email: string;
  temporary_password: string;
  login_url: string;
}

export function EditUserSheet({ open, onOpenChange, target, onSaved }: EditUserSheetProps) {
  const session = useEffectiveSession();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<RegenResult | null>(null);
  const [copied, setCopied] = useState<'email' | 'password' | 'link' | null>(null);

  // Pré-preenche quando abre (ou quando o target muda enquanto aberto).
  // Limpa o card de regen ao mudar de target.
  useEffect(() => {
    if (!open || !target) return;
    setFullName(target.full_name ?? '');
    setPhone(target.phone ?? '');
    setRegenResult(null);
  }, [open, target]);

  // Reset estado ao fechar — evita vazar dados/cards entre aberturas.
  useEffect(() => {
    if (!open) {
      setRegenResult(null);
      setCopied(null);
    }
  }, [open]);

  if (!target) return null;

  // Guard: usuário logado editando a si mesmo NÃO vê o botão regenerar
  // (faria logout imediato — backend também bloqueia, mas evita o request).
  const isSelf = session?.id === target.user_id;
  // Reenvio é só admin OU super_admin (coordinator excluído por design).
  const canRegenerate =
    !isSelf && (session?.is_super_admin || session?.role === 'admin');

  async function saveProfile() {
    if (!target) return;
    if (!fullName.trim()) {
      toast.error('Nome completo é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', target.user_id);
      if (error) {
        toast.error(`Falha ao salvar: ${error.message}`);
        return;
      }
      toast.success('Dados atualizados.');
      onSaved?.({ full_name: fullName.trim(), phone: phone.trim() || null });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function regenerateLink() {
    if (!target || !canRegenerate) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-access-link', {
        body: { user_id: target.user_id },
      });
      if (error) {
        toast.error(error.message || 'Falha ao regenerar acesso.');
        return;
      }
      const resp = data as { ok?: boolean; error?: string } & Partial<RegenResult>;
      if (!resp?.ok || !resp.user_email || !resp.temporary_password || !resp.login_url) {
        toast.error(resp?.error || 'Resposta inesperada do servidor.');
        return;
      }
      setRegenResult({
        user_email: resp.user_email,
        temporary_password: resp.temporary_password,
        login_url: resp.login_url,
      });
      toast.success('Link regenerado. Copie e envie ao usuário.');
    } finally {
      setRegenerating(false);
    }
  }

  async function copyToClipboard(text: string, what: 'email' | 'password' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>Editar usuário</SheetTitle>
          <SheetDescription>
            Atualize o nome e telefone, ou reenvie o link de acesso com nova senha temporária.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Avatar — usa o mesmo componente da lista, edição inline com click */}
          <div className="flex flex-col items-center gap-2">
            <AvatarUpload
              userId={target.user_id}
              name={target.full_name || target.email}
              currentUrl={target.avatar_url}
              canEdit={true}
              size="lg"
            />
            <p className="text-[11px] text-muted-foreground">
              Clique na foto para trocar
            </p>
          </div>

          {/* E-mail — read-only com aviso visual */}
          <div className="space-y-2">
            <Label htmlFor="email-ro">E-mail</Label>
            <Input
              id="email-ro"
              value={target.email}
              readOnly
              disabled
              className="bg-vortex-bg/40 text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">
              E-mail não pode ser editado nesta tela (vincula login). Para trocar,
              fale com o suporte.
            </p>
          </div>

          {/* Nome completo */}
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Nome completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(31) 99999-9999"
            />
          </div>

          {/* Card de credenciais regeneradas (aparece após click em Reenviar) */}
          {regenResult ? (
            <div className="rounded-lg border border-vortex-violet/40 bg-vortex-violet/10 p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium text-vortex-violet">
                <KeyRound className="h-4 w-4" />
                Acesso regenerado — envie ao usuário
              </div>
              <CredField
                label="E-mail"
                value={regenResult.user_email}
                onCopy={() => copyToClipboard(regenResult.user_email, 'email')}
                copied={copied === 'email'}
              />
              <CredField
                label="Senha temporária"
                value={regenResult.temporary_password}
                onCopy={() => copyToClipboard(regenResult.temporary_password, 'password')}
                copied={copied === 'password'}
                mono
              />
              <CredField
                label="Link de acesso"
                value={regenResult.login_url}
                onCopy={() => copyToClipboard(regenResult.login_url, 'link')}
                copied={copied === 'link'}
                mono
              />
              <p className="text-[11px] text-vortex-violet/80">
                O usuário será forçado a trocar a senha no primeiro login.
              </p>
            </div>
          ) : null}

          {/* Aviso quando bloqueado (auto-edição) */}
          {isSelf ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Você está editando seu próprio cadastro. O botão de regenerar acesso fica
                indisponível pra evitar logout. Para trocar sua senha, use o perfil.
              </span>
            </div>
          ) : null}

          {/* Footer com 3 botões: cancelar / regenerar (se permitido) / salvar */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || regenerating}
            >
              Fechar
            </Button>
            {canRegenerate ? (
              <Button
                type="button"
                variant="outline"
                onClick={regenerateLink}
                disabled={saving || regenerating}
                className="border-vortex-violet/40 text-vortex-violet hover:bg-vortex-violet/10 hover:text-vortex-violet"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {regenerating ? 'Regerando…' : 'Reenviar link de acesso'}
              </Button>
            ) : null}
            <Button type="button" onClick={saveProfile} disabled={saving || regenerating}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------------------
// Sub-componente local: campo + botão de copiar (reusado nos 3 itens do card
// de credenciais regeneradas).
// ----------------------------------------------------------------------------
function CredField({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-vortex-violet/80">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={
            'min-w-0 flex-1 rounded-md border border-vortex-violet/30 bg-vortex-bg/40 px-2.5 py-1.5 text-xs text-foreground/90 outline-none ' +
            (mono ? 'font-mono' : '')
          }
        />
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md border border-vortex-violet/30 bg-vortex-bg/40 px-2 py-1.5 text-vortex-violet hover:bg-vortex-violet/10"
          aria-label={`Copiar ${label.toLowerCase()}`}
          title="Copiar"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

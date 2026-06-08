import { useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Copy, Link2, Mail, MessageCircle, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Liderança alvo do convite. Só precisamos do nome (para personalizar a
   * mensagem) e do invite_code (para montar a URL pública /convite/[code]).
   */
  supporter: {
    name: string;
    invite_code: string;
  } | null;
  /**
   * Quando preenchido, a mensagem do convite referencia a CAMPANHA (ex.:
   * "rede de apoiadores de João Silva") em vez do indicador. Usado pelo
   * botão flutuante "Convidar Liderança" — convite genérico onde o
   * recipient não conhece o admin/coord que está enviando, mas reconhece
   * o nome do candidato.
   *
   * Quando undefined, mantém a mensagem antiga ("Olá, [nome]!") usada
   * pelo botão "Convidar" no card de cada liderança individual.
   */
  campaignName?: string;
}

/**
 * Modal de compartilhamento do link de convite (auto-cadastro via /convite/[code]).
 *
 * 4 canais (botões grandes):
 *   - WhatsApp (verde)  → wa.me com texto pré-preenchido
 *   - SMS      (azul)   → sms:?body=
 *   - E-mail   (laranja)→ mailto: com subject + body
 *   - Copiar   (roxo)   → navigator.clipboard + toast
 *
 * Acima dos botões: input read-only com a URL completa e um botão 📋 inline
 * para copiar só a URL (separado do botão grande "Copiar Link").
 *
 * Migration 047 — a URL pública aceita o invite_code uma única vez; quando
 * consumida o backend grava supporters.invite_used_at. Por isso o card de
 * Lideranças esconde o botão "Convidar" para códigos já usados (opção A).
 */
export function InviteModal({ open, onClose, supporter, campaignName }: InviteModalProps) {
  // URL completa do convite. window.location.origin funciona em dev (vite),
  // staging (Railway preview) e prod sem precisar de variável de ambiente.
  const inviteUrl = useMemo(() => {
    if (!supporter?.invite_code) return '';
    // Em SSR não há `window`; em runtime do browser sempre há.
    if (typeof window === 'undefined') return `/convite/${supporter.invite_code}`;
    return `${window.location.origin}/convite/${supporter.invite_code}`;
  }, [supporter?.invite_code]);

  // Mensagem padrão usada no WhatsApp, SMS e corpo do e-mail.
  //
  // Dois modos:
  //  • Genérico (campaignName presente, vindo do FAB "Convidar Liderança"):
  //    referencia o CANDIDATO porque o recipient não conhece o admin/coord
  //    que está enviando, mas reconhece o nome do candidato.
  //  • Individual (campaignName undefined, vindo do botão "Convidar" no card):
  //    saúda o destinatário pelo primeiro nome — o card é da liderança que
  //    vai ser convidada, então temos o nome dela.
  const message = useMemo(() => {
    if (campaignName) {
      return (
        `Você foi convidado(a) para fazer parte da rede de apoiadores de ${campaignName}.\n` +
        `Clique no link abaixo para criar seu acesso (leva menos de 1 minuto):\n\n` +
        `${inviteUrl}`
      );
    }
    const name = supporter?.name?.split(' ')[0] ?? '';
    const saudacao = name ? `Olá, ${name}!` : 'Olá!';
    return (
      `${saudacao}\n\n` +
      `Você foi convidado(a) a fazer parte da nossa rede de apoiadores.\n` +
      `Clique no link abaixo para criar seu acesso (leva menos de 1 minuto):\n\n` +
      `${inviteUrl}`
    );
  }, [campaignName, supporter?.name, inviteUrl]);

  async function copyToClipboard(text: string, successLabel: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successLabel);
    } catch {
      toast.error('Não foi possível copiar — copie manualmente.');
    }
  }

  function openWhatsApp() {
    // wa.me aceita texto via querystring; encodeURIComponent cuida das quebras
    // de linha e caracteres especiais.
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openSms() {
    // sms:?body= é o esquema universal (iOS/Android). No desktop o handler
    // pode não existir e o navegador simplesmente ignora — comportamento aceito.
    const url = `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = url;
  }

  function openEmail() {
    // No modo genérico (FAB), o "alvo" é a campanha — usa o nome do candidato
    // como suffix do subject. No modo individual, o subject usa o nome da
    // liderança alvo do convite.
    const subject = campaignName
      ? `Convite para a rede de apoiadores — ${campaignName}`
      : supporter?.name
        ? `Convite para a rede de apoiadores — ${supporter.name}`
        : 'Convite para a rede de apoiadores';
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = url;
  }

  // O modal é controlado: open vem do pai; onOpenChange(false) → onClose().
  // Não desmontamos quando supporter é null para evitar flash na transição
  // de fechamento — o conteúdo simplesmente fica vazio durante o fade-out.
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-vortex-border bg-vortex-surface p-6 shadow-2xl">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                Convidar liderança
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {campaignName
                  ? `Compartilhe o link da campanha de ${campaignName} via:`
                  : supporter?.name
                    ? `Compartilhe o link com ${supporter.name} via:`
                    : 'Compartilhe o link via:'}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-vortex-bg/60 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* URL completa + botão de copiar inline. Read-only para o usuário
              poder selecionar tudo com triple-click se preferir. */}
          <label className="mt-4 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Link do convite
          </label>
          <div className="mt-1 flex items-stretch gap-1.5">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-vortex-border bg-vortex-bg/40 px-3 py-2 font-mono text-xs text-foreground/90 outline-none focus:border-primary/60"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(inviteUrl, 'Link copiado!')}
              aria-label="Copiar link"
              title="Copiar link"
              className="shrink-0 rounded-md border border-vortex-border bg-vortex-bg/40 px-2.5 text-muted-foreground transition-colors hover:bg-vortex-bg/80 hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {/* 4 canais. Grid 2x2 no mobile, 4 colunas largas no desktop. As cores
              são inline (style) porque são fora da paleta padrão do tailwind
              do projeto (verde do WhatsApp, azul/laranja/roxo livres). */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ChannelButton
              label="WhatsApp"
              icon={<MessageCircle className="h-5 w-5" />}
              onClick={openWhatsApp}
              bg="#25D366"
              fg="#0b1f10"
            />
            <ChannelButton
              label="SMS"
              icon={<MessageSquare className="h-5 w-5" />}
              onClick={openSms}
              bg="#2563EB"
              fg="#FFFFFF"
            />
            <ChannelButton
              label="E-mail"
              icon={<Mail className="h-5 w-5" />}
              onClick={openEmail}
              bg="#EA580C"
              fg="#FFFFFF"
            />
            <ChannelButton
              label="Copiar Link"
              icon={<Link2 className="h-5 w-5" />}
              onClick={() => copyToClipboard(inviteUrl, 'Link copiado!')}
              bg="#7C3AED"
              fg="#FFFFFF"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Botão grande de canal. Mantido local — só é usado dentro deste modal e
 * a customização de cor inline justifica não virar primitive global.
 */
function ChannelButton({
  label,
  icon,
  onClick,
  bg,
  fg,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  bg: string;
  fg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg px-3 py-3.5 text-xs font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: bg, color: fg }}
    >
      {icon}
      {label}
    </button>
  );
}

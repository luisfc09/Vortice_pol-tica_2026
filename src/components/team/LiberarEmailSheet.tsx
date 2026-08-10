import { useState } from 'react';
import { KeyRound, Loader2, Trash2 } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { isMockMode } from '@/lib/data';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Liberar e-mail travado" — exclui uma conta ÓRFÃ pelo e-mail.
 *
 * Cenário: a pessoa foi removida de Lideranças e de Usuários, mas o login no
 * Auth sobrou (conta órfã), travando o e-mail em novos convites com "already
 * registered". Como ela não aparece mais em nenhuma lista, não há linha pra
 * clicar "Excluir conta" — esta ferramenta acha a conta pelo e-mail e apaga.
 *
 * Só apaga o login se a pessoa não estiver em NENHUMA campanha (garantido pela
 * edge delete-user). Autorização: admin/coord da campanha ou super admin.
 */
export function LiberarEmailSheet({ open, onOpenChange }: Props) {
  const session = useEffectiveSession();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (!session?.campaign) {
      toast.error('Nenhuma campanha ativa.');
      return;
    }
    setSubmitting(true);
    try {
      if (isMockMode()) {
        toast.success('E-mail liberado (modo demonstração).');
        setEmail('');
        onOpenChange(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { email: clean, campaign_id: session.campaign.id },
      });
      if (error) {
        let msg = 'Falha ao liberar o e-mail.';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const b = (await ctx.json()) as { error?: string };
            if (b?.error) msg = b.error;
          } catch {
            /* corpo não-JSON */
          }
        } else if (error.message) {
          msg = error.message;
        }
        toast.error(msg);
        return;
      }
      const resp = data as { ok?: boolean; deletedAuth?: boolean; warning?: string };
      if (!resp?.ok) {
        toast.error('Não foi possível liberar o e-mail.');
        return;
      }
      if (resp.warning) toast.warning(resp.warning);
      else if (resp.deletedAuth)
        toast.success('Conta excluída. O e-mail está livre para um novo convite.');
      else
        toast.warning(
          'A pessoa ainda está vinculada a outra campanha — o login foi mantido. Remova-a de lá primeiro.',
        );
      setEmail('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Liberar e-mail travado
          </SheetTitle>
          <SheetDescription>
            Use quando uma pessoa foi excluída mas o e-mail dela continua dando “já
            cadastrado” ao reenviar o convite. Isso apaga a conta de login órfã e
            libera o e-mail. Não pode ser desfeito.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="liberar-email">E-mail</Label>
            <Input
              id="liberar-email"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="pessoa@email.com"
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {submitting ? 'Liberando…' : 'Excluir conta e liberar e-mail'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

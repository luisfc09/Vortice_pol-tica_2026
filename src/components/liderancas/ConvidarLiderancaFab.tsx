import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { useMySupporter } from '@/hooks/useMySupporter';
import { InviteModal } from '@/components/liderancas/InviteModal';
import type { UserRole } from '@/types';

/**
 * Roles autorizados a usar o convite genérico da campanha. Researcher,
 * supporter e leader NÃO veem o botão — convites pra essas funções não
 * fazem sentido (researcher é leitura, supporter/leader já estão na ponta).
 */
const ALLOWED_ROLES = ['admin', 'candidate', 'coordinator'] as const satisfies readonly UserRole[];

/**
 * FAB (floating action button) que abre o `InviteModal` com o invite_code
 * do próprio usuário logado — link de convite "genérico" da campanha.
 *
 * Quem clica vira raiz/pai das lideranças que se cadastrarem pelo link.
 * Se o user ainda não tem linha em `supporters`, `useMySupporter().ensure()`
 * cria silenciosamente na primeira chamada (ver hook pra detalhes).
 *
 * Posicionamento: `fixed bottom-24 right-5 z-40` — fica ACIMA do
 * `CarlosDrawer` (que está em `bottom-5 right-5 h-14 w-14`, ~76px ocupado),
 * com folga de ~20px entre os dois. Ambos no mesmo `z-40` (não competem
 * com overlays de modal em `z-50`).
 */
export function ConvidarLiderancaFab() {
  const session = useEffectiveSession();
  const { ensure } = useMySupporter();

  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<{ name: string; invite_code: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Gate de visibilidade — fora dos roles permitidos OU sem campanha, some.
  if (!session?.role || !ALLOWED_ROLES.includes(session.role as (typeof ALLOWED_ROLES)[number])) {
    return null;
  }
  if (!session.campaign) return null;

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const mine = await ensure();
      // Defensivo: invite_code é gerado pelo default do banco, então o
      // INSERT acima sempre devolve com ele preenchido. Mas em casos de
      // schema desatualizado (PostgREST cache stale) pode vir undefined.
      if (!mine.invite_code) {
        toast.error('Sem invite_code gerado. Recarregue a página.');
        return;
      }
      setTarget({ name: mine.name, invite_code: mine.invite_code });
      setModalOpen(true);
    } catch (e) {
      // Erros típicos aqui: RLS bloqueando INSERT (improvável — o user
      // está logado), ou rede caída. Toast genérico já basta — o erro
      // real vai pro console pra debug.
      // eslint-disable-next-line no-console
      console.error('[ConvidarLiderancaFab] ensure() falhou:', e);
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar link de convite');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label="Convidar nova liderança via link público"
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        Convidar Liderança
      </button>

      <InviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        supporter={target}
      />
    </>
  );
}

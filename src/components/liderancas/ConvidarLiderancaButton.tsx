import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
 * Botão inline "Convidar Liderança" — abre o `InviteModal` com o invite_code
 * do próprio usuário logado (link genérico da campanha).
 *
 * Histórico: começou como FAB (canto inferior direito, fixed). Em 2026-06-08
 * foi promovido pro toolbar do topo da página /liderancas, ao lado do botão
 * "Nova liderança", por pedido do usuário (mais descoberto, padrão de UX
 * mais consistente com as outras ações da página).
 *
 * Lógica preservada do FAB:
 *   • Quem clica vira raiz/pai das lideranças que se cadastrarem pelo link.
 *   • Se o user ainda não tem linha em `supporters`, `useMySupporter().ensure()`
 *     cria silenciosamente na primeira chamada.
 *   • Loading spinner enquanto resolve o supporter próprio.
 *
 * Renderiza `null` quando o role não tem permissão ou não há campanha ativa —
 * pai não precisa gateiar.
 */
export function ConvidarLiderancaButton() {
  const session = useEffectiveSession();
  const { ensure } = useMySupporter();

  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<{ name: string; invite_code: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Gate de visibilidade. Sem campanha ativa, some.
  if (!session?.campaign) return null;
  // Super admin (god-mode) vê sempre — mesmo sem membership na campanha
  // (role === null). Senão, só os roles permitidos.
  const isSuperAdmin = session.is_super_admin === true;
  if (
    !isSuperAdmin &&
    (!session.role || !ALLOWED_ROLES.includes(session.role as (typeof ALLOWED_ROLES)[number]))
  ) {
    return null;
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const mine = await ensure();
      // Defensivo: invite_code vem do default do banco, então o INSERT
      // sempre devolve com ele preenchido. Mas em casos de schema stale
      // (PostgREST cache) pode vir undefined.
      if (!mine.invite_code) {
        toast.error('Sem invite_code gerado. Recarregue a página.');
        return;
      }
      setTarget({ name: mine.name, invite_code: mine.invite_code });
      setModalOpen(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ConvidarLiderancaButton] ensure() falhou:', e);
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar link de convite');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        aria-label="Convidar nova liderança via link público"
        // Lilás (#A78BFA) da paleta Vórtice — distingue visualmente do
        // verde-lima do "Nova liderança" (ação primária de cadastro
        // manual) e marca esta como ação alternativa de captação por
        // link. Texto dark (#0A0F1E = vortex-bg) garante contraste AA.
        className="bg-vortex-violet text-vortex-bg hover:bg-vortex-violet/90"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Convidar Liderança
      </Button>

      <InviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        supporter={target}
        // Convite genérico: mensagem referencia o nome do candidato
        // (recipient não conhece o admin/coord, mas reconhece o candidato).
        // session.campaign já está garantida não-null pelo gate acima.
        campaignName={session.campaign.candidate_name}
      />
    </>
  );
}

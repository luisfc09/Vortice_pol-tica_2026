import { useCallback, useMemo } from 'react';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { collections, useCollection } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import type { Supporter } from '@/types';

/**
 * Hook que devolve o supporter vinculado ao usuário logado (linha em
 * `supporters` onde `created_by = session.id`).
 *
 * Cenário de uso principal: botão flutuante "Convidar Liderança" na
 * página de Lideranças. Admin/candidato/coord precisa de um `invite_code`
 * próprio pra que novos cadastros via `/convite/[code]` caiam na rede dele
 * como `referrer_id` (e apareçam em "Minha Rede" do admin).
 *
 * Regras de design:
 * - Quem cadastra-se via `accept-invite` ganha automaticamente um supporter
 *   com `created_by = novo_user_id` — então JÁ tem registro.
 * - Quem foi provisionado via `provision-user` (admins/candidatos/coords)
 *   NÃO tem registro em `supporters` por padrão — `ensure()` cria silenciosamente
 *   na primeira chamada, com `role='outro' + role_custom='Equipe da campanha'`,
 *   `referrer_id=null` (raiz da árvore) e `status='ativo'`. O `invite_code`
 *   vem do default do banco (8 chars hex via md5).
 *
 * Retorno:
 * - `supporter`: o registro encontrado (ou `null` se ainda não existe)
 * - `ensure()`: idempotente. Se já existe, devolve o existente. Se não,
 *   cria via INSERT direto (não usa `collections.create` porque precisamos
 *   do `id`/`invite_code` reais — `collections.create` devolve tempUuid
 *   otimista). Após o INSERT, o realtime do `SupabaseCollection` propaga
 *   a nova linha automaticamente.
 */
export function useMySupporter() {
  const session = useEffectiveSession();
  const supporters = useCollection(collections.supporters);

  // Encontra o supporter cujo created_by bate com o user logado. Mesmo
  // padrão de MinhaRede.tsx — mantido sincronizado.
  //
  // ⚠️ Pegadinha: `created_by` tem 2 semânticas que colidem — "este supporter
  // É o user X" (accept-invite ou ensure()) E "este supporter foi cadastrado
  // pelo user X" (cadastros manuais). Fix do "mais antigo" (commit a50ff31)
  // resolve só pra users que vieram via accept-invite. Para users
  // PROVISIONADOS (admin/coord/researcher sem invite), eles NUNCA tiveram
  // seu próprio supporter criado automaticamente — então o "mais antigo"
  // pega o primeiro supporter que ELES cadastraram (ex.: Wallison),
  // e o link gerado fica em nome do Wallison em vez do user.
  //
  // Fix definitivo: identificar o "próprio supporter" exigindo TAMBÉM
  // email match — o supporter cujo email === session.email É o próprio
  // user (accept-invite/ensure setam email = auth.email; cadastros manuais
  // setam email da liderança alvo).
  //
  // Se nenhum casar, ensure() cria um novo supporter pro user com email
  // = session.email — daí pra frente o casamento funciona.
  const supporter = useMemo<Supporter | null>(() => {
    if (!session) return null;
    const sessionEmail = session.email?.toLowerCase().trim();
    if (!sessionEmail) return null;
    const mine = supporters.filter(
      (s) =>
        s.created_by === session.id &&
        s.email?.toLowerCase().trim() === sessionEmail,
    );
    if (mine.length === 0) return null;
    return mine.reduce((oldest, s) =>
      +new Date(s.created_at) < +new Date(oldest.created_at) ? s : oldest,
    );
  }, [supporters, session]);

  const ensure = useCallback(async (): Promise<Supporter> => {
    if (supporter) return supporter;
    if (!session || !session.campaign) {
      throw new Error('Sem sessão ou campanha ativa');
    }

    // Nome: prefere o full_name do profile; se vazio, cai pro email.
    // Campos opcionais ficam null — o supporter "fantasma" do admin não
    // precisa de endereço/cargo político/redes sociais.
    const payload = {
      campaign_id: session.campaign.id,
      name: session.profile.full_name || session.email,
      email: session.email,
      phone: session.profile.phone ?? null,
      role: 'outro' as const,
      role_custom: 'Equipe da campanha',
      status: 'ativo' as const,
      referrer_id: null,
      created_by: session.id,
    };

    const { data, error } = await supabase
      .from('supporters')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('INSERT não retornou linha');
    return data as Supporter;
  }, [supporter, session]);

  return { supporter, ensure };
}

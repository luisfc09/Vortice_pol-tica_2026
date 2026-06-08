// ============================================================================
// RankingRede — card gamificado em /minha-rede com Top 5 da campanha
// (ranqueado por indicações diretas) + linha destacada do usuário logado.
// ----------------------------------------------------------------------------
// Desempate: pip_score (peso da sub-árvore com decay 0.8^depth) — quem tem
// mais descendência indireta vem antes em caso de empate de filhos diretos.
//
// Otimização: `byParent` (index Map) calculado UMA vez via useMemo e
// reaproveitado em todos os cálculos (computePipScore + filhos diretos).
// Sem isso, com 100 supporters seriam 10k iterações por render. Com cache
// vira O(N) — escala até ~500-1000 supporters sem stutter.
//
// Estados renderizados (na ordem de avaliação):
//   1. supporters.length === 0    → SKELETON (provavelmente carregando)
//   2. ranking.length === 0       → EMPTY (ninguém tem indicações ainda)
//   3. caso comum                 → Top 5 + linha do user (se ele não
//                                    estiver no top 5, vai abaixo com
//                                    separador tracejado)
// ============================================================================

import { useMemo } from 'react';
import { Trophy, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  classifyInfluencia,
  computePipScore,
  indexByParent,
} from '@/lib/hierarchy';
import {
  NIVEL_INFLUENCIA_LABEL,
  type NivelInfluencia,
  type Supporter,
} from '@/types';

// Reutilizado em MinhaRede.tsx — se evoluir, sincronizar nos 2 lugares.
const NIVEL_BADGE_CLASS: Record<NivelInfluencia, string> = {
  baixo: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
  medio: 'border-slate-400/30 bg-slate-400/15 text-slate-200',
  alto: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  muito_alto: 'border-vortex-violet/40 bg-vortex-violet/15 text-vortex-violet',
};

interface RankingRow {
  id: string;
  displayName: string;
  indicacoes: number;
  pipScore: number;
  nivel: NivelInfluencia;
  isMe: boolean;
}

interface RankingRedeProps {
  /** Supporter do usuário logado (resolvido em MinhaRede via created_by). */
  me: Supporter;
  /** Lista completa de supporters da campanha (do useCollection). */
  supporters: Supporter[];
  /** Callback opcional pra abrir o modal/sheet de convite quando vazio. */
  onInvite?: () => void;
}

/**
 * Formata o nome de exibição: primeiro nome + inicial do último sobrenome.
 *   "Wallison Barros dos Santos" → "Wallison S."
 *   "Maria da Silva"             → "Maria S."
 *   "Maria"                      → "Maria"
 */
function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

/** Medalhas pra top 3, número simples pra 4 e 5. */
function positionBadge(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

export function RankingRede({ me, supporters, onInvite }: RankingRedeProps) {
  // Index parent → children calculado uma vez. Todos os cálculos abaixo
  // dependem dele (filhos diretos + computePipScore internamente).
  const byParent = useMemo(() => indexByParent(supporters), [supporters]);

  // Ranking completo da campanha — todos com pelo menos 1 indicação OU o
  // próprio usuário (pra garantir que ele aparece mesmo zerado, abaixo do
  // separador). Ordenação por indicações desc, desempate por pip_score desc.
  const ranking = useMemo<RankingRow[]>(() => {
    const rows = supporters.map<RankingRow>((s) => {
      const indicacoes = byParent.get(s.id)?.length ?? 0;
      const pipScore = computePipScore(supporters, s.id);
      return {
        id: s.id,
        displayName: formatDisplayName(s.name),
        indicacoes,
        pipScore,
        nivel: classifyInfluencia(pipScore),
        isMe: s.id === me.id,
      };
    });
    return rows
      .filter((r) => r.indicacoes > 0 || r.isMe)
      .sort((a, b) => {
        if (b.indicacoes !== a.indicacoes) return b.indicacoes - a.indicacoes;
        // Desempate por pip_score (descendência profunda conta).
        return b.pipScore - a.pipScore;
      });
  }, [supporters, byParent, me.id]);

  const top5 = ranking.slice(0, 5);
  const myIndex = ranking.findIndex((r) => r.isMe);
  const myPosition = myIndex >= 0 ? myIndex + 1 : null;
  const myData = myIndex >= 0 ? ranking[myIndex] : null;
  const isUserInTop5 = myPosition !== null && myPosition <= 5;

  // Estado 1: ainda carregando (supporters vazio) — improvável dado que
  // MinhaRede só renderiza essa página se `me` existe, mas defensivo.
  if (supporters.length === 0) {
    return <SkeletonCard />;
  }

  // Estado 2: ranking vazio — ninguém tem indicações. Mostra CTA pro user
  // ser o primeiro. (rankings.length sempre >= 1 quando o user existe — ele
  // mesmo entra por isMe — então isso só dispara se filtrou tudo.)
  const hasAnyIndicacoes = ranking.some((r) => r.indicacoes > 0);
  if (!hasAnyIndicacoes) {
    return (
      <Card>
        <Header />
        <div className="rounded-lg border border-dashed border-vortex-border bg-vortex-bg/30 px-3 py-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Seja o primeiro a convidar alguém pra sua rede!
          </p>
          {onInvite ? (
            <Button size="sm" onClick={onInvite}>
              Convidar agora <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  // Mensagem dinâmica do próximo passo (linha do user no rodapé)
  let nextStep = '';
  if (myData && myPosition !== null) {
    if (myPosition === 1) {
      nextStep = 'Você lidera a rede! 🏆';
    } else if (isUserInTop5) {
      nextStep = 'Você está no Top 5! 🎉';
    } else if (myData.indicacoes === 0) {
      nextStep = 'Convide alguém para aparecer no ranking.';
    } else {
      const above = ranking[myIndex - 1];
      const gap = above.indicacoes - myData.indicacoes + 1;
      nextStep = `Faltam ${gap} para alcançar o #${myPosition - 1}.`;
    }
  }

  return (
    <Card>
      <Header />

      <ul className="space-y-1.5">
        {top5.map((row, i) => (
          <RankRow key={row.id} row={row} position={i + 1} />
        ))}
      </ul>

      {/* Linha do user — só aparece se NÃO está no top 5. Caso contrário a
          linha dele já está no <ul> acima (com destaque visual via isMe). */}
      {!isUserInTop5 && myData && myPosition !== null ? (
        <>
          <div className="my-3 border-t border-dashed border-vortex-border" />
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-primary">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Você — #{myPosition}
                </p>
                <p className="text-[11px] text-muted-foreground">{nextStep}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {myData.indicacoes} ind.
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  NIVEL_BADGE_CLASS[myData.nivel],
                )}
              >
                {NIVEL_INFLUENCIA_LABEL[myData.nivel]}
              </span>
            </div>
          </div>
        </>
      ) : null}

      {/* Se está no top 5, mostra a próxima ação como rodapé */}
      {isUserInTop5 && nextStep ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">{nextStep}</p>
      ) : null}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Sub-componentes locais (ranking-only — não vazam pro resto do projeto)
// ----------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      {children}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Trophy className="h-4 w-4 text-amber-400" />
      <h3 className="font-display text-lg">Ranking da Rede</h3>
    </div>
  );
}

function RankRow({ row, position }: { row: RankingRow; position: number }) {
  const badge = positionBadge(position);
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        row.isMe
          ? 'border border-primary/30 bg-primary/10'
          : 'border border-transparent hover:bg-vortex-bg/30',
      )}
    >
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center',
          position <= 3 ? 'text-base' : 'text-xs font-semibold text-muted-foreground',
        )}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {row.isMe ? <>{row.displayName} <span className="text-primary">(você)</span></> : row.displayName}
        </p>
      </div>
      <span className="shrink-0 text-sm text-foreground/90">
        {row.indicacoes} ind.
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
          NIVEL_BADGE_CLASS[row.nivel],
        )}
      >
        {NIVEL_INFLUENCIA_LABEL[row.nivel]}
      </span>
    </li>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <Header />
      <ul className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            aria-hidden="true"
          >
            <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-vortex-bg/60" />
            <div className="h-4 flex-1 animate-pulse rounded bg-vortex-bg/60" />
            <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-vortex-bg/60" />
            <div className="h-4 w-14 shrink-0 animate-pulse rounded-full bg-vortex-bg/60" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

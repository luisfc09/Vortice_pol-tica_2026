// ============================================================================
// Página /minha-rede — visão restrita do supporter da sua própria pirâmide.
// ----------------------------------------------------------------------------
// Para role 'supporter' (criado via /convite/[code] na Fase 2).
//
// Mostra:
//   • Cabeçalho com seu nome + chip "Indicado por X" (se há referrer)
//   • Card "Compartilhar meu link" com o invite_code próprio:
//       - Se ainda não foi usado → botão copy do URL completo
//       - Se já foi usado → mensagem "Convite consumido. Solicite ao admin
//         um novo código." (admin precisa regenerar manualmente — fora do
//         escopo da Fase 2)
//   • Métricas: total de indicados (descendentes), profundidade, pip_score
//   • Path até a raiz (ancestrais)
//   • Sub-árvore embaixo (reusa SupporterTree componentized)
//
// Diferença pra /liderancas: filtra a árvore pra mostrar apenas:
//   - O próprio supporter
//   - Seus ancestrais (path até raiz)
//   - Seus descendentes (sub-árvore)
//
// Não mostra "primos" da rede (outros ramos).
// ============================================================================

import { useMemo, useState } from 'react';
import {
  Network,
  Copy,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  Target,
  Layers,
  Award,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { collections, useCollection } from '@/lib/data';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { cn } from '@/lib/utils';
import {
  classifyInfluencia,
  computePipScore,
  getAncestors,
  getDescendants,
  indexById,
} from '@/lib/hierarchy';
import {
  NIVEL_INFLUENCIA_LABEL,
  SUPPORTER_ROLE_LABEL,
  type NivelInfluencia,
  type Supporter,
} from '@/types';

const NIVEL_BADGE_CLASS: Record<NivelInfluencia, string> = {
  baixo: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
  medio: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  alto: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  muito_alto: 'border-vortex-violet/40 bg-vortex-violet/15 text-vortex-violet',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MinhaRedePage() {
  const session = useEffectiveSession();
  const supporters = useCollection(collections.supporters);

  // Identifica o supporter logado por created_by = session.id.
  // (Ele é o "dono" do registro porque o accept-invite criou usando o user_id
  // dele como created_by.)
  const me = useMemo<Supporter | null>(() => {
    if (!session?.id) return null;
    return supporters.find((s) => s.created_by === session.id) ?? null;
  }, [supporters, session?.id]);

  const byId = useMemo(() => indexById(supporters), [supporters]);

  const ancestors = useMemo(() => {
    if (!me) return [] as Supporter[];
    // getAncestors devolve do mais próximo (pai) ao mais distante (raiz).
    // Pra mostrar como "path", invertemos: raiz → ... → meu pai.
    return [...getAncestors(supporters, me.id)].reverse();
  }, [supporters, me]);

  const descendants = useMemo(() => {
    if (!me) return [] as Supporter[];
    return getDescendants(supporters, me.id);
  }, [supporters, me]);

  const pip = useMemo(() => (me ? computePipScore(supporters, me.id) : 0), [supporters, me]);
  const nivel = classifyInfluencia(pip);

  // -------- copy do link de convite ----------------------------------
  const [copied, setCopied] = useState(false);
  async function copyInviteLink() {
    if (!me?.invite_code) return;
    const url = `${window.location.origin}/convite/${me.invite_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado! Envie para quem você quer convidar.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar — copie o código manualmente.');
    }
  }

  // -------- empty state ----------------------------------------------
  if (!session) return null;
  if (!me) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-3xl text-foreground">Minha Rede</h2>
        <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center">
          <Network className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-medium text-foreground">Sem perfil vinculado na campanha</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua conta não está conectada a nenhuma liderança da campanha atual. Solicite ao administrador
            que vincule seu perfil ou cadastre você via convite.
          </p>
        </div>
      </div>
    );
  }

  const referrer = me.referrer_id ? byId.get(me.referrer_id) ?? null : null;
  const directChildren = supporters.filter((s) => s.referrer_id === me.id);
  const roleLabel =
    me.role === 'outro' && me.role_custom?.trim()
      ? me.role_custom
      : SUPPORTER_ROLE_LABEL[me.role] ?? me.role;
  const maxDescendantDepth = (() => {
    if (descendants.length === 0) return 0;
    // depth máxima a partir de me — usa getAncestors do descendente
    let mx = 0;
    for (const d of descendants) {
      const depth = getAncestors(supporters, d.id).findIndex((a) => a.id === me.id);
      if (depth + 1 > mx) mx = depth + 1;
    }
    return mx;
  })();

  return (
    <div className="space-y-6">
      {/* Header ------------------------------------------------------ */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-vortex-violet" />
          <h2 className="font-display text-3xl tracking-wide text-foreground">Minha Rede</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Seu lugar na pirâmide da campanha de{' '}
          <strong className="text-foreground/90">{session.campaign?.candidate_name ?? '—'}</strong>.
        </p>
      </div>

      {/* Métricas ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Indicados diretos"
          value={directChildren.length.toString()}
          accent="text-primary"
        />
        <MetricCard
          icon={Network}
          label="Rede total"
          value={descendants.length.toString()}
          accent="text-vortex-violet"
        />
        <MetricCard
          icon={Layers}
          label="Profundidade abaixo"
          value={`${maxDescendantDepth} ${maxDescendantDepth === 1 ? 'nível' : 'níveis'}`}
          accent="text-amber-400"
        />
        <MetricCard
          icon={Award}
          label="Nível"
          value={NIVEL_INFLUENCIA_LABEL[nivel]}
          accent="text-sky-400"
        />
      </div>

      {/* Card de compartilhar convite ------------------------------- */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-vortex-lime" />
          <h3 className="font-display text-lg">Convide alguém pra sua rede</h3>
        </div>
        {me.invite_used_at ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            ⚠ Seu convite já foi usado (consumido em{' '}
            {new Date(me.invite_used_at).toLocaleString('pt-BR')}). Solicite ao administrador da campanha
            que gere um novo código para você.
          </div>
        ) : me.invite_code ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie este link para uma pessoa convidá-la a entrar na campanha. <strong>Atenção:</strong>{' '}
              ele pode ser usado por uma única pessoa.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-vortex-border bg-vortex-bg/40 px-3 py-2">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs text-foreground/80">
                  {window.location.origin}/convite/{me.invite_code}
                </span>
              </div>
              <Button onClick={copyInviteLink} variant={copied ? 'outline' : 'default'} size="sm">
                {copied ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Código: <span className="font-mono">{me.invite_code}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Path até a raiz (ancestrais) -------------------------------- */}
      {ancestors.length > 0 ? (
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
          <h3 className="mb-3 font-display text-lg">Quem te trouxe</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {ancestors.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className="rounded-full border border-vortex-border bg-vortex-bg/40 px-2.5 py-1 text-xs text-foreground/90">
                  {a.name}
                </span>
                {i < ancestors.length - 1 ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
            <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              {me.name} (você)
            </span>
          </div>
          {referrer ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Indicador direto: <strong className="text-foreground/90">{referrer.name}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Sub-árvore embaixo ------------------------------------------ */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">Pessoas que você indicou</h3>
          <span className="text-xs text-muted-foreground">
            {descendants.length} no total ({directChildren.length} direta{directChildren.length === 1 ? '' : 's'})
          </span>
        </div>
        {descendants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-vortex-border bg-vortex-bg/30 px-3 py-6 text-center text-sm text-muted-foreground">
            Você ainda não indicou ninguém. Use o link acima pra convidar a primeira pessoa.
          </p>
        ) : (
          <ul className="space-y-2">
            {directChildren.map((child) => {
              const subCount = getDescendants(supporters, child.id).length;
              const childPip = computePipScore(supporters, child.id);
              const childNivel = classifyInfluencia(childPip);
              return (
                <li
                  key={child.id}
                  className="flex items-center gap-3 rounded-lg border border-vortex-border/60 bg-vortex-bg/30 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vortex-bg/60 font-display text-sm text-vortex-violet">
                    {initials(child.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{child.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[child.city, SUPPORTER_ROLE_LABEL[child.role] ?? child.role].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {subCount > 0 ? (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                      +{subCount} indireta{subCount === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      NIVEL_BADGE_CLASS[childNivel],
                    )}
                  >
                    {NIVEL_INFLUENCIA_LABEL[childNivel]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Cargo atual: <strong className="text-foreground/80">{roleLabel}</strong> · Nível pessoal:{' '}
        <strong className={cn('rounded px-1.5 py-0.5', NIVEL_BADGE_CLASS[nivel])}>
          {NIVEL_INFLUENCIA_LABEL[nivel]}
        </strong>
      </p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', accent)} />
        {label}
      </div>
      <div className={cn('mt-2 font-display text-2xl', accent)}>{value}</div>
    </div>
  );
}

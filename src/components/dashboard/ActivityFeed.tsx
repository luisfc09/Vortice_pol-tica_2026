import { UserPlus, ClipboardCheck, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collections, useCollection } from '@/lib/data';

interface Activity {
  id: string;
  kind: 'supporter' | 'voter' | 'interview';
  title: string;
  subtitle: string;
  at: string;
}

const ICONS = {
  supporter: Users,
  voter: UserPlus,
  interview: ClipboardCheck,
};

const COLORS = {
  supporter: 'bg-primary/15 text-primary',
  voter: 'bg-emerald-500/15 text-emerald-300',
  interview: 'bg-blue-500/15 text-blue-300',
};

export function ActivityFeed() {
  const supporters = useCollection(collections.supporters);
  const voters = useCollection(collections.voters);
  const interviews = useCollection(collections.interviews);

  const activities: Activity[] = [
    ...supporters.map<Activity>((s) => ({
      id: `s-${s.id}`,
      kind: 'supporter',
      title: `Nova liderança: ${s.name}`,
      subtitle: `${s.city ?? '—'}${s.neighborhood ? ` · ${s.neighborhood}` : ''}`,
      at: s.created_at,
    })),
    ...voters.map<Activity>((v) => ({
      id: `v-${v.id}`,
      kind: 'voter',
      title: `Eleitor cadastrado: ${v.name}`,
      subtitle: v.city ?? '—',
      at: v.created_at,
    })),
    ...interviews.map<Activity>((i) => ({
      id: `i-${i.id}`,
      kind: 'interview',
      title: `Entrevista de campo com ${i.voter_name}`,
      subtitle: `Receptividade ${i.receptivity_score}/5`,
      at: i.created_at,
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8);

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="border-b border-vortex-border px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Atividade recente
        </p>
        <p className="font-display text-2xl tracking-wide text-foreground">Últimos cadastros</p>
      </div>
      <ul className="divide-y divide-vortex-border">
        {activities.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            Sem atividade recente.
          </li>
        ) : (
          activities.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${COLORS[a.kind]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.subtitle}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.at), { addSuffix: true, locale: ptBR })}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

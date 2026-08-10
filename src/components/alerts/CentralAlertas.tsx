import { BellRing, CheckCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCard } from './AlertCard';
import { NudgeCard } from './NudgeCard';
import { useAlertas } from '@/hooks/useAlertas';
import { useMeusNudges } from '@/hooks/useMeusNudges';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { ALERT_PRIORITY_LABEL, type AlertPriority } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Roles que gerenciam a campanha e continuam vendo os alertas gerais
// (município inativo, meta, financeiro…). Demais (apoiador, liderança,
// pesquisador, campo) veem APENAS os nudges pessoais.
const GESTOR_ROLES = ['admin', 'coordinator', 'candidate'];

const SECTION_ORDER: AlertPriority[] = ['urgente', 'critico', 'atencao', 'info'];

const SECTION_HEAD: Record<AlertPriority, { caption: string; color: string }> = {
  urgente: { caption: 'Urgente — agir agora', color: 'text-red-300' },
  critico: { caption: 'Crítico — resolver hoje', color: 'text-orange-300' },
  atencao: { caption: 'Atenção', color: 'text-amber-300' },
  info: { caption: 'Informativos', color: 'text-sky-300' },
};

export function CentralAlertas({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const session = useEffectiveSession();
  const { buckets, counts, markRead, markResolved, markAllRead } = useAlertas();
  const { nudges } = useMeusNudges();

  // Gestor vê os alertas gerais da campanha; demais roles veem só os nudges.
  const isGestor =
    session?.is_super_admin === true ||
    (session?.role ? GESTOR_ROLES.includes(session.role) : false);

  const campaignTotal = isGestor ? counts.total : 0;
  const campaignUnread = isGestor ? counts.unread : 0;
  const campaignUrgente = isGestor ? counts.urgente : 0;

  function handleNudgeAction(route: string) {
    onOpenChange(false);
    navigate(route);
  }

  const nothing = nudges.length === 0 && campaignTotal === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Central de Alertas
          </SheetTitle>
          <SheetDescription>
            {campaignUrgente > 0 ? (
              <span>
                <span className="font-semibold text-red-300">
                  {campaignUrgente} urgente{campaignUrgente > 1 ? 's' : ''}
                </span>
                {' · '}
              </span>
            ) : null}
            {nudges.length > 0
              ? `${nudges.length} lembrete${nudges.length > 1 ? 's' : ''} pra você${
                  campaignTotal > 0 ? ` · ${campaignTotal} da campanha` : ''
                }`
              : campaignTotal > 0
                ? `${campaignTotal} aberto${campaignTotal > 1 ? 's' : ''} · ${campaignUnread} não lido${campaignUnread === 1 ? '' : 's'}`
                : 'Nenhum alerta no momento'}
          </SheetDescription>
        </SheetHeader>

        {nothing ? (
          <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-6 text-center">
            <BellRing className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">Tudo em ordem</p>
            <p className="text-xs text-muted-foreground">
              Nenhum lembrete no momento. Continue cadastrando e convidando pra
              subir no ranking.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Nudges pessoais do usuário logado — sempre no topo */}
            {nudges.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-vortex-violet" />
                  <p className="text-[11px] font-medium uppercase tracking-widest text-vortex-violet">
                    Seus lembretes
                  </p>
                </div>
                <div className="space-y-2">
                  {nudges.map((n) => (
                    <NudgeCard key={n.id} nudge={n} onAction={handleNudgeAction} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Alertas gerais da campanha — só pra gestores */}
            {isGestor && campaignUnread > 0 ? (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={markAllRead}>
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar todos como lidos
                </Button>
              </div>
            ) : null}

            {isGestor
              ? SECTION_ORDER.map((p) => {
                  const list = buckets[p];
                  if (list.length === 0) return null;
                  const head = SECTION_HEAD[p];
                  return (
                    <section key={p}>
                      <div className="mb-2 flex items-center justify-between">
                        <p
                          className={`text-[11px] font-medium uppercase tracking-widest ${head.color}`}
                        >
                          {head.caption}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {list.length} {ALERT_PRIORITY_LABEL[p].toLowerCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {list.map((a) => (
                          <AlertCard
                            key={a.id}
                            alert={a}
                            compact
                            onMarkRead={markRead}
                            onMarkResolved={markResolved}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })
              : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

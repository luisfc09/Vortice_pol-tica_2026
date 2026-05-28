import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Rocket, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PlanCards, RadioOption } from '@/components/billing/PlanCards';
import { formatPlanPrice } from '@/lib/plans';
import type { CampaignPlan } from '@/types';

interface ExpiringRow {
  id: string;
  candidate_name: string;
  trial_ends_at: string;
  days_remaining: number;
}

type BillingType = 'CREDIT_CARD' | 'PIX';

const WARN_DAYS = 14;

// Banner exibido no topo quando a campanha do user está em trial e perto de
// expirar. Super admins não veem (eles têm o card próprio em /admin/campaigns).
export function TrialBanner() {
  const session = useAuthStore((s) => s.session);
  const [info, setInfo] = useState<ExpiringRow | null>(null);
  const [open, setOpen] = useState(false);

  // estado do modal de assinatura
  const [plan, setPlan] = useState<CampaignPlan>('intermediario');
  const [billing, setBilling] = useState<BillingType>('CREDIT_CARD');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (USE_MOCKS) return;
      if (!session?.campaign) return;
      if (session.campaign.status !== 'trial') return;
      if (session.is_super_admin) return; // ele tem visão própria

      const { data, error } = await supabase.rpc('trial_campaigns_expiring', {
        p_days: WARN_DAYS,
      });
      if (!active || error) return;
      const rows = (data ?? []) as ExpiringRow[];
      const mine = rows.find((r) => r.id === session.campaign?.id) ?? null;
      setInfo(mine);
    }

    void load();
    return () => {
      active = false;
    };
  }, [session?.campaign?.id, session?.campaign?.status, session?.is_super_admin]);

  async function onGenerate() {
    if (!session?.campaign) return;
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment', {
        body: { campaign_id: session.campaign.id, plan, billing_type: billing },
      });
      if (error) {
        // tenta extrair a mensagem do corpo do erro
        let msg = error.message;
        try {
          const resp = (error as { context?: { response?: Response } }).context?.response;
          if (resp) {
            const b = await resp.clone().json();
            if (b?.error) msg = b.error;
          }
        } catch {
          /* ignore */
        }
        toast.error(`Falha ao gerar pagamento: ${msg}`);
        return;
      }
      const payload = data as { ok?: boolean; error?: string; payment_link?: string };
      if (payload.error || !payload.payment_link) {
        toast.error(payload.error ?? 'Não foi possível gerar o link de pagamento.');
        return;
      }
      setGeneratedLink(payload.payment_link);
      window.open(payload.payment_link, '_blank', 'noopener');
      toast.success('Link aberto em nova aba. Após o pagamento sua conta é ativada automaticamente.');
    } finally {
      setGenerating(false);
    }
  }

  if (!info) return null;

  const urgent = info.days_remaining <= 3;
  const color = urgent
    ? 'border-red-500/40 bg-red-500/10 text-red-200'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  const Icon = urgent ? AlertTriangle : Clock;

  return (
    <>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${color}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span>
            {info.days_remaining === 0
              ? 'Seu trial expira ainda hoje. Assine para não perder acesso.'
              : info.days_remaining === 1
                ? 'Seu trial expira amanhã. Assine para não perder acesso.'
                : `Seu trial expira em ${info.days_remaining} dias.`}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1 border-current px-2.5 text-xs"
          onClick={() => setOpen(true)}
        >
          Assinar agora
          <Rocket className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" /> Assine o Vórtice
            </SheetTitle>
            <SheetDescription>
              Escolha o plano para continuar após o trial. A ativação é automática após o
              pagamento.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5">
            <PlanCards value={plan} onChange={setPlan} compact />

            <div className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3 text-sm">
              Plano selecionado:{' '}
              <strong className="text-foreground">{formatPlanPrice(plan)}/mês</strong>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Forma de pagamento
              </p>
              <RadioOption
                selected={billing === 'CREDIT_CARD'}
                onSelect={() => setBilling('CREDIT_CARD')}
                title="Cartão de crédito"
                description="Cobrança recorrente automática todo mês."
              />
              <RadioOption
                selected={billing === 'PIX'}
                onSelect={() => setBilling('PIX')}
                title="PIX"
                description="Pagamento manual a cada 30 dias."
              />
            </div>

            {generatedLink ? (
              <a
                href={generatedLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Link aberto em nova aba — clique aqui se não abriu <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}

            <Button className="w-full" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {generating ? 'Gerando…' : 'Gerar link de pagamento'}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              Ao confirmar, você é direcionado à página segura de pagamento do Asaas. Após
              a confirmação, sua conta é ativada automaticamente.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

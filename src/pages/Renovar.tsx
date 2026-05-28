import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  LifeBuoy,
  Loader2,
  LogOut,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { VorticeLogo } from '@/components/brand/VorticeLogo';
import { PlanCards, RadioOption } from '@/components/billing/PlanCards';
import { formatPlanPrice } from '@/lib/plans';
import type { CampaignPlan } from '@/types';

type BillingType = 'CREDIT_CARD' | 'PIX';

// Tela de renovação/regularização. Para onde o ProtectedRoute manda qualquer
// usuário (não super admin) cuja campanha esteja `suspended` (assinatura
// venceu) ou `pending` (1º pagamento ainda não confirmado). Trava o resto do
// app — só dá pra renovar ou sair. Reusa generate-payment + PlanCards, mesmo
// padrão do TrialBanner.
export default function RenovarPage() {
  const { session, signOut } = useAuth();

  const [plan, setPlan] = useState<CampaignPlan>('intermediario');
  const [billing, setBilling] = useState<BillingType>('CREDIT_CARD');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);

  // Pré-seleciona o plano atual da campanha (se houver).
  useEffect(() => {
    if (session?.campaign?.plan) setPlan(session.campaign.plan);
  }, [session?.campaign?.plan]);

  // E-mail de suporte (config global da Vórtice) pro link de ajuda.
  useEffect(() => {
    let active = true;
    async function loadSupport() {
      if (USE_MOCKS) return;
      const { data } = await supabase
        .from('app_settings')
        .select('support_email')
        .eq('id', 1)
        .maybeSingle();
      if (active && data?.support_email) setSupportEmail(data.support_email as string);
    }
    void loadSupport();
    return () => {
      active = false;
    };
  }, []);

  if (!session) return <Navigate to="/login" replace />;
  // Sem campanha vinculada não é caso de renovação.
  if (!session.campaign) {
    return (
      <Navigate to={session.is_super_admin ? '/dashboard' : '/aguardando-ativacao'} replace />
    );
  }
  // Já regularizou (active/trial) → volta pro app.
  const status = session.campaign.status;
  if (status !== 'suspended' && status !== 'pending') {
    return <Navigate to="/dashboard" replace />;
  }

  const isPending = status === 'pending';

  async function onGenerate() {
    if (!session?.campaign) return;
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment', {
        body: { campaign_id: session.campaign.id, plan, billing_type: billing },
      });
      if (error) {
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
      toast.success(
        'Link aberto em nova aba. Após o pagamento sua conta é reativada automaticamente.',
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-vortex-surface/40 vortex-glow">
            <VorticeLogo size={44} />
          </div>
        </div>

        <div className="rounded-2xl border border-vortex-border bg-vortex-surface/70 p-6 backdrop-blur sm:p-8">
          {/* Cabeçalho de status — muda entre suspensa e pendente */}
          {isPending ? (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-300" />
                <p className="text-base font-semibold text-amber-100">Pagamento pendente</p>
              </div>
              <p className="text-sm text-amber-100/90">
                Sua campanha <strong>{session.campaign.candidate_name}</strong> foi criada, mas o
                pagamento ainda não foi confirmado. Conclua o pagamento abaixo para liberar o
                acesso completo à plataforma.
              </p>
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                <p className="text-base font-semibold text-red-100">Acesso suspenso</p>
              </div>
              <p className="text-sm text-red-100/90">
                A assinatura da campanha <strong>{session.campaign.candidate_name}</strong>{' '}
                venceu. Todos os seus dados estão preservados — renove abaixo para retomar o
                acesso imediatamente.
              </p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Escolha o plano
              </p>
              <PlanCards value={plan} onChange={setPlan} compact />
            </div>

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
                Link aberto em nova aba — clique aqui se não abriu{' '}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}

            <Button className="w-full" size="lg" onClick={onGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {generating
                ? 'Gerando…'
                : isPending
                  ? 'Pagar agora'
                  : 'Renovar agora'}
            </Button>

            <div className="flex items-start gap-2 rounded-lg border border-vortex-border bg-vortex-bg/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Você é direcionado à página segura de pagamento do Asaas. Após a confirmação, sua
                conta é reativada automaticamente em até 5 minutos.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4" /> Já paguei, atualizar
              </Button>
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <LifeBuoy className="h-3.5 w-3.5" /> Falar com o suporte
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 border-t border-vortex-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut className="h-4 w-4" /> Sair da conta
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Seus dados ficam preservados durante a suspensão · powered by Vórtice
        </p>
      </div>
    </div>
  );
}

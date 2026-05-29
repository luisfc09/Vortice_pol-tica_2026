import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  UserCheck,
  ClipboardList,
  Megaphone,
  Calendar,
  AlertTriangle,
  Save,
  Shield,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { initials } from '@/lib/utils';
import { useViewAsStore } from '@/stores/viewAs';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CAMPAIGN_STATUS_LABEL,
  ROLE_LABEL,
  type Campaign,
  type CampaignDetail,
  type CampaignStatus,
  type CampaignPlan,
} from '@/types';
import { PLANS, PLAN_ORDER } from '@/lib/plans';

const NUM = new Intl.NumberFormat('pt-BR');

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  trial: 'secondary',
  active: 'default',
  suspended: 'warning',
  cancelled: 'destructive',
  pending: 'warning',
};

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const enterViewAs = useViewAsStore((s) => s.enter);
  const viewAsId = useViewAsStore((s) => s.campaign?.id ?? null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({
    status: 'active' as CampaignStatus,
    plan: 'basico' as CampaignPlan,
    vote_target: '0',
    slogan: '',
    notes: '',
    trial_ends_at: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_campaign_detail', { p_campaign_id: id });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const d = data as CampaignDetail | null;
    setDetail(d);
    if (d) {
      setEditing({
        status: d.campaign.status,
        plan: d.campaign.plan,
        vote_target: String(d.campaign.vote_target ?? 0),
        slogan: d.campaign.slogan ?? '',
        notes: d.campaign.notes ?? '',
        trial_ends_at: d.campaign.trial_ends_at
          ? d.campaign.trial_ends_at.slice(0, 10)
          : '',
      });
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function enterAsClient() {
    if (!detail) return;
    // Busca a linha completa da campanha (garante o shape de Campaign p/ o
    // banner do view-as: candidate_name, plan, etc.).
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', detail.campaign.id)
      .single();
    if (error || !data) {
      toast.error(`Falha ao entrar como cliente: ${error?.message ?? 'sem dados'}`);
      return;
    }
    enterViewAs(data as Campaign);
    toast.success(`Visualizando como ${data.candidate_name}.`);
    navigate('/dashboard');
  }

  async function save() {
    if (!detail) return;
    setSaving(true);
    const { error } = await supabase
      .from('campaigns')
      .update({
        status: editing.status,
        plan: editing.plan,
        vote_target: Number(editing.vote_target) || 0,
        slogan: editing.slogan || null,
        notes: editing.notes || null,
        trial_ends_at: editing.trial_ends_at
          ? new Date(editing.trial_ends_at).toISOString()
          : null,
      })
      .eq('id', detail.campaign.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Campanha atualizada.');
    void load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando campanha...</p>;
  }
  if (!detail) {
    return (
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/campaigns">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  const c = detail.campaign;
  const m = detail.metrics;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/admin/campaigns">
              <ArrowLeft className="h-4 w-4" /> Todas as campanhas
            </Link>
          </Button>
          <div className="mb-1 flex items-center gap-2">
            <Shield className="h-4 w-4 text-vortex-violet" />
            <span className="text-xs uppercase tracking-widest text-vortex-violet">
              Admin Vórtice
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            {c.candidate_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {c.party} {c.party_number} · {c.office} {c.state} {c.election_year} · Criada{' '}
            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[c.status]} className="h-fit">
            {CAMPAIGN_STATUS_LABEL[c.status]}
          </Badge>
          <Button
            size="sm"
            variant={c.id === viewAsId ? 'default' : 'outline'}
            onClick={() => void enterAsClient()}
            title="Visualizar o sistema como admin desta campanha"
          >
            <Eye className="h-3.5 w-3.5" />
            {c.id === viewAsId ? 'Continuar vendo' : 'Ver como cliente'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric label="Membros" value={detail.members.filter((mm) => mm.is_active).length} icon={Users} />
        <Metric label="Lideranças" value={m.supporters_count} icon={Users} accent="lime" />
        <Metric label="Eleitores" value={m.voters_count} icon={UserCheck} accent="violet" />
        <Metric label="Entrevistas" value={m.interviews_count} icon={ClipboardList} accent="sky" />
        <Metric label="Eventos" value={m.events_count} icon={Calendar} accent="amber" />
        <Metric label="Alertas abertos" value={m.alerts_open} icon={AlertTriangle} accent="red" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="team">Equipe ({detail.members.length})</TabsTrigger>
          <TabsTrigger value="settings">Edição</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Info
              icon={<Building2 className="h-4 w-4 text-primary" />}
              title="Dados básicos"
              rows={[
                ['Nome interno', c.name],
                ['Candidato', c.candidate_name],
                ['Partido', `${c.party} (${c.party_number})`],
                ['Cargo', c.office],
                ['UF', c.state],
                ['Ano', String(c.election_year)],
              ]}
            />
            <Info
              icon={<Megaphone className="h-4 w-4 text-vortex-violet" />}
              title="Configuração"
              rows={[
                ['Meta de votos', NUM.format(c.vote_target)],
                ['Slogan', c.slogan ?? '—'],
                ['Status', CAMPAIGN_STATUS_LABEL[c.status]],
                [
                  'Trial até',
                  c.trial_ends_at
                    ? format(new Date(c.trial_ends_at), 'dd/MM/yyyy')
                    : '—',
                ],
                ['Notas internas', c.notes ?? '—'],
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="team">
          {detail.members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/30 p-6 text-center text-sm text-muted-foreground">
              Nenhum membro vinculado a esta campanha.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.members.map((mm) => {
                const name = mm.profile?.full_name ?? mm.email ?? mm.user_id.slice(-6);
                return (
                  <li
                    key={mm.id}
                    className="flex flex-col gap-3 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur sm:flex-row sm:items-center"
                  >
                    <Avatar>
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{name}</p>
                        <Badge variant={mm.is_active ? 'default' : 'destructive'}>
                          {mm.is_active ? 'Ativo' : 'Desativado'}
                        </Badge>
                        <Badge variant="outline">{ROLE_LABEL[mm.role]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {mm.email ?? 'sem e-mail'} ·{' '}
                        {mm.profile?.phone ?? 'sem telefone'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>
                        Último acesso:{' '}
                        {mm.last_sign_in_at
                          ? formatDistanceToNow(new Date(mm.last_sign_in_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : 'nunca'}
                      </p>
                      <p>
                        Membro desde{' '}
                        {format(new Date(mm.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
            <p className="mb-4 text-xs text-muted-foreground">
              Edição limitada do super admin. Para mudar dados básicos (candidato, partido,
              cargo) entre em contato com o admin do cliente.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing((s) => ({ ...s, status: v as CampaignStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[]).map((st) => (
                      <SelectItem key={st} value={st}>
                        {CAMPAIGN_STATUS_LABEL[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={editing.plan}
                  onValueChange={(v) => setEditing((s) => ({ ...s, plan: v as CampaignPlan }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLANS[p].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote_target">Meta de votos</Label>
                <Input
                  id="vote_target"
                  inputMode="numeric"
                  value={editing.vote_target}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...s,
                      vote_target: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trial_ends_at">Trial até</Label>
                <Input
                  id="trial_ends_at"
                  type="date"
                  value={editing.trial_ends_at}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, trial_ends_at: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="slogan">Slogan da campanha</Label>
                <Input
                  id="slogan"
                  value={editing.slogan}
                  onChange={(e) => setEditing((s) => ({ ...s, slogan: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas internas Vórtice (não visível ao cliente)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={editing.notes}
                  onChange={(e) => setEditing((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Histórico de contato, motivo da suspensão, etc."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'lime' | 'violet' | 'sky' | 'amber' | 'red';
}

const ACCENT: Record<NonNullable<MetricProps['accent']>, string> = {
  lime: 'text-vortex-lime bg-vortex-lime/10',
  violet: 'text-vortex-violet bg-vortex-violet/15',
  sky: 'text-sky-300 bg-sky-500/10',
  amber: 'text-amber-300 bg-amber-500/10',
  red: 'text-red-300 bg-red-500/10',
};

function Metric({ label, value, icon: Icon, accent = 'violet' }: MetricProps) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ACCENT[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="font-display text-2xl tracking-wide text-foreground">{value}</p>
    </div>
  );
}

interface InfoProps {
  icon: React.ReactNode;
  title: string;
  rows: Array<[string, string]>;
}

function Info({ icon, title, rows }: InfoProps) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
